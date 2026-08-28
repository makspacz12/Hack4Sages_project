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
  depthProfileChart, parseDepthProfile, penetrationRatio,
} from './charts/depthProfile.js';
import {
  COEFF_BANDS, bandFor, cumulativeDoseSeries, sampledCoefficients,
  supportsRescaling, survivalAtCoefficient,
} from './charts/doseModel.js';
import {
  fragmentSeries, meanAcross, relativeChangePpm, distanceFromBody, speedSeries,
} from './charts/series.js';

const PALETTE = {
  // Individual fragments and their swarm mean are the SAME quantity, so they
  // are one hue at two emphases rather than two categories: iron oxide drawn
  // faint for each fragment, regolith-bright for the aggregate over them.
  // Selection borrows the instrument accent, the one cool colour on the page.
  trace: '#e2683c',      // iron oxide - fallback when the rock type is unknown
  mean: '#f2ebe4',       // regolith, lit - the aggregate
  selected: '#45c2ca',   // instrument teal - what you are pointing at
};

/**
 * Hue by rock type, because rock type is what actually decides the outcome.
 *
 * The internal dose from a fragment's own U/Th/K exceeds the shielded galactic
 * cosmic-ray dose by several orders of magnitude, so two fragments on identical
 * trajectories diverge entirely on composition. Drawing every fragment in one
 * colour hides the only variable that explains the result.
 *
 * Hue is an identity channel, which is the right one for a categorical
 * attribute. Assignment is by fixed order rather than by cycling a generator,
 * so a given rock keeps its colour when the fragment count changes.
 */
const ROCK_COLORS = {
  basalt_vtype:       '#e2683c',
  ordinary_chondrite: '#4aa3c7',
  ci_chondrite:       '#d8a33c',
  cm_chondrite:       '#9b7fc4',
  enstatite:          '#5fb37a',
  stony_iron:         '#c25f8e',
  iron_nickel:        '#8d8d8d',
  ice_rich:           '#7fd4e0',
  organic_rich:       '#b5713a',
  hydrated_silicate:  '#6f9f4f',
  olivine:            '#a8b44a',
  rubble_pile:        '#a08878',
};

export function colorForRockType(rockType) {
  return ROCK_COLORS[rockType] ?? PALETTE.trace;
}

/** rock type of each fragment, taken from the first frame that names it. */
export function rockTypeById(frames) {
  const out = new Map();
  for (const frame of frames ?? []) {
    for (const prop of frame?.properties ?? []) {
      if (prop?.id && prop.rock_type && !out.has(prop.id)) {
        out.set(prop.id, prop.rock_type);
      }
    }
  }
  return out;
}

