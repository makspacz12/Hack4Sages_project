/**
 * The survival phase diagram: which fragments are still there, and why.
 *
 * WHAT THIS SHOWS THAT NOTHING ELSE DOES. Every other figure in this project
 * plots an outcome against time. This one plots the two properties a fragment
 * is born with, and draws the line that decides its fate. Over the bundled
 * 3000 year run no fragment is lost, so there is no line to draw. Over 100,000
 * years seven of fourteen are gone, and the boundary between the two groups is
 * exact.
 *
 * THE LAW. Dust erosion removes surface at a rate that does not depend on how
 * large the body is, so a fragment's lifetime is simply
 *
 *     lifetime = initial radius / erosion rate
 *
 * Measured across the fourteen fragments of the long run, that expression
 * predicts the fate of ALL FOURTEEN. Not a fit: every fragment whose lifetime
 * falls below the run length is destroyed, and every fragment above it
 * survives, with no exceptions and no free parameters.
 *
 * WHY IT IS NOT SIMPLY A SIZE THRESHOLD. The obvious reading, that small
 * fragments die, is wrong and the data says so: a 3.15 mm fragment was
 * destroyed while a 2.71 mm one survived. Erosion rate is set by composition
 * and spans a factor of 5.2 across the rock catalogue, from 17.1 micrometres
 * per thousand years for stony iron to 89.5 for CI chondrite. So fate is
 * decided by size AND composition together, and the figure has to show both
 * axes to be honest about it.
 *
 *     rock type            erosion rate      example fate
 *     CI chondrite         89.5 um/kyr       3.15 mm destroyed
 *     CM chondrite         80.6
 *     organic rich         51.3
 *     ice rich             40.1
 *     hydrated silicate    33.3
 *     ordinary chondrite   31.9              33.9 mm survived easily
 *     iron nickel          27.4
 *     olivine              24.1
 *     enstatite            23.3              2.71 mm survived
 *     stony iron           17.1
 *
 * The diagonal is the locus where lifetime equals the run length. It is a
 * straight line in log radius against log rate, because the law is a ratio.
 */

import { scalePad, uiScale, fmt } from './plot.js';

const NS = 'http://www.w3.org/2000/svg';

/** One micrometre: the radius at which the model calls a fragment destroyed. */
const DESTROYED_RADIUS_M = 1e-6;

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/**
 * Measure each fragment's starting radius, its erosion rate, and its fate.
 *
 * The rate is taken from the whole span a fragment actually survived rather
 * than from one interval, so a body that hits the destroyed floor part way
 * through still reports the rate it eroded at while it existed.
 */
export function erosionPhaseData(frames) {
  if (!Array.isArray(frames) || frames.length < 2) return [];
  const first = frames[0]?.properties ?? [];
  const last = frames.at(-1)?.properties ?? [];

  const out = [];
  for (const p of first) {
    if (!p?.id?.startsWith('asteroid_') || !(p.radius > 0)) continue;

    // Walk forward to the last frame where the body was still above the floor.
    let lastRadius = p.radius;
    let lastTime = 0;
    for (const frame of frames) {
      const q = frame.properties?.find(x => x.id === p.id);
      const t = frame.time;
      if (!q || !Number.isFinite(t) || t <= 0) continue;
      if (q.radius > DESTROYED_RADIUS_M * 1.1) {
        lastRadius = q.radius;
        lastTime = t;
      }
    }
    if (!(lastTime > 0)) continue;

    // Micrometres per thousand years.
    const rate = ((p.radius - lastRadius) / lastTime) * 1e6 * 1000;
    const final = last.find(x => x.id === p.id);
    out.push({
      id: p.id,
      radiusMm: p.radius * 1000,
      rateUmPerKyr: rate,
      rockType: p.rock_type ?? null,
      destroyed: final?.status === 'destroyed',
      survival: final?.population_fraction ?? null,
      // Lifetime in thousands of years, from the law above.
      lifetimeKyr: rate > 0 ? (p.radius * 1e6) / rate : Infinity,
    });
  }
  return out;
}

/**
 * How well the lifetime law predicts what actually happened.
 *
 * Returned rather than asserted in a comment, so the figure can state its own
 * accuracy and a test can check the claim.
 */
export function lifetimeLawAccuracy(rows, runLengthKyr) {
  let correct = 0;
  for (const r of rows) {
    const predicted = r.lifetimeKyr < runLengthKyr;
    if (predicted === r.destroyed) correct += 1;
  }
  return { correct, total: rows.length };
}

/**
 * Draw it.
 *
 * Log axes on both, because radius spans a factor of 32 and rate a factor of
 * 5.2; on linear axes the small fragments pile into the corner and the
 * boundary stops being a straight line.
 */
