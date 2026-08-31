/**
 * The survival phase diagram.
 *
 * The claim it makes is strong and therefore worth checking: that a fragment's
 * fate is fixed by two properties it is born with, through
 * lifetime = initial radius / erosion rate, with no free parameters. If that
 * law did not hold, the figure would be drawing a boundary the data does not
 * have.
 */

import { describe, it, expect } from 'vitest';
import { erosionPhaseData, lifetimeLawAccuracy } from '../src/charts/survivalPhase.js';
import longRun from '../public/data/run_100kyr.json';
import shortRun from '../public/data/cosmos_visualizer_simulation.json';

const rows = erosionPhaseData(longRun.frames);

describe('erosion phase data', () => {
  it('measures every fragment in the run', () => {
    expect(rows).toHaveLength(14);
  });

  it('finds erosion rates spanning a real range', () => {
    const rates = rows.map(r => r.rateUmPerKyr);
    expect(Math.min(...rates)).toBeGreaterThan(10);
    expect(Math.max(...rates)).toBeLessThan(120);
    // A factor of about five, set by composition.
    expect(Math.max(...rates) / Math.min(...rates)).toBeGreaterThan(3);
  });

  it('separates the destroyed from the survivors', () => {
    expect(rows.filter(r => r.destroyed)).toHaveLength(7);
    expect(rows.filter(r => !r.destroyed)).toHaveLength(7);
  });
});

describe('the lifetime law', () => {
  it('predicts the fate of every fragment', () => {
    // This is the figure's entire justification. Fourteen of fourteen.
    const { correct, total } = lifetimeLawAccuracy(rows, 100);
    expect(total).toBe(14);
    expect(correct).toBe(14);
  });

  it('is not simply a size threshold, which is why both axes are needed', () => {
    // A larger fragment was destroyed while a smaller one survived, so radius
    // alone cannot separate the two populations.
    const destroyed = rows.filter(r => r.destroyed);
    const alive = rows.filter(r => !r.destroyed);
    const largestDead = Math.max(...destroyed.map(r => r.radiusMm));
    const smallestAlive = Math.min(...alive.map(r => r.radiusMm));
    expect(largestDead).toBeGreaterThan(smallestAlive);
  });

  it('gives the fastest-eroding rock the shortest life for its size', () => {
    // Composition is the second axis: CI chondrite erodes fastest.
    const byRate = [...rows].sort((a, b) => b.rateUmPerKyr - a.rateUmPerKyr);
    expect(byRate[0].rockType).toBe('ci_chondrite');
    const slowest = byRate.at(-1);
    expect(slowest.rateUmPerKyr).toBeLessThan(byRate[0].rateUmPerKyr / 3);
  });

  it('has nothing to draw on the short run, and says so rather than inventing it', () => {
    // Over 3000 years no fragment is lost, so there is no boundary. The data
    // function must still work, and every fragment must be a survivor.
    const short = erosionPhaseData(shortRun.frames);
    expect(short.length).toBe(14);
    expect(short.every(r => !r.destroyed)).toBe(true);
  });

  it('declines to compute from a replay with no history', () => {
    expect(erosionPhaseData([])).toEqual([]);
    expect(erosionPhaseData(null)).toEqual([]);
  });
});

/**
 * The lifetime law, tested out of sample.
 *
 * A law that predicts every fate in the run it was derived from is only
 * suggestive: with fourteen points and two free-looking quantities it could be
 * a coincidence of that particular draw. The 1,000,000 year run is a different
 * run, ten times longer, and the law was not adjusted for it in any way.
 *
 * It predicts all fourteen fates there as well. The one fragment whose
 * lifetime exceeds the run length is the one fragment that survives, and it is
 * the largest, at 33.9 mm with a computed lifetime of 1062 kyr against a run
 * of 1000. Everything with a shorter lifetime is gone.
 *
 * That is a genuine out of sample prediction rather than a fit, and it is the
 * strongest evidence in the project that the erosion boundary is physics and
 * not a curve drawn through some points.
 */

import longestRun from '../public/data/run_1myr.json';

describe('the lifetime law predicts a run it was not derived from', () => {
  const rows = erosionPhaseData(longestRun.frames);

  it('covers a million years', () => {
    expect(longestRun.frames.at(-1).time).toBeCloseTo(1e6, 0);
  });

  it('predicts every fate at 1 Myr, having been checked at 100 kyr', () => {
    const { correct, total } = lifetimeLawAccuracy(rows, 1000);
    expect(total).toBe(14);
    expect(correct).toBe(14);
  });

  it('leaves exactly one survivor, and it is the largest fragment', () => {
    const alive = rows.filter(r => !r.destroyed);
    expect(alive).toHaveLength(1);
    const largest = rows.reduce((a, b) => (a.radiusMm > b.radiusMm ? a : b));
    expect(alive[0].id).toBe(largest.id);
    expect(alive[0].radiusMm).toBeGreaterThan(30);
  });

  it('puts that survivor only just past the boundary', () => {
    // 1062 kyr against a 1000 kyr run. The law is being tested where it is
    // hardest, not where the margin is comfortable.
    const alive = rows.filter(r => !r.destroyed)[0];
    expect(alive.lifetimeKyr).toBeGreaterThan(1000);
    expect(alive.lifetimeKyr).toBeLessThan(1300);
  });

  it('finds even the survivor biologically finished', () => {
    // Surviving the erosion does not mean surviving the radiation. The last
    // fragment standing is down to about 1e-10, far past sterilisation.
    const last = longestRun.frames.at(-1).properties
      .filter(p => p.id?.startsWith('asteroid_') && p.status !== 'destroyed');
    expect(last).toHaveLength(1);
    expect(last[0].population_fraction).toBeLessThan(1e-6);
  });
});
