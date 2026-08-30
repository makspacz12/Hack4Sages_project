/**
 * Colouring the fragments by the dose they have absorbed.
 *
 * WHY DOSE AND NOT SURVIVAL. Survival is the quantity the project is about, so
 * it is the obvious thing to encode - and it is the wrong one here. Across the
 * whole 3000-year run every fragment retains between 77.5% and 97.1% of its
 * microbes. Nothing is sterilised; nothing even comes close. Colouring by
 * survival on a ramp stretched to that range would paint a dramatic spread
 * across a 20-point difference, and the first person to ask what the colour
 * bar's bounds are would be told "0.775 to 0.971". The picture would be
 * carrying far more drama than the numbers support.
 *
 * Dose is the honest choice. It is what the model actually integrates, it runs
 * from zero to 726 Gy over the run, and it grows monotonically, so the scene
 * visibly changes as the transport advances rather than looking static.
 *
 * WHY A FIXED SCALE. The bounds are constants, not derived from the data in
 * view. An auto-scaled ramp re-maps its colours whenever the selection or the
 * time window changes, so the same colour means different things in two
 * screenshots of the same tool - which makes the encoding decorative rather
 * than quantitative. Fixed bounds mean a colour can be read off the bar.
 *
 * The ramp itself is the one already used by the trajectory figures: batlow,
 * perceptually uniform and colourblind-safe (Crameri et al. 2020), with its
 * dark end raised so the whole range stays legible against the dark scene.
 */

import { rampColor } from './charts/trajectoryColor.js';

/**
 * Upper bound of the dose scale, in gray.
 *
 * The most irradiated fragment reaches 726 Gy after 3000 years. 1000 is the
 * round number just above that, so the full range of the run is used without
 * the top of the ramp being unreachable, and the bound stays a stated constant
 * rather than a property of whichever fragments happen to be selected.
 */
export const DOSE_MAX_GY = 1000;

/** Colour for an absorbed dose in gray, as {r,g,b} in 0..1. */
export function doseColor(gy) {
  const t = Number.isFinite(gy) ? gy / DOSE_MAX_GY : 0;
  return rampColor(Math.min(1, Math.max(0, t)));
}

/**
 * Dose per fragment at a given frame, keyed by id.
 *
 * Read from the replay rather than recomputed, so what is drawn is what the
 * simulation produced.
 */
export function dosesAtFrame(frame) {
  const out = new Map();
  for (const p of frame?.properties ?? []) {
    if (p?.id && Number.isFinite(p.dose_cumulative_gy)) {
      out.set(p.id, p.dose_cumulative_gy);
    }
  }
  return out;
}

/**
 * Stops for the colour bar: evenly spaced doses and their colours.
 *
 * A colour encoding without a labelled scale is decoration, so this exists to
 * make the legend unavoidable rather than optional.
 */
export function doseLegendStops(steps = 5) {
  const out = [];
  for (let i = 0; i < steps; i += 1) {
    const gy = (DOSE_MAX_GY * i) / (steps - 1);
    out.push({ gy, color: doseColor(gy) });
  }
  return out;
}
