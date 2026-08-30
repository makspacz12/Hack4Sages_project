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

/**
 * Why the orbital paths are NOT coloured by local dose rate.
 *
 * The idea is appealing and was proposed as the single best figure the 3D view
 * could offer: if dose rate went as 1/d^2, the perihelion arc of each orbit
 * would light up and the trajectory and the biology would be coupled in one
 * image.
 *
 * It does not, and this test is here so nobody builds it. Fitted over all 2100
 * fragment-frames in the shipped replay:
 *
 *   uv_local_flux             ~ r^-1.90    sunlight, inverse square
 *   gcr_local_flux            ~ r^+0.08    galactic, distance-independent
 *   radiation_decay_gy_per_yr ~ r^+0.14
 *
 * Galactic cosmic rays arrive from outside the Solar System, so their flux
 * does not fall off with distance from the Sun - and they are the channel that
 * reaches the cargo, because UV photons stop within about 3 cm of rock. A hot
 * perihelion arc would be drawing a gradient that is not there.
 */
describe('dose rate is not a function of distance from the Sun', () => {
  function powerLawSlope(field) {
    const xs = [];
    const ys = [];
    for (const f of sim.frames) {
      const sun = f.positions.find(p => p.id === 'sun');
      for (const pr of f.properties ?? []) {
        if (!pr.id?.startsWith('asteroid_')) continue;
        const pos = f.positions.find(p => p.id === pr.id);
        if (!pos || !(pr[field] > 0)) continue;
        const r = Math.hypot(pos.x - sun.x, pos.y - sun.y, pos.z - sun.z);
        xs.push(Math.log(r));
        ys.push(Math.log(pr[field]));
      }
    }
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i += 1) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    return num / den;
  }

  it('has UV falling off as sunlight does', () => {
    expect(powerLawSlope('uv_local_flux')).toBeCloseTo(-1.9, 1);
  });

  it('has cosmic rays essentially independent of heliocentric distance', () => {
    expect(Math.abs(powerLawSlope('gcr_local_flux'))).toBeLessThan(0.3);
  });

  it('therefore has a dose rate too flat to colour an orbit by', () => {
    // Anything near zero means the perihelion arc is not hotter, so painting
    // one would be inventing structure.
    expect(Math.abs(powerLawSlope('radiation_decay_gy_per_year'))).toBeLessThan(0.3);
  });
});
