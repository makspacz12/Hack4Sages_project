import { describe, it, expect } from 'vitest';
import { parseSensitivityPayload } from '../src/charts/tornado.js';

const SAMPLE = {
  kind: 'oat_sensitivity',
  fraction: 0.1,
  seeds: [0, 1],
  baseline: { p50: 0.75 },
  tornado: [
    {
      id: 'years',
      label: 'Simulated time',
      unit: 'yr',
      baseline_value: 2.5,
      low_value: 2.25,
      high_value: 2.75,
      low_p50: 0.7,
      high_p50: 0.8,
      span: 0.05,
    },
    {
      id: 'bio_fraction',
      label: 'Biological core',
      unit: '',
      baseline_value: 0.01,
      low_value: 0.009,
      high_value: 0.011,
      low_p50: 0.74,
      high_p50: 0.76,
      span: 0.01,
    },
  ],
};

describe('parseSensitivityPayload', () => {
  it('accepts valid oat_sensitivity JSON', () => {
    const out = parseSensitivityPayload(SAMPLE);
    expect(out.baselineP50).toBe(0.75);
    expect(out.tornado).toHaveLength(2);
    expect(out.tornado[0].label).toBe('Simulated time');
  });

  it('rejects wrong kind', () => {
    expect(() => parseSensitivityPayload({ kind: 'parameter_grid' }))
      .toThrow(/oat_sensitivity/);
  });

  it('rejects empty tornado', () => {
    expect(() => parseSensitivityPayload({ kind: 'oat_sensitivity', tornado: [] }))
      .toThrow(/non-empty/);
  });
});
