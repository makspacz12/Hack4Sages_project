/**
 * Same dose, different fate.
 *
 * This is the whole argument of the project in one figure, and it only exists
 * because the long run was made.
 *
 * The seven fragments that survive 100,000 years all absorb very nearly the
 * same dose: 18,776 to 19,793 Gy, a spread of 5.4%. They are in the same
 * radiation environment, for the same length of time, and the physics does
 * essentially the same thing to all of them.
 *
 * Their surviving fractions span a factor of 522.
 *
 * Nothing about the environment explains that. The difference is c_rad, the
 * radiation inactivation coefficient, which is a property of the ORGANISM and
 * not of the journey. The published range for it spans a factor of seventeen
 * and this project samples across it, so each fragment is effectively carrying
 * a different microbe.
 *
 * WHY A PAIRED PLOT. Two axes, dose on the left and survival on the right,
 * with a line joining each fragment's position on one to its position on the
 * other. A scatter would let a reader look for a trend and find a weak one; the
 * paired form makes the comparison structural. The dose axis collapses to
 * almost a single point while the survival axis spreads over three decades, and
 * the lines cross, so the eye cannot construct a story in which the environment
 * did this.
 *
 * WHY ONLY SURVIVORS. The seven destroyed fragments were ground away by dust
 * erosion rather than sterilised, so their zero is a different kind of zero and
 * plotting it here would conflate two mechanisms. They have their own figure.
 */

import { scalePad, uiScale, fmt } from './plot.js';

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/**
 * Dose and survival for every fragment still intact at the end of a run.
 *
 * Returns an empty array when nothing survives, or when the run is too short
 * for survival to have separated at all.
 */
export function sameDoseData(frames) {
  const last = frames?.at(-1)?.properties ?? [];
  const rows = [];
  for (const p of last) {
    if (!p?.id?.startsWith('asteroid_')) continue;
    if (p.status === 'destroyed') continue;
    if (!Number.isFinite(p.dose_cumulative_gy) || !(p.population_fraction > 0)) continue;
    rows.push({
      id: p.id,
      doseGy: p.dose_cumulative_gy,
      survival: p.population_fraction,
      cRad: p.radiation_surv_coeff,
      rockType: p.rock_type ?? null,
    });
  }
  return rows;
}

/**
 * The two spreads, as numbers the figure can state about itself.
 *
 * A caption that says "the doses are similar" is an opinion. One that says
 * 5.4% against 522x is a measurement, and it is the point.
 */
export function spreadSummary(rows) {
  if (rows.length < 2) return null;
  const doses = rows.map(r => r.doseGy);
  const survivals = rows.map(r => r.survival);
  return {
    n: rows.length,
    doseLo: Math.min(...doses),
    doseHi: Math.max(...doses),
    dosePercent: (Math.max(...doses) / Math.min(...doses) - 1) * 100,
    survivalLo: Math.min(...survivals),
    survivalHi: Math.max(...survivals),
    survivalFactor: Math.max(...survivals) / Math.min(...survivals),
  };
}

/**
 * Draw it.
 *
 * Dose on a linear axis, because the point is how little it varies and a log
 * axis would hide that. Survival on a log axis, because the point is how much
 * it varies and a linear axis would collapse six of the seven onto the floor.
 * Using different scales on the two sides is the honest choice here and the
 * axis labels say which is which.
 */
