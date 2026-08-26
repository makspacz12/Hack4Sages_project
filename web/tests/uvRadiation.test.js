/**
 * uvRadiation.test.js
 * Tests for the two pure-function exports from uvRadiation.js:
 *   getMassSolar, computeHeatIntensity
 */

import { describe, it, expect } from 'vitest';
import { getMassSolar, computeHeatIntensity } from '../src/uvRadiation.js';

const M_SUN_KG = 1.989e30;

// ── getMassSolar ────────────────────────────────────────────────────────────
describe('getMassSolar', () => {
  it('returns mass_solar directly when present', () => {
    expect(getMassSolar({ mass_solar: 2.5 })).toBe(2.5);
  });

  it('converts info.Mass.value (kg) to solar units', () => {
    const obj = { info: { Mass: { value: M_SUN_KG * 1.5, unit: 'kg' } } };
    expect(getMassSolar(obj)).toBeCloseTo(1.5, 10);
  });

  it('converts info.mass.value (lowercase) to solar units', () => {
    const obj = { info: { mass: { value: M_SUN_KG * 0.8 } } };
    expect(getMassSolar(obj)).toBeCloseTo(0.8, 10);
  });

  it('falls back to 1.0 when no mass info is available', () => {
    expect(getMassSolar({})).toBe(1.0);
    expect(getMassSolar({ info: {} })).toBe(1.0);
  });
});

// ── computeHeatIntensity ────────────────────────────────────────────────────
// INNER_MULT = 2, OUTER_MULT = 30 (from module constants)
describe('computeHeatIntensity', () => {
  it('returns 1 when exactly at the inner boundary', () => {
    expect(computeHeatIntensity(2 * 5, 5)).toBe(1);
  });

  it('returns 1 when closer than inner boundary', () => {
    expect(computeHeatIntensity(1, 5)).toBe(1);
  });

  it('returns 0 when exactly at the outer boundary', () => {
    expect(computeHeatIntensity(30 * 5, 5)).toBe(0);
  });

  it('returns 0 when beyond the outer boundary', () => {
    expect(computeHeatIntensity(999, 5)).toBe(0);
  });

  it('returns a value strictly between 0 and 1 mid-range', () => {
    const val = computeHeatIntensity(75, 5); // mid between inner=10 and outer=150
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThan(1);
  });

  it('is monotonically decreasing with distance', () => {
    const starR = 5;
    const distances = [15, 30, 60, 100, 140];
    const intensities = distances.map(d => computeHeatIntensity(d, starR));
    for (let i = 1; i < intensities.length; i++) {
      expect(intensities[i]).toBeLessThan(intensities[i - 1]);
    }
  });
});
