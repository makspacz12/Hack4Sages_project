import { describe, it, expect } from 'vitest';
import {
  doseRates, survivalRange, sterilisationTime, spreadAttribution, fmtFraction, fmtYears, HORIZONS, fmtFractionHTML,
} from '../src/charts/headline.js';
import sim from '../public/data/cosmos_visualizer_simulation.json';

const BANDS = { cMin: 2.5e-5, cMax: 4.3e-4 };
const rates = doseRates(sim.frames);

describe('doseRates', () => {
  it('reads a rate for every fragment in the swarm', () => {
    expect(rates.length).toBe(14);
    for (const r of rates) expect(r.rate).toBeGreaterThan(0);
  });

  it('reproduces the exported cumulative dose when multiplied back out', () => {
    const t = sim.frames.at(-1).time;
    const props = sim.frames.at(-1).properties.filter(p => p.rock_type);
    for (const r of rates) {
      const p = props.find(x => x.id === r.id);
      expect(r.rate * t).toBeCloseTo(p.dose_cumulative_gy, 9);
    }
  });
});

describe('survivalRange', () => {
  it('survives a horizon that underflows a double', () => {
    // The whole reason this works in log space. At 10 Myr the linear value is
    // exactly 0, and an earlier version printed "NaN x 10^-Infinity".
    const r = survivalRange(rates, 1e7, BANDS);
    expect(r.low).toBe(0);
    expect(Number.isFinite(r.log10Low)).toBe(true);
    expect(Number.isFinite(r.decades)).toBe(true);
    expect(r.decades).toBeGreaterThan(100);
  });

  it('opens up as the horizon lengthens, and is narrow over the run itself', () => {
    const short = survivalRange(rates, 3e3, BANDS);
    const long = survivalRange(rates, 1e6, BANDS);
    // The point of the whole band: 3000 years hides the disagreement.
    expect(short.decades).toBeLessThan(2);
    expect(long.decades).toBeGreaterThan(20);
  });

  it('scales the number of decades linearly with the horizon', () => {
    const a = survivalRange(rates, 1e6, BANDS);
    const b = survivalRange(rates, 1e7, BANDS);
    expect(b.decades / a.decades).toBeCloseTo(10, 6);
  });

  it('puts the low end below the high end at every published horizon', () => {
    for (const h of HORIZONS) {
      const r = survivalRange(rates, h.years, BANDS);
      expect(r.log10Low).toBeLessThan(r.log10High);
    }
  });

  it('returns null rather than guessing when there is nothing to extrapolate', () => {
    expect(survivalRange([], 1e6, BANDS)).toBeNull();
    expect(survivalRange(rates, 0, BANDS)).toBeNull();
  });
});

describe('spreadAttribution', () => {
  it('attributes most of the spread to the coefficient, not the transport', () => {
    const a = spreadAttribution(rates, 1e6, BANDS);
    expect(a.coefficientShare).toBeGreaterThan(0.8);
    expect(a.coefficient).toBeGreaterThan(a.transport);
  });

  it('is scale-free: the share does not depend on the horizon', () => {
    // Both terms are linear in t, so the split is a property of the model, not
    // of how far you extrapolate. If this ever fails the attribution sentence
    // in the banner is horizon-dependent and must say which horizon it means.
    const a = spreadAttribution(rates, 1e5, BANDS).coefficientShare;
    const b = spreadAttribution(rates, 1e7, BANDS).coefficientShare;
    expect(a).toBeCloseTo(b, 12);
  });
});

describe('sterilisationTime', () => {
  it('brackets the run length and stays under the transfer timescale', () => {
    const s = sterilisationTime(rates, BANDS);
    expect(s.fast).toBeLessThan(s.slow);
    expect(s.fast).toBeGreaterThan(3e3);      // longer than this run
    expect(s.slow).toBeLessThan(1e7);         // shorter than a typical transfer
  });
});

describe('formatters', () => {
  it('normalises the mantissa instead of printing 10.0x10^-3', () => {
    expect(fmtFraction(0.001)).toBe('1.0×10⁻³');
    expect(fmtFraction(null, -3)).toBe('1.0×10⁻³');
    // This is the exact float that log10(0.01) produces, and the bug it used
    // to trigger: floor gives -3, so the mantissa came out as 10.0.
    expect(fmtFraction(null, -2.0000000000000004)).toBe('1.0×10⁻²');
  });

  it('carries the mantissa when it would round up to ten', () => {
    // 9.9994 prints as "10.0" at one decimal, so the carry has to happen
    // before rounding, not after. This shipped as "10.0x10^-3" in the banner.
    expect(fmtFraction(null, Math.log10(9.9994e-3))).toBe('1.0×10⁻²');
    expect(fmtFraction(null, Math.log10(9.9e-3))).toBe('9.9×10⁻³');
  });

  it('formats an exponent no double can hold', () => {
    expect(fmtFraction(null, -430)).toBe('1.0×10⁻⁴³⁰');
  });

  it('keeps readable values readable', () => {
    expect(fmtFraction(0.775)).toBe('0.775');
  });

  it('gives a dash rather than NaN for an impossible value', () => {
    expect(fmtFraction(0)).toBe('—');
    expect(fmtFraction(null, -Infinity)).toBe('—');
  });

  it('writes years at human scale, never in exponential notation', () => {
    expect(fmtYears(133000)).toBe('133 kyr');
    expect(fmtYears(3e6)).toBe('3.0 Myr');
    expect(fmtYears(450)).toBe('450 yr');
    for (const y of [1e3, 1.33e5, 3e6, 9.9e6]) {
      expect(fmtYears(y)).not.toMatch(/e[+-]/);
    }
  });
});

/**
 * The exponent must survive a font that lacks Unicode superscripts.
 *
 * fmtFraction builds the exponent from U+207B and the superscript digits.
 * Those are correct characters, but a font is free to have no glyph for them,
 * and the browser then drops them silently. Rendering the headline in Segoe UI
 * Variable Display did exactly that: the superscript minus disappeared and
 * 6.0x10^-46 was displayed as 6.0x10^46, wrong by ninety two orders of
 * magnitude, with nothing on screen to indicate it.
 */
describe('fmtFractionHTML', () => {
  it('emits a real superscript element rather than Unicode characters', () => {
    const html = fmtFractionHTML(0.001);
    expect(html).toBe('1.0×10<sup>-3</sup>');
    // No character from the Unicode superscript block may survive.
    expect(html).not.toMatch(/[\u2070-\u209f]/);
  });

  it('keeps the minus sign, which is the whole point', () => {
    expect(fmtFractionHTML(null, -46)).toContain('<sup>-46</sup>');
  });

  it('agrees with the text form on the value', () => {
    for (const l of [-3, -46, -2, -137]) {
      // Superscript 1, 2 and 3 live in Latin-1 (U+00B9, U+00B2, U+00B3),
      // not in the superscript block, so a range match misses them.
      const MAP = { '⁻': '-', '⁰': '0', '¹': '1', '²': '2',
                    '³': '3', '⁴': '4', '⁵': '5', '⁶': '6',
                    '⁷': '7', '⁸': '8', '⁹': '9' };
      const plain = [...fmtFraction(null, l)].map(c => MAP[c] ?? c).join('');
      const html = fmtFractionHTML(null, l).replace(/<\/?sup>/g, '');
      expect(html).toBe(plain);
    }
  });

  it('leaves a plain decimal alone', () => {
    // Above 1e-2 the formatter prints a decimal with no exponent at all.
    expect(fmtFractionHTML(0.5)).not.toContain('<sup>');
  });
});
