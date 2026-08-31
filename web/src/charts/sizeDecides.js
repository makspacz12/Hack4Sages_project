/**
 * Size decides everything, and it decides it twice, in opposite directions.
 *
 * THE FINDING. In this model the ability to travel and the ability to survive
 * are in direct conflict, and the same variable controls both.
 *
 *   1. Ejection speed falls with fragment size. The smallest fragment in the
 *      swarm leaves Mars at 17.5 km/s, the largest at 5.45 km/s. Across the
 *      fourteen the correlation against log radius is r = -0.73, and the
 *      ordering is very nearly monotone. This is the ejection model's own
 *      behaviour and it matches spallation physics: material spalled from
 *      close to the impact surface leaves fastest and in the smallest pieces.
 *
 *   2. Only the fastest fragments reach Jupiter-crossing orbits. Two of the
 *      fourteen do. One passes 0.43 AU from Jupiter and is scattered to 10.6
 *      AU; the other reaches 45 AU, past Neptune. The remaining twelve spend
 *      the whole 100,000 years between 0.86 and 2.31 AU, never leaving the
 *      neighbourhood of the orbit they were ejected from.
 *
 *   3. Erosion lifetime rises with size, exactly, because lifetime is radius
 *      divided by an erosion rate that does not depend on radius. So the same
 *      small fragments that are the only ones able to travel are also the
 *      first ones dust destroys. Both travellers are gone within 34 kyr.
 *
 * A fragment large enough to survive the journey is too slow to make it, and a
 * fragment fast enough to make the journey is too small to survive it. That is
 * the project's actual result, and no other figure here states it.
 *
 * WHAT THIS FIGURE DOES NOT CLAIM. That both travellers were destroyed is two
 * data points and nothing more; on its own it would be unremarkable. The claim
 * rests on the two systematic relations, each measured across all fourteen
 * fragments, not on the coincidence of those two fates.
 *
 * WHY TWO PANELS AND NOT TWO AXES. Speed is in km/s and lifetime in thousands
 * of years. Drawing them against a shared vertical scale would require two y
 * axes, which lets the author choose where the curves appear to cross and is
 * the most reliably misleading construction in charting. Two panels stacked on
 * one shared x axis carry the same comparison and let the reader see that the
 * left end of the size axis is high in one panel and low in the other.
 */

import { scalePad, uiScale, fmt } from './plot.js';

const NS = 'http://www.w3.org/2000/svg';

/** 1 AU/yr expressed in km/s. */
const AU_PER_YEAR_IN_KM_S = 4.740570;

/** Beyond this heliocentric distance a fragment has left its birth region. */
export const TRAVELLED_AU = 3;

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function norm(a, b) {
  return Math.hypot(a.vx - b.vx, a.vy - b.vy, a.vz - b.vz);
}

/**
 * Size, launch speed, how far it got, and how long it lasted.
 *
 * Ejection speed is measured relative to Mars in the first frame, which is the
 * initial condition the run was started from rather than a quantity derived
 * afterwards. Heliocentric distance is measured from the Sun's own position,
 * not from the origin: the Sun moves, and against a fragment at 1 AU that
 * offset is not negligible.
 */
export function sizeDecidesData(frames) {
  if (!Array.isArray(frames) || frames.length < 2) return [];

  const first = frames[0];
  const vel0 = new Map((first.velocities ?? []).map(v => [v.id, v]));
  const mars = vel0.get('planet_mars');

  const rows = new Map();
  for (const p of first.properties ?? []) {
    if (!p?.id?.startsWith('asteroid_') || !(p.radius > 0)) continue;
    const v = vel0.get(p.id);
    rows.set(p.id, {
      id: p.id,
      radiusMm: p.radius * 1000,
      rockType: p.rock_type ?? null,
      speedKmS: (v && mars) ? norm(v, mars) * AU_PER_YEAR_IN_KM_S : null,
      maxAU: 0,
      endKyr: 0,
      destroyed: false,
    });
  }
  if (!rows.size) return [];

  for (const frame of frames) {
    const pos = new Map((frame.positions ?? []).map(q => [q.id, q]));
    const sun = pos.get('sun');
    const tKyr = (frame.time ?? 0) / 1000;

    for (const row of rows.values()) {
      const q = pos.get(row.id);
      if (q && sun) {
        const r = Math.hypot(q.x - sun.x, q.y - sun.y, q.z - sun.z);
        if (r > row.maxAU) row.maxAU = r;
      }
      const prop = frame.properties?.find(x => x.id === row.id);
      if (!prop) continue;
      if (prop.status === 'destroyed') {
        if (!row.destroyed) {
          row.destroyed = true;
          row.endKyr = tKyr;
        }
      } else if (!row.destroyed) {
        row.endKyr = tKyr;
      }
    }
  }

  return [...rows.values()]
    .filter(r => r.speedKmS !== null)
    .sort((a, b) => a.radiusMm - b.radiusMm);
}

