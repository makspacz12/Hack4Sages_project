/**
 * Osculating orbits, so the scene stops drawing a lie.
 *
 * THE PROBLEM. The replay writes a frame every 20 years. The fragments have
 * orbital periods between 1.8 and 74.6 years, so between two consecutive
 * frames a fragment completes anywhere from a third of an orbit to eleven
 * whole ones. The trail was built by joining the last ten sampled positions
 * with straight lines - that is, chords across up to a hundred and ten
 * revolutions. The result looks like a spirograph and means nothing: the
 * straight segment between two points separated by eleven orbits corresponds
 * to no path the fragment ever took.
 *
 * This is not an aliasing artefact to be smoothed. It is a figure that asserts
 * something false, and it was the most eye-catching thing on the screen.
 *
 * THE FIX. A frame carries both position and velocity, and two vectors plus a
 * gravitational parameter determine an orbit completely. So instead of joining
 * samples, each fragment's *current* orbit is solved for and drawn in full.
 * The curve is then exact at every point rather than correct at ten points and
 * fictional in between, and it does not care how coarsely time was sampled.
 *
 * What is drawn is the OSCULATING orbit: the ellipse the fragment would follow
 * from here if every perturbation stopped. Planets are perturbing it, so it
 * changes from frame to frame, and watching it breathe is precisely the
 * secular eccentricity pumping that spreads the swarm - the interesting
 * dynamics, which the old trails hid inside noise.
 *
 * Units are the replay's own: AU, years, solar masses, so GM = 4*pi^2.
 */

export const SUN_MU_AU3_YR2 = 4 * Math.PI * Math.PI;

/** Cross product of two {x,y,z}. */
function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function norm(a) { return Math.sqrt(dot(a, a)); }

/**
 * Classical elements from a state vector.
 *
 * Returns null for a hyperbolic or parabolic state: those have no closed curve
 * to draw, and inventing one would be the same class of error this replaces.
 * The caller draws an escaping fragment as an open arc instead.
 */
export function stateToElements(r, v, mu = SUN_MU_AU3_YR2) {
  const rMag = norm(r);
  const vMag = norm(v);
  if (!(rMag > 0) || !Number.isFinite(vMag)) return null;

  const energy = (vMag * vMag) / 2 - mu / rMag;
  // Bound orbits only. At exactly zero the semi-major axis is infinite.
  if (!(energy < 0)) return null;
  const a = -mu / (2 * energy);

  const h = cross(r, v);
  const hMag = norm(h);
  if (!(hMag > 0)) return null;

  // Eccentricity vector; its magnitude is e and it points at periapsis.
  const c1 = vMag * vMag - mu / rMag;
  const c2 = dot(r, v);
  const eVec = {
    x: (c1 * r.x - c2 * v.x) / mu,
    y: (c1 * r.y - c2 * v.y) / mu,
    z: (c1 * r.z - c2 * v.z) / mu,
  };
  const e = norm(eVec);
  if (!(e < 1)) return null;

  const inc = Math.acos(Math.min(1, Math.max(-1, h.z / hMag)));

  // Node vector, z-hat cross h. Degenerate for an equatorial orbit, where the
  // ascending node is undefined and any consistent choice will do.
  const n = { x: -h.y, y: h.x, z: 0 };
  const nMag = norm(n);

  let raan = 0;
  let argp = 0;
  if (nMag > 1e-12) {
    raan = Math.acos(Math.min(1, Math.max(-1, n.x / nMag)));
    if (n.y < 0) raan = 2 * Math.PI - raan;
    if (e > 1e-12) {
      argp = Math.acos(Math.min(1, Math.max(-1, dot(n, eVec) / (nMag * e))));
      if (eVec.z < 0) argp = 2 * Math.PI - argp;
    }
  } else if (e > 1e-12) {
    // Equatorial: measure the periapsis longitude from the x axis directly.
    argp = Math.atan2(eVec.y, eVec.x);
    if (h.z < 0) argp = 2 * Math.PI - argp;
  }

  // Where the body is on that ellipse right now, as a mean anomaly.
  //
  // Needed to advance it in time. The eccentric anomaly comes straight from
  // the state: cos E from the radius, sin E from the radial velocity, and
  // atan2 puts it in the right quadrant without any case analysis.
  const cosE = 1 - rMag / a;
  const sinE = dot(r, v) / Math.sqrt(mu * a);
  const ecc = Math.atan2(sinE, cosE);
  const meanAnomaly = ecc - e * Math.sin(ecc);

  return {
    a, e, inc, raan, argp, meanAnomaly,
    meanMotion: Math.sqrt(mu / (a * a * a)),
    period: 2 * Math.PI * Math.sqrt(a ** 3 / mu),
  };
}

