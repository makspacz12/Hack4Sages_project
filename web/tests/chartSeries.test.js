import { describe, it, expect } from 'vitest';
import {
  fragmentIds, fragmentSeries, meanAcross, relativeChangePpm, distanceFromBody,
  speedSeries,
} from '../src/charts/series.js';

const frame = (time, properties, positions = []) => ({ time, properties, positions });

describe('fragmentIds', () => {
  it('returns only objects carrying population_fraction', () => {
    const ids = fragmentIds([
      frame(0, [
        { id: 'sun', mass: 2e30 },
        { id: 'earth' },
        { id: 'a', population_fraction: 1 },
      ]),
    ]);
    expect(ids).toEqual(['a']);
  });

  it('picks up fragments that first appear in a later frame', () => {
    const ids = fragmentIds([
      frame(0, [{ id: 'a', population_fraction: 1 }]),
      frame(1, [{ id: 'a', population_fraction: 1 }, { id: 'b', population_fraction: 1 }]),
    ]);
    expect(ids).toEqual(['a', 'b']);
  });

  it('handles missing input', () => {
    expect(fragmentIds(undefined)).toEqual([]);
    expect(fragmentIds([])).toEqual([]);
  });
});

describe('fragmentSeries', () => {
  it('builds one [time, value] series per fragment', () => {
    const out = fragmentSeries([
      frame(0, [{ id: 'a', population_fraction: 1.0 }]),
      frame(0.5, [{ id: 'a', population_fraction: 0.8 }]),
    ], 'population_fraction');
    expect(out.get('a')).toEqual([[0, 1.0], [0.5, 0.8]]);
  });

  it('skips frames with a non-numeric time', () => {
    const out = fragmentSeries([
      frame(0, [{ id: 'a', population_fraction: 1 }]),
      { time: 'later', properties: [{ id: 'a', population_fraction: 0.5 }] },
    ], 'population_fraction');
    expect(out.get('a')).toEqual([[0, 1]]);
  });

  it('reads any numeric field, not just survival', () => {
    const out = fragmentSeries([
      frame(0, [{ id: 'a', population_fraction: 1, radius: 3 }]),
    ], 'radius');
    expect(out.get('a')).toEqual([[0, 3]]);
  });
});

describe('meanAcross', () => {
  it('averages fragments sharing a timestamp', () => {
    const map = new Map([
      ['a', [[0, 1.0], [1, 0.6]]],
      ['b', [[0, 0.5], [1, 0.2]]],
    ]);
    const out = meanAcross(map);
    expect(out.map(p => p[0])).toEqual([0, 1]);
    expect(out[0][1]).toBeCloseTo(0.75, 12);
    expect(out[1][1]).toBeCloseTo(0.4, 12);
  });

  it('sorts by time regardless of insertion order', () => {
    const map = new Map([['a', [[2, 1], [0, 3]]]]);
    expect(meanAcross(map).map(p => p[0])).toEqual([0, 2]);
  });

  it('returns an empty array for no series', () => {
    expect(meanAcross(new Map())).toEqual([]);
  });
});

describe('relativeChangePpm', () => {
  it('normalises each fragment to its own starting value', () => {
    const map = new Map([['a', [[0, 100], [1, 99]]]]);
    const out = relativeChangePpm(map);
    expect(out.get('a')[0]).toEqual([0, 0]);
    expect(out.get('a')[1][1]).toBeCloseTo(-10000, 6);
  });

  it('makes a sub-ppm change visible', () => {
    // The real case: 0.0191889 -> 0.0191887 m is invisible in absolute terms.
    const map = new Map([['a', [[0, 0.0191889], [1, 0.0191887]]]]);
    const out = relativeChangePpm(map);
    expect(out.get('a')[1][1]).toBeCloseTo(-10.42, 1);
  });

  it('drops fragments whose starting value is zero', () => {
    const out = relativeChangePpm(new Map([['a', [[0, 0], [1, 1]]]]));
    expect(out.has('a')).toBe(false);
  });

  it('drops empty series', () => {
    expect(relativeChangePpm(new Map([['a', []]])).size).toBe(0);
  });
});

describe('distanceFromBody', () => {
  it('measures each fragment against the named body', () => {
    const out = distanceFromBody([
      frame(0, [{ id: 'a', population_fraction: 1 }], [
        { id: 'sun', x: 0, y: 0, z: 0 },
        { id: 'a', x: 3, y: 4, z: 0 },
      ]),
    ]);
    expect(out.get('a')).toEqual([[0, 5]]);
  });

  it('is relative, not absolute, when the origin body moves', () => {
    const out = distanceFromBody([
      frame(0, [{ id: 'a', population_fraction: 1 }], [
        { id: 'sun', x: 10, y: 0, z: 0 },
        { id: 'a', x: 13, y: 4, z: 0 },
      ]),
    ]);
    expect(out.get('a')).toEqual([[0, 5]]);
  });

  it('skips frames where the origin body is absent', () => {
    const out = distanceFromBody([
      frame(0, [{ id: 'a', population_fraction: 1 }], [{ id: 'a', x: 1, y: 0, z: 0 }]),
    ]);
    expect(out.get('a')).toEqual([]);
  });
});

describe('speedSeries', () => {
  it('takes the magnitude of the velocity vector', () => {
    const out = speedSeries([
      { time: 0, properties: [{ id: 'a', population_fraction: 1 }],
        velocities: [{ id: 'a', vx: 3, vy: 4, vz: 0 }] },
    ]);
    expect(out.get('a')).toEqual([[0, 5]]);
  });

  it('ignores velocities of non-fragment objects', () => {
    const out = speedSeries([
      { time: 0, properties: [{ id: 'a', population_fraction: 1 }],
        velocities: [{ id: 'sun', vx: 1, vy: 0, vz: 0 }, { id: 'a', vx: 0, vy: 0, vz: 2 }] },
    ]);
    expect([...out.keys()]).toEqual(['a']);
    expect(out.get('a')).toEqual([[0, 2]]);
  });

  it('tolerates a frame with no velocities', () => {
    const out = speedSeries([
      { time: 0, properties: [{ id: 'a', population_fraction: 1 }] },
    ]);
    expect(out.get('a')).toEqual([]);
  });
});
