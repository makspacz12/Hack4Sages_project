import { describe, expect, it } from 'vitest';
import {
  TRAJECTORY_FIELDS, fieldExtent, legendStops, rampColor, trajectoryColors,
} from '../src/charts/trajectoryColor.js';

const FRAMES = [
  { time: 0, properties: [
    { id: 'a', dose_cumulative_gy: 1, population_fraction: 1.0 },
    { id: 'b', dose_cumulative_gy: 10, population_fraction: 1.0 },
  ] },
  { time: 1, properties: [
    { id: 'a', dose_cumulative_gy: 100, population_fraction: 0.9 },
    { id: 'b', dose_cumulative_gy: 1000, population_fraction: 0.5 },
  ] },
];

describe('rampColor', () => {
  it('is monotonic in lightness, so it survives greyscale', () => {
    const lum = t => {
      const c = rampColor(t);
      return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    };
    for (let t = 0; t < 1; t += 0.1) {
      expect(lum(t + 0.1)).toBeGreaterThan(lum(t));
    }
  });

  it('clamps outside the unit interval instead of extrapolating', () => {
    expect(rampColor(-5)).toEqual(rampColor(0));
    expect(rampColor(5)).toEqual(rampColor(1));
  });

  it('treats a non-finite value as the floor rather than producing NaN', () => {
    const c = rampColor(NaN);
    expect(Number.isFinite(c.r)).toBe(true);
    expect(c).toEqual(rampColor(0));
  });
});

describe('fieldExtent', () => {
  it('spans the whole swarm, not one fragment', () => {
    expect(fieldExtent(FRAMES, 'dose_cumulative_gy')).toEqual([1, 1000]);
  });

  it('is null when the field is absent', () => {
    expect(fieldExtent(FRAMES, 'not_a_field')).toBeNull();
    expect(fieldExtent([], 'dose_cumulative_gy')).toBeNull();
  });
});

describe('trajectoryColors', () => {
  const extent = fieldExtent(FRAMES, 'dose_cumulative_gy');

  it('gives one colour per frame up to the current one', () => {
    expect(trajectoryColors(FRAMES, 'a', 'dose_cumulative_gy', extent, 0)).toHaveLength(1);
    expect(trajectoryColors(FRAMES, 'a', 'dose_cumulative_gy', extent, 1)).toHaveLength(2);
  });

  it('does not run past the end of the replay', () => {
    expect(trajectoryColors(FRAMES, 'a', 'dose_cumulative_gy', extent, 99)).toHaveLength(2);
  });

  it('log scaling separates values a linear map would crush together', () => {
    // The extent spans three decades, 1 to 1000. A dose of 100 is two decades
    // up - two thirds of the way along a log ramp - but only a tenth of the way
    // along a linear one, where it is nearly indistinguishable from the floor.
    // (Taken at frame 1: at frame 0 fragment 'a' IS the minimum, so both
    // mappings correctly agree on zero.)
    const lin = trajectoryColors(FRAMES, 'a', 'dose_cumulative_gy', extent, 1, { log: false }).at(-1);
    const log = trajectoryColors(FRAMES, 'a', 'dose_cumulative_gy', extent, 1, { log: true }).at(-1);
    expect(log.r).toBeGreaterThan(lin.r);
  });

  it('the two mappings agree at the ends of the range', () => {
    const linMin = trajectoryColors(FRAMES, 'a', 'dose_cumulative_gy', extent, 0, { log: false })[0];
    const logMin = trajectoryColors(FRAMES, 'a', 'dose_cumulative_gy', extent, 0, { log: true })[0];
    expect(logMin).toEqual(linMin);
  });

  it('a more irradiated fragment is brighter', () => {
    const a = trajectoryColors(FRAMES, 'a', 'dose_cumulative_gy', extent, 1, { log: true }).at(-1);
    const b = trajectoryColors(FRAMES, 'b', 'dose_cumulative_gy', extent, 1, { log: true }).at(-1);
    expect(b.r).toBeGreaterThan(a.r);
  });

  it('marks frames with no value rather than inventing one', () => {
    const frames = [{ time: 0, properties: [{ id: 'a' }] }];
    expect(trajectoryColors(frames, 'a', 'dose_cumulative_gy', [0, 1], 0)).toEqual([null]);
  });

  it('returns nothing without an extent', () => {
    expect(trajectoryColors(FRAMES, 'a', 'dose_cumulative_gy', null, 1)).toEqual([]);
  });
});

describe('legendStops', () => {
  it('spans the extent', () => {
    const stops = legendStops([0, 100], 5);
    expect(stops[0].value).toBe(0);
    expect(stops.at(-1).value).toBe(100);
  });

  it('spaces log stops geometrically', () => {
    const stops = legendStops([1, 1000], 4, { log: true });
    expect(stops[1].value).toBeCloseTo(10, 6);
    expect(stops[2].value).toBeCloseTo(100, 6);
  });

  it('is empty without an extent', () => {
    expect(legendStops(null)).toEqual([]);
  });
});

describe('TRAJECTORY_FIELDS', () => {
  it('offers the rock-type default plus physical fields', () => {
    expect(TRAJECTORY_FIELDS[0].key).toBeNull();
    expect(TRAJECTORY_FIELDS.some(f => f.key === 'dose_cumulative_gy')).toBe(true);
  });

  it('scales dose logarithmically and survival linearly', () => {
    expect(TRAJECTORY_FIELDS.find(f => f.key === 'dose_cumulative_gy').log).toBe(true);
    expect(TRAJECTORY_FIELDS.find(f => f.key === 'population_fraction').log).toBe(false);
  });
});
