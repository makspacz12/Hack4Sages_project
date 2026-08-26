/**
 * liveCharts.js
 * A dock of plots that draw themselves as the replay plays.
 *
 * Every series here comes from the replay currently on screen, so the charts
 * and the 3D scene are always showing the same frame - scrubbing the timeline
 * rewinds the curves too. The axes are fixed to the full run, so you watch the
 * curve grow into a stable frame rather than the scale sliding under you.
 *
 * Only quantities the replay records per frame are plotted. Per-rock-type
 * comparisons and the radiation breakdown live in separate exports that are not
 * frame-aligned to this file, so they are deliberately not here.
 */

import { liveLinePlot, fmt } from './charts/plot.js';
import {
  fragmentSeries, meanAcross, relativeChangePpm, distanceFromBody, speedSeries,
} from './charts/series.js';

const PALETTE = {
  // Validated against this dock's surface in dark mode. Slot order is fixed.
  trace: '#3987e5',   // slot 1 - individual fragments
  mean: '#d95926',    // slot 2 - the swarm mean drawn over them
};

function injectStyles() {
  if (document.getElementById('live-charts-style')) return;
  const s = document.createElement('style');
  s.id = 'live-charts-style';
  s.textContent = `
    #live-charts {
      position: fixed; top: 0; right: 0; bottom: 72px;
      width: 330px; z-index: 860;
      background: rgba(8, 12, 26, 0.94);
      border-left: 1px solid #1e2e4a;
      font-family: monospace; color: #ccd;
      display: flex; flex-direction: column;
      transition: transform .18s ease;
    }
    #live-charts.hidden { transform: translateX(100%); }

    #live-charts .lc-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; border-bottom: 1px solid #1e2e4a;
      background: rgba(0, 20, 50, .5); flex: 0 0 auto;
    }
    #live-charts .lc-title {
      font-size: 12px; font-weight: bold; color: #6cf; letter-spacing: .08em;
    }
    #live-charts .lc-sub { font-size: 10px; color: #5c7099; margin-top: 2px; }
    #live-charts .lc-close {
      background: none; border: 1px solid #1e2e4a; border-radius: 5px;
      color: #6f7f9e; cursor: pointer; font-size: 13px; line-height: 1;
      padding: 3px 8px;
    }
    #live-charts .lc-close:hover { color: #cfe; border-color: #4a9eff; }

    #live-charts .lc-body { overflow-y: auto; padding: 4px 0 12px; flex: 1 1 auto; }
    #live-charts .lc-fig { padding: 8px 12px 5px; border-bottom: 1px solid #141e31; }
    #live-charts .lc-fig:last-child { border-bottom: none; }
    #live-charts .lc-fig-title { font-size: 11.5px; color: #dfe8f7; font-weight: bold; }
    #live-charts .lc-fig-note { font-size: 10px; color: #5c7099; margin-top: 1px; }
    #live-charts .lc-readout { font-size: 10.5px; color: #8ba4cc; margin-top: 4px; }
    #live-charts .lc-plot { margin-top: 4px; position: relative; }

    #live-charts svg .grid   { stroke: #182238; stroke-width: 1; }
    #live-charts svg .axis   { stroke: #26324c; stroke-width: 1; }
    #live-charts svg .tick   { fill: #6f7f9e; font-size: 9px; font-family: inherit; }
    #live-charts svg .tick-y { text-anchor: end; dominant-baseline: middle; }
    #live-charts svg .tick-x { text-anchor: middle; }
    #live-charts svg .axis-label { fill: #6f7f9e; font-size: 9.5px; text-anchor: middle; font-family: inherit; }
    #live-charts svg .crosshair { stroke: #6f7f9e; stroke-width: 1; opacity: .45; }
    #live-charts .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 5px; font-size: 10px; color: #8ba4cc; }
    #live-charts .legend-item { display: inline-flex; align-items: center; gap: 5px; }
    #live-charts .legend-swatch { width: 10px; height: 3px; border-radius: 2px; display: inline-block; }
    #live-charts .empty { padding: 18px 0; text-align: center; color: #4a5670; font-size: 10.5px; }

    #btn-live-charts {
      position: fixed; top: 14px; right: 14px; z-index: 861;
      background: rgba(8, 12, 28, 0.82); border: 1px solid #1e3060;
      color: #4a9eff; font-family: monospace; font-size: 13px; font-weight: bold;
      letter-spacing: .1em; padding: 6px 14px; border-radius: 6px; cursor: pointer;
    }
    #btn-live-charts:hover { border-color: #4a9eff; background: rgba(74,158,255,.12); color: #80c4ff; }
    #btn-live-charts.docked { right: 344px; }

    /* The object search sits at right:300px; slide it clear of the dock so the
       two never overlap. */
    body.charts-docked #obj-search-toggle { right: 640px; }
    body.charts-docked #obj-search-panel  { right: 640px; }

    @media (max-width: 900px) {
      #live-charts { display: none; }
      #btn-live-charts { display: none; }
    }
  `;
  document.head.appendChild(s);
}

/**
 * @param {object} simData the parsed replay
 * @returns {{ mount():object, update(frameIndex:number):void }}
 */
