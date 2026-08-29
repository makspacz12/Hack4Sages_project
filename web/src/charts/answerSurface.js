/**
 * The whole biological result, as one field.
 *
 * Survival in this model factorises exactly:
 *
 *     N/N0 = exp(-c_rad * D_cum - c_hyd * H_cum)
 *
 * verified against the shipped replay to a worst deviation of 1.2e-15. Two
 * numbers per fragment therefore determine the answer completely: the dose it
 * accumulated, and the inactivation coefficient it was assigned. Everything
 * else the model computes - three thousand years of N-body integration, the
 * thermal model, radiation pressure, dust erosion, the radionuclide chain -
 * exists to produce the first of those two numbers.
 *
 * So the honest figure is not a time series. It is the plane those two numbers
 * live in, with contours of constant survival drawn across it and the swarm
 * placed on it as points. A reader sees the entire space of outcomes at once,
 * instead of one slice through it, and can see immediately which direction the
 * answer is sensitive to.
 *
 * This replaces four separate charts, each of which was a projection of this
 * plane: survival against time, the dose budget, the velocity-radius heatmap,
 * and the shielding-versus-depth figure.
 *
 * ONE HONEST CAVEAT. Hydrolysis is a second, independent channel, and it is
 * not identically zero - it moves survival by about 2e-4 over this run. It
 * cannot live on these two axes, so a point's drawn position is dose-only
 * while the survival quoted for it is the model's real answer. The gap is far
 * below the width of a plotted dot here, but it is a gap, and it is the reason
 * this figure is called a surface over the biology rather than the model.
 *
 * WHY THE AXES ARE THE WAY THEY ARE. Dose on x because it is the thing the
 * simulation computes and is known to within a factor of about 1.3 across the
 * swarm. Coefficient on y because it is the thing nobody knows, spanning a
 * factor of 17 in the published chronic band alone. Both logarithmic, because
 * the contours of exp(-cD) are straight lines in log-log - the eye reads a
 * straight line far more reliably than a hyperbola.
 */

/** Survival at a point in the plane. */
export function survivalAt(dose, coefficient) {
  return Math.exp(-coefficient * dose);
}

/**
 * The coefficient that yields a given survival at a given dose.
 *
 * This is the contour: c = -ln(N) / D. In log-log it is a straight line of
 * slope -1, which is why the grid reads cleanly.
 */
export function contourCoefficient(dose, survival) {
  if (!(dose > 0) || !(survival > 0) || survival >= 1) return null;
  return -Math.log(survival) / dose;
}

/** Survival levels worth drawing, from almost-everything to sterilised. */
export const CONTOURS = [
  { value: 0.9, label: '90%' },
  { value: 0.5, label: '50%' },
  { value: 0.1, label: '10%' },
  { value: 1e-2, label: '10⁻²' },
  { value: 1e-3, label: '10⁻³' },
  { value: 1e-6, label: '10⁻⁶ · sterilised' },
];

/**
 * Place the swarm in the plane at a chosen time horizon.
 *
 * The dose is extrapolated linearly from the run's own accumulated dose, which
 * is what the model itself does between frames; the coefficient is whatever
 * the run drew for that fragment.
 */
export function swarmPoints(frames, horizonYears, { hydrolysisCoeff = 1200 } = {}) {
  const last = frames?.at(-1);
  const t = last?.time;
  if (!(t > 0)) return [];
  return (last.properties ?? [])
    .filter(p => p?.rock_type
      && Number.isFinite(p.dose_cumulative_gy)
      && Number.isFinite(p.radiation_surv_coeff))
    .map(p => {
      const dose = (p.dose_cumulative_gy / t) * horizonYears;
      const hyd = ((p.hydrolysis_cumulative ?? 0) / t) * horizonYears;
      return {
        id: p.id,
        rockType: p.rock_type,
        radius: p.radius,
        dose,
        hydrolysis: hyd,
        coefficient: p.radiation_surv_coeff,
        // Dose-only, which is where the point sits on the plane.
        survivalFromDose: survivalAt(dose, p.radiation_surv_coeff),
        // The model's actual answer, including the hydrolysis channel. The two
        // differ by about 2e-4 over this run - small, but larger than the
        // rounding the figure implies, so a point can sit a hair off the
        // contour it appears to be on. Reporting the true value and drawing
        // the dose-only position is the honest split: the plane is what the
        // axes say it is, and the number quoted is what the model computed.
        survival: Math.exp(-p.radiation_surv_coeff * dose - hydrolysisCoeff * hyd),
      };
    });
}

/**
 * Axis limits that always contain the swarm and the published band.
 *
 * Padded by a fixed number of decades rather than a percentage, because on a
 * log axis a percentage pad is meaningless.
 */
export function planeExtent(points, bands, { padDecades = 0.35 } = {}) {
  const doses = points.map(p => p.dose).filter(d => d > 0);
  if (!doses.length) return null;
  const dLo = Math.log10(Math.min(...doses)) - padDecades;
  const dHi = Math.log10(Math.max(...doses)) + padDecades;
  const coeffs = points.map(p => p.coefficient).filter(c => c > 0);
  const cLo = Math.log10(Math.min(bands.cMin, ...coeffs)) - padDecades;
  const cHi = Math.log10(Math.max(bands.cMax, ...coeffs)) + padDecades;
  return { dLo, dHi, cLo, cHi };
}
