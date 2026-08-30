/**
 * Same dose, different fate.
 *
 * The strongest single statement the data makes, and the figure exists to make
 * it hard to misread. The seven fragments that survive 100,000 years absorb
 * nearly identical doses and end with survival fractions spanning a factor of
 * several hundred. The environment did not do that; the organism did.
 */

import { describe, it, expect } from 'vitest';
import { sameDoseData, spreadSummary } from '../src/charts/sameDose.js';
import longRun from '../public/data/run_100kyr.json';
import shortRun from '../public/data/cosmos_visualizer_simulation.json';

describe('same dose, different fate', () => {
  const rows = sameDoseData(longRun.frames);
  const spread = spreadSummary(rows);

  it('counts only the fragments still intact', () => {
    // The seven destroyed ones were ground away rather than sterilised, so
    // their zero means something else and must not be averaged in here.
    expect(rows).toHaveLength(7);
    expect(rows.every(r => r.survival > 0)).toBe(true);
  });

  it('finds the doses nearly identical', () => {
    expect(spread.dosePercent).toBeLessThan(10);
  });

  it('finds the outcomes wildly different', () => {
    expect(spread.survivalFactor).toBeGreaterThan(100);
  });

  it('makes the asymmetry the point, not a detail', () => {
    // The whole figure rests on these two being orders of magnitude apart.
    const doseSpreadFactor = spread.doseHi / spread.doseLo;
    expect(spread.survivalFactor / doseSpreadFactor).toBeGreaterThan(100);
  });

  it('carries the coefficient that explains it', () => {
    // Without c_rad on each row the reader has no candidate explanation.
    for (const r of rows) expect(Number.isFinite(r.cRad)).toBe(true);
    const coeffs = rows.map(r => r.cRad);
    expect(Math.max(...coeffs) / Math.min(...coeffs)).toBeGreaterThan(3);
  });

  it('has nothing to say about the short run, and says nothing', () => {
    // Over 3000 years survival spans only about 1.25x, so the figure would be
    // claiming an asymmetry that is not there.
    const short = spreadSummary(sameDoseData(shortRun.frames));
    expect(short.survivalFactor).toBeLessThan(2);
  });

  it('declines to summarise a single fragment', () => {
    expect(spreadSummary([])).toBeNull();
    expect(spreadSummary([{ doseGy: 1, survival: 1 }])).toBeNull();
  });
});
