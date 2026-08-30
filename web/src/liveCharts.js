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
  depthProfileChart, parseDepthProfile, penetrationRatio, profileForFragment,
} from './charts/depthProfile.js';
import {
  openChartWindow, redrawChartWindows, selectInChartWindows, updateChartWindows,
} from './charts/popout.js';
import { provenancePanel } from './charts/provenancePanel.js';
import { headlineBanner } from './charts/headlineBanner.js';
import { withTooltip, renderContent } from './ui/tooltip.js';
import { C_RAD_HELP, C_RAD_PRESETS } from './ui/paramHelp.js';
import { answerSurfaceChart, ANSWER_SURFACE_STYLE } from './charts/answerSurfaceChart.js';
import {
  COEFF_BANDS, bandFor, cumulativeDoseSeries, sampledCoefficients,
  supportsRescaling, survivalAtCoefficient, doseBudget, doseBudgetRatio,
  formatMultiplicative,
} from './charts/doseModel.js';
import {
  fragmentSeries, meanAcross, relativeChangePpm, distanceFromBody,
  orbitalEnergySeries, fateCounts,
} from './charts/series.js';

const PALETTE = {
  // Individual fragments and their swarm mean are the SAME quantity, so they
  // are one hue at two emphases rather than two categories: iron oxide drawn
  // faint for each fragment, regolith-bright for the aggregate over them.
  // Selection borrows the instrument accent, the one cool colour on the page.
  trace: 'var(--data-trace)',      // iron oxide - fallback when the rock type is unknown
  mean: 'var(--ink-bright)',       // regolith, lit - the aggregate
  selected: 'var(--accent)',   // instrument teal - what you are pointing at
  // A second data channel that is NOT a rock class and NOT the aggregate: the
  // internal decay dose beside the cosmic-ray dose. Measured against the
  // regolith line on this surface it separates by dE00 28.4 under protanopia
  // and 28.6 with normal vision, and clears 3:1 contrast; it also carries a
  // dash, so identity never rests on hue alone.
  secondary: 'var(--data-secondary)',
  // Annotations - an escape threshold, a reference level - are not data and
  // must stay recessive, or the eye reads the guide as a result.
  guide: 'var(--ink-dim)',
};

/**
 * Rock type by class hue plus dash pattern, not by twelve separate hues.
 *
 * Twelve hues was the wrong shape of answer. Measured with CIEDE2000 under the
 * Machado, Oliveira & Fernandes (2009) deficiency matrices, the previous set
 * separated by only 1.7 under protanopia: basalt_vtype and organic_rich were
 * literally the same colour for roughly one man in twelve in the room, and two
 * of the three chondrite groups were indistinguishable under deuteranopia.
 * Those are exactly the contrasts this simulation is about.
 *
 * Nor was it fixable by picking better hues. Optimising twelve colours against
 * the worst of normal, protan, deutan and tritan vision, subject to 3:1
 * contrast on this background, tops out around 11.7 — below what six colours
 * get for free. Twelve categories is not a job for colour.
 *
 * So the twelve rock types collapse to six physically meaningful classes, each
 * taking a colour from a published colourblind-safe palette, and members within
 * a class are separated by dash pattern instead.
 *
 * THE FIRST SIX COLOURS WERE STILL WRONG, and the comment here claimed they
 * measured 15.2 in the worst deficiency. They did not. Re-measured against this
 * surface: metallic #DDDDDD had chroma exactly ZERO, so it was a grey rather
 * than a colour; the metallic/chondrite pair separated by only 14.6 for a
 * reader with NORMAL vision, below the threshold at which two series can be
 * told apart at all; the icy/organic pair reached 6.2 under deuteranopia; and
 * four of the six sat outside the lightness band for a dark ground. Collapsing
 * to six classes was the right decision and the reasoning above stands; the
 * particular hues chosen to fill them were not checked.
 *
 * The replacements are Okabe & Ito, darkened where the published values were
 * too light to hold 3:1. Measured against ADJACENT pairs, every check passes:
 * worst 10.4 under deuteranopia, 18.1 with normal vision.
 *
 * BUT ADJACENT PAIRS ARE NOT THE TEST THAT MATTERS. Two classes can sit far
 * apart in this list and still be plotted on the same axes, so the honest
 * check is every pair, not neighbours. Under that check the original set had a
 * genuine collision: organic-rich against silicate at dE00 1.2 under
 * protanopia and 10.6 with NORMAL vision - two solid lines that were, for
 * practical purposes, the same colour. Both were oranges.
 *
 * Organic-rich is now a sienna, which lifts that pair to 5.9 protan while
 * still clearing 3:1 on BOTH grounds - a darker brown cleared the separation
 * but fell to 2.66:1 on the white panel, which the palette test caught.
 * What remains, stated rather than discovered later:
 *
 *   icy vs metallic        5.9 (deuteranopia)
 *   rubble vs chondrite   13.3 (normal vision)
 *   sky/purple             4.3 (tritanopia, ~1 in 10 000)
 *
 * Six categorical hues cannot clear the all-pairs thresholds; that was tested,
 * not assumed - every six-colour set tried failed some pair. The remedy is the
 * one the guidance allows: never let class identity rest on hue alone. Every
 * series is named in the legend and again in its hover tooltip, and members
 * within a class are separated by dash pattern.
 *
 * The dashes do NOT separate the classes from each other - each class's first
 * member is solid - so the direct labels are doing that work, and if they are
 * ever removed this palette stops being defensible.
 *
 * Encoding a category by line style as well as hue is also required rather than
 * merely advisable: WCAG 1.4.1, and the AAS Journals figure guidance — "the use
 * of color as the only distinguishing delimiter in a figure should be generally
 * avoided. Colored lines should also use different line styles."
 */
