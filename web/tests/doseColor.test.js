/**
 * Colouring by dose.
 *
 * The choice of quantity is the whole point of these tests. Survival is what
 * the project is about and is the wrong thing to encode here: across the full
 * 3000-year run every fragment keeps between 77.5% and 97.1% of its microbes,
 * so a survival ramp would spread the whole colour range over a 20-point
 * difference and imply drama the data does not contain. Dose is what the model
 * integrates, spans 0 to 726 Gy, and rises monotonically.
 */

import { describe, it, expect } from 'vitest';
import { doseColor, dosesAtFrame, doseLegendStops, DOSE_MAX_GY } from '../src/doseColor.js';
import sim from '../public/data/cosmos_visualizer_simulation.json';

describe('dose colouring', () => {
  it('covers the range the run actually reaches', () => {
    const last = sim.frames.at(-1);
    const doses = [...dosesAtFrame(last).values()];
    expect(doses.length).toBe(14);
    // The scale must contain the data, without being so wide the data sits in
    // a corner of it.
    expect(Math.max(...doses)).toBeLessThan(DOSE_MAX_GY);
    expect(Math.max(...doses)).toBeGreaterThan(DOSE_MAX_GY * 0.5);
  });

  it('is a fixed scale, not one derived from what is on screen', () => {
    // The same dose must give the same colour whatever else is in view; that
    // is what makes the colour bar readable at all.
    const a = doseColor(300);
    const b = doseColor(300);
    expect(a).toEqual(b);
    expect(DOSE_MAX_GY).toBe(1000);
  });

  it('separates the least and most irradiated fragments visibly', () => {
    const last = sim.frames.at(-1);
    const doses = [...dosesAtFrame(last).values()];
    const lo = doseColor(Math.min(...doses));
    const hi = doseColor(Math.max(...doses));
    const dist = Math.hypot(hi.r - lo.r, hi.g - lo.g, hi.b - lo.b);
    expect(dist).toBeGreaterThan(0.1);
  });

  it('clamps rather than running off the ramp', () => {
    expect(doseColor(-5)).toEqual(doseColor(0));
    expect(doseColor(1e6)).toEqual(doseColor(DOSE_MAX_GY));
    expect(doseColor(NaN)).toEqual(doseColor(0));
  });

  it('rises monotonically in lightness, so more dose reads as more', () => {
    let prev = -1;
    for (let gy = 0; gy <= DOSE_MAX_GY; gy += 100) {
      const c = doseColor(gy);
      // Rec. 709 luma; the ramp is built to increase in lightness.
      const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      expect(l).toBeGreaterThan(prev);
      prev = l;
    }
  });

  it('offers legend stops that span the whole declared scale', () => {
    const stops = doseLegendStops(5);
    expect(stops[0].gy).toBe(0);
    expect(stops.at(-1).gy).toBe(DOSE_MAX_GY);
    for (const s of stops) expect(s.color).toEqual(doseColor(s.gy));
  });

  it('says nothing for a fragment with no recorded dose', () => {
    expect(dosesAtFrame({ properties: [{ id: 'x' }] }).size).toBe(0);
    expect(dosesAtFrame(null).size).toBe(0);
  });
});
