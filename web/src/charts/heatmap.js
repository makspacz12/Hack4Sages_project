/**
 * heatmap.js
 * SVG heatmap for parameter-grid ensemble JSON (velocity × radius → survival).
 */

import { fmt, niceTicks } from './plot.js';
import { formatRadius } from '../ui/rangeLog.js';

const NS = 'http://www.w3.org/2000/svg';

const PAD = { top: 20, right: 72, bottom: 48, left: 72 };

/** @typedef {{ velocity_kms: number[], radius_m: number[], heatmap_p50: (number|null)[][] }} GridPayload */

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  }
  return node;
}

/**
 * Validate and normalise ensemble grid JSON from the Python CLI.
 * @param {unknown} raw
 * @returns {GridPayload}
 */
export function parseGridPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('expected a JSON object');
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);
  if (obj.kind !== 'parameter_grid') {
    throw new Error(`expected kind "parameter_grid", got ${String(obj.kind)}`);
  }
  const axes = /** @type {Record<string, unknown>} */ (obj.axes ?? {});
  const velocity_kms = /** @type {unknown[]} */ (axes.velocity_kms ?? []);
  const radius_m = /** @type {unknown[]} */ (axes.radius_m ?? []);
  if (!velocity_kms.length || !radius_m.length) {
    throw new Error('axes.velocity_kms and axes.radius_m must be non-empty');
  }
  const heatmap = /** @type {unknown} */ (obj.heatmap_p50);
  if (!Array.isArray(heatmap) || heatmap.length !== radius_m.length) {
    throw new Error('heatmap_p50 row count must match axes.radius_m');
  }
  for (const row of heatmap) {
    if (!Array.isArray(row) || row.length !== velocity_kms.length) {
      throw new Error('heatmap_p50 column count must match axes.velocity_kms');
    }
  }
  return {
    velocity_kms: velocity_kms.map(Number),
    radius_m: radius_m.map(Number),
    heatmap_p50: /** @type {(number|null)[][]} */ (heatmap),
  };
}

/** Map survival in [lo, hi] to an RGB colour (dark iron → instrument teal). */
export function colorForSurvival(value, lo = 0, hi = 1) {
  if (!Number.isFinite(value)) return '#2a2320';
  const span = hi - lo || 1;
  const t = Math.min(1, Math.max(0, (value - lo) / span));
  const r = Math.round(107 + t * (43 - 107));
  const g = Math.round(45 + t * (194 - 45));
  const b = Math.round(45 + t * (171 - 45));
  return `rgb(${r},${g},${b})`;
}

