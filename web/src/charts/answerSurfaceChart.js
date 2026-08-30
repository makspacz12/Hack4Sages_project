/**
 * Render the answer surface as SVG.
 *
 * Log-log, so the iso-survival contours are straight. The published chronic
 * band is a shaded horizontal strip, because that is literally what it is: a
 * range of possible y values with no preference inside it.
 */

import {
  CONTOURS, contourCoefficient, swarmPoints, planeExtent, survivalAt,
} from './answerSurface.js';
import { scalePad, uiScale } from './plot.js';

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  }
  return node;
}

const SUPER = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
function pow10Label(e) {
  return `10${String(e).split('').map(c => SUPER[c] ?? c).join('')}`;
}

/**
 * Ticks for a log axis that may span less than a decade.
 *
 * Decade ticks alone are useless over a narrow range: the dose axis here
 * covers 4.92 to 5.73 in log10, which is exactly one labelled tick. Below two
 * decades the 2/3/5 minors are added and labelled, which is the standard log
 * ruling; above that they would crowd, so only decades are drawn.
 */
export function logTicksFor(lo, hi, dense = true) {
  const out = [];
  const wide = hi - lo > 2;
  // `dense` is false when the type has been scaled up for a projector: the
  // minor ticks then no longer fit and collide with each other, which makes
  // the presentation setting worse than the default rather than better.
  const minors = (wide || !dense) ? [1] : [1, 2, 3, 5];
  for (let e = Math.floor(lo); e <= Math.ceil(hi); e += 1) {
    for (const m of minors) {
      const l = e + Math.log10(m);
      if (l < lo || l > hi) continue;
      out.push({ log: l, value: m * 10 ** e, major: m === 1 });
    }
  }
  return out;
}

/**
 * @param {HTMLElement} container
 * @param {object} opts - frames, bands {cMin,cMax,cDefault}, horizonYears,
 *   colorForRockType, onPick, selected, width, height
 */
