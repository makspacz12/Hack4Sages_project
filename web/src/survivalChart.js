/**
 * survivalChart.js
 * Live survival plot — bottom-left corner.
 *
 * Replaces the generic R/WebR demo panel that used to sit here. This one is
 * driven by the simulation actually on screen: it reads `population_fraction`
 * out of the replay frames and grows the curve as the animation plays.
 *
 * `population_fraction` is N/N0, the surviving microbial fraction, written per
 * frame per fragment by the Python model
 * (model/microbe_radiation_model/simulation/scenarios.py).
 *
 * Interaction:
 *   - The curve advances with the replay; scrubbing the timeline redraws it.
 *   - Click the header to collapse/expand.
 */

const PANEL_W = 300;
const CANVAS_W = 298;
const CANVAS_H = 150;
const PAD_L = 46;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 26;

// ── Pure data preparation (unit-tested) ───────────────────────────────────

/**
 * Extract per-fragment survival series from replay frames.
 *
 * Only objects that carry `population_fraction` are included, so the Sun,
 * planets and Gaia stars are skipped automatically.
 *
 * @param {Array<{time:number, properties:Array<object>}>} frames
 * @returns {{
 *   times: number[],
 *   ids: string[],
 *   series: number[][],   // series[i][f] = fraction for ids[i] at frame f
 *   mean: number[],       // swarm mean per frame
 *   min: number[],        // swarm minimum per frame
 *   yMin: number,
 *   yMax: number
 * }}
 */
export function buildSurvivalSeries(frames) {
  const empty = { times: [], ids: [], series: [], mean: [], min: [], yMin: 0, yMax: 1 };
  if (!Array.isArray(frames) || frames.length === 0) return empty;

  // Collect ids in first-seen order across every frame, so fragments that
  // appear part-way through an impact run are still tracked.
  const ids = [];
  const seen = new Set();
  for (const frame of frames) {
    for (const prop of frame?.properties ?? []) {
      if (prop == null) continue;
      // Number.isFinite, not typeof: NaN is a number and would otherwise
      // register a fragment that never contributes a single usable value.
      if (!Number.isFinite(prop.population_fraction)) continue;
      if (seen.has(prop.id)) continue;
      seen.add(prop.id);
      ids.push(prop.id);
    }
  }
  if (ids.length === 0) return empty;

  const times = frames.map((f, i) => (typeof f?.time === 'number' ? f.time : i));
  const series = ids.map(() => new Array(frames.length).fill(NaN));
  const mean = new Array(frames.length).fill(NaN);
  const min = new Array(frames.length).fill(NaN);

  const indexOfId = new Map(ids.map((id, i) => [id, i]));

  let lowest = Infinity;
  let highest = -Infinity;

  frames.forEach((frame, f) => {
    let sum = 0;
    let count = 0;
    let frameMin = Infinity;

    for (const prop of frame?.properties ?? []) {
      if (prop == null) continue;
      const value = prop.population_fraction;
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      const i = indexOfId.get(prop.id);
      if (i === undefined) continue;

      series[i][f] = value;
      sum += value;
      count += 1;
      if (value < frameMin) frameMin = value;
      if (value < lowest) lowest = value;
      if (value > highest) highest = value;
    }

    if (count > 0) {
      mean[f] = sum / count;
      min[f] = frameMin;
    }
  });

  if (!Number.isFinite(lowest) || !Number.isFinite(highest)) return empty;

  // Survival often stays within a fraction of a percent of 1.0 over a short
  // run. A fixed 0..1 axis would render that as a flat line, so scale to the
  // data and keep a little headroom.
  const span = highest - lowest;
  const padding = span > 0 ? span * 0.15 : Math.max(highest * 1e-4, 1e-9);
  const yMin = Math.max(0, lowest - padding);
  const yMax = Math.min(1, highest + padding);

  return { times, ids, series, mean, min, yMin: yMin === yMax ? yMin - 1e-9 : yMin, yMax };
}

/** Format a survival fraction with enough precision to be readable. */
export function formatFraction(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  if (value >= 0.999) return value.toFixed(6);
  if (value >= 0.01) return value.toFixed(4);
  return value.toExponential(2);
}

// ── Styles ────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('survival-chart-style')) return;
  const s = document.createElement('style');
  s.id = 'survival-chart-style';
  s.textContent = `
    #survival-panel {
      position: fixed;
      bottom: 72px;
      left: 14px;
      width: ${PANEL_W}px;
      background: rgba(8, 10, 20, 0.92);
      border: 1px solid #1e2e4a;
      border-radius: 10px;
      font-family: monospace;
      font-size: 12px;
      color: #ccd;
      z-index: 850;
      box-shadow: 0 4px 24px rgba(0,0,0,.55);
      overflow: hidden;
      user-select: none;
    }
    #survival-panel .sp-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 10px 5px;
      background: rgba(0,20,50,.55);
      border-bottom: 1px solid #1e2e4a;
      cursor: pointer;
    }
    #survival-panel .sp-title {
      font-weight: bold; color: #6cf; letter-spacing: .05em; font-size: 12px;
    }
    #survival-panel .sp-hint { font-size: 10px; color: #446; margin-left: 6px; }
    #survival-panel .sp-toggle {
      background: none; border: none; color: #446;
      font-size: 14px; padding: 0 2px; line-height: 1;
    }
    #survival-panel .sp-body { background: #060a16; }
    #survival-panel canvas { display: block; }
    #survival-panel .sp-status {
      padding: 4px 10px 5px;
      border-top: 1px solid #16223a;
      color: #8ba4cc; font-size: 10px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #survival-panel.collapsed .sp-body,
    #survival-panel.collapsed .sp-status { display: none; }
  `;
  document.head.appendChild(s);
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Create and mount the live survival chart.
 * @returns {{ mount:Function, setData:Function, update:Function, destroy:Function }}
 */
