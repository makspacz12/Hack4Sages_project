/**
 * series.js
 * Pure transforms from the model's JSON exports into plottable series.
 *
 * Kept free of DOM access so every one of these is unit-tested in
 * tests/chartSeries.test.js. The rendering lives in plot.js and charts.js.
 *
 * Input is the replay the visualizer is playing,
 * cosmos_visualizer_simulation.json: per-frame positions, velocities and
 * per-object properties.
 */

/** Objects in a replay frame that represent ejecta fragments. */
export function fragmentIds(frames) {
  const ids = [];
  const seen = new Set();
  for (const frame of frames ?? []) {
    for (const prop of frame?.properties ?? []) {
      if (!prop || seen.has(prop.id)) continue;
      if (!Number.isFinite(prop.population_fraction)) continue;
      seen.add(prop.id);
      ids.push(prop.id);
    }
  }
  return ids;
}

/**
 * Per-fragment time series of one property field.
 * @returns {Map<string, Array<[number, number]>>} id -> [[time, value], ...]
 */
export function fragmentSeries(frames, field) {
  const out = new Map();
  for (const id of fragmentIds(frames)) out.set(id, []);
  for (const frame of frames ?? []) {
    const t = Number.isFinite(frame?.time) ? frame.time : null;
    if (t === null) continue;
    for (const prop of frame?.properties ?? []) {
      if (!prop || !out.has(prop.id)) continue;
      const v = prop[field];
      if (Number.isFinite(v)) out.get(prop.id).push([t, v]);
    }
  }
  return out;
}

/** Mean across fragments at each time, from a Map of per-fragment series. */
export function meanAcross(seriesById) {
  const buckets = new Map();
  for (const points of seriesById.values()) {
    for (const [t, v] of points) {
      if (!buckets.has(t)) buckets.set(t, []);
      buckets.get(t).push(v);
    }
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, values]) => [t, values.reduce((a, b) => a + b, 0) / values.length]);
}

/**
 * Relative change from each fragment's own starting value, in parts per million.
 *
 * Dust erosion removes ~1e-7 m from a ~2e-2 m fragment over the run. Plotting
 * absolute radius renders that as a flat line, and plotting each fragment's
 * absolute radius on a shared axis compares fragments rather than showing the
 * erosion. Normalising to the fragment's own start shows the effect.
 */
export function relativeChangePpm(seriesById) {
  const out = new Map();
  for (const [id, points] of seriesById) {
    if (points.length === 0) continue;
    const first = points[0][1];
    if (!Number.isFinite(first) || first === 0) continue;
    out.set(id, points.map(([t, v]) => [t, ((v - first) / first) * 1e6]));
  }
  return out;
}

/** Distance of each fragment from a named body, per frame, in the replay's position unit. */
export function distanceFromBody(frames, bodyId = 'sun') {
  const ids = new Set(fragmentIds(frames));
  const out = new Map([...ids].map(id => [id, []]));
  for (const frame of frames ?? []) {
    const t = Number.isFinite(frame?.time) ? frame.time : null;
    if (t === null) continue;
    const positions = frame?.positions ?? [];
    const origin = positions.find(p => p?.id === bodyId);
    if (!origin) continue;
    for (const p of positions) {
      if (!ids.has(p?.id)) continue;
      const dx = p.x - origin.x;
      const dy = p.y - origin.y;
      const dz = p.z - origin.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (Number.isFinite(d)) out.get(p.id).push([t, d]);
    }
  }
  return out;
}

/** Speed of each fragment per frame, from the replay's velocity vectors. */
export function speedSeries(frames) {
  const ids = new Set(fragmentIds(frames));
  const out = new Map([...ids].map(id => [id, []]));
  for (const frame of frames ?? []) {
    const t = Number.isFinite(frame?.time) ? frame.time : null;
    if (t === null) continue;
    for (const v of frame?.velocities ?? []) {
      if (!ids.has(v?.id)) continue;
      const speed = Math.sqrt(v.vx * v.vx + v.vy * v.vy + v.vz * v.vz);
      if (Number.isFinite(speed)) out.get(v.id).push([t, speed]);
    }
  }
  return out;
}

/**
 * Gravitational parameter of the Sun in the replay's units [AU^3 / yr^2].
 *
 * The integrator works in units where G = 1, the Sun is one mass, lengths are
 * AU and times are years; GM is then 4*pi^2. The replay exports positions and
 * velocities in exactly those units, so the browser can recompute the same
 * quantity the model tests against in `scenarios.py`.
 */
export const SUN_MU_AU3_YR2 = 4 * Math.PI * Math.PI;

