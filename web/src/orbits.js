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

  return { a, e, inc, raan, argp, period: 2 * Math.PI * Math.sqrt(a ** 3 / mu) };
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