export function sameDoseChart(container, rows, options = {}) {
  const {
    width = container?.clientWidth || 320,
    height = 200 * uiScale(),
    colorFor = null,
  } = options;

  if (!container) return null;
  container.innerHTML = '';
  if (rows.length < 2) {
    const empty = document.createElement('div');
    empty.className = 'dp-empty';
    empty.textContent = 'Nothing survives this run, so there is nothing to compare.';
    container.appendChild(empty);
    return null;
  }

  const k = uiScale();
  const PAD = scalePad({ top: 22, right: 62, bottom: 20, left: 62 }, k);
  const plotW = Math.max(30, width - PAD.left - PAD.right);
  const plotH = Math.max(30, height - PAD.top - PAD.bottom);

  const doses = rows.map(r => r.doseGy);
  const survivals = rows.map(r => r.survival);

  // Dose axis padded by a tenth of its own range, so a 5% spread does not
  // render as a single line and the reader can still see the ordering.
  const dLo = Math.min(...doses);
  const dHi = Math.max(...doses);
  const dPad = (dHi - dLo) * 0.35 || 1;
  const yDose = v => PAD.top + plotH
    - ((v - (dLo - dPad)) / ((dHi + dPad) - (dLo - dPad))) * plotH;

  const sLo = Math.log10(Math.min(...survivals));
  const sHi = Math.log10(Math.max(...survivals));
  const sPad = (sHi - sLo) * 0.1 || 0.5;
  const ySurv = v => PAD.top + plotH
    - ((Math.log10(v) - (sLo - sPad)) / ((sHi + sPad) - (sLo - sPad))) * plotH;

  const xLeft = PAD.left;
  const xRight = PAD.left + plotW;

  const svg = el('svg', {
    viewBox: `0 0 ${width} ${height}`, width: '100%', height,
    role: 'img',
    'aria-label':
      'Cumulative dose on the left against surviving fraction on the right, '
      + 'one line per fragment',
  });

  // The two axes.
  for (const x of [xLeft, xRight]) {
    svg.appendChild(el('line', {
      x1: x, y1: PAD.top, x2: x, y2: PAD.top + plotH,
      stroke: 'var(--line-edge)', 'stroke-width': 1,
    }));
  }

  // Headings, so it is clear which side is which without a legend.
  const head = (x, anchor, text) => {
    const t = el('text', {
      x, y: PAD.top - 8, 'text-anchor': anchor,
      fill: 'var(--ink-dim)', 'font-size': 9.5 * k,
    });
    t.textContent = text;
    return t;
  };
  svg.appendChild(head(xLeft, 'start', 'absorbed dose [Gy]'));
  svg.appendChild(head(xRight, 'end', 'surviving fraction'));

  // One line per fragment, joining its dose to its fate.
  for (const r of rows) {
    const y1 = yDose(r.doseGy);
    const y2 = ySurv(r.survival);
    const color = colorFor?.(r) ?? 'var(--data-trace)';

    svg.appendChild(el('line', {
      x1: xLeft, y1, x2: xRight, y2,
      stroke: color, 'stroke-width': 1.4, opacity: 0.75,
    }));

    for (const [cx, cy] of [[xLeft, y1], [xRight, y2]]) {
      const dot = el('circle', { cx, cy, r: 3.6 * k, fill: color });
      const title = el('title');
      title.textContent =
        `${r.id.replace('asteroid_', 'fragment ')}: ${fmt(r.doseGy, 4)} Gy, `
        + `surviving fraction ${r.survival.toExponential(2)}, `
        + `c_rad ${r.cRad?.toExponential(2) ?? 'unknown'} per Gy`;
      dot.appendChild(title);
      svg.appendChild(dot);
    }
  }

  // End labels on each axis, so the ranges can be read off directly.
  const tick = (x, y, anchor, text) => {
    const t = el('text', {
      x, y, 'text-anchor': anchor, fill: 'var(--ink-faint)',
      'font-size': 8.5 * k, 'font-family': 'var(--font-mono)',
    });
    t.textContent = text;
    return t;
  };
  svg.appendChild(tick(xLeft - 5, yDose(dHi) + 3, 'end', fmt(dHi, 4)));
  svg.appendChild(tick(xLeft - 5, yDose(dLo) + 3, 'end', fmt(dLo, 4)));
  svg.appendChild(tick(xRight + 5, ySurv(Math.max(...survivals)) + 3, 'start',
    Math.max(...survivals).toExponential(1)));
  svg.appendChild(tick(xRight + 5, ySurv(Math.min(...survivals)) + 3, 'start',
    Math.min(...survivals).toExponential(1)));

  container.appendChild(svg);
  return { svg };
}
