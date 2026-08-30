/**
 * gridPage.js — load and display parameter-grid ensemble JSON as a heatmap.
 */

import './ui/analysisPage.css';
import { survivalHeatmap } from './charts/heatmap.js';

const APP_BASE = import.meta.env.BASE_URL;

function withBase(path) {
  return `${APP_BASE}${String(path).replace(/^\/+/, '')}`;
}

function injectPlotStyles() {
  if (document.getElementById('grid-plot-style')) return;
  const s = document.createElement('style');
  s.id = 'grid-plot-style';
  s.textContent = `
    #grid-plot svg .axis { stroke: var(--line-edge); stroke-width: 1; }
    #grid-plot svg .tick { fill: var(--ink-dim); font-size: 0.625rem; font-family: monospace; }
    #grid-plot svg .tick-y { text-anchor: end; dominant-baseline: middle; }
    #grid-plot svg .tick-x { text-anchor: middle; }
    #grid-plot svg .tick-legend { text-anchor: start; dominant-baseline: middle; font-size: 0.5625rem; }
    #grid-plot svg .axis-label { fill: var(--ink-dim); font-size: 0.625rem; font-family: monospace; }
    #grid-plot .hm-cell { cursor: crosshair; }
    #grid-plot .hm-tooltip {
      position: absolute; pointer-events: none; z-index: 5;
      background: var(--bg-panel); border: 1px solid var(--line-edge);
      border-radius: 5px; padding: 8px 10px; font-family: monospace;
      font-size: 0.6875rem; color: var(--ink); line-height: 1.5;
    }
    #grid-plot .hm-tooltip b { color: var(--ink-bright); }
  `;
  document.head.appendChild(s);
}

let plotHandle = null;

function showError(message) {
  const el = document.getElementById('grid-error');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('on', Boolean(message));
}

function renderMeta(raw) {
  const meta = document.getElementById('grid-meta');
  if (!meta) return;
  const seeds = Array.isArray(raw.seeds) ? raw.seeds.join(', ') : '—';
  meta.innerHTML =
    `<div><b>Metric:</b> ${raw.metric ?? 'median_population_fraction'}</div>` +
    `<div><b>Grid:</b> ${raw.axes?.velocity_kms?.length ?? '?'} × ${raw.axes?.radius_m?.length ?? '?'} ` +
    `(velocity × radius), <b>${raw.n_cells ?? '?'} cells</b></div>` +
    `<div><b>Seeds per cell:</b> ${seeds}</div>`;
}

function renderPlot(raw) {
  const host = document.getElementById('grid-plot');
  if (!host) return;
  if (plotHandle) plotHandle.destroy();
  plotHandle = survivalHeatmap(host, raw);
  showError('');
  renderMeta(raw);
}

async function loadSample() {
  const res = await fetch(withBase('data/grid_sample.json'));
  if (!res.ok) throw new Error(`sample not found (${res.status})`);
  return res.json();
}

function wireFileInput() {
  const input = document.getElementById('grid-file');
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
document.getElementById('grid-load-sample')?.addEventListener('click', async () => {
  try {
    renderPlot(await loadSample());
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  }
});

loadSample().then(renderPlot).catch(() => {
  showError('Load a grid JSON file or run the sample CLI command below.');
});
