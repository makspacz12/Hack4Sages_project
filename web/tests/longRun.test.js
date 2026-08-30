/**
 * The 100,000-year run, and what it says that 3000 years cannot.
 *
 * The bundled replay covers 3000 years, over which every fragment keeps 78% to
 * 97% of its microbes - nothing dies, and the interesting behaviour is all in
 * the extrapolation. A run two orders of magnitude longer was made to check
 * whether the extrapolation is honest, and it turned up a mechanism the short
 * run cannot show at all.
 *
 * It is NOT radiation that removes the small fragments. Seven of fourteen end
 * the run at exactly zero survival, and their absorbed doses predict between
 * 3% and 86% survival - the exponential law says they should still be alive.
 * They are gone because dust erosion ground them from millimetres down to the
 * one-micrometre floor and the model marked them destroyed.
 *
 * That makes it the same size argument the shielding case rests on, arriving
 * by a completely different route, and it is the stronger version: erosion
 * removes surface at a rate independent of the body's size, so lifetime scales
 * with radius. A 1.5 mm fragment is gone in 19 kyr; a 34 mm one lasts about a
 * megayear. Over the tens of megayears an interstellar transfer takes, neither
 * survives - which is the honest answer to the question the tool exists to ask.
 */

import { describe, it, expect } from 'vitest';
import longRun from '../public/data/run_100kyr.json';

const FINAL = longRun.frames.at(-1).properties.filter(p => p.id?.startsWith('asteroid_'));
const C_HYD = 1200;

describe('the long run', () => {
  it('covers 100,000 years, a hundred times the bundled replay', () => {
    expect(longRun.frames.at(-1).time).toBeCloseTo(1e5, 0);
    expect(longRun.frames.length).toBe(101);
  });

  it('destroys the small fragments and spares the large ones', () => {
    const destroyed = FINAL.filter(p => p.status === 'destroyed');
    const alive = FINAL.filter(p => p.status !== 'destroyed');
    expect(destroyed.length).toBeGreaterThan(0);
    expect(alive.length).toBeGreaterThan(0);

    // Every survivor started larger than every casualty would need to be:
    // the largest survivor is far bigger than the destroyed floor.
    const largestAlive = Math.max(...alive.map(p => p.radius));
    expect(largestAlive).toBeGreaterThan(1e-2);
    // The destroyed ones are all sitting on the 1 micrometre floor.
    for (const p of destroyed) expect(p.radius).toBeLessThan(2e-6);
  });

  it('kills them by erosion, not by radiation', () => {
    // This is the claim worth pinning. If the zeros were radiation kills, the
    // survival law would reproduce them; it does not, by a wide margin.
    const destroyed = FINAL.filter(p => p.status === 'destroyed');
    expect(destroyed.length).toBeGreaterThan(3);
    for (const p of destroyed) {
      const predicted = Math.exp(
        -p.radiation_surv_coeff * p.dose_cumulative_gy - C_HYD * p.hydrolysis_cumulative,
      );
      expect(p.population_fraction).toBe(0);
      // Radiation alone would have left a meaningful population alive.
      expect(predicted).toBeGreaterThan(1e-3);
    }
  });

  it('still factorises exactly for the fragments that survive', () => {
    const alive = FINAL.filter(p => p.status !== 'destroyed');
    for (const p of alive) {
      const predicted = Math.exp(
        -p.radiation_surv_coeff * p.dose_cumulative_gy - C_HYD * p.hydrolysis_cumulative,
      );
      const residual = Math.abs(predicted - p.population_fraction) / p.population_fraction;
      expect(residual, `${p.id}`).toBeLessThan(1e-9);
    }
  });

  it('keeps dose linear in time, so the two clocks stay justified', () => {
    // The orbital clock runs at its own rate because dose has no interesting
    // time structure. That has to hold at this timescale too, or the design
    // was only accidentally right.
    for (const id of ['asteroid_012', 'asteroid_004', 'asteroid_010']) {
      const pts = [];
      for (const f of longRun.frames) {
        const p = f.properties?.find(x => x.id === id);
        if (p && Number.isFinite(p.dose_cumulative_gy)) pts.push([f.time, p.dose_cumulative_gy]);
      }
      const end = pts.at(-1);
      const rate = end[1] / end[0];
      let worst = 0;
      for (const [t, D] of pts) {
        if (t <= 0) continue;
        worst = Math.max(worst, Math.abs(D - rate * t) / end[1]);
      }
      expect(worst, `${id} dose should be linear`).toBeLessThan(0.01);
    }
  });

  it('reaches the dose where survival genuinely collapses', () => {
    // 3000 years reaches ~600 Gy and nothing dies. This reaches ~20,000.
    const doses = FINAL.map(p => p.dose_cumulative_gy).filter(Number.isFinite);
    expect(Math.max(...doses)).toBeGreaterThan(15000);
  });

  it('does not replace the replay the conference figures are built on', () => {
    // Kept as a separate file deliberately.
    expect(longRun.frames.length).not.toBe(151);
  });
});
