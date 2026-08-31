/**
 * The one number, and the width of not knowing it.
 *
 * The interface used to open on a 3D scene and six small charts, and a viewer
 * had to assemble the result themselves. The result is one sentence, and it is
 * dominated by a coefficient nobody has pinned down.
 *
 * Over the 3000-year run the survival fraction sits between 0.77 and 0.97,  * which reads as "almost nothing happens" and hides the disagreement entirely.
 * The run is simply too short to show its own uncertainty. Extrapolated to the
 * transfer times the literature actually discusses, the same published band
 * for c_rad opens from a factor of 4 to more than forty orders of magnitude.
 * That is the honest headline, and it costs one exponential to compute.
 *
 * WHY A RANGE AND NOT AN INTERVAL. This is not a confidence interval and must
 * never be drawn as one. c_rad is not a random variable that was sampled; it
 * is a fixed quantity whose value is unknown, and the endpoints are the most
 * and least resistant organisms in the published table. The right object is a
 * probability box - the range of answers consistent with the literature, with
 * no claim about where inside it the truth sits (Sarma et al., CHI 2024,
 * doi:10.1145/3613904.3642375). Drawing it as a confidence band would invite
 * exactly the reading it does not support.
 */

/** Transfer times discussed in the literature, for the horizon selector. */
export const HORIZONS = [
  { years: 3e3, label: '3 000 yr', note: 'this run' },
  { years: 1e5, label: '100 kyr', note: 'fast interstellar transfer' },
  { years: 1e6, label: '1 Myr', note: 'lower bound, Belbruno et al. 2012' },
  { years: 1e7, label: '10 Myr', note: 'typical transfer time' },
];

/** The fraction at which a population is treated as sterilised. */
export const STERILISATION_FRACTION = 1e-6;

/**
 * Per-fragment dose rate, in Gy per year.
 *
 * Taken as accumulated dose over elapsed time rather than the instantaneous
 * rate, so it carries the whole run's shielding and orbital history rather
 * than the last frame's.
 */
export function doseRates(frames) {
  const last = frames?.at(-1);
  const t = last?.time;
  if (!(t > 0)) return [];
  return (last.properties ?? [])
    .filter(p => Number.isFinite(p?.dose_cumulative_gy) && p.rock_type)
    .map(p => ({
      id: p.id,
      rockType: p.rock_type,
      radius: p.radius,
      rate: p.dose_cumulative_gy / t,
      sampled: p.radiation_surv_coeff,
    }));
}

/**
 * The extrapolated survival range at one horizon.
 *
 * The extremes pair the worst coefficient with the worst-irradiated fragment
 * and the best with the best, because the question is what the model can and
 * cannot rule out - not what a typical fragment does.
 */
export function survivalRange(rates, horizonYears, { cMin, cMax }) {
  if (!rates.length || !(horizonYears > 0)) return null;
  const worstRate = Math.max(...rates.map(r => r.rate));
  const bestRate = Math.min(...rates.map(r => r.rate));
  // Worked in log10 throughout. exp(-c * rate * t) underflows a double to
  // exactly zero somewhere past 700 e-folds, which at these rates happens
  // before 10 Myr - the first version of this returned -Infinity decades and
  // rendered "NaN x 10^-Infinity" in the headline. The exponent is the answer
  // here anyway; nobody reads 43 significant figures of a survival fraction.
  const log10Low = -cMax * worstRate * horizonYears / Math.LN10;
  const log10High = -cMin * bestRate * horizonYears / Math.LN10;
  return {
    log10Low,
    log10High,
    low: 10 ** log10Low,
    high: 10 ** log10High,
    lowFragment: rates.find(r => r.rate === worstRate),
    highFragment: rates.find(r => r.rate === bestRate),
    decades: log10High - log10Low,
  };
}

/** Years until a population falls to the sterilisation threshold. */
export function sterilisationTime(rates, { cMin, cMax }) {
  if (!rates.length) return null;
  const worstRate = Math.max(...rates.map(r => r.rate));
  const bestRate = Math.min(...rates.map(r => r.rate));
  const k = Math.log(1 / STERILISATION_FRACTION);
  return { fast: k / (cMax * worstRate), slow: k / (cMin * bestRate) };
}

