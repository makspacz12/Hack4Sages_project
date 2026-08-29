/**
 * sensitivityPage.js — Morris elementary-effects screening.
 *
 * This page used to draw a one-at-a-time tornado. That was replaced rather
 * than annotated: see sensitivity.html for what its shipped sample actually
 * contained. `charts/tornado.js` is kept because the CLI can still emit that
 * format and an old file should still open, but nothing links to it.
 */

import './ui/analysisPage.css';
import { parseMorris } from './charts/morris.js';
import {
  morrisChart, morrisTable, morrisCostPanel, MORRIS_STYLE,
} from './charts/morrisChart.js';

const APP_BASE = import.meta.env.BASE_URL;

function withBase(path) {
  return `${APP_BASE}${String(path).replace(/^\/+/, '')}`;
}

function injectPlotStyles() {
  if (document.getElementById('morris-plot-style')) return;
  const s = document.createElement('style');
  s.id = 'morris-plot-style';
  s.textContent = MORRIS_STYLE;
  document.head.appendChild(s);
}

let handle = null;

function showError(message) {
  const el = document.getElementById('morris-error');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('on', Boolean(message));
}

function renderMeta(screening) {
  const meta = document.getElementById('morris-meta');
  if (!meta) return;
  meta.innerHTML =
    `<div><b>Factors:</b> ${screening.factors.length}</div>`
    + `<div><b>Trajectories:</b> ${screening.trajectories} · `
    + `<b>levels:</b> ${screening.levels}</div>`
    + `<div><b>Model runs:</b> ${screening.evaluations}</div>`
    + `<div><b>Metric:</b> ${screening.metric ?? '—'}</div>`;
}

function render(raw) {
  const screening = parseMorris(raw);
  if (!screening) {
    showError('That file is not a Morris screening. Expected kind: "morris_screening".');
    return;
  }
  const host = document.getElementById('morris-plot');
  if (handle) handle.destroy();
  // Square: the reading is the ratio sigma/mu*, so the axes must share a scale
  // and the drawing area has to be square for the diagonals to be diagonals.
  const side = Math.min(560, Math.max(320, host.clientWidth || 520));
  handle = morrisChart(host, screening, { width: side, height: side });
  morrisCostPanel(document.getElementById('morris-cost'), screening);
  morrisTable(document.getElementById('morris-table'), screening);
  renderMeta(screening);
  showError('');
}

async function loadSample() {
  const res = await fetch(withBase('data/morris_sample.json'));
  if (!res.ok) throw new Error(`sample not found (${res.status})`);
  return res.json();
}

function wireFileInput() {
  const input = document.getElementById('morris-file');
  input?.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      render(JSON.parse(await file.text()));
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  });
}

injectPlotStyles();
wireFileInput();
document.getElementById('morris-load-sample')?.addEventListener('click', async () => {
  try {
    render(await loadSample());
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  }
});

loadSample().then(render).catch(() => {
  showError('Load a screening JSON, or run the CLI command below to generate one.');
});