export function answerSurfaceChart(container, opts) {
  const {
    frames, bands, horizonYears = 1e6, colorForRockType = () => 'var(--data-trace)',
    onPick, selected = null, width = 300, height = 260, currentCoefficient = null,
  } = opts;

  container.textContent = '';
  const points = swarmPoints(frames, horizonYears);
  const extent = planeExtent(points, bands);
  if (!extent) {
    const empty = document.createElement('div');
    empty.className = 'as-empty';
    empty.textContent = 'no dose data in this replay';
    container.appendChild(empty);
    return { update() {}, setSelected() {}, destroy() {} };
  }

  const PAD = scalePad({ top: 12, right: 58, bottom: 40, left: 54 });
  const plotW = Math.max(40, width - PAD.left - PAD.right);
  const plotH = Math.max(40, height - PAD.top - PAD.bottom);

  const x = d => PAD.left + ((Math.log10(d) - extent.dLo) / (extent.dHi - extent.dLo)) * plotW;
  const y = c => PAD.top + (1 - (Math.log10(c) - extent.cLo) / (extent.cHi - extent.cLo)) * plotH;

  const svg = el('svg', {
    width, height, viewBox: `0 0 ${width} ${height}`, class: 'as-svg', role: 'img',
    'aria-label':
      'Survival as a function of accumulated dose and radiation inactivation '
      + 'coefficient, both logarithmic, with the fourteen fragments placed on it.',
  });

  // ── The published band, as a strip ──────────────────────────────────────
  // A strip and not a line: the literature gives a range with no preferred
  // value inside it, and drawing a central line would invent one.
  const bandTop = y(bands.cMax);
  const bandBottom = y(bands.cMin);
  svg.appendChild(el('rect', {
    x: PAD.left, y: bandTop, width: plotW, height: Math.max(1, bandBottom - bandTop),
    class: 'as-band',
  }));

  // ── Iso-survival contours ───────────────────────────────────────────────
  for (const c of CONTOURS) {
    const d0 = 10 ** extent.dLo;
    const d1 = 10 ** extent.dHi;
    const c0 = contourCoefficient(d0, c.value);
    const c1 = contourCoefficient(d1, c.value);
    if (!c0 || !c1) continue;
    // Clip to the drawn box by walking the straight log-log line.
    const path = el('line', {
      x1: x(d0), y1: y(c0), x2: x(d1), y2: y(c1),
      class: 'as-contour',
    });
    svg.appendChild(path);

    // Label where the contour leaves the right edge, if it is on screen.
    const yEnd = y(c1);
    if (yEnd > PAD.top - 2 && yEnd < PAD.top + plotH + 2) {
      const t = el('text', {
        x: PAD.left + plotW + 5, y: yEnd + 3, class: 'as-contour-label',
      });
      t.textContent = c.label;
      svg.appendChild(t);
    }
  }

  // ── Axes ────────────────────────────────────────────────────────────────
  const frame = el('rect', {
    x: PAD.left, y: PAD.top, width: plotW, height: plotH, class: 'as-frame',
  });
  svg.appendChild(frame);

  const denseTicks = uiScale() < 1.4;
  for (const t of logTicksFor(extent.dLo, extent.dHi, denseTicks)) {
    const px = PAD.left + ((t.log - extent.dLo) / (extent.dHi - extent.dLo)) * plotW;
    svg.appendChild(el('line', {
      x1: px, y1: PAD.top + plotH, x2: px, y2: PAD.top + plotH + (t.major ? 4 : 2.5),
      class: 'as-tick',
    }));
    const label = el('text', { x: px, y: PAD.top + plotH + 15, class: 'as-tick-label' });
    label.textContent = t.major
      ? pow10Label(Math.round(Math.log10(t.value)))
      : String(Math.round(t.value / 10 ** Math.floor(Math.log10(t.value))));
    svg.appendChild(label);
  }
  for (const t of logTicksFor(extent.cLo, extent.cHi, denseTicks)) {
    const py = PAD.top + (1 - (t.log - extent.cLo) / (extent.cHi - extent.cLo)) * plotH;
    svg.appendChild(el('line', {
      x1: PAD.left - (t.major ? 4 : 2.5), y1: py, x2: PAD.left, y2: py, class: 'as-tick',
    }));
    const label = el('text', {
      x: PAD.left - 7, y: py + 3, class: 'as-tick-label as-tick-y',
    });
    label.textContent = t.major
      ? pow10Label(Math.round(Math.log10(t.value)))
      : String(Math.round(t.value / 10 ** Math.floor(Math.log10(t.value))));
    svg.appendChild(label);
  }

  const xl = el('text', { x: PAD.left + plotW / 2, y: height - 5, class: 'as-axis-label' });
  xl.textContent = 'accumulated dose [Gy]';
  svg.appendChild(xl);
  const yl = el('text', {
    x: 11, y: PAD.top + plotH / 2, class: 'as-axis-label',
    transform: `rotate(-90 11 ${PAD.top + plotH / 2})`,
  });
  yl.textContent = 'c_rad [1/Gy]';
  svg.appendChild(yl);

  // ── The coefficient currently selected in the panel ──────────────────────
  const marker = el('line', {
    x1: PAD.left, x2: PAD.left + plotW, class: 'as-current', visibility: 'hidden',
  });
  svg.appendChild(marker);

  // ── The swarm ───────────────────────────────────────────────────────────
  const dots = new Map();
  for (const p of points) {
    const g = el('g', { class: 'as-pt', 'data-id': p.id });
    const dot = el('circle', {
      cx: x(p.dose), cy: y(p.coefficient), r: 4.2,
      fill: colorForRockType(p.rockType), class: 'as-dot',
    });
    g.appendChild(dot);
    const title = el('title');
    title.textContent =
      `${p.id.replace('asteroid_', 'fragment ')} · ${p.rockType}\n`
      + `radius ${(p.radius * 1000).toFixed(1)} mm\n`
      + `dose ${p.dose.toExponential(2)} Gy\n`
      + `c_rad ${p.coefficient.toExponential(2)} 1/Gy\n`
      + `N/N₀ ${p.survival < 1e-3 ? p.survival.toExponential(2) : p.survival.toFixed(4)}`;
    g.appendChild(title);
    if (onPick) {
      g.style.cursor = 'pointer';
      g.addEventListener('click', () => onPick(p.id));
    }
    svg.appendChild(g);
    dots.set(p.id, g);
  }

  container.appendChild(svg);

  function setSelected(id) {
    for (const [key, g] of dots) g.classList.toggle('as-pt--sel', key === id);
    svg.classList.toggle('as-has-sel', Boolean(id));
  }
  setSelected(selected);

  function setCoefficient(c) {
    if (!(c > 0)) { marker.setAttribute('visibility', 'hidden'); return; }
    const py = y(c);
    marker.setAttribute('y1', py);
    marker.setAttribute('y2', py);
    marker.setAttribute('visibility', 'visible');
  }
  setCoefficient(currentCoefficient);

  return {
    update() {},
    setSelected,
    setCoefficient,
    points,
    destroy() { container.textContent = ''; },
  };
}

export const ANSWER_SURFACE_STYLE = `
  .as-svg { display: block; }
  .as-empty { color: var(--ink-dim); font-size: 0.6875rem; padding: 10px 0; }
  .as-frame { fill: none; stroke: var(--line-edge); stroke-width: 1; }
  .as-band { fill: rgba(154, 140, 196, 0.16); }
  .as-contour { stroke: var(--ink-faint); stroke-width: 1; stroke-dasharray: 3 3; }
  .as-contour-label { fill: var(--ink-dim); font-size: 0.53125rem; font-family: inherit; }
  .as-tick { stroke: var(--line-edge); stroke-width: 1; }
  .as-tick-label {
    fill: var(--ink-dim); font-size: 0.5625rem; font-family: inherit; text-anchor: middle;
  }
  .as-tick-y { text-anchor: end; }
  .as-axis-label {
    fill: var(--ink-dim); font-size: 0.59375rem; font-family: inherit; text-anchor: middle;
  }
  .as-dot { stroke: var(--bg-panel); stroke-width: 1; }
  .as-current { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 5 3; }
  /* Dim the rest only once something is actually selected. */
  .as-has-sel .as-dot { opacity: 0.32; }
  .as-has-sel .as-pt--sel .as-dot { opacity: 1; stroke: var(--accent); stroke-width: 1.6; }
`;
