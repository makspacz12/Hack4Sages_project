/**
 * The planets must not be tinted on top of their own textures.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import sim from '../public/data/cosmos_visualizer_simulation.json';
import {
  displayHelioDistanceAU, sunRadiusAU,
} from '../src/sceneScale.js';

const src = await readFile(new URL('../src/shaderMaterial.js', import.meta.url), 'utf8');
const scaleSrc = await readFile(new URL('../src/sceneScale.js', import.meta.url), 'utf8');
const mainSrc = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

function parseConst(name, text = scaleSrc) {
  const raw = text.match(new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*([^;\\n]+)`))?.[1]?.trim();
  if (!raw) return NaN;
  if (raw.includes('/')) {
    const [a, b] = raw.split('/').map(s => Number(s.trim()));
    return a / b;
  }
  return Number(raw);
}

function sunRadiusM(objects) {
  const r = objects.find(o => o.id === 'sun')?.info?.Radius?.value;
  return Number.isFinite(r) && r > 0 ? r : 695_709_902;
}

function drawRelative(rMetres, sunR, sunDrawn, exp) {
  return sunDrawn * (rMetres / sunR) ** exp;
}

describe('planet shading', () => {
  it('never multiplies a sampled texture by the identity tint', () => {
    const offending = src.match(/texture2D\s*\([^)]*\)\s*\.rgb\s*\*\s*uColor/g);
    expect(offending).toBeNull();
  });

  it('keeps the flat colour as the no-texture fallback', () => {
    expect(src).toMatch(/uHasMap\s*>\s*0\.5[\s\S]{0,200}:\s*uColor/);
  });

  it('lights from the Sun world position in world space', () => {
    expect(src).toMatch(/uniform\s+vec3\s+uSunPos/);
    expect(src).toMatch(/normalize\(uSunPos\s*-\s*vWorldPos\)/);
    expect(src).toMatch(/dot\(vWorldNormal,\s*toSun\)/);
    expect(src).toMatch(/vWorldNormal\s*=\s*normalize\(mat3\(modelMatrix\)/);
  });

  it('does not add camera-facing fill light', () => {
    expect(src).not.toMatch(/float\s+fill\s*=/);
  });

  it('uses sun-hemisphere ambient instead of a flat wash', () => {
    expect(src).toMatch(/hemiAmbient/);
    expect(src).toMatch(/smoothstep\([^)]*ci\)/);
  });

  it('keeps an ambient floor low enough to preserve the terminator', () => {
    expect(src).toMatch(/mix\(0\.045,\s*0\.14/);
  });
});

describe('body exaggeration stays honest', () => {
  it('keeps the Sun well inside Mercury\'s orbit', () => {
    const sun = parseConst('SUN_R');
    const frame = sim.frames[0];
    const origin = frame.positions.find(p => p.id === 'sun');
    const mercury = frame.positions.find(p => p.id === 'planet_mercury');
    const dAU = Math.hypot(
      mercury.x - origin.x, mercury.y - origin.y, mercury.z - origin.z);
    const orbit = displayHelioDistanceAU(dAU, sunRadiusAU(sim.objects));
    expect(sun).toBeLessThan(orbit * 0.6);
  });

  it('draws every planet with a cube-root ratio to the Sun', () => {
    const sunDrawn = parseConst('SUN_R');
    const exp = parseConst('DEFAULT_RATIO_EXPONENT');
    expect(exp).toBeCloseTo(1 / 3, 9);

    const sunR = sunRadiusM(sim.objects);
    const drawn = (id) => {
      const r = sim.objects.find(o => o.id === id)?.info?.Radius?.value;
      return drawRelative(r, sunR, sunDrawn, exp);
    };

    const realRatio = (id) =>
      sim.objects.find(o => o.id === id)?.info?.Radius?.value / sunR;
    const jupMerReal = realRatio('planet_jupiter') / realRatio('planet_mercury');
    const jupMerVis = drawn('planet_jupiter') / drawn('planet_mercury');
    expect(jupMerVis).toBeCloseTo(jupMerReal ** exp, 6);
    expect(jupMerVis).toBeLessThan(jupMerReal);
    expect(drawn('planet_jupiter')).toBeLessThan(sunDrawn);
    expect(drawn('planet_saturn')).toBeLessThan(sunDrawn);
    expect(drawn('planet_mercury')).toBeLessThan(drawn('planet_jupiter'));
  });

  it('keeps Mercury visible at the default framing', () => {
    const sunDrawn = parseConst('SUN_R');
    const exp = parseConst('DEFAULT_RATIO_EXPONENT');
    const sunR = sunRadiusM(sim.objects);
    const mercuryR = sim.objects.find(o => o.id === 'planet_mercury').info.Radius.value;
    const world = drawRelative(mercuryR, sunR, sunDrawn, exp);
    expect(2 * world * 0.817).toBeGreaterThan(1.5);
  });
});

describe('backscattering is applied only where it is physical', () => {
  it('implements the Lommel-Seeliger disk function', () => {
    expect(src).toMatch(/ci\s*\/\s*max\s*\(\s*ci\s*\+\s*ce/);
  });

  it('keeps it switchable, so gas giants stay Lambertian', () => {
    expect(src).toMatch(/uniform\s+float\s+uAirless/);
    expect(src).toMatch(/mix\s*\(\s*ci\s*,/);
  });

  it('marks the rocky bodies airless and nothing else', async () => {
    const factory = await readFile(new URL('../src/objectFactory.js', import.meta.url), 'utf8');
    const set = factory.match(/const AIRLESS = new Set\(\[([^\]]*)\]\)/)?.[1] ?? '';
    expect(set).toContain('planet_mercury');
    expect(set).toContain('planet_mars');
    for (const gas of ['jupiter', 'saturn', 'uranus', 'neptune', 'venus']) {
      expect(set).not.toContain(gas);
    }
    expect(factory).toMatch(/Boolean\(rockType\)/);
  });
});

describe('fragment sizing', () => {
  function fragRadii() {
    const out = new Map();
    for (const f of sim.frames) {
      for (const p of f.properties ?? []) {
        if (p?.id?.startsWith('asteroid_') && p.radius > 0 && !out.has(p.id)) {
          out.set(p.id, p.radius);
        }
      }
    }
    return out;
  }

  function modelFragmentDraw() {
    const sunDrawn = parseConst('SUN_R');
    const exp = parseConst('DEFAULT_RATIO_EXPONENT');
    const frac = parseConst('FRAGMENT_MAX_MERCURY_FRACTION');
    const sunR = sunRadiusM(sim.objects);
    const mercuryR = sim.objects.find(o => o.id === 'planet_mercury').info.Radius.value;
    const mercuryDrawn = drawRelative(mercuryR, sunR, sunDrawn, exp);
    const cap = mercuryDrawn * frac;
    const radii = fragRadii();
    const physical = r => drawRelative(r, sunR, sunDrawn, exp);
    const maxP = Math.max(...[...radii.values()].map(physical));
    const boost = cap / maxP;
    return { draw: id => physical(radii.get(id)) * boost, cap, mercuryDrawn, radii };
  }

  it('does not use the old 8e11 fragment multiplier', () => {
    expect(scaleSrc).not.toMatch(/FRAGMENT_EXAGGERATION/);
    expect(mainSrc).not.toMatch(/8e11/);
  });

  it('preserves fragment ratios after the uniform boost', () => {
    const exp = parseConst('DEFAULT_RATIO_EXPONENT');
    const { draw, radii } = modelFragmentDraw();
    const entries = [...radii.entries()].sort((a, b) => a[1] - b[1]);
    const largest = entries.at(-1);
    const mid = entries.find(([, r], i) => i > 0 && i < entries.length - 1);
    expect(mid).toBeDefined();
    const linearRatio = largest[1] / mid[1];
    expect(draw(largest[0]) / draw(mid[0])).toBeCloseTo(linearRatio ** exp, 5);
  });

  it('caps the largest fragment near one third of Mercury', () => {
    const { draw, cap, mercuryDrawn, radii } = modelFragmentDraw();
    const largestId = [...radii.entries()].sort((a, b) => b[1] - a[1])[0][0];
    expect(draw(largestId)).toBeCloseTo(cap, 6);
    expect(draw(largestId)).toBeLessThan(mercuryDrawn);
    expect(draw(largestId)).toBeGreaterThan(mercuryDrawn * 0.2);
  });

  it('keeps every fragment smaller than Mercury', () => {
    const { draw, mercuryDrawn, radii } = modelFragmentDraw();
    for (const id of radii.keys()) {
      expect(draw(id)).toBeLessThan(mercuryDrawn);
    }
  });
});