function extentFromTable(table) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const row of table) {
    for (const v of row) {
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return Number.isFinite(lo) ? [lo, hi] : [0, 1];
}

/**
 * Render a survival heatmap into `container`.
 * @returns {{ destroy(): void }}
 */
export function survivalHeatmap(container, payload, options = {}) {
  const {
    height = 360,
    xLabel = 'Ejection speed (km/s)',
    yLabel = 'Fragment radius (m)',
    title = 'Median survival (p50)',
  } = options;

  const { velocity_kms, radius_m, heatmap_p50 } = parseGridPayload(payload);
  container.textContent = '';

  const width = Math.max(320, container.clientWidth || 480);
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const nCol = velocity_kms.length;
  const nRow = radius_m.length;
  const cellW = plotW / nCol;
  const cellH = plotH / nRow;
  const [cLo, cHi] = extentFromTable(heatmap_p50);

  const svg = el('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: '100%',
    height,
    role: 'img',
    'aria-label': title,
  });

  const xPos = i => PAD.left + (i + 0.5) * cellW;
  const yPos = j => PAD.top + plotH - (j + 0.5) * cellH;

  for (let j = 0; j < nRow; j++) {
    for (let i = 0; i < nCol; i++) {
      const value = heatmap_p50[j][i];
      const rect = el('rect', {
        x: PAD.left + i * cellW,
        y: PAD.top + plotH - (j + 1) * cellH,
        width: cellW,
        height: cellH,
        fill: colorForSurvival(Number(value), cLo, cHi),
        stroke: '#14100e',
        'stroke-width': 0.5,
        class: 'hm-cell',
      });
      rect.dataset.velocity = String(velocity_kms[i]);
      rect.dataset.radius = String(radius_m[j]);
      rect.dataset.value = Number.isFinite(value) ? String(value) : '';
      svg.appendChild(rect);
    }
  }

  for (const t of niceTicks(velocity_kms[0], velocity_kms[nCol - 1], 5)) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < nCol; i++) {
      const d = Math.abs(velocity_kms[i] - t);
      if (d < bestD) { bestD = d; best = i; }
    }
    const x = xPos(best);
    const label = el('text', { x, y: height - PAD.bottom + 18, class: 'tick tick-x' });
    label.textContent = fmt(t, 3);
    svg.appendChild(label);
  }

  for (const t of niceTicks(radius_m[0], radius_m[nRow - 1], 5)) {
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < nRow; j++) {
      const d = Math.abs(radius_m[j] - t);
      if (d < bestD) { bestD = d; best = j; }
    }
    const y = yPos(best);
    const label = el('text', { x: PAD.left - 8, y, class: 'tick tick-y' });
    label.textContent = formatRadius(t);
    svg.appendChild(label);
  }

  svg.appendChild(el('line', {
    x1: PAD.left, x2: PAD.left + plotW,
    y1: height - PAD.bottom, y2: height - PAD.bottom,
    class: 'axis',
  }));
  svg.appendChild(el('line', {
    x1: PAD.left, x2: PAD.left,
    y1: PAD.top, y2: PAD.top + plotH,
    class: 'axis',
  }));

  const xLab = el('text', {
    x: PAD.left + plotW / 2,
    y: height - 8,
    class: 'axis-label',
  });
  xLab.textContent = xLabel;
  svg.appendChild(xLab);

  const yLab = el('text', {
    x: 14,
    y: PAD.top + plotH / 2,
    class: 'axis-label',
    transform: `rotate(-90 14 ${PAD.top + plotH / 2})`,
  });
  yLab.textContent = yLabel;
  svg.appendChild(yLab);

  const legendX = width - PAD.right + 10;
  const legendH = plotH;
  const grad = el('defs');
  const linear = el('linearGradient', { id: 'hm-grad', x1: '0', y1: '1', x2: '0', y2: '0' });
  for (const stop of [0, 0.5, 1]) {
    const off = el('stop', {
      offset: `${stop * 100}%`,
      'stop-color': colorForSurvival(cLo + stop * (cHi - cLo), cLo, cHi),
    });
    linear.appendChild(off);
  }
  grad.appendChild(linear);
  svg.appendChild(grad);
  svg.appendChild(el('rect', {
    x: legendX,
    y: PAD.top,
    width: 12,
    height: legendH,
    fill: 'url(#hm-grad)',
    stroke: '#3a2f29',
    'stroke-width': 1,
  }));
  const loLab = el('text', { x: legendX + 18, y: PAD.top + legendH, class: 'tick tick-legend' });
  loLab.textContent = fmt(cLo, 3);
  svg.appendChild(loLab);
  const hiLab = el('text', { x: legendX + 18, y: PAD.top + 10, class: 'tick tick-legend' });
  hiLab.textContent = fmt(cHi, 3);
  svg.appendChild(hiLab);
  const legTitle = el('text', { x: legendX + 18, y: PAD.top - 6, class: 'tick tick-legend' });
  legTitle.textContent = 'p50';
  svg.appendChild(legTitle);

  container.appendChild(svg);

  const tip = document.createElement('div');
  tip.className = 'hm-tooltip';
  tip.hidden = true;
  container.appendChild(tip);

  function showTip(event, rect) {
    const v = rect.dataset.velocity;
    const r = rect.dataset.radius;
    const val = rect.dataset.value;
    tip.innerHTML =
      `<div><b>v</b> ${fmt(Number(v), 3)} km/s</div>` +
      `<div><b>r</b> ${formatRadius(Number(r))} m</div>` +
      `<div><b>survival</b> ${val ? fmt(Number(val), 4) : '—'}</div>`;
    tip.hidden = false;
    const box = container.getBoundingClientRect();
    tip.style.left = `${event.clientX - box.left + 12}px`;
    tip.style.top = `${event.clientY - box.top - 8}px`;
  }

  for (const rect of svg.querySelectorAll('.hm-cell')) {
    rect.addEventListener('pointerenter', e => showTip(e, rect));
    rect.addEventListener('pointermove', e => showTip(e, rect));
    rect.addEventListener('pointerleave', () => { tip.hidden = true; });
  }

  return {
    destroy: () => { container.textContent = ''; },
  };
}
