import { describe, it, expect } from 'vitest';
import {
  SIGNIFICANT_SPREAD, colorForSurvival, formatBound, isSignificant, parseGridPayload,
} from '../src/charts/heatmap.js';

const SAMPLE = {
  kind: 'parameter_grid',
  metric: 'median_population_fraction',
  axes: {
    velocity_kms: [5.0, 10.0, 20.0],
    radius_m: [0.1, 1.0],
  },
  seeds: [0, 1],
  n_cells: 6,
  heatmap_p50: [
    [0.9, 0.8, 0.7],
    [0.95, 0.85, 0.75],
  ],
};

describe('parseGridPayload', () => {
  it('accepts a valid parameter_grid', () => {
    const out = parseGridPayload(SAMPLE);
    expect(out.velocity_kms).toEqual([5, 10, 20]);
    expect(out.radius_m).toEqual([0.1, 1]);
    expect(out.heatmap_p50).toHaveLength(2);
    expect(out.heatmap_p50[0]).toHaveLength(3);
  });

  it('rejects wrong kind', () => {
    expect(() => parseGridPayload({ kind: 'seed_ensemble' }))
      .toThrow(/parameter_grid/);
  });

  it('rejects mismatched heatmap shape', () => {
    expect(() => parseGridPayload({
      ...SAMPLE,
      heatmap_p50: [[0.5]],
    })).toThrow(/row count/);
  });
});

describe('colorForSurvival', () => {
  it('returns a colour string', () => {
    expect(colorForSurvival(0)).toMatch(/^rgb\(/);
    expect(colorForSurvival(1)).toMatch(/^rgb\(/);
  });

  it('handles non-finite values', () => {
    expect(colorForSurvival(NaN)).toBe('#2a2320');
  });
});

describe('refusing to colour noise', () => {
  it('detects a grid whose variation is below resolution', () => {
    // The shipped sample spans 5.2e-7 in survival across every cell.
    expect(isSignificant([0.9999993599983599, 0.9999998837353619])).toBe(false);
    expect(isSignificant([0.05, 0.95])).toBe(true);
  });

  it('treats the threshold as a property of the quantity, not the arithmetic', () => {
    // A change in surviving fraction below 0.01% is far under the
    // factor-of-several uncertainty on the coefficients that produced it.
    expect(SIGNIFICANT_SPREAD).toBe(1e-4);
    expect(isSignificant([0.5, 0.5 + 2e-4])).toBe(true);
    expect(isSignificant([0.5, 0.5 + 5e-5])).toBe(false);
  });

  it('rejects a degenerate extent', () => {
    expect(isSignificant([NaN, 1])).toBe(false);
    expect(isSignificant([1, 1])).toBe(false);
  });

  it('never prints two different bounds identically', () => {
    // fmt(v, 3) rendered both ends of the shipped legend as "1.00".
    const lo = 0.9999993599983599;
    const hi = 0.9999998837353619;
    expect(formatBound(lo, hi - lo)).not.toBe(formatBound(hi, hi - lo));
  });

  it('follows the spread rather than the magnitude when choosing digits', () => {
    // Two digits past what the spread itself resolves, so the bound is
    // readable without inventing precision: a spread of 0.4 gets three
    // decimals, a spread of 1e-6 gets eight.
    expect(formatBound(0.5, 0.4)).toBe('0.500');
    expect(formatBound(0.123456789, 1e-6)).toBe('0.12345679');
    expect(formatBound(0.9999993599983599, 5.24e-7)).toBe('0.999999360');
  });

  it('handles a missing value without producing NaN text', () => {
    expect(formatBound(undefined, 0.1)).toBe('—');
  });
});
