/**
 * Transmitted radiation against depth inside a fragment.
 *
 * Every other chart in this project reports an outcome. This one reports the
 * mechanism, which is why fragment size is the variable that decides whether
 * lithopanspermia is arguable at all.
 *
 * The two curves attenuate on scales that differ by roughly a factor of
 * sixteen: photons in silicate are gone within centimetres, while cosmic rays
 * are charged particles and reach far deeper. So a half-metre rock is opaque to
 * starlight and still transmits a large fraction of the radiation that actually
 * kills the microbes inside it. Plotting them on one log axis is the only way
 * to see both facts at once - on a linear axis the photon curve is a vertical
 * line at the surface and nothing else is visible.
 */

/** Pull the profile out of a replay, or null for a file that predates it. */
export function parseDepthProfile(payload) {
  const p = payload?.dose_depth_profile;
  if (!p || !Array.isArray(p.samples) || p.samples.length < 2) return null;
  const samples = p.samples
    .filter(s => Number.isFinite(s?.depth_m))
    .map(s => ({
      depth: s.depth_m,
      radiusFraction: s.radius_fraction,
      photon: Number.isFinite(s.photon_fraction) ? s.photon_fraction : null,
      cosmic: Number.isFinite(s.cosmic_ray_fraction) ? s.cosmic_ray_fraction : null,
    }));
  if (samples.length < 2) return null;
  return {
    rockType: p.rock_type ?? null,
    rockRadius: p.rock_radius_m,
    bioRadius: p.bio_radius_m,
    density: p.density_kg_m3,
    photonDepth: p.photon_attenuation_depth_m,
    cosmicDepth: p.cosmic_ray_attenuation_depth_m,
    // The biological core is a second material with its own coefficients.
    // Older replays predate these fields; callers fall back to the exported
    // samples rather than guessing at them.
    bioDensity: p.bio_density_kg_m3 ?? null,
    bioPhotonDepth: p.bio_photon_attenuation_depth_m ?? null,
    bioCosmicDepth: p.bio_cosmic_ray_attenuation_depth_m ?? null,
    samples,
  };
}

/**
 * The depth at which a channel falls to a given fraction, by interpolation.
 *
 * Interpolated in log space because attenuation is exponential; linear
 * interpolation between decades would put the crossing in the wrong place.
 */
export function depthAtFraction(samples, channel, target) {
  if (!(target > 0) || !samples?.length) return null;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    const va = a[channel];
    const vb = b[channel];
    if (!(va > 0) || !(vb > 0)) continue;
    if (va >= target && vb <= target) {
      const t = (Math.log(target) - Math.log(va)) / (Math.log(vb) - Math.log(va));
      return a.depth + t * (b.depth - a.depth);
    }
  }
  return null;
}

/** Ratio of the two penetration depths - the headline number of this chart. */
export function penetrationRatio(profile) {
  if (!profile?.photonDepth || !profile?.cosmicDepth) return null;
  return profile.cosmicDepth / profile.photonDepth;
}

const CHANNELS = [
  { key: 'photon', label: 'stellar photons', color: 'var(--warn)' },
  { key: 'cosmic', label: 'cosmic rays', color: '#4aa3c7' },
];

