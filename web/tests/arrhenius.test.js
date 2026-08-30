/**
 * The Arrhenius figure.
 *
 * The two damage channels behave completely differently and only one is worth
 * plotting against temperature. Cosmic ray dose varies by a factor of 1.3
 * across the swarm, because galactic rays do not care where a body is.
 * Hydrolysis varies by 119 orders of magnitude, because it is chemistry.
 *
 * The figure earns its place by recovering a checkable constant rather than
 * showing a correlation: the slope gives an activation energy in the textbook
 * range for hydrolysis of the DNA phosphodiester bond.
 */

import { describe, it, expect } from 'vitest';
import { arrheniusSeries, arrheniusFit } from '../src/charts/series.js';
import sim from '../public/data/cosmos_visualizer_simulation.json';

describe('hydrolysis against temperature', () => {
  const series = arrheniusSeries(sim.frames);
  const fit = arrheniusFit(series);

  it('has a point for every fragment at every frame that recorded one', () => {
    expect(series.size).toBe(14);
    expect(fit.n).toBe(2100);
  });

  it('is a straight line in Arrhenius coordinates', () => {
    // Anything less than near-perfect here means the relationship is not
    // Arrhenius and the figure would be claiming something false.
    expect(Math.abs(fit.r)).toBeGreaterThan(0.99);
  });

  it('recovers an activation energy a chemist can check', () => {
    // DNA phosphodiester hydrolysis sits around 100-160 kJ/mol.
    expect(fit.activationKJ).toBeGreaterThan(100);
    expect(fit.activationKJ).toBeLessThan(160);
  });

  it('slopes downward, because cold chemistry is slow', () => {
    // x is 1000/T, so higher x is colder; the rate must fall.
    expect(fit.slope).toBeLessThan(0);
  });

  it('spans a temperature range wide enough to be worth plotting', () => {
    const [loX, hiX] = fit.xRange;
    const hotK = 1000 / loX;
    const coldK = 1000 / hiX;
    expect(hotK).toBeGreaterThan(200);
    expect(coldK).toBeLessThan(60);
  });

  it('drops records it cannot place, rather than inventing them', () => {
    const frames = [{ time: 0, properties: [
      { id: 'asteroid_001', T_center_K: 0, hydrolysis_rate_s_inv: 1e-30 },
      { id: 'asteroid_001', T_center_K: 200, hydrolysis_rate_s_inv: 0 },
    ] }];
    const s = arrheniusSeries(frames);
    expect(s.get('asteroid_001') ?? []).toEqual([]);
  });

  it('declines to fit a line through nothing', () => {
    expect(arrheniusFit(new Map())).toBeNull();
    expect(arrheniusFit(new Map([['a', [[1, 1]]]]))).toBeNull();
  });
});
