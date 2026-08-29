import { describe, it, expect } from 'vitest';
import {
  survivalAt, contourCoefficient, swarmPoints, planeExtent, CONTOURS,
} from '../src/charts/answerSurface.js';
import sim from '../public/data/cosmos_visualizer_simulation.json';

const BANDS = { cMin: 2.5e-5, cMax: 4.3e-4 };

describe('the factorisation the figure rests on', () => {
  it('reproduces the exported survival from dose and coefficient alone', () => {
    // If this ever fails, the surface is not the whole answer any more and the
    // figure's caption becomes a lie.
    const last = sim.frames.at(-1).properties.filter(p => p.rock_type);
    for (const p of last) {
      const predicted = Math.exp(
        -p.radiation_surv_coeff * p.dose_cumulative_gy - 1200 * p.hydrolysis_cumulative,
      );
      expect(predicted).toBeCloseTo(p.population_fraction, 12);
    }
  });
});

describe('contourCoefficient', () => {
  it('is the exact inverse of the survival it labels', () => {
    for (const c of CONTOURS) {
      for (const dose of [1, 100, 5e5]) {
        const coeff = contourCoefficient(dose, c.value);
        expect(survivalAt(dose, coeff)).toBeCloseTo(c.value, 12);
      }
    }
  });

  it('is a straight line of slope -1 in log-log, which is why the axes are log', () => {
    const a = contourCoefficient(10, 0.5);
    const b = contourCoefficient(1000, 0.5);
    const slope = (Math.log10(b) - Math.log10(a)) / (Math.log10(1000) - Math.log10(10));
    expect(slope).toBeCloseTo(-1, 12);
  });

  it('refuses the cases that have no contour', () => {
    expect(contourCoefficient(0, 0.5)).toBeNull();
    expect(contourCoefficient(100, 1)).toBeNull();
    expect(contourCoefficient(100, 0)).toBeNull();
  });
});

describe('swarmPoints', () => {
  const pts = swarmPoints(sim.frames, 1e6);

  it('places every fragment', () => {
    expect(pts.length).toBe(14);
  });

  it('extrapolates the dose linearly from the run', () => {
    const t = sim.frames.at(-1).time;
    const props = sim.frames.at(-1).properties.filter(p => p.rock_type);
    for (const p of pts) {
      const src = props.find(x => x.id === p.id);
      expect(p.dose).toBeCloseTo((src.dose_cumulative_gy / t) * 1e6, 6);
    }
  });

  it('agrees with the recorded survival when asked for the run\'s own horizon', () => {
    const t = sim.frames.at(-1).time;
    const own = swarmPoints(sim.frames, t);
    const props = sim.frames.at(-1).properties.filter(p => p.rock_type);
    for (const p of own) {
      const src = props.find(x => x.id === p.id);
      expect(p.survival).toBeCloseTo(src.population_fraction, 12);
    }
  });

  it('sterilises most of the swarm at a million years, but not the toughest', () => {
    // The interesting part. Eleven of fourteen fall below the sterilisation
    // threshold; the fragment that drew the most resistant coefficient
    // (5.0e-5 1/Gy) still retains 6.2e-5. Lithopanspermia at this horizon is
    // not ruled out - it is ruled out for almost everything.
    const alive = pts.filter(p => p.survival >= 1e-6);
    expect(alive.length).toBeGreaterThan(0);
    expect(alive.length).toBeLessThan(pts.length);
    expect(Math.max(...pts.map(p => p.survival))).toBeLessThan(1e-3);
  });

  it('keeps the dose-only position close to, but not identical with, the answer', () => {
    // The caveat the module documents: hydrolysis cannot live on these axes.
    for (const p of pts) {
      expect(p.survivalFromDose).toBeGreaterThanOrEqual(p.survival);
    }
  });

  it('returns nothing rather than guessing for an empty replay', () => {
    expect(swarmPoints([], 1e6)).toEqual([]);
    expect(swarmPoints(null, 1e6)).toEqual([]);
  });
});

describe('planeExtent', () => {
  const pts = swarmPoints(sim.frames, 1e6);
  const ext = planeExtent(pts, BANDS);

  it('contains every fragment', () => {
    for (const p of pts) {
      expect(Math.log10(p.dose)).toBeGreaterThan(ext.dLo);
      expect(Math.log10(p.dose)).toBeLessThan(ext.dHi);
      expect(Math.log10(p.coefficient)).toBeGreaterThan(ext.cLo);
      expect(Math.log10(p.coefficient)).toBeLessThan(ext.cHi);
    }
  });

  it('contains the whole published band even when the swarm misses part of it', () => {
    expect(Math.log10(BANDS.cMin)).toBeGreaterThan(ext.cLo);
    expect(Math.log10(BANDS.cMax)).toBeLessThan(ext.cHi);
  });

  it('pads in decades, not per cent, because the axis is logarithmic', () => {
    const doses = pts.map(p => Math.log10(p.dose));
    expect(ext.dLo).toBeCloseTo(Math.min(...doses) - 0.35, 12);
    expect(ext.dHi).toBeCloseTo(Math.max(...doses) + 0.35, 12);
  });

  it('returns null for a swarm with no dose', () => {
    expect(planeExtent([], BANDS)).toBeNull();
  });
});
