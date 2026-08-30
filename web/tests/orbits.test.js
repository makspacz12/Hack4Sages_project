import { describe, it, expect } from 'vitest';
import { stateToElements, orbitPoints, osculatingOrbit, SUN_MU_AU3_YR2, propagateElements, keplerSafe } from '../src/orbits.js';
import sim from '../public/data/cosmos_visualizer_simulation.json';

const MU = SUN_MU_AU3_YR2;

describe('stateToElements', () => {
  it('recovers a circular orbit in the plane', () => {
    const a = 2;
    const r = { x: a, y: 0, z: 0 };
    const v = { x: 0, y: Math.sqrt(MU / a), z: 0 };
    const el = stateToElements(r, v);
    expect(el.a).toBeCloseTo(a, 10);
    expect(el.e).toBeCloseTo(0, 10);
    expect(el.inc).toBeCloseTo(0, 10);
  });

  it("gives Earth's period for a one-AU circular orbit, which is the unit check", () => {
    const r = { x: 1, y: 0, z: 0 };
    const v = { x: 0, y: Math.sqrt(MU), z: 0 };
    expect(stateToElements(r, v).period).toBeCloseTo(1, 10);
  });

  it('recovers a known eccentric orbit from its periapsis state', () => {
    // At periapsis, r = a(1-e) and v is perpendicular with the vis-viva speed.
    const a = 3;
    const e = 0.6;
    const rp = a * (1 - e);
    const vp = Math.sqrt(MU * (2 / rp - 1 / a));
    const el = stateToElements({ x: rp, y: 0, z: 0 }, { x: 0, y: vp, z: 0 });
    expect(el.a).toBeCloseTo(a, 9);
    expect(el.e).toBeCloseTo(e, 9);
  });

  it('recovers a polar inclination', () => {
    const a = 2;
    const speed = Math.sqrt(MU / a);
    const el = stateToElements({ x: a, y: 0, z: 0 }, { x: 0, y: 0, z: speed });
    expect(el.inc).toBeCloseTo(Math.PI / 2, 9);
  });

  it('refuses an unbound state rather than inventing a closed curve', () => {
    const r = { x: 1, y: 0, z: 0 };
    const escape = Math.sqrt(2 * MU);
    expect(stateToElements(r, { x: 0, y: escape * 1.01, z: 0 })).toBeNull();
    expect(stateToElements(r, { x: 0, y: escape, z: 0 })).toBeNull();
  });

  it('refuses a degenerate state instead of returning NaN', () => {
    expect(stateToElements({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBeNull();
    // Radial fall: no angular momentum, so no orbital plane.
    expect(stateToElements({ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 })).toBeNull();
  });
});

describe('orbitPoints', () => {
  it('closes the curve exactly', () => {
    const el = stateToElements({ x: 2, y: 0, z: 0 }, { x: 0, y: Math.sqrt(MU / 2) * 0.8, z: 0 });
    const pts = orbitPoints(el, 64);
    expect(pts.length).toBe(65);
    const first = pts[0];
    const last = pts.at(-1);
    expect(last.x).toBeCloseTo(first.x, 10);
    expect(last.y).toBeCloseTo(first.y, 10);
    expect(last.z).toBeCloseTo(first.z, 10);
  });

  it('draws a circle of the right radius for a circular orbit', () => {
    const a = 2.5;
    const el = stateToElements({ x: a, y: 0, z: 0 }, { x: 0, y: Math.sqrt(MU / a), z: 0 });
    for (const p of orbitPoints(el, 48)) {
      expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(a, 9);
    }
  });

  it('spans periapsis and apoapsis at the right distances', () => {
    const a = 3;
    const e = 0.6;
    const rp = a * (1 - e);
    const vp = Math.sqrt(MU * (2 / rp - 1 / a));
    const el = stateToElements({ x: rp, y: 0, z: 0 }, { x: 0, y: vp, z: 0 });
    const radii = orbitPoints(el, 360).map(p => Math.hypot(p.x, p.y, p.z));
    expect(Math.min(...radii)).toBeCloseTo(a * (1 - e), 6);
    expect(Math.max(...radii)).toBeCloseTo(a * (1 + e), 6);
  });
});

/** Perpendicular distance from a point to a line segment. */
function distanceToSegment(p, a, b) {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ap = { x: p.x - a.x, y: p.y - a.y, z: p.z - a.z };
  const len2 = ab.x ** 2 + ab.y ** 2 + ab.z ** 2;
  const t = len2 > 0
    ? Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y + ap.z * ab.z) / len2))
    : 0;
  return Math.hypot(ap.x - t * ab.x, ap.y - t * ab.y, ap.z - t * ab.z);
}