export function createLiveCharts(simData) {
  injectStyles();

  const frames = simData?.frames ?? [];
  const timeUnit = simData?.meta?.timeUnit ?? 'yr';
  const posUnit = simData?.meta?.positionUnit ?? 'AU';
  const velUnit = simData?.meta?.velocityUnit ?? 'AU/yr';

  const panel = document.createElement('div');
  panel.id = 'live-charts';
  panel.innerHTML = `
    <div class="lc-head">
      <div>
        <div class="lc-title">LIVE ANALYSIS</div>
        <div class="lc-sub">drawn from the replay, frame by frame</div>
      </div>
      <button class="lc-close" title="Hide">&times;</button>
    </div>
    <div class="lc-body"></div>
  `;
  const body = panel.querySelector('.lc-body');

  const toggle = document.createElement('button');
  toggle.id = 'btn-live-charts';
  toggle.textContent = 'ANALYSIS';

  // ── Build the series once ───────────────────────────────────────────────
  const survival = fragmentSeries(frames, 'population_fraction');
  const distance = distanceFromBody(frames, 'sun');
  const erosion = relativeChangePpm(fragmentSeries(frames, 'radius'));
  const speed = speedSeries(frames);

  const traces = map => [...map.values()].map(points => ({
    color: PALETTE.trace, points, width: 1, opacity: 0.32, faint: true,
  }));
  const withMean = (map, meanName) => [
    ...traces(map),
    { name: meanName, color: PALETTE.mean, points: meanAcross(map), width: 2 },
  ];

  const specs = [
    {
      title: 'Surviving microbial fraction',
      note: `N/N₀ · ${survival.size} fragments`,
      series: withMean(survival, 'swarm mean'),
      yLabel: 'N / N₀',
      yFormat: v => v.toFixed(5),
      readout: (map, i) => `mean ${fmtAt(meanAcross(map), i, 6)} · worst ${fmtWorst(map, i, 6)}`,
      source: survival,
    },
    {
      title: 'Distance from the Sun',
      note: 'how far the swarm has travelled',
      series: withMean(distance, 'swarm mean'),
      yLabel: `distance [${posUnit}]`,
      yFormat: v => v.toFixed(1),
      readout: (map, i) => `mean ${fmtAt(meanAcross(map), i, 3)} ${posUnit} · max ${fmtBest(map, i, 3)} ${posUnit}`,
      source: distance,
    },
    {
      title: 'Speed',
      note: 'orbital speed of each fragment',
      series: withMean(speed, 'swarm mean'),
      yLabel: `speed [${velUnit}]`,
      yFormat: v => v.toFixed(1),
      readout: (map, i) => `mean ${fmtAt(meanAcross(map), i, 3)} ${velUnit}`,
      source: speed,
    },
    {
      title: 'Dust erosion',
      note: 'radius lost, relative to each fragment\'s own start',
      series: withMean(erosion, 'swarm mean'),
      yLabel: 'Δr [ppm]',
      yFormat: v => v.toFixed(0),
      readout: (map, i) => `mean ${fmtAt(meanAcross(map), i, 2)} ppm`,
      source: erosion,
    },
  ];

  const live = [];

  for (const spec of specs) {
    const fig = document.createElement('div');
    fig.className = 'lc-fig';
    fig.innerHTML = `
      <div class="lc-fig-title">${spec.title}</div>
      <div class="lc-fig-note">${spec.note}</div>
      <div class="lc-plot"></div>
      <div class="lc-readout">—</div>
    `;
    body.appendChild(fig);
    const plotEl = fig.querySelector('.lc-plot');
    const readoutEl = fig.querySelector('.lc-readout');

    live.push({ spec, plotEl, readoutEl, chart: null });
  }

  function renderAll() {
    for (const item of live) {
      item.chart = liveLinePlot(item.plotEl, {
        series: item.spec.series,
        xLabel: `time [${timeUnit}]`,
        yLabel: item.spec.yLabel,
        yFormat: item.spec.yFormat,
        xFormat: v => fmt(v),
        height: 126,
      });
    }
  }

  function update(frameIndex) {
    const t = frames[Math.min(frameIndex, frames.length - 1)]?.time;
    for (const item of live) {
      item.chart?.update(frameIndex);
      const text = item.spec.readout(item.spec.source, frameIndex);
      item.readoutEl.textContent = Number.isFinite(t)
        ? `t=${t.toFixed(2)} ${timeUnit} · ${text}`
        : text;
    }
  }

  function setVisible(visible) {
    panel.classList.toggle('hidden', !visible);
    toggle.classList.toggle('docked', visible);
    document.body.classList.toggle('charts-docked', visible);
    toggle.textContent = visible ? 'ANALYSIS ›' : 'ANALYSIS';
  }

  panel.querySelector('.lc-close').addEventListener('click', () => setVisible(false));
  toggle.addEventListener('click', () => setVisible(panel.classList.contains('hidden')));

  function mount() {
    document.body.append(panel, toggle);
    renderAll();
    setVisible(true);
    update(0);
    body.scrollTop = 0;
    return api;
  }

  const api = { mount, update };
  return api;
}

// ── Readout helpers ───────────────────────────────────────────────────────

function valueAt(points, index) {
  if (!points || points.length === 0) return null;
  return points[Math.min(Math.max(0, index), points.length - 1)]?.[1] ?? null;
}

function fmtAt(points, index, digits) {
  const v = valueAt(points, index);
  return Number.isFinite(v) ? v.toFixed(digits) : '—';
}

function reduceAt(map, index, pick) {
  let best = null;
  for (const points of map.values()) {
    const v = valueAt(points, index);
    if (!Number.isFinite(v)) continue;
    best = best === null ? v : pick(best, v);
  }
  return best;
}

function fmtWorst(map, index, digits) {
  const v = reduceAt(map, index, Math.min);
  return Number.isFinite(v) ? v.toFixed(digits) : '—';
}

function fmtBest(map, index, digits) {
  const v = reduceAt(map, index, Math.max);
  return Number.isFinite(v) ? v.toFixed(digits) : '—';
}
