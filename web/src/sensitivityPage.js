/**
 * sensitivityPage.js — load OAT tornado JSON from the ensemble CLI.
 */

import './ui/analysisPage.css';
import { parseSensitivityPayload, tornadoChart } from './charts/tornado.js';

const APP_BASE = import.meta.env.BASE_URL;

function withBase(path) {
  return `${APP_BASE}${String(path).replace(/^\/+/, '')}`;
}

function injectPlotStyles() {
  if (document.getElementById('tornado-plot-style')) return;
  const s = document.createElement('style');
  s.id = 'tornado-plot-style';
  s.textContent = `
    #tornado-plot svg .axis { stroke: #3a2f29; stroke-width: 1; }
    #tornado-plot svg .baseline { stroke: #98897d; stroke-width: 1; stroke-dasharray: 4 3; }
    #tornado-plot svg .row-label {
      fill: #cbbfb4; font-size: 11px; font-family: monospace;
      text-anchor: end; dominant-baseline: middle;
    }
    #tornado-plot svg .tick { fill: #98897d; font-size: 10px; font-family: monospace; text-anchor: middle; }
    #tornado-plot svg .tornado-title {
      fill: #f2ebe4; font-size: 12px; font-family: monospace; font-weight: bold;
    }
    #tornado-plot .tornado-tooltip {
      position: absolute; pointer-events: none; z-index: 5;
      background: rgba(20,16,14,.94); border: 1px solid #3a2f29;
      border-radius: 5px; padding: 8px 10px; font-family: monospace;
      font-size: 11px; color: #cbbfb4; line-height: 1.5; white-space: pre-line;
    }
    #tornado-plot .tornado-legend {
      display: flex; gap: 16px; margin-top: 10px;
      font-family: monospace; font-size: 11px; color: #98897d;
    }
    #tornado-plot .tornado-legend .swatch {
      display: inline-block; width: 12px; height: 8px; margin-right: 6px;
      vertical-align: middle; border-radius: 2px;
    }
    #tornado-plot .tornado-legend .swatch.low { background: #e2683c; }
    #tornado-plot .tornado-legend .swatch.high { background: #2ba3ab; }
  `;
  document.head.appendChild(s);
}

let plotHandle = null;

function showError(message) {
  const el = document.getElementById('tornado-error');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('on', Boolean(message));
}

function renderMeta(raw) {
  const meta = document.getElementById('tornado-meta');
  if (!meta) return;
  const data = parseSensitivityPayload(raw);
  meta.innerHTML =
    `<div><b>Baseline p50:</b> ${data.baselineP50.toPrecision(4)}</div>` +
    `<div><b>Perturbation:</b> ±${Math.round(data.fraction * 100)}% OAT</div>` +
    `<div><b>Knobs:</b> ${data.tornado.length} (top: ${data.tornado[0]?.label ?? '—'})</div>` +
    `<div><b>Seeds:</b> ${data.seeds.join(', ') || '—'}</div>`;
}

function renderPlot(raw) {
  const host = document.getElementById('tornado-plot');
  if (!host) return;
  if (plotHandle) plotHandle.destroy();
  plotHandle = tornadoChart(host, raw);
  showError('');
  renderMeta(raw);
}

async function loadSample() {
  const res = await fetch(withBase('data/tornado_sample.json'));
  if (!res.ok) throw new Error(`sample not found (${res.status})`);
  return res.json();
}

function wireFileInput() {
  const input = document.getElementById('tornado-file');
  input?.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      renderPlot(JSON.parse(await file.text()));
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  });
}

injectPlotStyles();
wireFileInput();
document.getElementById('tornado-load-sample')?.addEventListener('click', async () => {
  try {
    renderPlot(await loadSample());
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  }
});

loadSample().then(renderPlot).catch(() => {
  showError('Load a tornado JSON file or run the sample CLI command below.');
});