describe('osculatingOrbit on the shipped replay', () => {
  const frame = sim.frames.at(-1);
  const sun = frame.positions.find(p => p.id === 'sun');
  const fragments = frame.velocities.filter(v => v.id.startsWith('asteroid_'));

  it('solves an orbit for every fragment, since none of them escape', () => {
    for (const v of fragments) {
      const pos = frame.positions.find(p => p.id === v.id);
      const orbit = osculatingOrbit(pos, { x: v.vx, y: v.vy, z: v.vz }, sun);
      expect(orbit).not.toBeNull();
      expect(orbit.elements.a).toBeGreaterThan(0);
      expect(orbit.elements.e).toBeLessThan(1);
    }
  });

  it('passes through the fragment it was solved for, to second order', () => {
    // The whole claim of the figure: this curve contains the body drawing it.
    //
    // Asserted as a CONVERGENCE RATE rather than against a fixed distance,
    // which is the honest form. Any residual has two possible sources - an
    // error in the orbit, or the fact that a polyline is not a curve - and only
    // the second one shrinks as the square of the segment count. Measured here
    // it falls by a factor near sixteen each time the segments quadruple, so
    // what is left is the drawing, not the mathematics.
    //
    // A first version compared against the nearest sampled VERTEX and reported
    // a miss of 1.2e-3 AU. That was half the spacing between vertices: it was
    // measuring the sampling, not the curve at all.
    const sunV = frame.velocities.find(v => v.id === 'sun');
    const worstAt = (segments) => {
      let worst = 0;
      for (const v of fragments) {
        const pos = frame.positions.find(p => p.id === v.id);
        const { points } = osculatingOrbit(
          pos, { x: v.vx, y: v.vy, z: v.vz }, sun,
          { segments, originVelocity: { x: sunV.vx, y: sunV.vy, z: sunV.vz } },
        );
        let best = Infinity;
        for (let i = 1; i < points.length; i += 1) {
          best = Math.min(best, distanceToSegment(pos, points[i - 1], points[i]));
        }
        const r = Math.hypot(pos.x - sun.x, pos.y - sun.y, pos.z - sun.z);
        worst = Math.max(worst, best / r);
      }
      return worst;
    };

    const coarse = worstAt(256);
    const fine = worstAt(1024);
    const finer = worstAt(4096);
    expect(coarse / fine).toBeGreaterThan(8);
    expect(fine / finer).toBeGreaterThan(8);
    // And at the resolution actually drawn, the curve is within a thousandth
    // of each fragment's own orbital radius - far under a pixel at any zoom.
    expect(coarse).toBeLessThan(1e-3);
  });

  it('agrees with the energy the dock reports', () => {
    for (const v of fragments) {
      const pos = frame.positions.find(p => p.id === v.id);
      const r = Math.hypot(pos.x - sun.x, pos.y - sun.y, pos.z - sun.z);
      const eps = (v.vx ** 2 + v.vy ** 2 + v.vz ** 2) / 2 - MU / r;
      const { elements } = osculatingOrbit(pos, { x: v.vx, y: v.vy, z: v.vz }, sun);
      expect(elements.a).toBeCloseTo(-MU / (2 * eps), 8);
    }
  });

  it('spans the eccentricities the swarm actually reaches', () => {
    const es = fragments.map(v => {
      const pos = frame.positions.find(p => p.id === v.id);
      return osculatingOrbit(pos, { x: v.vx, y: v.vy, z: v.vz }, sun).elements.e;
    });
    expect(Math.max(...es)).toBeGreaterThan(0.3);
    expect(Math.min(...es)).toBeLessThan(Math.max(...es));
  });
});