/**
 * How much of the spread each source is responsible for, in decades.
 *
 * This is the number that decides what the tool should be arguing about. If
 * the coefficient owns nearly all of it, then every other subsystem - the
 * N-body integration, the thermal model, the erosion - is refining a quantity
 * that the biology then swamps, and the interface should say so rather than
 * giving all six an equal-sized chart.
 */
export function spreadAttribution(rates, horizonYears, { cMin, cMax }) {
  if (!rates.length) return null;
  const worstRate = Math.max(...rates.map(r => r.rate));
  const bestRate = Math.min(...rates.map(r => r.rate));
  const mid = Math.sqrt(cMin * cMax);
  const k = horizonYears / Math.LN10;
  // Hold the transport fixed and move only the coefficient, then the reverse.
  // In log space each is a plain difference, so no underflow is possible.
  const coefficient = (cMax - cMin) * worstRate * k;
  const transport = mid * (worstRate - bestRate) * k;
  const total = coefficient + transport;
  return {
    coefficient,
    transport,
    total,
    coefficientShare: total > 0 ? coefficient / total : 0,
  };
}

/** Compact powers-of-ten label; plain digits stay plain. */
export function fmtFraction(v, log10v = null) {
  const l = log10v ?? (v > 0 ? Math.log10(v) : null);
  if (l === null || !Number.isFinite(l)) return '—';
  if (l >= -2) return (10 ** l).toFixed(3);
  // Normalise the mantissa into [1, 10). Taking floor(log10(v)) directly gives
  // 10.0x10^-3 for 0.01, because log10(0.01) evaluates to -2.0000000000000004
  // and floors to -3.
  let e = Math.floor(l);
  let m = 10 ** (l - e);
  // Guard at 9.95, not at 10: the mantissa is printed to one decimal, so
  // anything from 9.95 up rounds to "10.0" and needs carrying first.
  if (m >= 9.95) { m /= 10; e += 1; }
  return `${m.toFixed(1)}×10${superscript(e)}`;
}

/**
 * The same value as markup, with a real superscript instead of Unicode.
 *
 * WHY THIS EXISTS. fmtFraction builds the exponent from the Unicode
 * superscript block, U+207B and U+2070 upward. Those characters are correct
 * and they survive copy and paste, which is why the text form keeps them.
 *
 * But a font is free to have no glyph for them, and when that happens the
 * browser drops the character silently. Rendering the headline in Segoe UI
 * Variable Display did exactly that: the superscript minus vanished and
 * 6.0x10 to the minus 46 was displayed as 6.0x10 to the 46. The DOM was
 * correct, the arithmetic was correct, and the screen was wrong by ninety two
 * orders of magnitude, with nothing to indicate it.
 *
 * A number that changes meaning depending on which fonts the presenting
 * machine happens to have installed is not acceptable in the one figure the
 * whole talk rests on. <sup> with ordinary digits cannot fail that way,
 * because every font has a minus sign and the digits nought to nine.
 */
export function fmtFractionHTML(v, log10v = null) {
  const text = fmtFraction(v, log10v);
  if (!text.includes('×')) return text;
  const [mantissa, exp] = text.split('×10');
  const plain = [...exp].map(c => PLAIN[c] ?? c).join('');
  return `${mantissa}×10<sup>${plain}</sup>`;
}

/** Years rendered at the scale a reader actually thinks in. */
export function fmtYears(y) {
  if (!Number.isFinite(y)) return '—';
  const scale = (v, unit) => `${v < 10 ? v.toPrecision(2) : Math.round(v)} ${unit}`;
  if (y >= 1e6) return scale(y / 1e6, 'Myr');
  if (y >= 1e3) return scale(y / 1e3, 'kyr');
  return `${Math.round(y)} yr`;
}

const SUPER = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
function superscript(n) {
  return String(n).split('').map(c => SUPER[c] ?? c).join('');
}

/** Reverse of SUPER, for turning a rendered exponent back into plain digits. */
const PLAIN = Object.fromEntries(
  Object.entries(SUPER).map(([plain, sup]) => [sup, plain]),
);
