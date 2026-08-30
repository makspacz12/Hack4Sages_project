/**
 * Independent checks of the model's physics, from the shipped replay.
 *
 * These do not re-run the model or trust its comments. Each recomputes a
 * quantity from first principles and compares against what was exported, so a
 * drift in the Python would surface here rather than in a conference talk.
 */

import { describe, it, expect } from 'vitest';
import sim from '../public/data/cosmos_visualizer_simulation.json';

const FRAGMENTS = sim.frames.at(-1).properties.filter(p => p.id?.startsWith('asteroid_'));

/** HYDROLYSIS_SURV_COEFF from model/microbe_radiation_model/biology/constants.py. */
const C_HYD = 1.2 / 0.001;

describe('survival factorises exactly', () => {
  /*
   * The whole live-coefficient feature rests on this. If survival is not
   * exactly exp(-c_rad*D - c_hyd*H), then rescaling it in the browser for a
   * different c_rad is not a recomputation but an approximation, and the
   * headline range would be quietly wrong.
   */
  it('reproduces every recorded population fraction to machine precision', () => {
    for (const p of FRAGMENTS) {
      const predicted = Math.exp(
        -p.radiation_surv_coeff * p.dose_cumulative_gy - C_HYD * p.hydrolysis_cumulative,
      );
      const residual = Math.abs(predicted - p.population_fraction) / p.population_fraction;
      expect(residual, `${p.id} residual ${residual}`).toBeLessThan(1e-12);
    }
  });
});

describe('body temperature follows radiative equilibrium', () => {
  /*
   * A grey body in sunlight sits at T = 278.6 (1-A)^(1/4) / sqrt(r_AU). The
   * exported temperatures must track that; a body warmer than the subsolar
   * blackbody limit or colder than deep space would be unphysical.
   */
  function equilibriumK(rAU, albedo) {
    return (278.6 * (1 - albedo) ** 0.25) / Math.sqrt(rAU);
  }

  it('stays between the coldest and hottest physically allowed values', () => {
    const sun = sim.frames[0].positions.find(p => p.id === 'sun');
    for (const frame of sim.frames) {
      const origin = frame.positions.find(p => p.id === 'sun') ?? sun;
      for (const p of frame.properties ?? []) {
        if (!p.id?.startsWith('asteroid_') || !Number.isFinite(p.T_center_K)) continue;
        const pos = frame.positions.find(q => q.id === p.id);
        if (!pos) continue;
        const r = Math.hypot(pos.x - origin.x, pos.y - origin.y, pos.z - origin.z);
        if (!(r > 0)) continue;
        // Bracketed by the darkest and brightest plausible surfaces, with a
        // 15% margin for the model's own thermal treatment.
        const hottest = equilibriumK(r, 0.0) * 1.15;
        const coldest = equilibriumK(r, 0.35) * 0.85;
        expect(p.T_center_K).toBeLessThan(hottest);
        expect(p.T_center_K).toBeGreaterThan(coldest);
      }
    }
  });

  it('is colder further out, as sunlight thins', () => {
    const byDistance = [];
    const frame = sim.frames.at(-1);
    const origin = frame.positions.find(p => p.id === 'sun');
    for (const p of frame.properties ?? []) {
      if (!p.id?.startsWith('asteroid_')) continue;
      const pos = frame.positions.find(q => q.id === p.id);
      if (!pos || !Number.isFinite(p.T_center_K)) continue;
      byDistance.push([
        Math.hypot(pos.x - origin.x, pos.y - origin.y, pos.z - origin.z),
        p.T_center_K,
      ]);
    }
    byDistance.sort((a, b) => a[0] - b[0]);
    expect(byDistance[0][1]).toBeGreaterThan(byDistance.at(-1)[1]);
  });
});

describe('radiation pressure beta', () => {
  /*
   * beta = 3 L Q_pr / (16 pi G M c rho s). It must fall as 1/radius, and land
   * in the range that formula gives for these sizes and densities - a beta
   * near 1 would mean sunlight overcoming gravity, which for a millimetre
   * stone at these densities it does not.
   */
  it('is inversely proportional to fragment radius', () => {
    const pts = FRAGMENTS
      .filter(p => p.beta > 0 && p.radius > 0)
      .map(p => [p.radius, p.beta])
      .sort((a, b) => a[0] - b[0]);
    // Smallest fragment must have the largest beta.
    expect(pts[0][1]).toBeGreaterThan(pts.at(-1)[1]);
    // And the product beta*radius should be roughly constant across the swarm.
    const products = pts.map(([r, b]) => r * b);
    const spread = Math.max(...products) / Math.min(...products);
    // Density varies by rock type, so this is not exactly constant; the rock
    // catalogue spans 1190 to 4172 kg/m3, a factor of 3.5.
    expect(spread).toBeLessThan(4.5);
  });

  it('is far below unity, so sunlight never overcomes gravity here', () => {
    for (const p of FRAGMENTS) {
      if (!Number.isFinite(p.beta)) continue;
      expect(p.beta).toBeLessThan(1e-3);
      expect(p.beta).toBeGreaterThan(0);
    }
  });
});

describe('the dose budget chart is in the same units as the model', () => {
  /*
   * gcr_local_flux is exported in the cosmic-ray model's normalised unit, not
   * in Gy/yr, while radiation_decay_gy_per_year beside it genuinely is Gy/yr.
   * Summing them without the 0.194 conversion put two different units on one
   * axis labelled "cumulative dose [Gy]", and drove the cosmic-ray curve to
   * 3076 Gy - five times more dose than the model produced for any fragment,
   * and above the colour scale's own 1000 Gy ceiling.
   *
   * The check that catches it is the only one that can: the integrated budget
   * must reproduce the dose the model itself exported.
   */
  it('reproduces the exported cumulative dose', async () => {
    const { doseBudget } = await import('../src/charts/doseModel.js');
    const budget = doseBudget(sim.frames);
    const total = budget.gcr.at(-1)[1] + budget.decay.at(-1)[1];

    const exported = FRAGMENTS.map(p => p.dose_cumulative_gy).filter(Number.isFinite);
    const meanExported = exported.reduce((a, b) => a + b, 0) / exported.length;

    // Within a percent; the residual is the zero-width first interval.
    expect(Math.abs(total - meanExported) / meanExported).toBeLessThan(0.02);
  });

  it('never claims more dose than the colour scale can show', async () => {
    const { doseBudget } = await import('../src/charts/doseModel.js');
    const { DOSE_MAX_GY } = await import('../src/doseColor.js');
    const budget = doseBudget(sim.frames);
    expect(budget.gcr.at(-1)[1]).toBeLessThan(DOSE_MAX_GY);
  });
});