const ROCK_CLASSES = {
  silicate:  { color: '#D55E00', label: 'silicates' },    // Okabe & Ito vermillion
  chondrite: { color: '#0072B2', label: 'chondrites' },   // Okabe & Ito blue
  metal:     { color: '#009E73', label: 'metallic' },     // Okabe & Ito bluish green
  organic:   { color: '#A0522D', label: 'organic-rich' }, // sienna; see the note above
  icy:       { color: '#B0578C', label: 'icy' },          // Okabe & Ito purple, darkened
  rubble:    { color: '#4E9BCF', label: 'rubble pile' },  // Okabe & Ito sky, darkened
};

/** Dash separates members within a class; hue separates classes. */
const ROCK_STYLE = {
  basalt_vtype:       { cls: 'silicate',  dash: null },
  olivine:            { cls: 'silicate',  dash: '6 3' },
  enstatite:          { cls: 'silicate',  dash: '2 3' },
  hydrated_silicate:  { cls: 'silicate',  dash: '9 3 2 3' },
  ordinary_chondrite: { cls: 'chondrite', dash: null },
  ci_chondrite:       { cls: 'chondrite', dash: '6 3' },
  cm_chondrite:       { cls: 'chondrite', dash: '2 3' },
  iron_nickel:        { cls: 'metal',     dash: null },
  stony_iron:         { cls: 'metal',     dash: '6 3' },
  organic_rich:       { cls: 'organic',   dash: null },
  ice_rich:           { cls: 'icy',       dash: null },
  rubble_pile:        { cls: 'rubble',    dash: null },
};

export function colorForRockType(rockType) {
  const style = ROCK_STYLE[rockType];
  return style ? ROCK_CLASSES[style.cls].color : PALETTE.trace;
}

export function dashForRockType(rockType) {
  return ROCK_STYLE[rockType]?.dash ?? null;
}

export function rockClassLabel(rockType) {
  const style = ROCK_STYLE[rockType];
  return style ? ROCK_CLASSES[style.cls].label : 'unclassified';
}

/** The six classes, for a legend. */
export function rockClasses() {
  return Object.entries(ROCK_CLASSES).map(([id, c]) => ({ id, ...c }));
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

/**
 * Two layout defects that only show up once both panels are open.
 *
 * The object inspector sits at right:16 with width 270 and z-index 800; this
 * dock sits at right:0 with width 330 and z-index 860. The inspector is
 * therefore entirely inside the dock's footprint and underneath it, so
 * clicking a fragment in the 3D scene filled a panel nobody could see. It is
 * moved clear of the dock whenever the dock is open, rather than being given a
 * higher z-index, because stacking two panels on the same pixels helps no one.
 *
 * The headline band also has to push the top-anchored chrome down, or it
 * covers the very controls it sits above.
 */
function injectLayoutFixes(banner) {
  if (!document.getElementById('lc-layout-fix')) {
    const s = document.createElement('style');
    s.id = 'lc-layout-fix';
    // Everything top-anchored is pushed below the band by its MEASURED height,
    // not a hard-coded one. The band wraps differently at different widths -
    // it was 138px where a guessed 104px had been assumed, so the dock header
    // and both toggle buttons sat underneath it.
    s.textContent = `
      body.charts-docked #info-panel,
      body.charts-docked #obj-search-panel { right: 346px; }
      #info-panel, #obj-search-panel, #focus-hud, #ui {
        top: calc(var(--headline-h, 0px) + var(--menubar-h, 0px) + 16px);
      }
      #btn-live-charts { top: calc(var(--headline-h, 0px) + var(--menubar-h, 0px) + 14px); }
      #live-charts { top: calc(var(--headline-h, 0px) + var(--menubar-h, 0px)); }
    `;
    document.head.appendChild(s);
  }
  if (!banner?.root) return;
  const measure = () => {
    const h = banner.root.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--headline-h', `${Math.ceil(h)}px`);
  };
  measure();
  // The band reflows with the window, so the offset has to follow it.
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(measure).observe(banner.root);
  } else {
    window.addEventListener('resize', measure);
  }
}

