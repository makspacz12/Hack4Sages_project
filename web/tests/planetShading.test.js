/**
 * The planets must not be tinted on top of their own textures.
 *
 * The surface maps already carry each body's real colour. Multiplying them by
 * a saturated identity tint was colour times colour, and it destroyed them:
 * measured against the shipped maps, Earth's mean 84,101,130 came out
 * 29,101,214 - the red channel annihilated, so continents could not appear -
 * while Uranus, Saturn, Jupiter and Venus clipped to white. Seven of nine
 * bodies were either blown out or missing a channel.
 *
 * The Sun escaped by coincidence: its #FFD580 nearly matches its own texture,
 * so for that one body the multiply was close to a no-op. That accident is the
 * whole reason the Sun looked right while the planets looked like grey mud,
 * and it is why this regression is easy to reintroduce - the scene does not
 * look obviously broken, it just looks bad.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import sim from '../public/data/cosmos_visualizer_simulation.json';

const src = await readFile(new URL('../src/shaderMaterial.js', import.meta.url), 'utf8');

describe('planet shading', () => {
  it('never multiplies a sampled texture by the identity tint', () => {
    // Any `texture2D(...) * uColor` is the bug, in either shader.
    const offending = src.match(/texture2D\s*\([^)]*\)\s*\.rgb\s*\*\s*uColor/g);
    expect(offending).toBeNull();
  });

  it('keeps the flat colour as the no-texture fallback', () => {
    // The tint must still be what a failed texture load degrades to, so a
    // missing file costs nobody the rest of the visualisation.
    expect(src).toMatch(/uHasMap\s*>\s*0\.5[\s\S]{0,200}:\s*uColor/);
  });

  it('lights the hemisphere the camera actually sees', () => {
    // The Sun sits at the origin and lights outward, but the default camera
    // looks inward from beyond the swarm, so the visible hemisphere is every
    // planet's night side. Without a real fill term the scene is a bright Sun
    // ringed by black discs.
    const m = src.match(/float\s+fill\s*=[^;]*?\*\s*([0-9.]+)\s*;/);
    expect(m, 'a fill term must exist').toBeTruthy();
    expect(Number(m[1])).toBeGreaterThanOrEqual(0.25);
  });

  it('keeps an ambient floor low enough to preserve the terminator', () => {
    // The day/night boundary is what makes a sphere read as a sphere. A high
    // floor flattens every body into a disc.
    const m = src.match(/float\s+ambient\s*=\s*([0-9.]+)\s*;/);
    expect(m).toBeTruthy();
    expect(Number(m[1])).toBeLessThanOrEqual(0.2);
  });
});

/**
 * The exaggeration must not misrepresent the system's structure.
 *
 * Drawing the bodies larger than scale is necessary and is captioned on screen.
 * Drawing the Sun larger than the orbit it sits inside is a different thing: it
 * would make the scene assert something false about the Solar System. An
 * earlier pass had SUN_R at 44 world units against Mercury's orbital radius of
 * 28, so the Sun engulfed the orbit of the innermost planet.
 */