function el(name, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/**
 * Render the profile as an SVG figure.
 *
 * Log y, because the photon channel spans seven decades across a half-metre of
 * rock and a linear axis would show only its first centimetre.
 */
export function depthProfileChart(container, profile, options = {}) {
  const { width = 560, height = 300 } = options;
  container.textContent = '';
  if (!profile) {
    const note = document.createElement('div');
    note.className = 'dp-empty';
    note.textContent = 'no depth profile in this replay';
    container.appendChild(note);
    return null;
  }

  const PAD = { top: 16, right: 132, bottom: 44, left: 62 };
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const maxDepth = profile.samples.at(-1).depth || 1;
  // Floor the axis rather than following the data to zero: attenuation has no
  // lower bound, and an axis chasing 1e-40 would compress everything readable
  // into the top pixel.
  const LO = 1e-8;
  const xPos = d => PAD.left + (d / maxDepth) * plotW;
  const yPos = v => {
    const clamped = Math.max(LO, Math.min(1, v));
    return PAD.top + plotH * (1 - Math.log10(clamped / LO) / Math.log10(1 / LO));
  };

  const svg = el('svg', {
    width, height, viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label':
      `Transmitted radiation against depth in a ${profile.rockRadius} metre `
      + `fragment. Photons fall to 1/e at ${profile.photonDepth?.toFixed(3)} m, `
      + `cosmic rays at ${profile.cosmicDepth?.toFixed(3)} m.`,
  });

  // decade gridlines
  for (let e = 0; e >= -8; e -= 2) {
    const y = yPos(10 ** e);
    svg.appendChild(el('line', {
      x1: PAD.left, x2: PAD.left + plotW, y1: y, y2: y,
      stroke: 'var(--line-hair)', 'stroke-width': 1,
    }));
    const t = el('text', {
      x: PAD.left - 8, y: y + 3, 'text-anchor': 'end',
      fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'monospace',
    });
    t.textContent = e === 0 ? '1' : `1e${e}`;
    svg.appendChild(t);
  }

  for (const { key, color, label } of CHANNELS) {
    const pts = profile.samples
      .filter(s => Number.isFinite(s[key]) && s[key] > 0)
      .map(s => `${xPos(s.depth).toFixed(2)},${yPos(s[key]).toFixed(2)}`);
    if (pts.length < 2) continue;
    svg.appendChild(el('path', {
      d: `M${pts.join('L')}`, fill: 'none', stroke: color, 'stroke-width': 2,
      'data-channel': key,
    }));

    // 1/e marker, the number a reader can check the curve against
    const depth = key === 'photon' ? profile.photonDepth : profile.cosmicDepth;
    if (Number.isFinite(depth) && depth <= maxDepth) {
      svg.appendChild(el('circle', {
        cx: xPos(depth), cy: yPos(Math.exp(-1)), r: 3.5,
        fill: color, stroke: 'var(--bg-panel)', 'stroke-width': 1,
      }));
    }

    const last = profile.samples.at(-1);
    const legend = el('text', {
      x: PAD.left + plotW + 10,
      y: yPos(Math.max(LO, last[key])) + 3,
      fill: color, 'font-size': 11, 'font-family': 'monospace',
    });
    legend.textContent = label;
    svg.appendChild(legend);
  }

  // biological core boundary - where the payload actually sits
  if (Number.isFinite(profile.bioRadius) && profile.bioRadius > 0) {
    const coreDepth = profile.rockRadius - profile.bioRadius;
    if (coreDepth > 0 && coreDepth < maxDepth) {
      svg.appendChild(el('line', {
        x1: xPos(coreDepth), x2: xPos(coreDepth), y1: PAD.top, y2: PAD.top + plotH,
        stroke: 'var(--ink-faint)', 'stroke-width': 1, 'stroke-dasharray': '3 3',
      }));
      const t = el('text', {
        x: xPos(coreDepth) + 4, y: PAD.top + 11,
        fill: 'var(--ink-dim)', 'font-size': 9.5, 'font-family': 'monospace',
      });
      t.textContent = 'biological core';
      svg.appendChild(t);
    }
  }

  // axes
  svg.appendChild(el('line', {
    x1: PAD.left, x2: PAD.left + plotW, y1: PAD.top + plotH, y2: PAD.top + plotH,
    stroke: '#4a3f38', 'stroke-width': 1,
  }));
  for (let i = 0; i <= 4; i += 1) {
    const d = (maxDepth * i) / 4;
    const t = el('text', {
      x: xPos(d), y: PAD.top + plotH + 15, 'text-anchor': 'middle',
      fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'monospace',
    });
    t.textContent = d.toFixed(2);
    svg.appendChild(t);
  }
  const xl = el('text', {
    x: PAD.left + plotW / 2, y: height - 8, 'text-anchor': 'middle',
    fill: 'var(--ink-dim)', 'font-size': 10.5, 'font-family': 'monospace',
  });
  xl.textContent = 'depth below surface [m]';
  svg.appendChild(xl);

  const yl = el('text', {
    x: 14, y: PAD.top + plotH / 2, fill: 'var(--ink-dim)',
    'font-size': 10.5, 'font-family': 'monospace', 'text-anchor': 'middle',
    transform: `rotate(-90 14 ${PAD.top + plotH / 2})`,
  });
  yl.textContent = 'transmitted fraction';
  svg.appendChild(yl);

  container.appendChild(svg);
  return svg;
}

/**
 * Density of a fragment, recovered from its exported mass and radius.
 *
 * The replay does not carry density directly, but it carries both mass and
 * radius, and the fragments are modelled as homogeneous spheres. The values
 * this recovers are constant within a rock type across the whole swarm - 4172
 * for iron-nickel, 1190 for CI chondrite, 2162 for ice-rich - which is the
 * check that the recovery is exact rather than approximately right.
 */
export function fragmentDensity(prop) {
  const r = prop?.radius;
  const m = prop?.mass;
  if (!(r > 0) || !(m > 0)) return null;
  return m / ((4 / 3) * Math.PI * r ** 3);
}

/**
 * Re-cast the depth profile for one actual fragment of the swarm.
 *
 * The exported profile describes a single configured stone: half a metre
 * across at 3460 kg/m3. No fragment in the run is that stone - the radii span
 * 0.027 to 0.799 m and the densities 1190 to 4172 - so the one figure that
 * explains the mechanism was explaining a rock that is not in the simulation.
 *
 * The rescaling is exact rather than a redraw, but it is NOT one exponential.
 * The stone has two materials: rock down to the biological core, then core
 * material the rest of the way, each with its own attenuation length. The
 * first version of this function assumed a single exponential and matched the
 * exported curve to twelve digits near the surface while being wrong by a
 * quarter at the centre - which is the half that decides whether the microbes
 * live. The test that caught it is still there.
 *
 * Attenuation length is Lambda = 1/(k*rho), and k is one configured constant
 * for every rock type in this model, so the rock lengths scale as the inverse
 * of the fragment's density; the core material is identical in every fragment,
 * so its length does not scale.
 *
 * Attaching it to the selected fragment turns a static caption into the
 * argument the chart exists to make: click the 27 mm silicate and the curve
 * barely moves across the whole stone; click the 799 mm ice-rich one and it
 * falls by decades. Size is the variable, and now you can see it being the
 * variable.
 */
export function profileForFragment(base, prop, { samples = 40 } = {}) {
  if (!base) return null;
  const radius = prop?.radius;
  const density = fragmentDensity(prop);
  if (!(radius > 0) || !(density > 0) || !(base.density > 0)) return base;
  // Without the core's coefficients the curve cannot be reproduced past the
  // core boundary. Returning the exported profile is the honest fallback:
  // wrong stone, but not a wrong curve.
  if (!(base.bioPhotonDepth > 0) || !(base.bioCosmicDepth > 0)) return base;

  // Lambda = 1/(k*rho) and k is one configured constant for every rock type in
  // this model, so only density varies and the rock lengths scale as 1/rho.
  // The core material is identical in every fragment, so its lengths do not
  // scale at all.
  const scale = base.density / density;
  const photonDepth = base.photonDepth * scale;
  const cosmicDepth = base.cosmicDepth * scale;
  // Keep the core's share of the stone rather than its absolute size: the
  // biological core is a mass fraction, so it grows with the fragment.
  const bioFraction = base.rockRadius > 0 ? base.bioRadius / base.rockRadius : 0;
  const bioRadius = radius * bioFraction;
  const shell = radius - bioRadius;

  /** Two-material Beer-Lambert along one radius, surface inward. */
  const transmit = (depth, rockLambda, bioLambda) => {
    if (depth <= shell) return Math.exp(-depth / rockLambda);
    return Math.exp(-shell / rockLambda) * Math.exp(-(depth - shell) / bioLambda);
  };

  const out = [];
  for (let i = 0; i < samples; i += 1) {
    const depth = (radius * i) / (samples - 1);
    out.push({
      depth,
      radiusFraction: 1 - i / (samples - 1),
      photon: transmit(depth, photonDepth, base.bioPhotonDepth),
      cosmic: transmit(depth, cosmicDepth, base.bioCosmicDepth),
    });
  }
  return {
    rockType: prop?.rock_type ?? base.rockType,
    rockRadius: radius,
    bioRadius,
    density,
    photonDepth,
    cosmicDepth,
    bioDensity: base.bioDensity,
    bioPhotonDepth: base.bioPhotonDepth,
    bioCosmicDepth: base.bioCosmicDepth,
    samples: out,
    fragmentId: prop?.id ?? null,
  };
}