/** Pearson correlation, used on log radius against speed. */
export function correlation(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? null : num / den;
}

/**
 * The claim, as numbers the figure can state about itself.
 *
 * Returns null when no fragment has a launch speed to report, which is the
 * case for any replay written without velocities.
 */
export function sizeDecidesSummary(rows) {
  if (rows.length < 3) return null;
  const travellers = rows.filter(r => r.maxAU > TRAVELLED_AU);
  const speedR = correlation(
    rows.map(r => Math.log10(r.radiusMm)),
    rows.map(r => r.speedKmS),
  );
  return {
    total: rows.length,
    smallest: rows[0],
    largest: rows[rows.length - 1],
    speedCorrelation: speedR,
    travellers,
    // Of the fragments that left the birth region, how many were destroyed.
    travellersLost: travellers.filter(r => r.destroyed).length,
    stayHomeMaxAU: Math.max(
      ...rows.filter(r => r.maxAU <= TRAVELLED_AU).map(r => r.maxAU),
    ),
  };
}

/** A log axis helper shared by both panels. */
function logScale(values, lo, hi) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const a = Math.log10(min) - 0.06;
  const b = Math.log10(max) + 0.06;
  return v => lo + ((Math.log10(v) - a) / (b - a)) * (hi - lo);
}

/**
 * Draw it: two panels, one shared size axis.
 *
 * Radius is logarithmic because it spans a factor of 32. Speed is linear
 * because it spans only a factor of three and a log axis would flatten the
 * very trend the panel exists to show.
 */
