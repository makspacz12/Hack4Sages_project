/**
 * A second clock, for the eye.
 *
 * THE PROBLEM. The replay samples positions every 20 years, and the fragments
 * have orbital periods of 1.8 to 3.8 years. That is a ratio of about eight, so
 * one frame gap is eight revolutions, and no playback rate makes orbital
 * motion visible: at the slowest setting the transport offers, one orbit still
 * completes in 0.12 seconds. Interpolating between samples fixes the
 * teleporting, but it cannot fix this - the information simply is not in the
 * frame sequence. Re-running at a finer step is not available either; 3000
 * years at a step fine enough for Mercury is about 2.8 GB.
 *
 * WHY A SECOND CLOCK IS SOUND, NOT A TRICK. The two things the viewer is
 * watching have completely different time structure:
 *
 *   Orbital motion is periodic on a scale of years. It is also known
 *   analytically - each body's osculating elements come straight from its
 *   state vector, so its position at ANY time is computable, not interpolated
 *   from samples.
 *
 *   Dose is a straight line. Measured across all fourteen fragments over the
 *   whole 3000-year run, cumulative dose departs from rate * t by at most
 *   0.19%. There is no structure in it to miss.
 *
 * So the orbits can be shown at a rate where an orbit is legible, while the
 * dose readout sweeps the full 3000 years, and nothing scientific is lost:
 * every dose value shown is computed from the same measured rate the
 * simulation produced, at whatever time is asked for. The two clocks are not
 * two speeds for one quantity - they are the natural rates of two quantities
 * that happen to share a screen.
 *
 * WHAT IS NOT CLAIMED. The orbital clock does not re-integrate anything. It
 * advances each body along the ellipse it is on at the bracketing sample, so
 * the secular evolution - the ellipse itself changing shape across the run,
 * which is the real dynamical result - still comes from the integration and
 * still appears as the transport clock moves.
 */

import { stateToElements, propagateElements, keplerSafe } from './orbits.js';

/**
 * Simulated years per second of wall clock for the orbital view.
 *
 * At 3 yr/s the median fragment (period 2.4 yr) completes one orbit in 0.8
 * seconds and Earth in 0.33 - fast enough to read as orbital motion, slow
 * enough to follow one body around. This is the rate the eye gets; the dose
 * readout is driven by the transport clock and is unaffected.
 */
export const DEFAULT_ORBITAL_RATE = 3;

/**
 * Create the orbital clock.
 *
 * It holds its own time, in years, which advances whenever the scene is
 * playing and is reset whenever the transport jumps somewhere else - because
 * the elements it propagates from belong to a particular sampled frame.
 */
export function createOrbitalClock({ rate = DEFAULT_ORBITAL_RATE } = {}) {
  return {
    rate,
    /** Years elapsed since the bracketing sample. */
    years: 0,
    enabled: true,
    /** Which frame the current element set was derived from. */
    _frame: -1,
    _elements: new Map(),
  };
}

/** Advance the clock. `deltaSec` is real seconds. */
export function tickOrbitalClock(clock, deltaSec, playing) {
  if (!clock?.enabled || !playing) return;
  clock.years += deltaSec * clock.rate;
}

/** Start again from a sampled frame; call whenever the transport moves. */
export function resetOrbitalClock(clock, frameIndex) {
  if (!clock) return;
  clock.years = 0;
  clock._frame = frameIndex;
  clock._elements.clear();
}

/**
 * Place every body at where its own orbit puts it, `clock.years` after the
 * sampled frame.
 *
 * Elements are derived once per frame and cached: they only change when the
 * transport moves to a different sample, and re-deriving them every animation
 * tick would be pure waste at 60 fps.
 *
 * A body the two-body step cannot describe - the 17.7 AU outlier, or anything
 * unbound - is left at its sampled position, which is the one place its
 * position is actually known.
 */
export function applyOrbitalClock(clock, frame, meshById, scale) {
  if (!clock?.enabled || !frame) return false;

  const sunPos = (frame.positions ?? []).find(p => p.id === 'sun');
  if (!sunPos) return false;

  if (clock._elements.size === 0) {
    const sunVel = (frame.velocities ?? []).find(v => v.id === 'sun');
    const velById = new Map((frame.velocities ?? []).map(v => [v.id, v]));
    for (const p of frame.positions ?? []) {
      if (p.id === 'sun') continue;
      const v = velById.get(p.id);
      if (!v) continue;
      // Velocity must be Sun-relative: the Sun itself moves 2.6e-3 AU/yr, and
      // elements taken in the scene frame come out wrong.
      const el = stateToElements(
        { x: p.x - sunPos.x, y: p.y - sunPos.y, z: p.z - sunPos.z },
        {
          x: v.vx - (sunVel?.vx ?? 0),
          y: v.vy - (sunVel?.vy ?? 0),
          z: v.vz - (sunVel?.vz ?? 0),
        },
      );
      if (el) clock._elements.set(p.id, el);
    }
  }

  for (const p of frame.positions ?? []) {
    const mesh = meshById.get(p.id);
    if (!mesh) continue;
    if (p.id === 'sun') {
      mesh.position.set(p.x * scale, p.y * scale, p.z * scale);
      continue;
    }
    const el = clock._elements.get(p.id);
    // keplerSafe is asked about the interval actually being propagated, which
    // for this clock is however far it has run since the sample.
    if (!el || !keplerSafe(el, clock.years)) {
      mesh.position.set(p.x * scale, p.y * scale, p.z * scale);
      continue;
    }
    const rel = propagateElements(el, clock.years);
    if (!rel) {
      mesh.position.set(p.x * scale, p.y * scale, p.z * scale);
      continue;
    }
    mesh.position.set(
      (rel.x + sunPos.x) * scale,
      (rel.y + sunPos.y) * scale,
      (rel.z + sunPos.z) * scale,
    );
  }
  return true;
}
