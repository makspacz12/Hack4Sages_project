/**
 * Recompute microbial survival from accumulated dose, in the browser.
 *
 * Survival factorises exactly. Each per-step factor is exp(-c_rad * Ḋ * Δt),
 * and both coefficients are constant for a given fragment, so multiplying the
 * steps together gives
 *
 *     N/N₀ = exp(-c_rad · D_cum − c_hyd · H_cum)
 *
 * with no approximation. The simulation therefore exports the accumulated dose
 * alongside the survival it produced, and any other coefficient is one
 * exponential away — no integration, no server, microseconds.
 *
 * That matters because c_rad is the least certain number in the model: the
 * published chronic band spans 2.5e-5 to 4.3e-4 1/Gy, a factor of seventeen,
 * and the acute laboratory band sits higher still. A reader asked to absorb
 * that from an error bar will misread it; the literature on this is
 * unambiguous. A reader who can drag it and watch the curve move does not have
 * to take anyone's word for anything.
 */

/** Published coefficient bands [1/Gy], from biology/constants.py. */
export const COEFF_BANDS = {
  chronicMin: 2.5e-5,   // D. radiodurans R1, shallow shielding
  default: 2.5e-4,      // B. subtilis wild-type spores
  chronicMax: 4.3e-4,   // B. subtilis, 600 g/cm^2
  acuteMin: 6.1e-4,     // acute low-LET D10 - NOT applicable to GCR
  acuteMax: 1.5e-3,
};

/**
 * Hydrolysis scaling from biology/constants.py.
 *
 * Carries no citation upstream and is flagged unresolved in the coefficient
 * audit, so anything derived from it inherits that caveat.
 */
export const HYDROLYSIS_SURV_COEFF = 1200;

/**
 * Per-fragment accumulated dose, as [time, D_cum, H_cum] triples.
 *
 * Returns an empty map when the replay predates the cumulative-dose export, so
 * callers can fall back to the recorded survival rather than drawing zeros.
 */
export function cumulativeDoseSeries(frames) {
  const out = new Map();
  for (const frame of frames ?? []) {
    const t = Number.isFinite(frame?.time) ? frame.time : null;
    if (t === null) continue;
    for (const prop of frame?.properties ?? []) {
      const d = prop?.dose_cumulative_gy;
      if (!prop?.id || !Number.isFinite(d)) continue;
      if (!out.has(prop.id)) out.set(prop.id, []);
      const h = Number.isFinite(prop.hydrolysis_cumulative)
        ? prop.hydrolysis_cumulative : 0;
      out.get(prop.id).push([t, d, h]);
    }
  }
  return out;
}

/** Whether this replay carries enough information to rescale the coefficient. */
export function supportsRescaling(frames) {
  return cumulativeDoseSeries(frames).size > 0;
}

/**
 * Survival curves at a chosen coefficient.
 *
 * `cRad` may be a number, applied to every fragment, or null to use each
 * fragment's own sampled value from `sampledById` — which reproduces the run
 * exactly and is the honest default.
 */
export function survivalAtCoefficient(doseSeries, cRad, sampledById = new Map()) {
  const out = new Map();
  for (const [id, points] of doseSeries) {
    const c = cRad === null || cRad === undefined
      ? (sampledById.get(id) ?? COEFF_BANDS.default)
      : cRad;
    out.set(id, points.map(([t, d, h]) => [
      t, Math.exp(-c * d - HYDROLYSIS_SURV_COEFF * h),
    ]));
  }
  return out;
}

/** Each fragment's own sampled coefficient, as the run used it. */
export function sampledCoefficients(frames) {
  const out = new Map();
  for (const frame of frames ?? []) {
    for (const prop of frame?.properties ?? []) {
      const c = prop?.radiation_surv_coeff;
      if (prop?.id && Number.isFinite(c) && !out.has(prop.id)) out.set(prop.id, c);
    }
  }
  return out;
}

/**
 * Which band a coefficient falls in, for labelling.
 *
 * The acute band is included because it is a real published range, but it is
 * measured by fast laboratory irradiation and does not transfer to cosmic
 * rays: for heavy ions the action cross-section saturates, so a single track
 * deposits enormous local dose while killing only the spore it hits. Per unit
 * of mean dose, high-LET radiation is less efficient, not more.
 */
export function bandFor(cRad) {
  if (cRad < COEFF_BANDS.chronicMin) return 'below published range';
  if (cRad <= COEFF_BANDS.chronicMax) return 'chronic, Mileikowsky 2000';
  if (cRad < COEFF_BANDS.acuteMin) return 'between bands';
  if (cRad <= COEFF_BANDS.acuteMax) return 'acute low-LET — not applicable to GCR';
  return 'above published range';
}

/**
 * Format a coefficient with its multiplicative uncertainty.
 *
 * A quantity known to within a factor is not symmetric on a linear scale, so
 * "±" misstates it: Limpert, Stahel & Abbt (2001), BioScience 51(5):341-352,
 * give "×/" — times-or-divided-by — as the multiplicative counterpart, where
 * the interval is [x/s, x·s] rather than [x−s, x+s]. Writing a factor-of-2.5
 * uncertainty as a ± interval misstates its own coverage by roughly twenty
 * percentage points.
 */
export function formatMultiplicative(value, factor, digits = 2) {
  return `${value.toExponential(digits)} ×/ ${factor}`;
}