describe('body exaggeration stays honest', () => {
  it('keeps the Sun well inside Mercury\'s orbit', async () => {
    const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
    const sun = Number(main.match(/const\s+SUN_R\s*=\s*([0-9.]+)/)?.[1]);
    expect(Number.isFinite(sun)).toBe(true);

    const replay = JSON.parse(await readFile(
      new URL('../public/data/cosmos_visualizer_simulation.json', import.meta.url), 'utf8'));
    const scale = replay.meta.positionScale;
    const frame = replay.frames[0];
    const origin = frame.positions.find(p => p.id === 'sun');
    const mercury = frame.positions.find(p => p.id === 'planet_mercury');
    const orbit = Math.hypot(
      mercury.x - origin.x, mercury.y - origin.y, mercury.z - origin.z) * scale;

    expect(sun).toBeLessThan(orbit * 0.6);
  });

  it('draws every planet at the same exaggeration, so the ratios are true', async () => {
    /*
     * The sizes used to be remapped onto a 5 to 11 unit band through a cube
     * root, which kept the ordering and destroyed the proportions: Jupiter is
     * 29.3 times Mercury's radius and was drawn 2.2 times its size. A single
     * multiplier is what makes every ratio between bodies exactly right, and
     * it is the only property here worth defending.
     */
    const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
    expect(main).toMatch(/const\s+BODY_EXAGGERATION\s*=\s*\d+/);
    // No remapping function may survive: a cube root here would silently
    // reintroduce the compression.
    const sizing = main.slice(main.indexOf('function planetRadii'),
                              main.indexOf('function planetRadii') + 500);
    expect(sizing).not.toMatch(/cbrt/);
  });

  it('reproduces the true radius ratios from the replay', async () => {
    const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
    const k = Number(main.match(/const\s+BODY_EXAGGERATION\s*=\s*(\d+)/)?.[1]);
    const KM_PER_AU = 149597870.7;
    const scale = sim.meta.positionScale;

    const drawn = (id) => {
      const obj = sim.objects.find(o => o.id === id);
      const rMetres = obj?.info?.Radius?.value;
      return ((rMetres / 1000) / KM_PER_AU) * scale * k;
    };
    const trueR = (id) =>
      sim.objects.find(o => o.id === id)?.info?.Radius?.value;

    const drawnRatio = drawn('planet_jupiter') / drawn('planet_mercury');
    const realRatio = trueR('planet_jupiter') / trueR('planet_mercury');
    // Exactly, not approximately: one multiplier cancels in a ratio.
    expect(drawnRatio).toBeCloseTo(realRatio, 9);
    expect(realRatio).toBeGreaterThan(29);
  });

  it('keeps the smallest planet above one pixel', async () => {
    // Below this the exaggeration buys nothing: Mercury becomes a single
    // pixel and the proportions it was fixed to show are invisible anyway.
    const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
    const k = Number(main.match(/const\s+BODY_EXAGGERATION\s*=\s*(\d+)/)?.[1]);
    const KM_PER_AU = 149597870.7;
    const mercury = sim.objects.find(o => o.id === 'planet_mercury');
    const world = ((mercury.info.Radius.value / 1000) / KM_PER_AU)
      * sim.meta.positionScale * k;
    // 0.817 pixels per world unit, measured at the default framing.
    expect(2 * world * 0.817).toBeGreaterThan(1.5);
  });
});

/**
 * Airless bodies backscatter; gas giants do not.
 *
 * Regolith returns light toward its source, so a real asteroid or Mercury
 * stays evenly bright almost to the terminator and then falls off sharply,
 * while a Lambertian sphere fades smoothly from the middle and reads as a
 * billiard ball. Measured on Bennu the Lunar-Lambert partition is
 * L(a) = exp(-0.009a), i.e. L(0) = 1.0 - pure Lommel-Seeliger at low phase,
 * with the independent Minnaert fit agreeing at k = 0.530.
 *   Golish et al. 2021, Icarus 357, 113724
 *
 * The claim has to stay bounded to bodies it is true of: Jupiter has no
 * surface, and Venus is seen as its cloud deck.
 */
describe('backscattering is applied only where it is physical', () => {
  it('implements the Lommel-Seeliger disk function', () => {
    // ci / (ci + ce) is the whole law; without the view term it is not it.
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
    // A gas giant here would be asserting a surface that does not exist.
    for (const gas of ['jupiter', 'saturn', 'uranus', 'neptune', 'venus']) {
      expect(set).not.toContain(gas);
    }
    // Every fragment is airless rock, whatever its type.
    expect(factory).toMatch(/Boolean\(rockType\)/);
  });
});

/**
 * Fragment size encodes fragment radius.
 *
 * Every fragment used to be drawn at the same 0.18 world units, so a 57.5 mm
 * boulder and a 1.3 mm grain were the same dot - throwing away the variable
 * the shielding argument turns on. GCR attenuation depth is about half a
 * metre, so size decides whether rock protects the cargo at all.
 */
