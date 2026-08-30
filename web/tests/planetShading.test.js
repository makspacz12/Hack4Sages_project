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

  it('draws Jupiter larger than Mercury', async () => {
    const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
    const lo = Number(main.match(/const\s+PLANET_R_MIN\s*=\s*([0-9.]+)/)?.[1]);
    const hi = Number(main.match(/const\s+PLANET_R_MAX\s*=\s*([0-9.]+)/)?.[1]);
    expect(hi).toBeGreaterThan(lo);
  });
});
