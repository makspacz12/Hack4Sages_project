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
  { key: 'photon', label: 'stellar photons', color: '#d8a33c' },
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
      stroke: '#2a2320', 'stroke-width': 1,
    }));
    const t = el('text', {
      x: PAD.left - 8, y: y + 3, 'text-anchor': 'end',
      fill: '#8d7f74', 'font-size': 10, 'font-family': 'monospace',
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
        fill: color, stroke: '#14100e', 'stroke-width': 1,
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
        stroke: '#6f5f55', 'stroke-width': 1, 'stroke-dasharray': '3 3',
      }));
      const t = el('text', {
        x: xPos(coreDepth) + 4, y: PAD.top + 11,
        fill: '#8d7f74', 'font-size': 9.5, 'font-family': 'monospace',
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
      fill: '#8d7f74', 'font-size': 10, 'font-family': 'monospace',
    });
    t.textContent = d.toFixed(2);
    svg.appendChild(t);
  }
  const xl = el('text', {
    x: PAD.left + plotW / 2, y: height - 8, 'text-anchor': 'middle',
    fill: '#8d7f74', 'font-size': 10.5, 'font-family': 'monospace',
  });
  xl.textContent = 'depth below surface [m]';
  svg.appendChild(xl);

  const yl = el('text', {
    x: 14, y: PAD.top + plotH / 2, fill: '#8d7f74',
    'font-size': 10.5, 'font-family': 'monospace', 'text-anchor': 'middle',
    transform: `rotate(-90 14 ${PAD.top + plotH / 2})`,
  });
  yl.textContent = 'transmitted fraction';
  svg.appendChild(yl);

  container.appendChild(svg);
  return svg;
}