function injectStyles() {
  if (document.getElementById('live-charts-style')) return;
  const s = document.createElement('style');
  s.id = 'live-charts-style';
  s.textContent = `
    .lc-coeff {
      padding: 8px 10px; border-bottom: 1px solid #3a2f29;
      background: rgba(12, 10, 9, 0.6);
    }
    .lc-coeff-label {
      display: block; font-size: 10px; letter-spacing: 0.04em;
      text-transform: uppercase; color: #8d7f74; margin-bottom: 4px;
    }
    .lc-coeff-val { color: #f2ebe4; text-transform: none; letter-spacing: 0; }
    .lc-coeff-slider { width: 100%; margin: 2px 0; accent-color: #45c2ca; }
    .lc-coeff-slider:focus-visible { outline: 2px solid #45c2ca; outline-offset: 2px; }
    .lc-coeff-band { font-size: 10px; color: #8d7f74; }
    .lc-coeff-band[data-warn="true"] { color: #e2683c; }
    .lc-coeff-reset {
      margin-top: 5px; background: none; border: 1px solid #3a2f29;
      color: #cbbfb4; font-family: monospace; font-size: 10px;
      padding: 2px 6px; cursor: pointer;
    }
    .lc-coeff-reset:hover { border-color: #45c2ca; color: #f2ebe4; }
    .lc-depth { border-top: 1px solid #3a2f29; padding-top: 8px; }
    .lc-depth-plot svg { display: block; max-width: 100%; }
    .dp-empty { font-size: 10.5px; color: #8d7f74; padding: 6px 0; }
    #live-charts {
      position: fixed; top: 0; right: 0; bottom: 72px;
      width: 330px; z-index: 860;
      background: rgba(20, 16, 14, 0.95);
      border-left: 1px solid #3a2f29;
      font-family: monospace; color: #cbbfb4;
      display: flex; flex-direction: column;
      transition: transform .18s ease;
    }
    #live-charts.hidden { transform: translateX(100%); }

    #live-charts .lc-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; border-bottom: 1px solid #3a2f29;
      background: rgba(30, 22, 18, .55); flex: 0 0 auto;
    }
    #live-charts .lc-title {
      font-size: 12px; font-weight: bold; color: #2ba3ab; letter-spacing: .08em;
    }
    #live-charts .lc-sub { font-size: 10px; color: #6b5e55; margin-top: 2px; }
    #live-charts .lc-close {
      background: none; border: 1px solid #3a2f29; border-radius: 5px;
      color: #98897d; cursor: pointer; font-size: 13px; line-height: 1;
      padding: 3px 8px;
    }
    #live-charts .lc-close:hover { color: #f2ebe4; border-color: #2ba3ab; }

    #live-charts .lc-body { overflow-y: auto; padding: 4px 0 12px; flex: 1 1 auto; }
    #live-charts .lc-fig { padding: 8px 12px 5px; border-bottom: 1px solid #2a2320; }
    #live-charts .lc-fig:last-child { border-bottom: none; }
    #live-charts .lc-fig-title { font-size: 11.5px; color: #f2ebe4; font-weight: bold; }
    #live-charts .lc-fig-note { font-size: 10px; color: #6b5e55; margin-top: 1px; }
    #live-charts .lc-readout { font-size: 10.5px; color: #98897d; margin-top: 4px; }
    #live-charts .lc-plot { margin-top: 4px; position: relative; }

    #live-charts svg .grid   { stroke: #241d1a; stroke-width: 1; }
    #live-charts svg .axis   { stroke: #3a2f29; stroke-width: 1; }
    #live-charts svg .tick   { fill: #98897d; font-size: 9px; font-family: inherit; }
    #live-charts svg .tick-y { text-anchor: end; dominant-baseline: middle; }
    #live-charts svg .tick-x { text-anchor: middle; }
    #live-charts svg .axis-label { fill: #98897d; font-size: 9.5px; text-anchor: middle; font-family: inherit; }
    #live-charts svg .crosshair { stroke: #98897d; stroke-width: 1; opacity: .45; }
    #live-charts .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 5px; font-size: 10px; color: #98897d; }
    #live-charts .legend-item { display: inline-flex; align-items: center; gap: 5px; }
    #live-charts .legend-swatch { width: 10px; height: 3px; border-radius: 2px; display: inline-block; }
    #live-charts .empty { padding: 18px 0; text-align: center; color: #6b5e55; font-size: 10.5px; }

    #live-charts .lc-fig-head {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
    }
    #live-charts .lc-expand {
      background: none; border: 1px solid transparent; border-radius: 3px;
      color: #6b5e55; cursor: pointer; font-size: 13px; line-height: 1;
      padding: 2px 5px; flex: 0 0 auto;
    }
    #live-charts .lc-fig:hover .lc-expand { border-color: #3a2f29; color: #98897d; }
    #live-charts .lc-expand:hover { color: #2ba3ab; border-color: #2ba3ab; }

    #live-charts .lc-selection {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 12px; background: rgba(43,163,171,.11);
      border-bottom: 1px solid #3a2f29; font-size: 10.5px; color: #cbbfb4;
      flex: 0 0 auto;
    }
    #live-charts .lc-selection b { color: #f2ebe4; }
    #live-charts .lc-clear {
      background: none; border: 1px solid #57453b; border-radius: 3px;
      color: #98897d; font-size: 9.5px; letter-spacing: .06em; text-transform: uppercase;
      padding: 2px 7px; cursor: pointer; font-family: inherit;
    }
    #live-charts .lc-clear:hover { color: #f2ebe4; border-color: #2ba3ab; }

    #live-charts svg .hoverline { stroke: #2ba3ab; stroke-width: 1; opacity: .55; }
    #live-charts .tooltip, .lc-modal .tooltip {
      position: absolute; pointer-events: none; z-index: 5;
      background: #1e1917; border: 1px solid #57453b; border-radius: 3px;
      padding: 6px 9px; font-size: 11px; color: #f2ebe4;
      box-shadow: 0 6px 20px rgba(0,0,0,.6); white-space: nowrap;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    #live-charts .tt-head, .lc-modal .tt-head { color: #98897d; margin-bottom: 3px; }
    #live-charts .tt-row, .lc-modal .tt-row { display: flex; align-items: center; gap: 6px; }
    #live-charts .tt-swatch, .lc-modal .tt-swatch {
      width: 8px; height: 8px; border-radius: 2px; display: inline-block;
    }
    #live-charts .tt-hint, .lc-modal .tt-hint { color: #2ba3ab; margin-top: 3px; font-size: 10px; }

    /* ── Enlarged view ── */
    .lc-modal {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(6, 5, 4, .84);
      display: flex; align-items: center; justify-content: center; padding: 40px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .lc-modal-card {
      background: #14100e; border: 1px solid #57453b; border-radius: 4px;
      width: min(1000px, 92vw); box-shadow: 0 24px 80px rgba(0,0,0,.7);
    }
    .lc-modal-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 14px 18px; border-bottom: 1px solid #3a2f29; gap: 16px;
    }
    .lc-modal-head .lc-fig-title { font-size: 14px; color: #f2ebe4; font-weight: bold; }
    .lc-modal-head .lc-fig-note { font-size: 11px; color: #98897d; margin-top: 3px; max-width: 80ch; }
    .lc-modal-close {
      background: none; border: 1px solid #3a2f29; border-radius: 3px;
      color: #98897d; cursor: pointer; font-size: 16px; line-height: 1; padding: 3px 9px;
    }
    .lc-modal-close:hover { color: #f2ebe4; border-color: #2ba3ab; }
    .lc-modal-plot { padding: 12px 18px 4px; position: relative; }
    .lc-modal-plot svg .grid { stroke: #241d1a; }
    .lc-modal-plot svg .axis { stroke: #3a2f29; }
    .lc-modal-plot svg .tick { fill: #98897d; font-size: 11px; font-family: inherit; }
    .lc-modal-plot svg .tick-y { text-anchor: end; dominant-baseline: middle; }
    .lc-modal-plot svg .tick-x { text-anchor: middle; }
    .lc-modal-plot svg .axis-label { fill: #cbbfb4; font-size: 12px; text-anchor: middle; font-family: inherit; }
    .lc-modal-plot svg .hoverline { stroke: #2ba3ab; stroke-width: 1; opacity: .55; }
    .lc-modal-plot svg .crosshair { stroke: #98897d; stroke-width: 1; opacity: .4; }
    .lc-modal-plot svg .hover-dot { stroke: #14100e; stroke-width: 2; }
    .lc-modal-plot .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 8px; font-size: 11px; color: #cbbfb4; }
    .lc-modal-plot .legend-swatch { width: 12px; height: 3px; border-radius: 2px; display: inline-block; }
    .lc-modal-foot {
      padding: 8px 18px 14px; font-size: 10.5px; color: #6b5e55;
      border-top: 1px solid #2a2320;
    }

    #btn-live-charts {
      position: fixed; top: 14px; right: 14px; z-index: 861;
      background: rgba(20, 16, 14, 0.86); border: 1px solid #3a2f29;
      color: #2ba3ab; font-family: monospace; font-size: 13px; font-weight: bold;
      letter-spacing: .1em; padding: 6px 14px; border-radius: 6px; cursor: pointer;
    }
    #btn-live-charts:hover { border-color: #2ba3ab; background: rgba(43,163,171,.13); color: #45c2ca; }
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
export function createLiveCharts(simData, { onSelectFragment } = {}) {
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
    <div class="lc-selection" hidden></div>
    <div class="lc-coeff" hidden>
      <label class="lc-coeff-label" for="lc-crad">
        radiation inactivation <span class="lc-coeff-val"></span>
      </label>
      <input class="lc-coeff-slider" id="lc-crad" type="range"
             min="0" max="1000" value="0" step="1"
             aria-describedby="lc-coeff-band">
      <div class="lc-coeff-band" id="lc-coeff-band"></div>
      <button class="lc-coeff-reset" type="button">use each fragment's own value</button>
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

  const rockTypes = rockTypeById(frames);

  const traces = map => [...map].map(([id, points]) => ({
    color: colorForRockType(rockTypes.get(id)),
    points, width: 1, opacity: 0.42, faint: true,
    selectedColor: PALETTE.selected,
    pickId: id,
    rockType: rockTypes.get(id) ?? null,
    label: `${id.replace('asteroid_', 'fragment ')}`
      + (rockTypes.get(id) ? ` · ${rockTypes.get(id)}` : ''),
  }));
  const withMean = (map, meanName) => [
    ...traces(map),
    { name: meanName, color: PALETTE.mean, points: meanAcross(map), width: 2 },
  ];

  // ── Coefficient control ────────────────────────────────────────────────
  //
  // c_rad is the least certain number in the model - the published chronic
  // band alone spans a factor of seventeen. Rather than draw that as an error
  // bar, which the literature shows even professional readers misread, the
  // panel lets it be moved and redraws the survival curve from the exported
  // cumulative dose. The recomputation is exact, not an approximation.
  const doseSeries = cumulativeDoseSeries(frames);
  const sampledCoeffs = sampledCoefficients(frames);
  const canRescale = supportsRescaling(frames);

  // Log mapping: the range covers nearly two decades, so a linear slider would
  // spend most of its travel in the top half of the band.
  const C_LO = COEFF_BANDS.chronicMin;
  const C_HI = COEFF_BANDS.acuteMax;
  const posToCoeff = pos =>
    C_LO * Math.pow(C_HI / C_LO, Math.min(1, Math.max(0, pos / 1000)));
  const coeffToPos = c =>
    Math.round(1000 * Math.log(c / C_LO) / Math.log(C_HI / C_LO));

  // null means "each fragment keeps the coefficient the run sampled for it".
  let overrideCoeff = null;

  /** Survival at the current coefficient, or as recorded if unchanged. */
  function currentSurvival() {
    if (!canRescale || overrideCoeff === null) return survival;
    return survivalAtCoefficient(doseSeries, overrideCoeff, sampledCoeffs);
  }

  const specs = [
    {
      title: 'Surviving microbial fraction',
      note: `N/N₀ · ${survival.size} fragments`,
      series: withMean(currentSurvival(), 'swarm mean'),
      rescalable: true,
      yLabel: 'N / N₀',
      // A surviving fraction lives in [0, 1]. Without this the axis fits
      // itself to the data, and a run where essentially nothing dies is drawn
      // as a collapse with 0.99950 at the bottom of the scale.
      yDomain: [0, 1],
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
      <div class="lc-fig-head">
        <div>
          <div class="lc-fig-title">${spec.title}</div>
          <div class="lc-fig-note">${spec.note}</div>
        </div>
        <button class="lc-expand" title="Enlarge">&#9974;</button>
      </div>
      <div class="lc-plot"></div>
      <div class="lc-readout">—</div>
    `;
    body.appendChild(fig);
    const plotEl = fig.querySelector('.lc-plot');
    const readoutEl = fig.querySelector('.lc-readout');
    fig.querySelector('.lc-expand').addEventListener('click', () => openModal(spec));

    live.push({ spec, plotEl, readoutEl, chart: null });
  }

  let selectedId = null;
  let frameIndex = 0;
  let modal = null;

  function renderAll() {
    for (const item of live) {
      item.chart = liveLinePlot(item.plotEl, {
        series: item.spec.series,
        xLabel: `time [${timeUnit}]`,
        yLabel: item.spec.yLabel,
        yFormat: item.spec.yFormat,
        yDomain: item.spec.yDomain,
        xFormat: v => fmt(v),
        xUnit: timeUnit,
        height: 126,
        selected: selectedId,
        onPick: (s) => { if (s.pickId) select(s.pickId); },
      });
    }
  }

  /**
   * Rebuild only the charts whose data depends on the coefficient.
   *
   * Distance, speed and erosion are unaffected by biology, so they are left
   * alone rather than torn down and rebuilt on every slider step.
   */
  function applyCoefficient(value) {
    overrideCoeff = value;
    const recomputed = currentSurvival();
    for (const item of live) {
      if (!item.spec.rescalable) continue;
      item.spec.series = withMean(recomputed, 'swarm mean');
      item.spec.source = recomputed;
      item.chart?.destroy?.();
      item.chart = liveLinePlot(item.plotEl, {
        series: item.spec.series,
        xLabel: `time [${timeUnit}]`,
        yLabel: item.spec.yLabel,
        yFormat: item.spec.yFormat,
        // While the coefficient is being moved the axis is pinned to the full
        // [0, 1] scale. Letting it refit on every slider step would rescale the
        // frame around the curve, so the curve would appear to stand still
        // while the numbers underneath it changed - which defeats the entire
        // point of being able to drag the coefficient.
        yDomain: item.spec.yDomain,
        pinDomain: value !== null,
        xFormat: v => fmt(v),
        xUnit: timeUnit,
        height: 126,
        selected: selectedId,
        onPick: (s) => { if (s.pickId) select(s.pickId); },
      });
    }
    paintCoefficient();
    // Redraw through the normal path so the numeric readouts refresh too;
    // updating the chart alone leaves them showing the previous coefficient.
    update(frameIndex);
  }

  function paintCoefficient() {
    const box = panel.querySelector('.lc-coeff');
    if (!box) return;
    // Hidden entirely for replays generated before the cumulative dose was
    // exported: a control that silently does nothing is worse than no control.
    box.hidden = !canRescale;
    if (!canRescale) return;
    const valEl = box.querySelector('.lc-coeff-val');
    const bandEl = box.querySelector('.lc-coeff-band');
    if (overrideCoeff === null) {
      valEl.textContent = 'as sampled per fragment';
      bandEl.textContent =
        `${COEFF_BANDS.chronicMin.toExponential(1)}–`
        + `${COEFF_BANDS.chronicMax.toExponential(1)} 1/Gy, drawn per fragment`;
      bandEl.dataset.warn = 'false';
    } else {
      valEl.textContent = `${overrideCoeff.toExponential(2)} 1/Gy, all fragments`;
      const band = bandFor(overrideCoeff);
      bandEl.textContent = band;
      bandEl.dataset.warn = String(band.includes('not applicable')
        || band.includes('above') || band.includes('below'));
    }
  }

  /** Selecting a fragment highlights it in every chart and follows it in 3D. */
  function select(id) {
    selectedId = selectedId === id ? null : id;
    for (const item of live) item.chart?.setSelected(selectedId);
    modal?.chart?.setSelected(selectedId);
    paintSelection();
    if (selectedId) onSelectFragment?.(selectedId);
  }

  function paintSelection() {
    const bar = panel.querySelector('.lc-selection');
    if (!bar) return;
    bar.hidden = !selectedId;
    if (selectedId) {
      bar.innerHTML = `<span>following <b>${selectedId.replace('asteroid_', 'fragment ')}</b></span>`
                    + '<button class="lc-clear">clear</button>';
      bar.querySelector('.lc-clear').addEventListener('click', () => select(selectedId));
    }
  }

  /** Click the enlarge glyph to inspect one chart at full size. */
  function openModal(spec) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'lc-modal';
    overlay.innerHTML = `
      <div class="lc-modal-card">
        <div class="lc-modal-head">
          <div>
            <div class="lc-fig-title">${spec.title}</div>
            <div class="lc-fig-note">${spec.note}</div>
          </div>
          <button class="lc-modal-close" title="Close">&times;</button>
        </div>
        <div class="lc-modal-plot"></div>
        <div class="lc-modal-foot">Hover for exact values · click a trace to follow that fragment · Esc to close</div>
      </div>
    `;
    document.body.appendChild(overlay);
    const chart = liveLinePlot(overlay.querySelector('.lc-modal-plot'), {
      series: spec.series,
      xLabel: `time [${timeUnit}]`,
      yLabel: spec.yLabel,
      yFormat: spec.yFormat,
      yDomain: spec.yDomain,
      xFormat: v => fmt(v),
      xUnit: timeUnit,
      height: 420,
      selected: selectedId,
      onPick: (s) => { if (s.pickId) select(s.pickId); },
    });
    chart.update(frameIndex);
    modal = { overlay, chart };
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    overlay.querySelector('.lc-modal-close').addEventListener('click', closeModal);
    document.addEventListener('keydown', onEsc);
  }

  function onEsc(e) { if (e.key === 'Escape') closeModal(); }

  function closeModal() {
    if (!modal) return;
    modal.overlay.remove();
    modal = null;
    document.removeEventListener('keydown', onEsc);
  }

  function update(index) {
    frameIndex = index;
    modal?.chart?.update(index);
    const t = frames[Math.min(index, frames.length - 1)]?.time;
    for (const item of live) {
      item.chart?.update(index);
      const text = item.spec.readout(item.spec.source, index);
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

  /**
   * The mechanism figure: transmitted radiation against depth.
   *
   * Appended once, after the time series, and labelled as static so nobody
   * waits for it to animate. It is a property of the fragment's geometry, and
   * it is the only figure here that explains the outcome rather than reporting
   * it.
   */
  function renderDepthProfile() {
    const profile = parseDepthProfile(simData);
    if (!profile) return;
    const fig = document.createElement('figure');
    fig.className = 'lc-fig lc-depth';
    const ratio = penetrationRatio(profile);
    fig.innerHTML = `
      <figcaption>
        <div class="lc-fig-title">Shielding against depth</div>
        <div class="lc-fig-note">
          static · ${profile.rockRadius} m fragment${profile.rockType ? ` · ${profile.rockType}` : ''}
        </div>
      </figcaption>
      <div class="lc-depth-plot"></div>
      <div class="lc-readout">${
        ratio
          ? `cosmic rays reach ${ratio.toFixed(0)}× deeper than photons `
            + `(1/e at ${profile.cosmicDepth.toFixed(3)} m vs `
            + `${profile.photonDepth.toFixed(3)} m)`
          : ''
      }</div>
    `;
    body.appendChild(fig);
    depthProfileChart(fig.querySelector('.lc-depth-plot'), profile, {
      width: 300, height: 190,
    });
  }

  function mount() {
    document.body.append(panel, toggle);
    renderAll();
    renderDepthProfile();
    const slider = panel.querySelector('.lc-coeff-slider');
    const reset = panel.querySelector('.lc-coeff-reset');
    if (slider) {
      slider.value = String(coeffToPos(COEFF_BANDS.default));
      slider.addEventListener('input', () => {
        applyCoefficient(posToCoeff(Number(slider.value)));
      });
    }
    reset?.addEventListener('click', () => {
      applyCoefficient(null);
      if (slider) slider.value = String(coeffToPos(COEFF_BANDS.default));
    });
    paintCoefficient();
    setVisible(true);
    update(0);
    paintSelection();
    body.scrollTop = 0;
    return api;
  }

  const api = { mount, update, select };
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
