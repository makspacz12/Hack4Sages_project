/**
 * tests/rangeLog.test.js
 * Dual-range helpers (log radius + linear speed).
 */

import { describe, it, expect } from 'vitest';
import {
  valueToPos, posToValue,
  valueToPosLinear, posToValueLinear,
  clampMin, clampMax, MIN_RANGE_RATIO,
} from '../src/ui/rangeLog.js';

const LO = 0.001;
const HI = 5;

describe('valueToPos / posToValue (log)', () => {
  it('maps endpoints to 0 and 1', () => {
    expect(valueToPos(LO, LO, HI)).toBeCloseTo(0);
    expect(valueToPos(HI, LO, HI)).toBeCloseTo(1);
  });

  it('round-trips', () => {
    for (const v of [0.001, 0.1, 1, 5]) {
      expect(posToValue(valueToPos(v, LO, HI), LO, HI)).toBeCloseTo(v, 10);
    }
  });
});

describe('valueToPosLinear / posToValueLinear', () => {
  it('maps endpoints and round-trips', () => {
    expect(valueToPosLinear(1, 1, 60)).toBeCloseTo(0);
    expect(valueToPosLinear(60, 1, 60)).toBeCloseTo(1);
    for (const v of [1, 5.03, 20, 60]) {
      expect(posToValueLinear(valueToPosLinear(v, 1, 60), 1, 60)).toBeCloseTo(v, 10);
    }
  });
});

describe('clampMin / clampMax', () => {
  it('keeps max/min >= MIN_RANGE_RATIO', () => {
    expect(clampMin(2, 1, LO, HI)).toBeCloseTo(1 / MIN_RANGE_RATIO);
    expect(clampMax(0.5, 1, LO, HI)).toBeCloseTo(MIN_RANGE_RATIO);
  });

  it('stays inside absolute bounds', () => {
    expect(clampMin(1e-6, 1, LO, HI)).toBe(LO);
    expect(clampMax(100, 1, LO, HI)).toBe(HI);
  });
});