export function createSurvivalChart() {
  injectStyles();

  const panel = document.createElement('div');
  panel.id = 'survival-panel';
  panel.innerHTML = `
    <div class="sp-header">
      <span><span class="sp-title">SURVIVAL</span>
      <span class="sp-hint">N/N&#8320; per fragment</span></span>
      <button class="sp-toggle" title="Collapse">&minus;</button>
    </div>
    <div class="sp-body"></div>
    <div class="sp-status">waiting for simulation data…</div>
  `;

  const body = panel.querySelector('.sp-body');
  const statusEl = panel.querySelector('.sp-status');
  const header = panel.querySelector('.sp-header');
  const toggle = panel.querySelector('.sp-toggle');

  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = CANVAS_W * dpr;
  canvas.height = CANVAS_H * dpr;
  canvas.style.width = `${CANVAS_W}px`;
  canvas.style.height = `${CANVAS_H}px`;
  body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  let data = null;
  let timeUnit = 'yr';

  header.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    toggle.innerHTML = collapsed ? '&plus;' : '&minus;';
    toggle.title = collapsed ? 'Expand' : 'Collapse';
  });

  function xFor(frameIndex) {
    const n = data.times.length;
    if (n <= 1) return PAD_L;
    return PAD_L + (frameIndex / (n - 1)) * (CANVAS_W - PAD_L - PAD_R);
  }

  function yFor(value) {
    const { yMin, yMax } = data;
    const span = yMax - yMin || 1;
    const t = (value - yMin) / span;
    return PAD_T + (1 - t) * (CANVAS_H - PAD_T - PAD_B);
  }

  function drawAxes() {
    ctx.strokeStyle = '#22314e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_L, PAD_T);
    ctx.lineTo(PAD_L, CANVAS_H - PAD_B);
    ctx.lineTo(CANVAS_W - PAD_R, CANVAS_H - PAD_B);
    ctx.stroke();

    ctx.fillStyle = '#5c7099';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const frac of [0, 0.5, 1]) {
      const value = data.yMin + frac * (data.yMax - data.yMin);
      const y = yFor(value);
      ctx.fillText(formatFraction(value).slice(0, 8), PAD_L - 4, y);
      ctx.strokeStyle = '#141e31';
      ctx.beginPath();
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(CANVAS_W - PAD_R, y);
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const t0 = data.times[0] ?? 0;
    const t1 = data.times[data.times.length - 1] ?? 0;
    ctx.fillText(t0.toFixed(2), PAD_L, CANVAS_H - PAD_B + 5);
    ctx.fillText(t1.toFixed(2), CANVAS_W - PAD_R, CANVAS_H - PAD_B + 5);
    ctx.fillText(`time [${timeUnit}]`, (PAD_L + CANVAS_W - PAD_R) / 2, CANVAS_H - PAD_B + 15);
  }

  function drawSeries(values, upTo, style, width) {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    let started = false;
    for (let f = 0; f <= upTo && f < values.length; f++) {
      const v = values[f];
      if (!Number.isFinite(v)) { started = false; continue; }
      const x = xFor(f);
      const y = yFor(v);
      if (started) ctx.lineTo(x, y);
      else { ctx.moveTo(x, y); started = true; }
    }
    ctx.stroke();
  }

  function render(frameIndex) {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (!data || data.times.length === 0) {
      ctx.fillStyle = '#44506b';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('no survival data in this replay', CANVAS_W / 2, CANVAS_H / 2);
      return;
    }

    const upTo = Math.max(0, Math.min(frameIndex, data.times.length - 1));
    drawAxes();

    // One faint line per fragment, then the swarm mean on top.
    for (const values of data.series) {
      drawSeries(values, upTo, 'rgba(108, 170, 255, 0.28)', 1);
    }
    drawSeries(data.mean, upTo, '#ffb454', 2);

    // Playhead and current-value marker.
    const x = xFor(upTo);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, PAD_T);
    ctx.lineTo(x, CANVAS_H - PAD_B);
    ctx.stroke();

    const meanNow = data.mean[upTo];
    if (Number.isFinite(meanNow)) {
      ctx.fillStyle = '#ffb454';
      ctx.beginPath();
      ctx.arc(x, yFor(meanNow), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function update(frameIndex) {
    if (!data) return;
    render(frameIndex);

    const upTo = Math.max(0, Math.min(frameIndex, data.times.length - 1));
    const t = data.times[upTo];
    const meanNow = data.mean[upTo];
    const minNow = data.min[upTo];

    statusEl.textContent = Number.isFinite(meanNow)
      ? `${t.toFixed(2)} ${timeUnit} · mean ${formatFraction(meanNow)} · min ${formatFraction(minNow)} · n=${data.ids.length}`
      : `${t.toFixed(2)} ${timeUnit} · no fragments yet`;
  }

  /**
   * @param {Array} frames replay frames
   * @param {object} [meta] replay meta (used for the time unit label)
   */
  function setData(frames, meta) {
    data = buildSurvivalSeries(frames);
    timeUnit = meta?.timeUnit ?? 'yr';
    if (data.ids.length === 0) {
      statusEl.textContent = 'this replay carries no population_fraction data';
    }
    update(0);
  }

  function mount() {
    document.body.appendChild(panel);
    return api;
  }

  function destroy() {
    panel.remove();
  }

  const api = { mount, setData, update, destroy };
  return api;
}
