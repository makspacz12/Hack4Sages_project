import { describe, it, expect } from 'vitest';
import {
  stateToElements, orbitPoints, osculatingOrbit, SUN_MU_AU3_YR2,
} from '../src/orbits.js';
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