export function sizeDecidesChart(container, rows, options = {}) {
  const {
    width = (container && container.clientWidth) || 320,
    runEndKyr = rows.length ? Math.max(...rows.map(r => r.endKyr)) : 1,
  } = options;

  if (!container) return null;
  container.innerHTML = '';
  if (rows.length < 3) {
    const empty = document.createElement('div');
    empty.className = 'dp-empty';
    empty.textContent = 'This replay carries no launch velocities to compare.';
    container.appendChild(empty);
    return null;
  }

  const k = uiScale();
  const PAD = scalePad({ top: 16, right: 10, bottom: 30, left: 34 }, k);
  const panelH = 74 * k;
  const panelGap = 26 * k;
  const plotW = Math.max(40, width - PAD.left - PAD.right);
  const height = PAD.top + panelH * 2 + panelGap + PAD.bottom;

  const xOf = logScale(rows.map(r => r.radiusMm), PAD.left, PAD.left + plotW);

  const svg = el('svg', {
    viewBox: '0 0 ' + width + ' ' + height, width: '100%', height,
    role: 'img',
    'aria-label':
      'Two panels sharing a fragment-size axis. Above, ejection speed falls as '
      + 'fragments get larger. Below, how long each fragment lasted rises as '
      + 'they get larger. The fragments fast enough to travel are the ones '
      + 'erosion destroys first.',
  });

  const panelTop = i => PAD.top + i * (panelH + panelGap);

  /** One panel: a title, a y axis with two labelled ends, and the markers. */
  function panel(index, title, valueOf, formatValue) {
    const top = panelTop(index);
    const values = rows.map(valueOf);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    /* Inset by the ring radius at both ends.
     *
     * The extreme markers sit at the very top and bottom of their panel, and a
     * ringed marker is 6.5px across at scale 1. Without the inset the highest
     * point collided with the panel heading above it. */
    const inset = 9 * k;
    const yOf = v => top + panelH - inset
      - ((v - lo) / span) * (panelH - inset * 2);

    const heading = el('text', {
      x: PAD.left, y: top - 5 * k,
      fill: 'var(--ink-dim)', 'font-size': 9.5 * k,
    });
    heading.textContent = title;
    svg.appendChild(heading);

    svg.appendChild(el('line', {
      x1: PAD.left, y1: top, x2: PAD.left, y2: top + panelH,
      stroke: 'var(--line-edge)', 'stroke-width': 1,
    }));

    for (const [v, dy] of [[hi, 3], [lo, 3]]) {
      const t = el('text', {
        x: PAD.left - 4 * k, y: yOf(v) + dy * k,
        'text-anchor': 'end', fill: 'var(--ink-faint)',
        'font-size': 8 * k, 'font-family': 'var(--font-mono)',
      });
      t.textContent = formatValue(v);
      svg.appendChild(t);
    }

    return yOf;
  }

  const ySpeed = panel(0, 'ejection speed [km/s]',
    r => r.speedKmS, v => v.toFixed(1));
  const yLife = panel(1, 'how long the rock lasted [kyr]',
    r => r.endKyr, v => fmt(v, 3));

  /* Markers.
   *
   * Filled means the fragment was still intact at the end of the run; hollow
   * means dust destroyed it. A ring marks the two that left the birth region,
   * so the outcome is carried by shape and not by colour alone. */
  for (const row of rows) {
    const x = xOf(row.radiusMm);
    const travelled = row.maxAU > TRAVELLED_AU;

    for (const [yOf, value] of [[ySpeed, row.speedKmS], [yLife, row.endKyr]]) {
      const y = yOf(value);
      if (travelled) {
        svg.appendChild(el('circle', {
          cx: x, cy: y, r: 6.5 * k,
          fill: 'none', stroke: 'var(--data-trace)', 'stroke-width': 1.2,
        }));
      }
      const dot = el('circle', {
        cx: x, cy: y, r: 3.6 * k,
        fill: row.destroyed ? 'var(--bg-panel)' : 'var(--ink-bright)',
        stroke: travelled ? 'var(--data-trace)' : 'var(--ink-bright)',
        'stroke-width': 1.4,
      });
      const title = el('title');
      title.textContent =
        row.id.replace('asteroid_', 'fragment ') + ': '
        + fmt(row.radiusMm, 3) + ' mm, ' + (row.rockType || 'unknown rock')
        + '. Left Mars at ' + row.speedKmS.toFixed(1) + ' km/s, reached '
        + fmt(row.maxAU, 3) + ' AU, '
        + (row.destroyed
          ? 'destroyed at ' + fmt(row.endKyr, 3) + ' kyr.'
          : 'still intact at ' + fmt(row.endKyr, 3) + ' kyr.');
      dot.appendChild(title);
      svg.appendChild(dot);
    }
  }

  /* Name the travellers on the heading line, not next to their markers.
   *
   * The two are 1.05 mm and 1.07 mm, two percent apart, so on a log size axis
   * their markers genuinely sit on top of each other. That overlap is the data
   * and it stays. An anchored label, however, had nowhere to go that was not
   * on top of either those markers or the cluster below them, so the fact goes
   * on the heading line where there is room to state both distances. */
  const travellers = rows.filter(r => r.maxAU > TRAVELLED_AU);
  if (travellers.length) {
    const reached = travellers
      .map(r => r.maxAU)
      .sort((a, b) => a - b)
      .map(v => fmt(v, 3));
    const note = el('text', {
      x: PAD.left + plotW, y: panelTop(0) - 5 * k,
      'text-anchor': 'end', fill: 'var(--data-trace)', 'font-size': 8.5 * k,
    });
    note.textContent = 'ringed: reached ' + reached.join(' and ') + ' AU';
    svg.appendChild(note);
  }

  // The shared size axis, ruled once under the lower panel.
  const axisY = panelTop(1) + panelH + 10 * k;
  svg.appendChild(el('line', {
    x1: PAD.left, y1: axisY, x2: PAD.left + plotW, y2: axisY,
    stroke: 'var(--line-edge)', 'stroke-width': 1,
  }));
  for (const row of [rows[0], rows[rows.length - 1]]) {
    const t = el('text', {
      x: xOf(row.radiusMm), y: axisY + 11 * k,
      'text-anchor': row === rows[0] ? 'start' : 'end',
      fill: 'var(--ink-faint)', 'font-size': 8 * k,
      'font-family': 'var(--font-mono)',
    });
    t.textContent = fmt(row.radiusMm, 2) + ' mm';
    svg.appendChild(t);
  }
  const xLabel = el('text', {
    x: PAD.left + plotW / 2, y: height - 2 * k,
    'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 9 * k,
  });
  xLabel.textContent = 'fragment radius, smallest to largest';
  svg.appendChild(xLabel);

  void runEndKyr;
  container.appendChild(svg);
  return { svg };
}