describe('fragment sizing', () => {
  const KM_PER_AU = 149597870.7;

  async function constants() {
    const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
    return {
      body: Number(main.match(/const\s+BODY_EXAGGERATION\s*=\s*([\d.e+]+)/)?.[1]),
      frag: Number(main.match(/const\s+FRAGMENT_EXAGGERATION\s*=\s*([\d.e+]+)/)?.[1]),
      floor: Number(main.match(/const\s+FRAGMENT_FLOOR\s*=\s*([\d.]+)/)?.[1]),
      src: main,
    };
  }

  function fragRadii() {
    const out = new Map();
    for (const f of sim.frames) {
      for (const p of f.properties ?? []) {
        if (p?.id?.startsWith('asteroid_') && p.radius > 0 && !out.has(p.id)) {
          out.set(p.id, p.radius);
        }
      }
    }
    return [...out.values()];
  }

  it('scales fragments by one factor, so their ratios are true', async () => {
    /*
     * A log remap onto a fixed band compressed a real 44.2 to 1 span into
     * 2.6 to 1. One multiplier cancels in a ratio, so the proportion between
     * any two fragments is exactly what the model computed.
     */
    const { frag, src } = await constants();
    expect(Number.isFinite(frag)).toBe(true);
    const sizing = src.slice(src.indexOf('function fragmentRadii'),
                             src.indexOf('function fragmentRadii') + 900);
    expect(sizing).not.toMatch(/Math\.log10/);
  });

  it('preserves the true ratio between the largest and smallest fragment', async () => {
    const { frag, floor } = await constants();
    const radii = fragRadii().sort((a, b) => a - b);
    const scale = sim.meta.positionScale;
    const world = r => Math.max(floor, ((r / 1000) / KM_PER_AU) * scale * frag);

    const largest = world(radii.at(-1));
    // Take a fragment comfortably above the visibility floor, so the ratio
    // being checked is the scaled one rather than the clamped one.
    const mid = radii.find(r => ((r / 1000) / KM_PER_AU) * scale * frag > floor * 2);
    expect(mid).toBeDefined();
    expect(largest / world(mid)).toBeCloseTo(radii.at(-1) / mid, 6);
  });

  it('keeps most fragments off the visibility floor, so size still reads', async () => {
    /*
     * The previous rule was that no fragment may be drawn larger than the
     * smallest planet. With the planets on true proportions Mercury is 2.1
     * pixels, and enforcing that put all fourteen fragments on the floor:
     * every one the same dot, which is the defect the size scaling exists to
     * prevent. The rule that replaces it is the one that matters, that the
     * sizes carry information.
     */
    const { frag, floor } = await constants();
    const scale = sim.meta.positionScale;
    const radii = fragRadii();
    const clamped = radii.filter(
      r => ((r / 1000) / KM_PER_AU) * scale * frag < floor).length;
    expect(clamped).toBeLessThan(radii.length / 2);
  });

  it('draws even the smallest fragment, via an explicit floor', async () => {
    // The floor is the one place a size is not proportional. It exists so the
    // smallest fragment does not vanish and take the size argument with it,
    // and it is named rather than folded into the scale.
    const { frag, floor } = await constants();
    const scale = sim.meta.positionScale;
    // The floor must be low enough that it catches only the few fragments too
    // small to draw, and high enough that those are still visible. At the
    // current scale two of fourteen sit on it.
    const world = r => ((r / 1000) / KM_PER_AU) * scale * frag;
    const onFloor = fragRadii().filter(r => world(r) < floor).length;
    expect(onFloor).toBeGreaterThanOrEqual(0);
    expect(onFloor).toBeLessThan(4);
    // Whatever lands on it is still drawn: about 0.6 px at the measured
    // 0.817 pixels per world unit.
    expect(2 * floor * 0.817).toBeGreaterThan(0.5);
  });
});
