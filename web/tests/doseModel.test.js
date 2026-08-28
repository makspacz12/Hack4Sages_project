import { describe, expect, it } from 'vitest';
import {
  COEFF_BANDS, HYDROLYSIS_SURV_COEFF, bandFor, cumulativeDoseSeries,
  formatMultiplicative, sampledCoefficients, supportsRescaling,
  survivalAtCoefficient,
} from '../src/charts/doseModel.js';

const FRAMES = [
  { time: 0, properties: [
    { id: 'asteroid_1', dose_cumulative_gy: 0, hydrolysis_cumulative: 0,
      radiation_surv_coeff: 2.5e-4, rock_type: 'ci_chondrite' },
    { id: 'asteroid_2', dose_cumulative_gy: 0, hydrolysis_cumulative: 0,
      radiation_surv_coeff: 5.0e-5, rock_type: 'enstatite' },
  ] },
  { time: 100, properties: [
    { id: 'asteroid_1', dose_cumulative_gy: 400, hydrolysis_cumulative: 0 },
    { id: 'asteroid_2', dose_cumulative_gy: 400, hydrolysis_cumulative: 0 },
  ] },
];

describe('cumulativeDoseSeries', () => {
  it('collects dose per fragment over time', () => {
    const s = cumulativeDoseSeries(FRAMES);
    expect(s.size).toBe(2);
    expect(s.get('asteroid_1')).toEqual([[0, 0, 0], [100, 400, 0]]);
  });

  it('reports that an older replay cannot be rescaled', () => {
    const old = [{ time: 0, properties: [{ id: 'a', population_fraction: 1 }] }];
    expect(supportsRescaling(old)).toBe(false);
    expect(supportsRescaling(FRAMES)).toBe(true);
  });

  it('survives frames with no usable time', () => {
    expect(cumulativeDoseSeries([{ properties: [] }, null]).size).toBe(0);
  });
});

describe('survivalAtCoefficient', () => {
  it('reproduces the exponential exactly', () => {
    const s = survivalAtCoefficient(cumulativeDoseSeries(FRAMES), 2.5e-4);
    const [, value] = s.get('asteroid_1').at(-1);
    expect(value).toBeCloseTo(Math.exp(-2.5e-4 * 400), 15);
  });

  it('a higher coefficient kills more', () => {
    const dose = cumulativeDoseSeries(FRAMES);
    const gentle = survivalAtCoefficient(dose, COEFF_BANDS.chronicMin).get('asteroid_1').at(-1)[1];
    const harsh = survivalAtCoefficient(dose, COEFF_BANDS.acuteMax).get('asteroid_1').at(-1)[1];
    expect(harsh).toBeLessThan(gentle);
  });

  it('falls back to each fragment sampled value when given null', () => {
    const dose = cumulativeDoseSeries(FRAMES);
    const sampled = sampledCoefficients(FRAMES);
    const s = survivalAtCoefficient(dose, null, sampled);
    // Same dose, different organisms: the curves must differ.
    expect(s.get('asteroid_1').at(-1)[1]).toBeCloseTo(Math.exp(-2.5e-4 * 400), 15);
    expect(s.get('asteroid_2').at(-1)[1]).toBeCloseTo(Math.exp(-5.0e-5 * 400), 15);
  });

  it('includes the hydrolysis channel in the exponent', () => {
    const frames = [{ time: 1, properties: [
      { id: 'a', dose_cumulative_gy: 100, hydrolysis_cumulative: 1e-5 },
    ] }];
    const v = survivalAtCoefficient(cumulativeDoseSeries(frames), 1e-4).get('a')[0][1];
    expect(v).toBeCloseTo(Math.exp(-1e-4 * 100 - HYDROLYSIS_SURV_COEFF * 1e-5), 15);
  });

  it('never returns a value outside [0, 1]', () => {
    const frames = [{ time: 1, properties: [
      { id: 'a', dose_cumulative_gy: 1e9, hydrolysis_cumulative: 0 },
    ] }];
    const v = survivalAtCoefficient(cumulativeDoseSeries(frames), 1e-3).get('a')[0][1];
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });
});

describe('bandFor', () => {
  it('names the chronic band', () => {
    expect(bandFor(2.5e-4)).toContain('Mileikowsky');
  });

  it('warns that the acute band does not transfer to cosmic rays', () => {
    expect(bandFor(1.0e-3)).toContain('not applicable');
  });

  it('flags values outside anything published', () => {
    expect(bandFor(1e-9)).toContain('below');
    expect(bandFor(1)).toContain('above');
  });
});

describe('formatMultiplicative', () => {
  it('uses times-or-divided-by, not plus-or-minus', () => {
    const s = formatMultiplicative(2.5e-4, 2.5);
    expect(s).toContain('×/');
    expect(s).not.toContain('±');
  });
});