function injectStyles() {
  if (document.getElementById('live-charts-style')) return;
  const s = document.createElement('style');
  s.id = 'live-charts-style';
  s.textContent = `
    .lc-coeff {
      padding: 8px 10px; border-bottom: 1px solid var(--line-edge);
      background: var(--bg-raised);
    }
    .lc-coeff-label {
      display: block; font-size: 10px; letter-spacing: 0.04em;
      text-transform: uppercase; color: var(--ink-dim); margin-bottom: 4px;
    }
    .lc-coeff-val { color: var(--ink-bright); text-transform: none; letter-spacing: 0; }
    .lc-coeff-slider { width: 100%; margin: 2px 0; accent-color: var(--accent); }
    .lc-coeff-slider:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .lc-coeff-presets {
      display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0 5px;
    }
    .lc-preset {
      background: none; border: 1px solid var(--line-edge); color: var(--ink-dim);
      font-family: inherit; font-size: 9.5px; padding: 2px 6px;
      border-radius: 2px; cursor: pointer; line-height: 1.4;
    }
    .lc-preset:hover { border-color: var(--accent); color: var(--ink-bright); }
    .lc-preset:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    .lc-coeff-num {
      width: 100%; box-sizing: border-box; margin: 4px 0 5px;
      background: var(--bg-sunken); border: 1px solid var(--line-edge); color: var(--ink-bright);
      font-family: inherit; font-size: 11px; padding: 3px 6px; border-radius: 2px;
    }
    .lc-coeff-num:focus { outline: none; border-color: var(--accent); }
    .lc-coeff-num.bad { border-color: var(--data-trace); }
    .lc-coeff-name { border-bottom: 1px dotted var(--line-strong); }
    .lc-coeff-band { font-size: 10px; color: var(--ink-dim); }
    .lc-coeff-band[data-warn="true"] { color: var(--data-trace); }
    .lc-coeff-reset {
      margin-top: 5px; background: none; border: 1px solid var(--line-edge);
      color: var(--ink); font-family: monospace; font-size: 10px;
      padding: 2px 6px; cursor: pointer;
    }
    .lc-coeff-reset:hover { border-color: var(--accent); color: var(--ink-bright); }
    #live-charts .lc-fig-btns { display: flex; gap: 3px; }
    #live-charts .lc-popout {
      background: none; border: 1px solid transparent; color: transparent;
      font-size: 12px; cursor: pointer; padding: 0 3px; line-height: 1.4;
    }
    #live-charts .lc-fig:hover .lc-popout { border-color: var(--line-edge); color: var(--ink-dim); }
    #live-charts .lc-popout:hover { color: var(--accent); border-color: var(--accent); }
    .lc-depth { border-top: 1px solid var(--line-edge); padding-top: 8px; }
    .lc-depth-plot svg { display: block; max-width: 100%; }
    .dp-empty { font-size: 10.5px; color: var(--ink-dim); padding: 6px 0; }
    #live-charts {
      position: fixed; top: 0; right: 0; bottom: 72px;
      width: 330px; z-index: 860;
      background: var(--bg-panel);
      border-left: 1px solid var(--line-edge);
      font-family: monospace; color: var(--ink);
      display: flex; flex-direction: column;
      transition: transform .18s ease;
    }
    #live-charts.hidden { transform: translateX(100%); }

    #live-charts .lc-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; border-bottom: 1px solid var(--line-edge);
      background: var(--bg-raised); flex: 0 0 auto;
    }
    #live-charts .lc-title {
      font-size: 12px; font-weight: bold; color: var(--accent); letter-spacing: .08em;
    }
    #live-charts .lc-sub { font-size: 10px; color: var(--ink-dim); margin-top: 2px; }
    #live-charts .lc-close {
      background: none; border: 1px solid var(--line-edge); border-radius: 5px;
      color: var(--ink-dim); cursor: pointer; font-size: 13px; line-height: 1;
      padding: 3px 8px;
    }
    #live-charts .lc-close:hover { color: var(--ink-bright); border-color: var(--accent); }

    #live-charts .lc-body { overflow-y: auto; padding: 4px 0 12px; flex: 1 1 auto; }
    #live-charts .lc-fig { padding: 8px 12px 5px; border-bottom: 1px solid var(--line-hair); }
    #live-charts .lc-fig:last-child { border-bottom: none; }
    #live-charts .lc-fig-title { font-size: 11.5px; color: var(--ink-bright); font-weight: bold; }
    #live-charts .lc-fig-note { font-size: 10px; color: var(--ink-dim); margin-top: 1px; }
    #live-charts .lc-readout { font-size: 10.5px; color: var(--ink-dim); margin-top: 4px; }
    #live-charts .lc-plot { margin-top: 4px; position: relative; }

    /* Scoped to the SVG, not to #live-charts. These same charts are rendered
       into detached windows, which are separate documents with no ancestor of
       that id - so an id-scoped rule silently stopped applying and the popped
       out chart lost its grid, ticks and axis labels. */
    svg .grid   { stroke: var(--line-hair); stroke-width: 1; }
    svg .axis   { stroke: var(--line-edge); stroke-width: 1; }
    svg .tick   { fill: var(--ink-dim); font-size: 9px; font-family: inherit; }
    svg .tick-y { text-anchor: end; dominant-baseline: middle; }
    svg .tick-x { text-anchor: middle; }
    svg .axis-label { fill: var(--ink-dim); font-size: 9.5px; text-anchor: middle; font-family: inherit; }
    svg .crosshair { stroke: var(--ink-dim); stroke-width: 1; opacity: .45; }
    #live-charts .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 5px; font-size: 10px; color: var(--ink-dim); }
    #live-charts .legend-item { display: inline-flex; align-items: center; gap: 5px; }
    #live-charts .legend-swatch { width: 10px; height: 3px; border-radius: 2px; display: inline-block; }
    #live-charts .empty { padding: 18px 0; text-align: center; color: var(--ink-dim); font-size: 10.5px; }

    #live-charts .lc-fig-head {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
    }
    #live-charts .lc-expand {
      background: none; border: 1px solid transparent; border-radius: 3px;
      color: var(--ink-dim); cursor: pointer; font-size: 13px; line-height: 1;
      padding: 2px 5px; flex: 0 0 auto;
    }
    #live-charts .lc-fig:hover .lc-expand { border-color: var(--line-edge); color: var(--ink-dim); }
    #live-charts .lc-expand:hover { color: var(--accent); border-color: var(--accent); }

    #live-charts .lc-selection {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 12px; background: rgba(43,163,171,.11);
      border-bottom: 1px solid var(--line-edge); font-size: 10.5px; color: var(--ink);
      flex: 0 0 auto;
    }
    #live-charts .lc-selection b { color: var(--ink-bright); }
    #live-charts .lc-clear {
      background: none; border: 1px solid var(--line-strong); border-radius: 3px;
      color: var(--ink-dim); font-size: 9.5px; letter-spacing: .06em; text-transform: uppercase;
      padding: 2px 7px; cursor: pointer; font-family: inherit;
    }
    #live-charts .lc-clear:hover { color: var(--ink-bright); border-color: var(--accent); }

    svg .hoverline { stroke: var(--accent); stroke-width: 1; opacity: .55; }
    #live-charts .tooltip, .lc-modal .tooltip {
      position: absolute; pointer-events: none; z-index: 5;
      background: var(--bg-raised); border: 1px solid var(--line-strong); border-radius: 3px;
      padding: 6px 9px; font-size: 11px; color: var(--ink-bright);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12); white-space: nowrap;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    #live-charts .tt-head, .lc-modal .tt-head { color: var(--ink-dim); margin-bottom: 3px; }
    #live-charts .tt-row, .lc-modal .tt-row { display: flex; align-items: center; gap: 6px; }
    #live-charts .tt-swatch, .lc-modal .tt-swatch {
      width: 8px; height: 8px; border-radius: 2px; display: inline-block;
    }
    #live-charts .tt-hint, .lc-modal .tt-hint { color: var(--accent); margin-top: 3px; font-size: 10px; }

    /* ── Enlarged view ── */
    .lc-modal {
      position: fixed; inset: 0; z-index: 1000;
      background: var(--bg-panel);
      display: flex; align-items: center; justify-content: center; padding: 40px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .lc-modal-card {
      background: var(--bg-panel); border: 1px solid var(--line-strong); border-radius: 4px;
      width: min(1000px, 92vw); box-shadow: 0 24px 80px rgba(0, 0, 0, 0.16);
    }
    .lc-modal-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 14px 18px; border-bottom: 1px solid var(--line-edge); gap: 16px;
    }
    .lc-modal-head .lc-fig-title { font-size: 14px; color: var(--ink-bright); font-weight: bold; }
    .lc-modal-head .lc-fig-note { font-size: 11px; color: var(--ink-dim); margin-top: 3px; max-width: 80ch; }
    .lc-modal-close {
      background: none; border: 1px solid var(--line-edge); border-radius: 3px;
      color: var(--ink-dim); cursor: pointer; font-size: 16px; line-height: 1; padding: 3px 9px;
    }
    .lc-modal-close:hover { color: var(--ink-bright); border-color: var(--accent); }
    .lc-modal-plot { padding: 12px 18px 4px; position: relative; }
    .lc-modal-plot svg .grid { stroke: var(--line-hair); }
    .lc-modal-plot svg .axis { stroke: var(--line-edge); }
    .lc-modal-plot svg .tick { fill: var(--ink-dim); font-size: 11px; font-family: inherit; }
    .lc-modal-plot svg .tick-y { text-anchor: end; dominant-baseline: middle; }
    .lc-modal-plot svg .tick-x { text-anchor: middle; }
    .lc-modal-plot svg .axis-label { fill: var(--ink); font-size: 12px; text-anchor: middle; font-family: inherit; }
    .lc-modal-plot svg .hoverline { stroke: var(--accent); stroke-width: 1; opacity: .55; }
    .lc-modal-plot svg .crosshair { stroke: var(--ink-dim); stroke-width: 1; opacity: .4; }
    .lc-modal-plot svg .hover-dot { stroke: var(--bg-panel); stroke-width: 2; }
    .lc-modal-plot .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 8px; font-size: 11px; color: var(--ink); }
    .lc-modal-plot .legend-swatch { width: 12px; height: 3px; border-radius: 2px; display: inline-block; }
    .lc-modal-foot {
      padding: 8px 18px 14px; font-size: 10.5px; color: var(--ink-dim);
      border-top: 1px solid var(--line-hair);
    }

    #btn-live-charts {
      position: fixed; top: 14px; right: 14px; z-index: 861;
      background: var(--bg-raised); border: 1px solid var(--line-edge);
      color: var(--accent); font-family: monospace; font-size: 13px; font-weight: bold;
      letter-spacing: .1em; padding: 6px 14px; border-radius: 6px; cursor: pointer;
    }
    #btn-live-charts:hover { border-color: var(--accent); background: rgba(43,163,171,.13); color: var(--accent); }
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
        <span class="lc-coeff-name">radiation inactivation</span>
        <span class="lc-coeff-val"></span>
      </label>
      <div class="lc-coeff-presets"></div>
      <input class="lc-coeff-slider" id="lc-crad" type="range"
             min="0" max="1000" value="0" step="1"
             aria-describedby="lc-coeff-band">
      <div class="lc-coeff-band" id="lc-coeff-band"></div>
      <input class="lc-coeff-num" type="text" inputmode="decimal" spellcheck="false"
             aria-label="radiation inactivation coefficient in 1/Gy">
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
  const energy = orbitalEnergySeries(frames);
  const budget = doseBudget(frames);
  const budgetRatio = doseBudgetRatio(budget);
  const times = frames.map(f => f?.time).filter(Number.isFinite);
  const timeSpan = times.length ? [Math.min(...times), Math.max(...times)] : [0, 1];

  const rockTypes = rockTypeById(frames);

  const traces = map => [...map].map(([id, points]) => ({
    color: colorForRockType(rockTypes.get(id)),
    dash: dashForRockType(rockTypes.get(id)),
    points, width: 1, opacity: 0.42, faint: true,
    selectedColor: PALETTE.selected,
    pickId: id,
    rockType: rockTypes.get(id) ?? null,
    // The swarm already IS a sample of the biological uncertainty: each
    // fragment carries its own drawn c_rad, spanning 5.0e-5 to 4.2e-4 in the
    // shipped run. The spread on the survival chart is that uncertainty, and
    // labelling only the rock type hid where it came from.
    label: `${id.replace('asteroid_', 'fragment ')}`
      + (rockTypes.get(id) ? ` · ${rockTypes.get(id)}` : '')
      + (sampledCoeffs.get(id)
        ? ` · c_rad ${sampledCoeffs.get(id).toExponential(2)} 1/Gy`
        : ''),
    rockClass: rockClassLabel(rockTypes.get(id)),
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

  // The multiplicative summary of the published chronic band.
  //
  // The centre is the GEOMETRIC mean of the endpoints, not the default value:
  // 2.5e-4 sits 10x above the floor and only 1.7x below the ceiling, so
  // quoting "default x/ f" would describe a band the literature does not
  // report. The geometric centre and sqrt(max/min) are the only pair that
  // reproduce both endpoints exactly.
  const bandCentre = Math.sqrt(COEFF_BANDS.chronicMin * COEFF_BANDS.chronicMax);
  const bandFactor = Math.sqrt(COEFF_BANDS.chronicMax / COEFF_BANDS.chronicMin);

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
      // Replaces a speed chart. Speed alone cannot say whether a fragment is
      // leaving - 30 km/s is bound at 1 AU and unbound at 40 AU - and it is
      // largely implied by the distance chart above. Energy answers the
      // question the project exists to ask, from the same two inputs.
      title: 'Orbital energy',
      note: 'below zero is bound to the Sun; above zero escapes',
      series: [
        ...traces(energy),
        { name: 'swarm mean', color: PALETTE.mean, points: meanAcross(energy), width: 2 },
        {
          name: 'escape threshold', color: PALETTE.guide, width: 1, dash: '4 3',
          points: [[timeSpan[0], 0], [timeSpan[1], 0]],
        },
      ],
      yLabel: `ε [${posUnit}²/yr²]`,
      yFormat: v => v.toFixed(1),
      readout: (map, i) => {
        const f = fateCounts(map, frames, i);
        return `bound ${f.bound} · unbound ${f.unbound} · arrived ${f.arrived}`;
      },
      source: energy,
    },
    {
      // The radionuclide chain is a fully cited subsystem that turns out to be
      // negligible here. Drawn on a log axis because a stacked area would give
      // the smaller channel zero pixels and so claim it does not exist.
      title: 'Where the dose comes from',
      note: budgetRatio
        ? `internal U/Th/K decay is ${budgetRatio.decayPercent.toFixed(4)}% of the total`
        : 'cosmic rays versus internal decay',
      series: [
        { name: 'galactic cosmic rays', color: PALETTE.mean, points: budget.gcr, width: 2 },
        { name: 'internal U/Th/K decay', color: PALETTE.secondary, points: budget.decay, width: 2, dash: '4 3' },
      ],
      yScale: 'log',
      yLabel: 'cumulative dose [Gy]',
      readout: () => (budgetRatio
        ? `cosmic rays deliver ${budgetRatio.ratio.toFixed(0)}× the dose of internal decay`
        : '—'),
      source: null,
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

  // One million years: the shortest transfer time the literature discusses,
  // and the point at which the published coefficient band stops being a
  // rounding error and starts spanning tens of orders of magnitude.
  const SURFACE_HORIZON_YEARS = 1e6;

  const live = [];

  // A stable key per figure, derived once, so the menu bar can address them by
  // name rather than by position in the array.
  const keyOf = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  for (const spec of specs) {
    spec.key = keyOf(spec.title);
    const fig = document.createElement('div');
    fig.className = 'lc-fig';
    fig.innerHTML = `
      <div class="lc-fig-head">
        <div>
          <div class="lc-fig-title">${spec.title}</div>
          <div class="lc-fig-note">${spec.note}</div>
        </div>
        <div class="lc-fig-btns">
          <button class="lc-expand" title="Enlarge in place">&#9974;</button>
          <button class="lc-popout" title="Open in its own window">&#10696;</button>
        </div>
      </div>
      <div class="lc-plot"></div>
      <div class="lc-readout">—</div>
    `;
    body.appendChild(fig);
    const plotEl = fig.querySelector('.lc-plot');
    const readoutEl = fig.querySelector('.lc-readout');
    fig.querySelector('.lc-expand').addEventListener('click', () => openModal(spec));
    fig.querySelector('.lc-popout').addEventListener('click', () => detach(spec));

    live.push({ spec, fig, plotEl, readoutEl, chart: null });
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
        yScale: item.spec.yScale,
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
    // The surface shows the chosen coefficient as a horizontal line, so moving
    // the slider walks that line up and down through the contours - which is
    // the whole point of putting the two on the same screen.
    surfaceChart?.setCoefficient?.(value);
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
    // The detached windows hold the previous series, so they are rebuilt from
    // the new one rather than merely advanced.
    redrawChartWindows();
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
      // "x/" rather than "+/-": the band spans a factor of 17, and a quantity
      // known to within a factor is not symmetric on a linear scale. Limpert,
      // Stahel & Abbt (2001), BioScience 51(5):341-352, give times-or-divided-by
      // as the multiplicative counterpart, where the interval is [x/s, x*s].
      // Written as a +/- interval this band would misstate its own coverage.
      bandEl.textContent =
        `${formatMultiplicative(bandCentre, bandFactor.toFixed(1), 1)} 1/Gy`
        + ` (${COEFF_BANDS.chronicMin.toExponential(1)}–`
        + `${COEFF_BANDS.chronicMax.toExponential(1)}), drawn per fragment`;
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
    paintDepthProfile();
    selectInChartWindows(selectedId);
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
  /**
   * Move a chart into its own window, still driven by this one.
   *
   * The detached window is redrawn on every frame from the same series the
   * docked chart uses, so it is a second view of one dataset rather than a
   * copy that can drift.
   */
  function detach(spec) {
    const opened = openChartWindow(spec.title, {
      title: spec.title,
      note: spec.note,
      footer: 'follows the replay in the main window · click a line to select a fragment',
      render: (container, w, h) => liveLinePlot(container, {
        series: spec.series,
        xLabel: `time [${timeUnit}]`,
        yLabel: spec.yLabel,
        yFormat: spec.yFormat,
        yDomain: spec.yDomain,
        yScale: spec.yScale,
        pinDomain: overrideCoeff !== null && spec.rescalable,
        xFormat: v => fmt(v),
        xUnit: timeUnit,
        width: w,
        height: h,
        selected: selectedId,
        onPick: (s) => { if (s.pickId) select(s.pickId); },
      }),
    });
    if (!opened) {
      // Popup blocked. Fall back rather than leaving a dead button.
      openModal(spec);
      return;
    }
    opened.chart?.update?.(frameIndex);
  }

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
      yScale: spec.yScale,
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
    // Detached windows are views of the same run, so they advance with it.
    updateChartWindows(index);
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
  // The depth figure is the only one that explains the MECHANISM rather than
  // reporting an outcome, and it was drawing a configured half-metre stone at
  // 3460 kg/m3 that appears nowhere in the swarm. It now follows the selection.
  const baseProfile = parseDepthProfile(simData);
  let depthFig = null;

  /** The property record of the selected fragment at the current frame. */
  function selectedProp() {
    if (!selectedId) return null;
    for (let i = Math.min(frameIndex, frames.length - 1); i >= 0; i -= 1) {
      const hit = (frames[i]?.properties ?? []).find(x => x?.id === selectedId);
      if (hit) return hit;
    }
    return null;
  }

  // The answer surface goes FIRST, above the time series, because it is the
  // whole biological result rather than one slice through it. Everything below
  // it explains how the swarm reached the position it occupies here.
  let surfaceFig = null;
  let surfaceChart = null;

  /**
   * Detach any chart that knows how to draw itself into a box.
   *
   * The line charts have their own path because they carry a series spec; this
   * one takes a plain render function, so the same window machinery works for
   * the surface, and for anything added later, without special-casing each.
   */
  function detachRendered(spec) {
    const opened = openChartWindow(spec.title, {
      title: spec.title,
      note: spec.note,
      footer: 'linked to the main window · click a fragment to select it everywhere',
      render: spec.render,
    });
    if (!opened) { openSurfaceModal(spec); return; }
  }

  /** Same chart, full size, without leaving the page. */
  function openSurfaceModal(spec) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'lc-modal';
    overlay.innerHTML = `
      <div class="lc-modal-card">
        <div class="lc-modal-head">
          <div class="lc-modal-title">${spec.title}</div>
          <button class="lc-modal-close" title="Close">&times;</button>
        </div>
        <div class="lc-modal-plot"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    const host = overlay.querySelector('.lc-modal-plot');
    spec.render(host, Math.min(880, window.innerWidth - 120), 520);
    modal = { overlay, chart: null };
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    overlay.querySelector('.lc-modal-close').addEventListener('click', closeModal);
    document.addEventListener('keydown', onEsc);
  }

  /** Powers of ten below a thousandth; plain digits above it. */
  function fmtSmall(v) {
    if (!Number.isFinite(v)) return '—';
    return v < 1e-3 ? v.toExponential(1) : v.toFixed(4);
  }

  function renderAnswerSurface() {
    if (!document.getElementById('as-style')) {
      const st = document.createElement('style');
      st.id = 'as-style';
      st.textContent = ANSWER_SURFACE_STYLE;
      document.head.appendChild(st);
    }
    const fig = document.createElement('figure');
    fig.className = 'lc-fig lc-surface';
    fig.innerHTML = `
      <div class="lc-fig-head">
        <div>
          <div class="lc-fig-title">The answer surface</div>
          <div class="lc-fig-note">
            every outcome the biology can produce, at 1 Myr of transit
          </div>
        </div>
        <div class="lc-fig-btns">
          <button class="lc-expand" title="Enlarge in place">&#9974;</button>
          <button class="lc-popout" title="Open in its own window">&#10696;</button>
        </div>
      </div>
      <div class="lc-plot"></div>
      <div class="lc-readout"></div>
    `;
    body.insertBefore(fig, body.firstChild);
    surfaceFig = fig;
    const spec = surfaceSpec();
    fig.querySelector('.lc-expand').addEventListener('click', () => openSurfaceModal(spec));
    fig.querySelector('.lc-popout').addEventListener('click', () => detachRendered(spec));
    paintAnswerSurface();
  }

  /** The detachable spec for the surface, shared by the menu and the buttons. */
  function surfaceSpec() {
    return {
      title: 'The answer surface',
      note: 'every outcome the biology can produce, at 1 Myr of transit',
      render: (el2, w, h) => answerSurfaceChart(el2, {
        frames, bands: surfaceBands(), horizonYears: SURFACE_HORIZON_YEARS,
        colorForRockType, onPick: select, selected: selectedId,
        currentCoefficient: overrideCoeff, width: w, height: h,
      }),
    };
  }

  function surfaceBands() {
    return {
      cMin: COEFF_BANDS.chronicMin,
      cMax: COEFF_BANDS.chronicMax,
      cDefault: COEFF_BANDS.default,
    };
  }

  function paintAnswerSurface() {
    if (!surfaceFig) return;
    surfaceChart?.destroy?.();
    const plotEl = surfaceFig.querySelector('.lc-plot');
    surfaceChart = answerSurfaceChart(plotEl, {
      frames, bands: surfaceBands(), horizonYears: SURFACE_HORIZON_YEARS,
      colorForRockType, onPick: select, selected: selectedId,
      currentCoefficient: overrideCoeff,
      width: Math.max(240, plotEl.clientWidth || 288), height: 236,
    });
    const pts = surfaceChart.points ?? [];
    if (pts.length) {
      const survivals = pts.map(p => p.survival).filter(v => v > 0);
      const lo = Math.min(...survivals);
      const hi = Math.max(...survivals);
      surfaceFig.querySelector('.lc-readout').textContent =
        `${pts.length} fragments · N/N₀ from ${fmtSmall(lo)} to ${fmtSmall(hi)}`
        + ` · shaded strip is the published chronic band`;
    }
  }

  function renderDepthProfile() {
    if (!baseProfile) return;
    const fig = document.createElement('figure');
    fig.className = 'lc-fig lc-depth';
    fig.innerHTML = `
      <figcaption>
        <div class="lc-fig-title">Shielding against depth</div>
        <div class="lc-fig-note"></div>
      </figcaption>
      <div class="lc-depth-plot"></div>
      <div class="lc-readout"></div>
    `;
    body.appendChild(fig);
    depthFig = fig;
    paintDepthProfile();
    surfaceChart?.setSelected?.(selectedId);
  }

  /** Redraw the depth figure for whichever fragment is selected. */
  function paintDepthProfile() {
    if (!depthFig || !baseProfile) return;
    const prop = selectedProp();
    const profile = prop ? profileForFragment(baseProfile, prop) : baseProfile;
    const ratio = penetrationRatio(profile);
    const rho = profile.density ? `${profile.density.toFixed(0)} kg/m³` : '';

    depthFig.querySelector('.lc-fig-note').textContent = prop
      ? `${selectedId.replace('asteroid_', 'fragment ')} · `
        + `${profile.rockRadius.toFixed(3)} m · ${profile.rockType} · ${rho}`
      : `no fragment selected · configured ${baseProfile.rockRadius} m reference `
        + `stone at ${rho} — click a fragment to use a real one`;

    // The transmitted fraction at the centre is the number that decides
    // whether shielding matters for THIS stone, and it is the number the
    // static version could never give.
    const core = profile.samples.at(-1);
    depthFig.querySelector('.lc-readout').textContent = ratio
      ? `cosmic rays reach ${ratio.toFixed(0)}× deeper than photons `
        + `(1/e at ${profile.cosmicDepth.toFixed(3)} m vs ${profile.photonDepth.toFixed(3)} m)`
        + ` · centre keeps ${(core.cosmic * 100).toFixed(1)}% of the cosmic-ray flux`
      : '';

    depthProfileChart(depthFig.querySelector('.lc-depth-plot'), profile, {
      width: 300, height: 190,
    });
  }

  function mount() {
    document.body.append(panel, toggle);
    // The band goes up first and spans the window: everything below it is a
    // supporting argument for the number it states.
    const banner = headlineBanner(document.body, simData, {
      cMin: COEFF_BANDS.chronicMin, cMax: COEFF_BANDS.chronicMax,
    });
    injectLayoutFixes(banner);
    renderAll();
    renderAnswerSurface();
    renderDepthProfile();
    // Last, deliberately: it describes the run the charts above came from, so
    // it reads as a footer to them rather than as a control.
    const prov = document.createElement('div');
    body.appendChild(prov);
    provenancePanel(prov, simData);
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
    // The coefficient gets a typed field, named organisms, and the fullest
    // explanation in the project - because it is the number the whole result
    // rests on, and because a slider alone cannot express a value like 4.3e-4.
    withTooltip(panel.querySelector('.lc-coeff-name'), renderContent(C_RAD_HELP));

    const presetBox = panel.querySelector('.lc-coeff-presets');
    for (const preset of C_RAD_PRESETS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lc-preset';
      b.textContent = preset.label;
      b.title = `${preset.value.toExponential(1)} 1/Gy · ${preset.note}`;
      // A preset writes into the field rather than switching to a mode of its
      // own, so the value still lives in exactly one place.
      b.addEventListener('click', () => {
        applyCoefficient(preset.value);
        if (slider) slider.value = String(coeffToPos(preset.value));
      });
      presetBox.appendChild(b);
    }

    const numBox = panel.querySelector('.lc-coeff-num');
    const commitNum = () => {
      const parsed = Number.parseFloat(numBox.value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        numBox.classList.add('bad');
        return;
      }
      numBox.classList.remove('bad');
      applyCoefficient(parsed);
      if (slider) slider.value = String(coeffToPos(parsed));
    };
    numBox.addEventListener('change', commitNum);
    numBox.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') commitNum();
      if (e.key === 'Escape') { numBox.value = ''; numBox.classList.remove('bad'); }
    });

    paintCoefficient();
    setVisible(true);
    update(0);
    paintSelection();
    body.scrollTop = 0;
    return api;
  }

  /**
   * Everything the dock can show, for a menu that wants to list it.
   *
   * Each entry knows how to show itself, hide itself, and open in its own
   * window, so the menu does not have to know anything about how a figure is
   * built - which is what stops the two drifting apart as figures are added.
   */
  function catalogue() {
    const entries = live.map(item => ({
      key: item.spec.key,
      title: item.spec.title,
      note: item.spec.note,
      group: 'Time series',
      isVisible: () => !item.fig.hidden,
      setVisible: (on) => { item.fig.hidden = !on; },
      detach: () => detach(item.spec),
      enlarge: () => openModal(item.spec),
    }));
    if (surfaceFig) {
      const spec = surfaceSpec();
      entries.unshift({
        key: 'answer-surface',
        title: 'The answer surface',
        note: 'every outcome the biology can produce',
        group: 'Overview',
        isVisible: () => !surfaceFig.hidden,
        setVisible: (on) => { surfaceFig.hidden = !on; },
        detach: () => detachRendered(spec),
        enlarge: () => openSurfaceModal(spec),
      });
    }
    if (depthFig) {
      entries.push({
        key: 'shielding-depth',
        title: 'Shielding against depth',
        note: 'the mechanism, for the selected fragment',
        group: 'Mechanism',
        isVisible: () => !depthFig.hidden,
        setVisible: (on) => { depthFig.hidden = !on; },
        detach: null,
        enlarge: null,
      });
    }
    return entries;
  }

  const api = {
    mount, update, select, catalogue,
    setVisible,
    isVisible: () => !panel.classList.contains('hidden'),
  };
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