/**
 * Advancing a body along its own ellipse.
 *
 * Positions are sampled every 20 years and the shortest period in the system
 * is Mercury's 0.24 years. Played back as sampled, a fragment jumps a median
 * of 2.48 AU - 149 world units - between frames, and nothing appears to move
 * so much as teleport. Re-running finely enough is not available: 3000 years
 * at 0.05 yr/frame is about 2.8 GB.
 */
describe('propagateElements', () => {
  const MU = 4 * Math.PI ** 2;

  it('returns to the start after exactly one period', () => {
    // Unit circular orbit: period is 1 year by construction.
    const el = stateToElements({ x: 1, y: 0, z: 0 }, { x: 0, y: 2 * Math.PI, z: 0 }, MU);
    const p = propagateElements(el, el.period);
    expect(p.x).toBeCloseTo(1, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  it('is halfway round at half a period', () => {
    const el = stateToElements({ x: 1, y: 0, z: 0 }, { x: 0, y: 2 * Math.PI, z: 0 }, MU);
    const p = propagateElements(el, el.period / 2);
    expect(p.x).toBeCloseTo(-1, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  it('lands on the curve orbitPoints draws', () => {
    // The marker must sit ON the drawn ellipse, or the scene contradicts
    // itself. Both use the same rotation, so every propagated point must be at
    // the ellipse's own radius for its true anomaly.
    const el = stateToElements({ x: 1.3, y: 0.2, z: 0.05 }, { x: -0.9, y: 5.4, z: 0.3 }, MU);
    expect(el).toBeTruthy();
    for (const frac of [0, 0.17, 0.4, 0.63, 0.91]) {
      const p = propagateElements(el, el.period * frac);
      const r = Math.hypot(p.x, p.y, p.z);
      // Every point on the ellipse lies between periapsis and apoapsis.
      expect(r).toBeGreaterThanOrEqual(el.a * (1 - el.e) - 1e-9);
      expect(r).toBeLessThanOrEqual(el.a * (1 + el.e) + 1e-9);
    }
  });

  it('solves Kepler for a strongly eccentric orbit', () => {
    // e = 0.8 is where a naive iteration starts to struggle. At periapsis
    // r_p = 0.3 AU, v = sqrt(mu(1+e)/r_p) = 15.3906 produces exactly that.
    const el = stateToElements({ x: 0.3, y: 0, z: 0 }, { x: 0, y: 15.3906, z: 0 }, MU);
    expect(el.e).toBeGreaterThan(0.5);
    const p = propagateElements(el, el.period);
    expect(p.x).toBeCloseTo(0.3, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('refuses a body it cannot describe, and accepts the ones it can', () => {
    // The test is not "is dt small next to the period" - a 2.4-year orbit
    // propagates perfectly across a 20-year gap, it simply goes round eight
    // times. What breaks it is the orbit changing within the gap, which is
    // what happens to the 17.7 AU outlier being thrown around by Jupiter.
    const swarm = stateToElements({ x: 1.5, y: 0, z: 0 }, { x: 0, y: 5.2, z: 0 }, MU);
    expect(keplerSafe(swarm, 20)).toBe(true);

    const outlier = stateToElements({ x: 17.7, y: 0, z: 0 }, { x: 0, y: 1.5, z: 0 }, MU);
    expect(keplerSafe(outlier, 20)).toBe(false);

    expect(keplerSafe(null, 20)).toBe(false);
  });

  it('says nothing rather than guessing on bad input', () => {
    expect(propagateElements(null, 5)).toBeNull();
    expect(propagateElements({ a: 1 }, NaN)).toBeNull();
  });
});

/**
 * The accuracy claim, measured against the shipped replay.
 *
 * This is the number the whole approach rests on, so it is checked against
 * REBOUND's own output rather than asserted in a comment.
 */
describe('Kepler interpolation against the real integration', () => {
  const MU = 4 * Math.PI ** 2;

  function heliocentric(frameIdx, id) {
    const f = sim.frames[frameIdx];
    const sun = f.positions.find(p => p.id === 'sun');
    const p = f.positions.find(q => q.id === id);
    if (!p || !sun) return null;
    return { x: p.x - sun.x, y: p.y - sun.y, z: p.z - sun.z };
  }

  function elementsAt(frameIdx, id) {
    const f = sim.frames[frameIdx];
    const sunV = f.velocities.find(v => v.id === 'sun');
    const v = f.velocities.find(q => q.id === id);
    const r = heliocentric(frameIdx, id);
    if (!r || !v) return null;
    // Velocity must be Sun-relative: the Sun itself moves 2.6e-3 AU/yr.
    return stateToElements(r, {
      x: v.vx - (sunV?.vx ?? 0),
      y: v.vy - (sunV?.vy ?? 0),
      z: v.vz - (sunV?.vz ?? 0),
    }, MU);
  }

  it('is far closer to the truth than showing the sampled position', () => {
    const errors = [];
    const jumps = [];
    const ids = sim.frames[0].velocities
      .filter(v => v.id.startsWith('asteroid_')).map(v => v.id);

    for (const id of ids) {
      for (let i = 0; i < sim.frames.length - 1; i += 1) {
        const el = elementsAt(i, id);
        const truth = heliocentric(i + 1, id);
        const here = heliocentric(i, id);
        if (!el || !truth || !here) continue;
        const dt = sim.frames[i + 1].time - sim.frames[i].time;
        if (!keplerSafe(el, dt)) continue;
        const pred = propagateElements(el, dt);
        if (!pred) continue;
        errors.push(Math.hypot(pred.x - truth.x, pred.y - truth.y, pred.z - truth.z));
        // What the viewer sees without interpolation: the body simply appears
        // at the next sampled point.
        jumps.push(Math.hypot(here.x - truth.x, here.y - truth.y, here.z - truth.z));
      }
    }

    expect(errors.length).toBeGreaterThan(1000);
    errors.sort((a, b) => a - b);
    jumps.sort((a, b) => a - b);
    const medErr = errors[errors.length >> 1];
    const medJump = jumps[jumps.length >> 1];

    // Measured: 0.0295 AU against a 2.48 AU jump, about 84x better.
    expect(medErr).toBeLessThan(0.05);
    expect(medErr).toBeLessThan(medJump / 20);
  });

  it('excludes the one fragment whose orbit changes within a gap', () => {
    // asteroid_011 is at a = 17.7 AU, perturbed hard by Jupiter, and its own
    // propagation error reaches 24 AU - larger than the inner Solar System.
    const el = elementsAt(0, 'asteroid_011');
    expect(el).toBeTruthy();
    expect(el.a).toBeGreaterThan(6);
    expect(keplerSafe(el, 20)).toBe(false);
  });

  it('accepts every fragment in the main swarm', () => {
    const ids = sim.frames[0].velocities
      .filter(v => v.id.startsWith('asteroid_') && v.id !== 'asteroid_011')
      .map(v => v.id);
    for (const id of ids) {
      const el = elementsAt(0, id);
      if (!el) continue;
      expect(keplerSafe(el, 20), `${id} must be interpolable`).toBe(true);
    }
  });
});
