import { describe, it, expect } from 'vitest';
import { parseGridPayload, colorForSurvival } from '../src/charts/heatmap.js';

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