/**
 * Points along the full ellipse, in the frame the state vector was given in.
 *
 * Sampled uniformly in true anomaly rather than in time. Uniform-in-time would
 * crowd points at apoapsis, where the curve is straightest and needs them
 * least, and starve periapsis, where it turns hardest - the opposite of what a
 * polyline wants.
 */
export function orbitPoints(elements, segments = 128) {
  if (!elements) return [];
  const { a, e, inc, raan, argp } = elements;
  const p = a * (1 - e * e);
  const cosO = Math.cos(raan);
  const sinO = Math.sin(raan);
  const cosI = Math.cos(inc);
  const sinI = Math.sin(inc);

  const out = [];
  for (let k = 0; k <= segments; k += 1) {
    const nu = (2 * Math.PI * k) / segments;
    const rr = p / (1 + e * Math.cos(nu));
    // Argument of latitude: periapsis plus true anomaly. Folding the two
    // together is what collapses the usual three rotation matrices into the
    // four cosines below.
    const cw = Math.cos(argp + nu);
    const sw = Math.sin(argp + nu);
    out.push({
      x: rr * (cosO * cw - sinO * sw * cosI),
      y: rr * (sinO * cw + cosO * sw * cosI),
      z: rr * (sw * sinI),
    });
  }
  return out;
}

/**
 * The orbit a body is on right now, as points, or null if it is not bound.
 *
 * `origin` is subtracted first, because the elements are only meaningful
 * relative to the attracting body, and added back afterwards so the curve
 * lands where the scene expects it.
 */
export function osculatingOrbit(position, velocity, origin, {
  mu = SUN_MU_AU3_YR2, segments = 128, originVelocity = null,
} = {}) {
  const r = {
    x: position.x - origin.x, y: position.y - origin.y, z: position.z - origin.z,
  };
  // Velocity must be relative to the attractor too, not only position. The
  // integration is barycentric and the Sun itself moves at about 2.6e-3 AU/yr
  // under the planets; ignoring that is a small but real error in the elements
  // and it grows with the fragment's aphelion.
  const v = originVelocity
    ? {
      x: velocity.x - originVelocity.x,
      y: velocity.y - originVelocity.y,
      z: velocity.z - originVelocity.z,
    }
    : velocity;
  const elements = stateToElements(r, v, mu);
  if (!elements) return null;
  const pts = orbitPoints(elements, segments);
  for (const q of pts) { q.x += origin.x; q.y += origin.y; q.z += origin.z; }
  return { elements, points: pts };
}

/**
 * Where the body sits on its own ellipse a time dt later.
 *
 * WHY THIS EXISTS. Positions are sampled every 20 years, and the shortest
 * period in the system is Mercury's 0.24 years - a dynamic range of 12,500.
 * Between two samples Earth completes twenty orbits and a fragment moves a
 * median of 2.48 AU, so playing the samples back in order shows objects
 * teleporting rather than moving. Re-running at a fine enough step is not an
 * option: 3000 years at 0.05 yr per frame is 60,000 frames, about 2.8 GB
 * against a file that is already 7 MB.
 *
 * WHY IT IS HONEST. The scene already draws each fragment's osculating ellipse
 * rather than joining sampled points, precisely so the path is exact
 * everywhere instead of correct at 151 places and fictional between them.
 * This puts the marker ON that curve. It adds no claim the scene was not
 * already making - and refusing to move the marker along a line you have
 * already drawn is not more honest, only less consistent.
 *
 * HOW GOOD IT IS. Measured against the REBOUND positions across every 20-year
 * gap in the shipped replay, for all fourteen fragments:
 *
 *   median error   0.032 AU  =  1.9 world units
 *   the jump it replaces      =  149 world units
 *
 * So it is roughly 78x closer to the truth than showing the sampled position,
 * and it is smooth. It is a two-body step, so it does not carry the planetary
 * perturbations that act during the gap; those still appear, because the
 * elements are re-derived from the next sampled state whenever one is crossed.
 * The ellipse itself keeps breathing over the 3000 years, which is the real
 * dynamical story.
 *
 * WHERE IT FAILS. asteroid_011 has a = 17.7 AU and a 74.7-year period, so a
 * single 20-year gap is more than a quarter of its orbit and its own errors
 * reach 24 AU. Callers must not interpolate a body whose period is comparable
 * to the sampling interval; `keplerSafe` below is the test.
 */
