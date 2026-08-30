/**
 * The orbital clock.
 *
 * The replay samples every 20 years while the fragments orbit in 1.8 to 3.8,
 * so one frame gap is about eight revolutions and no transport speed makes
 * orbital motion legible - at the slowest setting an orbit still completes in
 * 0.12 seconds. This clock runs the geometry at a rate the eye can follow
 * while the dose readout keeps the transport's own time, which is sound
 * because dose is a straight line to 0.19% while orbits are periodic in years.
 */

import { describe, it, expect } from 'vitest';
import {
  createOrbitalClock, tickOrbitalClock, resetOrbitalClock, applyOrbitalClock,
  DEFAULT_ORBITAL_RATE,
} from '../src/orbitalClock.js';
import sim from '../public/data/cosmos_visualizer_simulation.json';

function meshes(frame) {
  const m = new Map();
  for (const p of frame.positions ?? []) {
    m.set(p.id, { position: { x: 0, y: 0, z: 0,
      set(x, y, z) { this.x = x; this.y = y; this.z = z; } } });
  }
  return m;
}

describe('orbital clock', () => {
  const frame = sim.frames[0];

  it('advances only while playing', () => {
    const c = createOrbitalClock();
    tickOrbitalClock(c, 1, false);
    expect(c.years).toBe(0);
    tickOrbitalClock(c, 1, true);
    expect(c.years).toBeCloseTo(DEFAULT_ORBITAL_RATE, 9);
  });

  it('runs an orbit at a rate a person can actually follow', () => {
    // The median fragment has a period near 2.4 years. At the default rate one
    // orbit must take a meaningful fraction of a second - not the 0.004 s the
    // transport gives at 30 steps/s, and not so slow it looks frozen.
    const secondsPerOrbit = 2.4 / DEFAULT_ORBITAL_RATE;
    expect(secondsPerOrbit).toBeGreaterThan(0.3);
    expect(secondsPerOrbit).toBeLessThan(3);
  });

  it('actually moves the bodies', () => {
    const c = createOrbitalClock();
    resetOrbitalClock(c, 0);
    const m = meshes(frame);
    applyOrbitalClock(c, frame, m, 1);
    const before = { ...m.get('asteroid_003').position };
    c.years = 0.6;                       // a quarter of a typical orbit
    applyOrbitalClock(c, frame, m, 1);
    const after = m.get('asteroid_003').position;
    const moved = Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z);
    expect(moved).toBeGreaterThan(0.1);
  });

  it('returns a body to where it started after one full period', () => {
    const c = createOrbitalClock();
    resetOrbitalClock(c, 0);
    const m = meshes(frame);
    applyOrbitalClock(c, frame, m, 1);
    const start = { ...m.get('asteroid_003').position };
    const el = c._elements.get('asteroid_003');
    expect(el).toBeTruthy();
    c.years = el.period;
    applyOrbitalClock(c, frame, m, 1);
    const end = m.get('asteroid_003').position;
    expect(Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z)).toBeLessThan(1e-6);
  });

  it('leaves the Sun at the origin of the motion, not on an orbit', () => {
    const c = createOrbitalClock();
    resetOrbitalClock(c, 0);
    const m = meshes(frame);
    c.years = 5;
    applyOrbitalClock(c, frame, m, 1);
    const sun = frame.positions.find(p => p.id === 'sun');
    const drawn = m.get('sun').position;
    expect(drawn.x).toBeCloseTo(sun.x, 12);
    expect(drawn.y).toBeCloseTo(sun.y, 12);
  });

  it('leaves the outlier at its sampled position rather than guessing', () => {
    // asteroid_011 sits at a = 17.7 AU and is perturbed hard by Jupiter; a
    // two-body step does not describe it.
    const c = createOrbitalClock();
    resetOrbitalClock(c, 0);
    const m = meshes(frame);
    c.years = 40;
    applyOrbitalClock(c, frame, m, 1);
    const sampled = frame.positions.find(p => p.id === 'asteroid_011');
    const drawn = m.get('asteroid_011').position;
    expect(drawn.x).toBeCloseTo(sampled.x, 12);
    expect(drawn.y).toBeCloseTo(sampled.y, 12);
  });

  it('forgets its elements when the transport moves', () => {
    const c = createOrbitalClock();
    resetOrbitalClock(c, 0);
    applyOrbitalClock(c, frame, meshes(frame), 1);
    expect(c._elements.size).toBeGreaterThan(0);
    resetOrbitalClock(c, 40);
    expect(c._elements.size).toBe(0);
    expect(c.years).toBe(0);
  });
});

/**
 * The transport's "Orbital motion" checkbox must actually turn this off.
 *
 * The clock and the frame interpolator both write mesh positions, and main.js
 * chooses between them. The clock's `enabled` flag was never tied to the
 * control, so unticking the box left the clock still advancing bodies along
 * their orbits: the viewer asked for the raw sampled positions and got
 * interpolated ones anyway, with no error and nothing on screen to say so.
 *
 * That is worse than a crash, because it makes a control lie about what is
 * being shown - in a tool whose whole argument is that it marks what it does
 * and does not know.
 */
describe('the orbital clock answers to the smoothing control', () => {
  it('is wired to ctrl.smooth in the animation loop', async () => {
    const { readFile } = await import('node:fs/promises');
    const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
    expect(main).toMatch(/orbitalClock\.enabled\s*=\s*ctrl\.smooth/);
  });

  it('draws nothing when disabled, so the caller falls back', () => {
    const c = createOrbitalClock();
    c.enabled = false;
    resetOrbitalClock(c, 0);
    const frame = sim.frames[0];
    const m = meshes(frame);
    // Returns false so main.js knows to use the sampled positions instead.
    expect(applyOrbitalClock(c, frame, m, 1)).toBe(false);
  });

  it('does not advance its own time while disabled', () => {
    const c = createOrbitalClock();
    c.enabled = false;
    tickOrbitalClock(c, 5, true);
    expect(c.years).toBe(0);
  });
});