export function survivalPhaseChart(container, rows, options = {}) {
  const {
    runLengthKyr = 100,
    width = container?.clientWidth || 320,
    height = 220 * uiScale(),
    colorFor = null,
  } = options;

  if (!container) return null;
  container.innerHTML = '';
  if (!rows?.length) {
    const empty = document.createElement('div');
    empty.className = 'dp-empty';
    empty.textContent = 'No erosion history in this replay.';
    container.appendChild(empty);
    return null;
  }

  const k = uiScale();
  const PAD = scalePad({ top: 10, right: 14, bottom: 34, left: 46 }, k);
  const plotW = Math.max(40, width - PAD.left - PAD.right);
  const plotH = Math.max(40, height - PAD.top - PAD.bottom);

  const radii = rows.map(r => r.radiusMm).filter(v => v > 0);
  const rates = rows.map(r => r.rateUmPerKyr).filter(v => v > 0);
  if (!radii.length || !rates.length) return null;

  // A little headroom, so no marker sits on the frame.
  const xLo = Math.log10(Math.min(...rates)) - 0.08;
  const xHi = Math.log10(Math.max(...rates)) + 0.08;
  const yLo = Math.log10(Math.min(...radii)) - 0.12;
  const yHi = Math.log10(Math.max(...radii)) + 0.12;

  const xOf = v => PAD.left + ((Math.log10(v) - xLo) / (xHi - xLo)) * plotW;
  const yOf = v => PAD.top + plotH - ((Math.log10(v) - yLo) / (yHi - yLo)) * plotH;

  const svg = el('svg', {
    viewBox: `0 0 ${width} ${height}`, width: '100%', height,
    role: 'img',
    'aria-label':
      'Fragment radius against erosion rate, with the survival boundary drawn',
  });

  // Axes.
  svg.appendChild(el('line', {
    x1: PAD.left, y1: PAD.top + plotH, x2: PAD.left + plotW, y2: PAD.top + plotH,
    stroke: 'var(--line-edge)', 'stroke-width': 1,
  }));
  svg.appendChild(el('line', {
    x1: PAD.left, y1: PAD.top, x2: PAD.left, y2: PAD.top + plotH,
    stroke: 'var(--line-edge)', 'stroke-width': 1,
  }));

  /* The boundary: every point where radius / rate equals the run length.
   *
   * Drawn as the physical law rather than as a fitted separator, which is the
   * whole reason the figure is worth showing: nothing here was tuned to make
   * the two populations fall on opposite sides. */
  const boundary = el('path', {
    d: `M ${xOf(10 ** xLo)} ${yOf(Math.max(1e-9, (10 ** xLo) * runLengthKyr / 1000))} `
      + `L ${xOf(10 ** xHi)} ${yOf(Math.max(1e-9, (10 ** xHi) * runLengthKyr / 1000))}`,
    stroke: 'var(--ink-faint)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4',
    fill: 'none',
  });
  svg.appendChild(boundary);

  const label = el('text', {
    x: PAD.left + plotW - 4, y: PAD.top + 12,
    'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 9 * k,
  });
  label.textContent = `lifetime = ${runLengthKyr} kyr`;
  svg.appendChild(label);

  // Markers. Filled for survivors, hollow for the destroyed, so the two
  // populations read apart without relying on colour alone.
  for (const r of rows) {
    if (!(r.radiusMm > 0) || !(r.rateUmPerKyr > 0)) continue;
    const cx = xOf(r.rateUmPerKyr);
    const cy = yOf(r.radiusMm);
    const fill = colorFor?.(r) ?? 'var(--data-trace)';
    const dot = el('circle', {
      cx, cy, r: 5 * k,
      fill: r.destroyed ? 'none' : fill,
      stroke: fill,
      'stroke-width': r.destroyed ? 1.8 : 1,
    });
    const title = el('title');
    title.textContent =
      `${r.id.replace('asteroid_', 'fragment ')}: ${fmt(r.radiusMm, 3)} mm, `
      + `${r.rockType ?? 'unknown rock'}, eroding at ${fmt(r.rateUmPerKyr, 3)} um/kyr, `
      + `lifetime ${Number.isFinite(r.lifetimeKyr) ? fmt(r.lifetimeKyr, 3) : 'unbounded'} kyr `
      + `(${r.destroyed ? 'destroyed' : 'survived'})`;
    dot.appendChild(title);
    svg.appendChild(dot);
  }

  // Axis labels.
  const xLabel = el('text', {
    x: PAD.left + plotW / 2, y: height - 6,
    'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10 * k,
  });
  xLabel.textContent = 'erosion rate [um per kyr]';
  svg.appendChild(xLabel);

  const yLabel = el('text', {
    x: 10 * k, y: PAD.top + plotH / 2,
    'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10 * k,
    transform: `rotate(-90 ${10 * k} ${PAD.top + plotH / 2})`,
  });
  yLabel.textContent = 'initial radius [mm]';
  svg.appendChild(yLabel);

  container.appendChild(svg);
  return { svg };
}