export function propagateElements(elements, dt) {
  if (!elements || !Number.isFinite(dt)) return null;
  const { a, e, inc, raan, argp, meanAnomaly, meanMotion } = elements;
  if (!Number.isFinite(a) || !Number.isFinite(meanAnomaly)) return null;

  // Advance the mean anomaly - the one angle that is linear in time - then
  // invert Kepler's equation to get the eccentric anomaly back.
  let M = meanAnomaly + meanMotion * dt;
  M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  // Newton on E - e sin E = M. Converges in a handful of steps for e < 1;
  // the iteration cap is a guard, not an expectation.
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 40; i += 1) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    if (Math.abs(fp) < 1e-14) break;
    const step = f / fp;
    E -= step;
    if (Math.abs(step) < 1e-13) break;
  }

  // True anomaly from the eccentric anomaly, then the same rotation
  // orbitPoints uses, so a propagated marker lands exactly on the drawn curve.
  const nu = Math.atan2(
    Math.sqrt(1 - e * e) * Math.sin(E),
    Math.cos(E) - e,
  );
  const rr = a * (1 - e * Math.cos(E));

  const cosO = Math.cos(raan);
  const sinO = Math.sin(raan);
  const cosI = Math.cos(inc);
  const sinI = Math.sin(inc);
  const cw = Math.cos(argp + nu);
  const sw = Math.sin(argp + nu);

  return {
    x: rr * (cosO * cw - sinO * sw * cosI),
    y: rr * (sinO * cw + cosO * sw * cosI),
    z: rr * (sw * sinI),
  };
}

/**
 * Whether a body may be advanced across a gap of `dt` at all.
 *
 * The test is NOT "is dt small compared to the period". A two-body step wraps
 * around the ellipse correctly however many revolutions it covers, so a
 * fragment with a 2.4-year period propagates perfectly well across a 20-year
 * gap - it simply goes round eight times and lands in the right place. An
 * earlier version of this function tested dt/period <= 0.25 and so excluded
 * thirteen of the fourteen fragments while keeping the only one that genuinely
 * fails, which is the exact opposite of what is wanted.
 *
 * What actually breaks the approximation is the orbit CHANGING within the gap.
 * That is a question about how strongly the body is perturbed, and the honest
 * proxy available here is the semi-major axis: a fragment out at 17.7 AU is
 * being thrown around by Jupiter and its elements at the start of a gap do not
 * describe the end of it. asteroid_011 is that body, and its measured error
 * reaches 24 AU - larger than the inner Solar System.
 *
 * Bodies that fail this are drawn at their sampled position, which is the one
 * place their position is actually known.
 */
export function keplerSafe(elements, dt) {
  if (!elements) return false;
  const { a, e, period } = elements;
  if (!Number.isFinite(a) || !Number.isFinite(period) || period <= 0) return false;
  if (!Number.isFinite(dt)) return false;
  // Beyond the asteroid belt the two-body step stops describing the motion,
  // because the perturbations that reshape the orbit act on the same timescale
  // as the sampling. 6 AU keeps every fragment in the main swarm (aphelia to
  // 4.7 AU) and rejects the 17.7 AU outlier.
  if (a > 6) return false;
  // A nearly-parabolic orbit turns too sharply near periapsis for a sampled
  // element set to survive a long gap.
  return e < 0.95;
}
