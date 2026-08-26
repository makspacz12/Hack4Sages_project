import { describe, it, expect } from 'vitest';
import { buildSurvivalSeries, formatFraction } from '../src/survivalChart.js';

function frame(time, entries) {
  return { time, properties: entries };
}

describe('buildSurvivalSeries', () => {
  it('returns an empty result for no frames', () => {
    const out = buildSurvivalSeries([]);
    expect(out.ids).toEqual([]);
    expect(out.series).toEqual([]);
    expect(out.times).toEqual([]);
  });

  it('returns an empty result for non-array input', () => {
    expect(buildSurvivalSeries(null).ids).toEqual([]);
    expect(buildSurvivalSeries(undefined).ids).toEqual([]);
  });

  it('ignores objects without population_fraction', () => {
    const out = buildSurvivalSeries([
      frame(0, [
        { id: 'sun', mass: 2e30 },
        { id: 'earth', mass: 6e24 },
        { id: 'asteroid_001', population_fraction: 1.0 },
      ]),
    ]);
    expect(out.ids).toEqual(['asteroid_001']);
  });

  it('extracts one series per fragment', () => {
    const out = buildSurvivalSeries([
      frame(0, [
        { id: 'a', population_fraction: 1.0 },
        { id: 'b', population_fraction: 1.0 },
      ]),
      frame(1, [
        { id: 'a', population_fraction: 0.9 },
        { id: 'b', population_fraction: 0.8 },
      ]),
    ]);
    expect(out.ids).toEqual(['a', 'b']);
    expect(out.series[0]).toEqual([1.0, 0.9]);
    expect(out.series[1]).toEqual([1.0, 0.8]);
    expect(out.times).toEqual([0, 1]);
  });

  it('computes the swarm mean and minimum per frame', () => {
    const out = buildSurvivalSeries([
      frame(0, [
        { id: 'a', population_fraction: 1.0 },
        { id: 'b', population_fraction: 0.5 },
      ]),
      frame(1, [
        { id: 'a', population_fraction: 0.6 },
        { id: 'b', population_fraction: 0.2 },
      ]),
    ]);
    expect(out.mean[0]).toBeCloseTo(0.75, 10);
    expect(out.mean[1]).toBeCloseTo(0.4, 10);
    expect(out.min).toEqual([0.5, 0.2]);
  });

  it('tracks fragments that appear part-way through the run', () => {
    const out = buildSurvivalSeries([
      frame(0, [{ id: 'a', population_fraction: 1.0 }]),
      frame(1, [
        { id: 'a', population_fraction: 0.9 },
        { id: 'late', population_fraction: 1.0 },
      ]),
    ]);
    expect(out.ids).toEqual(['a', 'late']);
    expect(Number.isNaN(out.series[1][0])).toBe(true);
    expect(out.series[1][1]).toBe(1.0);
  });

  it('scales the y axis to the data, not to a fixed 0..1', () => {
    // Real runs stay within a fraction of a percent of 1.0; a fixed axis would
    // render that as a flat line.
    const out = buildSurvivalSeries([
      frame(0, [{ id: 'a', population_fraction: 1.0 }]),
      frame(1, [{ id: 'a', population_fraction: 0.999 }]),
    ]);
    expect(out.yMin).toBeGreaterThan(0.99);
    expect(out.yMax).toBeLessThanOrEqual(1);
    expect(out.yMin).toBeLessThan(0.999);
  });

  it('never produces a zero-height y range', () => {
    const out = buildSurvivalSeries([
      frame(0, [{ id: 'a', population_fraction: 1.0 }]),
      frame(1, [{ id: 'a', population_fraction: 1.0 }]),
    ]);
    expect(out.yMax).toBeGreaterThan(out.yMin);
  });

  it('clamps the y range to [0, 1]', () => {
    const out = buildSurvivalSeries([
      frame(0, [{ id: 'a', population_fraction: 1.0 }]),
      frame(1, [{ id: 'a', population_fraction: 0.0 }]),
    ]);
    expect(out.yMin).toBeGreaterThanOrEqual(0);
    expect(out.yMax).toBeLessThanOrEqual(1);
  });

  it('falls back to the frame index when time is missing', () => {
    const out = buildSurvivalSeries([
      { properties: [{ id: 'a', population_fraction: 1.0 }] },
      { properties: [{ id: 'a', population_fraction: 0.5 }] },
    ]);
    expect(out.times).toEqual([0, 1]);
  });

  it('skips non-finite values without breaking the mean', () => {
    const out = buildSurvivalSeries([
      frame(0, [
        { id: 'a', population_fraction: 1.0 },
        { id: 'b', population_fraction: Number.NaN },
      ]),
    ]);
    expect(out.ids).toEqual(['a']);
    expect(out.mean[0]).toBe(1.0);
  });

  it('tolerates frames with no properties array', () => {
    const out = buildSurvivalSeries([
      frame(0, [{ id: 'a', population_fraction: 1.0 }]),
      { time: 1 },
    ]);
    expect(out.times).toEqual([0, 1]);
    expect(Number.isNaN(out.mean[1])).toBe(true);
  });

  it('tolerates null entries inside properties', () => {
    const out = buildSurvivalSeries([
      frame(0, [null, { id: 'a', population_fraction: 1.0 }]),
    ]);
    expect(out.ids).toEqual(['a']);
  });
});

describe('formatFraction', () => {
  it('keeps six decimals near 1 so tiny losses stay visible', () => {
    expect(formatFraction(0.999081)).toBe('0.999081');
  });

  it('uses four decimals in the mid range', () => {
    expect(formatFraction(0.5)).toBe('0.5000');
  });

  it('switches to exponential for very small survival', () => {
    expect(formatFraction(1e-9)).toBe('1.00e-9');
  });

  it('renders exact zero plainly', () => {
    expect(formatFraction(0)).toBe('0');
  });

  it('returns a dash for missing values', () => {
    expect(formatFraction(undefined)).toBe('—');
    expect(formatFraction(Number.NaN)).toBe('—');
  });
});
