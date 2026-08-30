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
