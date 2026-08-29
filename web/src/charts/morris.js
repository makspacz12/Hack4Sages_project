/**
 * Morris elementary-effects screening: parsing and the conventions.
 *
 * The Python side has produced this for a long time and nothing ever drew it.
 * What the interface showed instead was a tornado plot from a one-at-a-time
 * design, which is not merely older but actively misleading: it measures a
 * local derivative at a point nobody claims to know, and it cannot detect an
 * interaction even in principle.
 *
 * THE CONVENTIONS, AND WHERE THEY COME FROM. These were checked against the
 * sources rather than copied from practice, because the two disagree.
 *
 *   Axes. mu* on x, sigma on y. Morris (1991), Technometrics 33(2):161-174,
 *   Figures 1 and 4 plot the mean of the elementary effects horizontally and
 *   their standard deviation vertically; Saltelli, Ratto, Tarantola &
 *   Campolongo (2012), Chem. Rev. 112(5):PR1-PR21 describe assessment "by
 *   plotting factors on the (mu_i*, sigma_i) axes". Equal unit scale on both,
 *   because the whole reading is about the RATIO sigma/mu*, and a ratio read
 *   off axes with different scales means nothing.
 *
 *   mu* itself. Campolongo, Cariboni & Saltelli (2007), Env. Modelling &
 *   Software 22:1509-1518 introduced the mean of ABSOLUTE effects, because
 *   plain mu cancels for a factor whose effect changes sign. Both are reported
 *   here, and the gap between them is drawn, because |mu| much smaller than
 *   mu* IS the signature of a non-monotonic factor and is invisible if you
 *   plot only one of them.
 *
 *   The diagonals. sigma/mu* = 0.1, 0.5 and 1 come from Garcia Sanchez,
 *   Lacarriere, Musy & Bourges (2014), Energy and Buildings 68:741-753, who
 *   propose exactly these three slopes to separate almost-linear from
 *   monotonic from non-monotonic-or-interacting.
 *
 *   The wedge. mu* +/- 2*SEM with SEM = sigma/sqrt(r) is Morris's own, from
 *   the 1991 paper: "if the coordinates for input i lie outside of the wedge
 *   formed by these two lines, one might interpret this, approximately, as
 *   significant evidence that the expectation is nonzero." It is a
 *   significance test and is NOT the same thing as the diagonals above, which
 *   classify shape. Secondary literature routinely conflates the two.
 */

/** Read a Morris screening file, tolerating an absent or malformed one. */
export function parseMorris(payload) {
  if (payload?.kind !== 'morris_screening' || !Array.isArray(payload.factors)) return null;
  const factors = payload.factors
    .filter(f => Number.isFinite(f?.mu_star) && Number.isFinite(f?.sigma))
    .map(f => ({
      id: f.id,
      label: f.label ?? f.id,
      unit: f.unit ?? '',
      muStar: f.mu_star,
      mu: f.mu,
      sigma: f.sigma,
      samples: f.samples,
      low: f.low,
      high: f.high,
      log: f.log === true,
      ratio: f.mu_star > 0 ? f.sigma / f.mu_star : null,
      // Morris's own significance test, computed here so the chart and the
      // table can never disagree about it.
      sem: Number.isFinite(payload.trajectories) && payload.trajectories > 0
        ? f.sigma / Math.sqrt(payload.trajectories) : null,
    }))
    .sort((a, b) => b.muStar - a.muStar);
  return {
    factors,
    trajectories: payload.trajectories,
    levels: payload.levels,
    evaluations: payload.evaluations,
    metric: payload.metric,
    oatFraction: payload.oat_explored_fraction,
    note: payload.note,
    baseValues: payload.base_values ?? {},
  };
}

/** The three shape classes, in the order Garcia Sanchez et al. define them. */
export const RATIO_LINES = [
  { ratio: 0.1, label: 'σ/μ* = 0.1' },
  { ratio: 0.5, label: '0.5' },
  { ratio: 1.0, label: '1' },
];

/**
 * How a factor should be described, from its sigma/mu* ratio.
 *
 * Wording follows the four categories Morris names on p.162: negligible,
 * linear and additive, non-linear, or involved in interactions.
 */
export function classify(factor) {
  if (factor.ratio === null) return 'no measured effect';
  if (factor.ratio < 0.1) return 'linear and additive';
  if (factor.ratio < 0.5) return 'monotonic';
  if (factor.ratio < 1) return 'almost monotonic';
  return 'non-linear or interacting';
}

/**
 * Whether the effect changes sign across the space.
 *
 * mu averages signed effects and mu* averages their magnitudes, so they agree
 * exactly for a factor that always pushes the same way. A visible gap means
 * the factor helps in one part of the space and hurts in another - which a
 * single ranked bar chart cannot express at all.
 */
export function changesSign(factor, tolerance = 0.02) {
  if (!(factor.muStar > 0)) return false;
  return Math.abs(factor.mu) / factor.muStar < 1 - tolerance;
}

/** Whether Morris's own wedge test calls this factor's mean effect non-zero. */
export function significant(factor) {
  if (factor.sem === null) return null;
  return Math.abs(factor.mu) > 2 * factor.sem;
}

/**
 * Fraction of the input space a one-at-a-time design can reach, in k dimensions.
 *
 * r(k) = pi^(k/2) / (Gamma(k/2 + 1) * 2^k), the volume of the inscribed
 * hypersphere over the volume of the unit hypercube. Saltelli & Annoni (2010),
 * Env. Modelling & Software 25(12):1508-1517, "OAT can't work. A geometric
 * proof". They give r(2) = 0.78 and r(3) = 0.52 explicitly.
 *
 * It is an UPPER bound: the OAT points actually lie on a hypercross inside
 * that sphere, which has measure zero.
 */
export function oatExploredFraction(k) {
  if (!Number.isInteger(k) || k < 1) return null;
  // log-gamma by Lanczos, so large k does not overflow the factorial.
  const lnGamma = z => {
    const g = 7;
    const c = [
      0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
    const zz = z - 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i += 1) x += c[i] / (zz + i);
    const t = zz + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(t) - t + Math.log(x);
  };
  const ln = (k / 2) * Math.log(Math.PI) - lnGamma(k / 2 + 1) - k * Math.LN2;
  return Math.exp(ln);
}
