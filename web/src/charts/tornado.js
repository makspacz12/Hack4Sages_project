/**
 * tornado.js, SVG tornado chart for OAT sensitivity JSON.
 */

import { fmt } from './plot.js';
import { scalePad } from './plot.js';

const NS = 'http://www.w3.org/2000/svg';
const BASE_PAD = { top: 24, right: 28, bottom: 36, left: 168 };
// Read at draw time, so a presentation scale widens the gutters too.
const PAD = () => scalePad(BASE_PAD);
const ROW_H = 28;
const COLOR_LOW = 'var(--data-trace)';
const COLOR_HIGH = 'var(--accent)';

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  }
  return node;
}

function formatKnobValue(value) {
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1e4 || (Math.abs(value) > 0 && Math.abs(value) < 1e-3)) {
    return value.toExponential(2);
  }
  if (Number.isInteger(value)) return String(value);
  return value.toPrecision(3);
}

/**
 * @param {unknown} raw
 */
export function parseSensitivityPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('expected a JSON object');
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);
  if (obj.kind !== 'oat_sensitivity') {
    throw new Error(`expected kind "oat_sensitivity", got ${String(obj.kind)}`);
  }
  const tornado = /** @type {unknown} */ (obj.tornado);
  if (!Array.isArray(tornado) || tornado.length === 0) {
    throw new Error('tornado must be a non-empty array');
  }
  const baseline = /** @type {Record<string, unknown>} */ (obj.baseline ?? {});
  const p50 = baseline.p50;
  if (!Number.isFinite(p50)) {
    throw new Error('baseline.p50 must be a number');
  }
  return {
    fraction: Number(obj.fraction ?? 0.1),
    seeds: Array.isArray(obj.seeds) ? obj.seeds : [],
    baselineP50: Number(p50),
    tornado: tornado.map(row => {
      const r = /** @type {Record<string, unknown>} */ (row);
      return {
        id: String(r.id ?? ''),
        label: String(r.label ?? r.id ?? ''),
        unit: String(r.unit ?? ''),
        baselineValue: r.baseline_value,
        lowValue: r.low_value,
        highValue: r.high_value,
        lowP50: Number(r.low_p50),
        highP50: Number(r.high_p50),
        span: Number(r.span ?? 0),
      };
    }),
  };
}

/**
 * @returns {{ destroy(): void }}
 */
export function tornadoChart(container, payload, options = {}) {
  const { title = 'Sensitivity (median survival p50)' } = options;
  const data = parseSensitivityPayload(payload);
  container.textContent = '';

  const rows = data.tornado;
  const baseline = data.baselineP50;
  const allValues = [baseline];
  for (const row of rows) {
    if (Number.isFinite(row.lowP50)) allValues.push(row.lowP50);
    if (Number.isFinite(row.highP50)) allValues.push(row.highP50);
  }
  let xLo = Math.min(...allValues);
  let xHi = Math.max(...allValues);
  const bump = Math.max((xHi - xLo) * 0.08, 1e-6);
  xLo -= bump;
  xHi += bump;

  const width = Math.max(480, container.clientWidth || 640);
  const height = PAD().top + PAD().bottom + rows.length * ROW_H;
  const plotW = width - PAD().left - PAD().right;
  const xPos = v => PAD().left + ((v - xLo) / (xHi - xLo || 1)) * plotW;

  const svg = el('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: '100%',
    height,
    role: 'img',
    'aria-label': title,
  });

  const titleNode = el('text', {
    x: PAD().left,
    y: 16,
    class: 'tornado-title',
  });
  titleNode.textContent = title;
  svg.appendChild(titleNode);

  const baseX = xPos(baseline);
  svg.appendChild(el('line', {
    x1: baseX, x2: baseX,
    y1: PAD().top - 4, y2: PAD().top + rows.length * ROW_H,
    class: 'baseline',
  }));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const y = PAD().top + i * ROW_H + ROW_H / 2;
    const yTop = y - 9;

    const label = el('text', { x: PAD().left - 10, y, class: 'row-label' });
    label.textContent = row.label;
    svg.appendChild(label);

    const lo = row.lowP50;
    const hi = row.highP50;
    if (Number.isFinite(lo)) {
      const x0 = Math.min(xPos(lo), baseX);
      const x1 = Math.max(xPos(lo), baseX);
      svg.appendChild(el('rect', {
        x: x0, y: yTop, width: Math.max(1, x1 - x0), height: 18,
        fill: COLOR_LOW, opacity: 0.85, class: 'bar bar-low',
      }));
    }
    if (Number.isFinite(hi)) {
      const x0 = Math.min(xPos(hi), baseX);
      const x1 = Math.max(xPos(hi), baseX);
      svg.appendChild(el('rect', {
        x: x0, y: yTop, width: Math.max(1, x1 - x0), height: 18,
        fill: COLOR_HIGH, opacity: 0.85, class: 'bar bar-high',
      }));
    }

    const tip = `${row.label}\n−${Math.round(data.fraction * 100)}%: ${formatKnobValue(row.lowValue)} → ${fmt(lo, 4)}\n+${Math.round(data.fraction * 100)}%: ${formatKnobValue(row.highValue)} → ${fmt(hi, 4)}`;
    const hit = el('rect', {
      x: PAD().left, y: yTop - 2, width: plotW, height: 22,
      fill: 'transparent', class: 'row-hit',
    });
    hit.dataset.tip = tip;
    svg.appendChild(hit);
  }

  svg.appendChild(el('line', {
    x1: PAD().left, x2: PAD().left + plotW,
    y1: PAD().top + rows.length * ROW_H,
    y2: PAD().top + rows.length * ROW_H,
    class: 'axis',
  }));

  const baseTick = el('text', {
    x: baseX, y: height - 10, class: 'tick tick-x',
  });
  baseTick.textContent = `base ${fmt(baseline, 3)}`;
  svg.appendChild(baseTick);

  container.appendChild(svg);

  const tipEl = document.createElement('div');
  tipEl.className = 'tornado-tooltip';
  tipEl.hidden = true;
  container.appendChild(tipEl);

  for (const hit of svg.querySelectorAll('.row-hit')) {
    hit.addEventListener('pointerenter', e => {
      tipEl.textContent = hit.dataset.tip ?? '';
      tipEl.hidden = false;
      const box = container.getBoundingClientRect();
      tipEl.style.left = `${e.clientX - box.left + 12}px`;
      tipEl.style.top = `${e.clientY - box.top - 8}px`;
    });
    hit.addEventListener('pointerleave', () => { tipEl.hidden = true; });
  }

  const legend = document.createElement('div');
  legend.className = 'tornado-legend';
  legend.innerHTML =
    `<span><i class="swatch low"></i> −${Math.round(data.fraction * 100)}%</span>` +
    `<span><i class="swatch high"></i> +${Math.round(data.fraction * 100)}%</span>`;
  container.appendChild(legend);

  return { destroy: () => { container.textContent = ''; } };
}
