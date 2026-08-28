/**
 * Colour a fragment's path by what happened to it along the way.
 *
 * The existing trails answer "where has this fragment been". They cannot answer
 * "where did it pick up its dose", which is the question the model exists to
 * settle: dose accumulates fastest close to the Sun and while the fragment is
 * still small enough to be poorly shielded, so the trajectory and the biology
 * are not independent.
 *
 * Mapping a scalar onto the path turns the 3D scene from an animation into a
 * measurement. The encoding is luminance-ordered so it survives greyscale
 * printing and the common forms of colour vision deficiency - a rainbow ramp
 * would imply an ordering the eye does not actually read, which is the standard
 * objection to rainbow colour maps in scientific figures (Crameri, Shephard &
 * Heron 2020, Nature Communications 11:5444).
 */

/**
 * Sequential ramp, dark to bright, monotonic in perceived lightness.
 *
 * Single-hue with a warm shift at the top rather than a hue cycle: magnitude is
 * an ordered quantity, and lightness is the channel the eye orders reliably.
 */
const RAMP = [
  [0.00, [26, 22, 20]],
  [0.25, [72, 45, 38]],
  [0.50, [140, 70, 45]],
  [0.75, [206, 120, 55]],
  [1.00, [245, 205, 130]],
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** RGB for a normalised value in [0, 1]. */
export function rampColor(t) {
  const x = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  for (let i = 1; i < RAMP.length; i += 1) {
    const [p0, c0] = RAMP[i - 1];
    const [p1, c1] = RAMP[i];
    if (x <= p1) {
      const f = p1 === p0 ? 0 : (x - p0) / (p1 - p0);
      return {
        r: lerp(c0[0], c1[0], f) / 255,
        g: lerp(c0[1], c1[1], f) / 255,
        b: lerp(c0[2], c1[2], f) / 255,
      };
    }
  }
  const last = RAMP.at(-1)[1];
  return { r: last[0] / 255, g: last[1] / 255, b: last[2] / 255 };
}

/**
 * Per-fragment values of a field over time, and the range across the swarm.
 *
 * The range is taken across every fragment rather than per fragment, so two
 * paths of the same colour carry the same dose. Normalising each path to its
 * own maximum would make every fragment look identical at its endpoint, which
 * is the opposite of what the figure is for.
 */
export function fieldExtent(frames, field) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const frame of frames ?? []) {
    for (const prop of frame?.properties ?? []) {
      const v = prop?.[field];
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return Number.isFinite(lo) ? [lo, hi] : null;
}

/**
 * Colours along one fragment's path, up to the current frame.
 *
 * `log` maps in log space, which is what accumulated dose needs: it spans
 * several decades across a swarm, and a linear map would leave every fragment
 * but the worst-irradiated one at the bottom of the ramp.
 */
export function trajectoryColors(frames, id, field, extent, upTo, { log = false } = {}) {
  if (!extent) return [];
  let [lo, hi] = extent;
  if (log) {
    // Guard the floor: a run that starts at zero dose has no log.
    const floor = lo > 0 ? lo : 1e-12;
    lo = Math.log10(floor);
    hi = Math.log10(Math.max(hi, floor * 10));
  }
  const span = hi - lo;
  const out = [];
  const last = Math.min(upTo ?? frames.length - 1, frames.length - 1);
  for (let i = 0; i <= last; i += 1) {
    const prop = frames[i]?.properties?.find(p => p?.id === id);
    const raw = prop?.[field];
    if (!Number.isFinite(raw)) { out.push(null); continue; }
    const v = log ? Math.log10(Math.max(raw, 1e-12)) : raw;
    out.push(rampColor(span > 0 ? (v - lo) / span : 0));
  }
  return out;
}

/** Legend stops for the colour bar, as {value, color}. */
export function legendStops(extent, steps = 5, { log = false } = {}) {
  if (!extent) return [];
  const [lo, hi] = extent;
  const out = [];
  for (let i = 0; i < steps; i += 1) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const value = log
      ? 10 ** (Math.log10(Math.max(lo, 1e-12))
        + t * (Math.log10(Math.max(hi, 1e-12)) - Math.log10(Math.max(lo, 1e-12))))
      : lo + t * (hi - lo);
    out.push({ value, color: rampColor(t) });
  }
  return out;
}

/** The fields worth colouring a path by, with how each should be scaled. */
export const TRAJECTORY_FIELDS = [
  { key: null, label: 'fragment colour (rock type)', log: false },
  { key: 'dose_cumulative_gy', label: 'accumulated dose [Gy]', log: true },
  { key: 'population_fraction', label: 'surviving fraction', log: false },
  { key: 'gcr_local_flux', label: 'cosmic-ray dose rate', log: true },
  { key: 'T_surface_K', label: 'surface temperature [K]', log: false },
];