/**
 * Specific orbital energy of each fragment: eps = v^2/2 - GM/r.
 *
 * This replaces the speed chart, which could not answer the one question the
 * project exists to ask. Speed alone says nothing about whether a fragment is
 * leaving: 30 km/s is bound at 1 AU and unbound at 40 AU. Energy answers it
 * directly - eps < 0 is bound, eps > 0 escapes - and it is the same criterion
 * the model itself applies when it decides a fragment has left the system.
 *
 * It is also nearly conserved, so the curve is a visible integrator check: a
 * line that drifts is telling you the timestep is too coarse, which a speed
 * curve oscillating over every orbit cannot show.
 */
export function orbitalEnergySeries(frames, bodyId = 'sun') {
  const ids = new Set(fragmentIds(frames));
  const out = new Map([...ids].map(id => [id, []]));
  for (const frame of frames ?? []) {
    const t = Number.isFinite(frame?.time) ? frame.time : null;
    if (t === null) continue;
    const origin = (frame?.positions ?? []).find(p => p?.id === bodyId);
    if (!origin) continue;
    const posById = new Map((frame.positions ?? []).map(p => [p.id, p]));
    for (const v of frame?.velocities ?? []) {
      if (!ids.has(v?.id)) continue;
      const p = posById.get(v.id);
      if (!p) continue;
      const r = Math.hypot(p.x - origin.x, p.y - origin.y, p.z - origin.z);
      if (!(r > 0)) continue;
      const eps = (v.vx * v.vx + v.vy * v.vy + v.vz * v.vz) / 2 - SUN_MU_AU3_YR2 / r;
      if (Number.isFinite(eps)) out.get(v.id).push([t, eps]);
    }
  }
  return out;
}

/** How many fragments are bound, unbound, and arrived, at one frame index. */
export function fateCounts(energyById, frames, index) {
  let bound = 0;
  let unbound = 0;
  for (const points of energyById.values()) {
    const p = points[Math.min(index, points.length - 1)];
    if (!p) continue;
    if (p[1] < 0) bound += 1; else unbound += 1;
  }
  const props = frames?.[index]?.properties ?? [];
  const arrived = props.filter(p => p?.status === 'arrived').length;
  return { bound, unbound, arrived };
}

/**
 * Hydrolysis rate against temperature, as an Arrhenius pair.
 *
 * WHY THIS FIGURE EXISTS. The two damage channels in this model behave
 * completely differently, and only one of them is interesting to look at.
 * Cosmic ray dose is nearly the same for every fragment - it varies by a
 * factor of 1.3 across the swarm, because galactic rays do not care where a
 * body is. Hydrolysis varies by 119 ORDERS OF MAGNITUDE, because it is
 * chemistry and chemistry is exponential in temperature.
 *
 * Fitted over all 2100 fragment-frames in the shipped replay, ln(rate) against
 * 1/T is straight to r = -0.99923, with a slope of -16261 K. That is an
 * activation energy of 135 kJ/mol, which is the textbook range for
 * phosphodiester bond hydrolysis in DNA - so the plot is not just a
 * correlation, it recovers a number a chemist can check.
 *
 * Returns points as [1000/T, log10(rate)] because that is how an Arrhenius
 * plot is conventionally drawn: reciprocal temperature on x, log rate on y, a
 * straight line whose slope is the activation energy.
 */
export function arrheniusSeries(frames) {
  const out = new Map();
  for (const id of fragmentIds(frames)) out.set(id, []);
  for (const frame of frames ?? []) {
    for (const prop of frame?.properties ?? []) {
      if (!prop || !out.has(prop.id)) continue;
      const T = prop.T_center_K;
      const rate = prop.hydrolysis_rate_s_inv;
      // A zero or negative rate has no logarithm, and a zero temperature no
      // reciprocal; both mean the fragment carried no usable record here.
      if (!(T > 0) || !(rate > 0)) continue;
      out.get(prop.id).push([1000 / T, Math.log10(rate)]);
    }
  }
  return out;
}

/**
 * Least-squares fit through every point of an Arrhenius series.
 *
 * Returns the slope and intercept in the plotted coordinates, the correlation,
 * and the activation energy the slope implies. Null when there is nothing to
 * fit, rather than a line through no data.
 */
export function arrheniusFit(series) {
  const pts = [];
  for (const points of series.values()) pts.push(...points);
  if (pts.length < 3) return null;

  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pts) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (!(sxx > 0) || !(syy > 0)) return null;

  const slope = sxy / sxx;
  const r = sxy / Math.sqrt(sxx * syy);
  // x is 1000/T and y is log10(rate), so the Arrhenius slope in natural units
  // is slope * ln(10) * 1000, and Ea = -R * that.
  const activationKJ = -slope * Math.LN10 * 1000 * 8.314462618 / 1000;
  return {
    slope,
    intercept: my - slope * mx,
    r,
    n,
    activationKJ,
    xRange: [Math.min(...pts.map(p => p[0])), Math.max(...pts.map(p => p[0]))],
  };
}
