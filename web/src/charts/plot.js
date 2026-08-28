/**
 * plot.js
 * Minimal SVG plotting for the analysis page.
 *
 * Deliberately dependency-free: the project already carries three.js and adding
 * a charting library for a dozen static plots is not worth the weight. SVG
 * rather than canvas so text stays crisp and hover targets are real elements.
 *
 * One form: a line plot whose curves grow with the replay. Colours come from
 * the caller; the palette lives in liveCharts.js and is validated against that
 * dock's surface.
 */

const NS = 'http://www.w3.org/2000/svg';

const PAD = { top: 14, right: 16, bottom: 40, left: 62 };
const MIN_HEIGHT = 220;

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  }
  return node;
}

/** Nice round tick values covering [lo, hi]. */
export function niceTicks(lo, hi, count = 5) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (lo === hi) return [lo];
  const span = hi - lo;
  const raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const first = Math.ceil(lo / step) * step;
  const ticks = [];
  for (let v = first; v <= hi + step * 1e-9; v += step) ticks.push(Number(v.toFixed(12)));
  return ticks;
}

/** Decade ticks for a log axis. */
export function logTicks(lo, hi, maxCount = 6) {
  if (!(lo > 0) || !(hi > 0)) return [];
  const first = Math.floor(Math.log10(lo));
  const last = Math.ceil(Math.log10(hi));
  const all = [];
  for (let e = first; e <= last; e++) all.push(10 ** e);
  if (all.length <= maxCount) return all;
  const stride = Math.ceil(all.length / maxCount);
  return all.filter((_, i) => i % stride === 0);
}

/** Compact numeric formatting that keeps small and large values readable. */
export function fmt(value, digits = 3) {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e5 || abs < 1e-3) return value.toExponential(2).replace('e', 'e');
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 1) return value.toFixed(2);
  return value.toPrecision(digits);
}

function extent(values) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return Number.isFinite(lo) ? [lo, hi] : [0, 1];
}

/**
 * Widen an axis to a quantity's natural full scale when the data barely moves.
 *
 * A surviving fraction that runs 1.000000 to 0.999457 is a flat line, but an
 * axis fitted to the data alone renders it as a dramatic collapse across the
 * full height of the chart, labelled 0.99950 to 1.00000. The reader has to
 * check the tick labels to discover that nothing happened. That is backwards:
 * the common case should be legible without reading the axis.
 *
 * So when a series declares a natural domain - [0, 1] for a fraction - and the
 * observed variation is below `threshold` of it, show the whole domain. Real
 * change still fills the chart; noise correctly looks like noise.
 */
export function domainAwareRange([lo, hi], domain, threshold = 0.02) {
  if (!domain) return null;
  const [dLo, dHi] = domain;
  const dSpan = dHi - dLo;
  if (!(dSpan > 0)) return null;
  if ((hi - lo) / dSpan >= threshold) return null;
  return [dLo, dHi];
}

function padRange([lo, hi], fraction = 0.06) {
  if (lo === hi) {
    const bump = Math.abs(lo) * 1e-3 || 1;
    return [lo - bump, hi + bump];
  }
  const pad = (hi - lo) * fraction;
  return [lo - pad, hi + pad];
}

// ── Shared chrome ─────────────────────────────────────────────────────────

function makeSvg(width, height) {
  const svg = el('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: '100%',
    height,
    role: 'img',
    'aria-hidden': 'false',
  });
  return svg;
}

function drawAxes(svg, { width, height, xTicks, yTicks, xPos, yPos, xLabel, yLabel, xFormat, yFormat, pad = PAD }) {
  const PAD = pad;
  const plotW = width - PAD.left - PAD.right;

  for (const t of yTicks) {
    const y = yPos(t);
    if (!Number.isFinite(y)) continue;
    svg.appendChild(el('line', {
      x1: PAD.left, x2: PAD.left + plotW, y1: y, y2: y, class: 'grid',
    }));
    const label = el('text', { x: PAD.left - 8, y, class: 'tick tick-y' });
    label.textContent = (yFormat ?? fmt)(t);
    svg.appendChild(label);
  }

  for (const t of xTicks) {
    const x = xPos(t);
    if (!Number.isFinite(x)) continue;
    const label = el('text', { x, y: height - PAD.bottom + 16, class: 'tick tick-x' });
    label.textContent = (xFormat ?? fmt)(t);
    svg.appendChild(label);
  }

  svg.appendChild(el('line', {
    x1: PAD.left, x2: PAD.left + plotW,
    y1: height - PAD.bottom, y2: height - PAD.bottom, class: 'axis',
  }));

  if (xLabel) {
    const t = el('text', { x: PAD.left + plotW / 2, y: height - 6, class: 'axis-label' });
    t.textContent = xLabel;
    svg.appendChild(t);
  }
  if (yLabel) {
    const t = el('text', {
      x: 12, y: PAD.top + (height - PAD.top - PAD.bottom) / 2,
      class: 'axis-label',
      transform: `rotate(-90 12 ${PAD.top + (height - PAD.top - PAD.bottom) / 2})`,
    });
    t.textContent = yLabel;
    svg.appendChild(t);
  }
}

function buildLegend(container, series) {
  // A legend is present for two or more series; a single series is named by the
  // chart title instead.
  const named = series.filter(s => s.name);
  if (named.length < 2) return;
  const legend = document.createElement('div');
  legend.className = 'legend';
  for (const s of named) {
    const item = document.createElement('span');
    item.className = 'legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = s.color;
    if (s.dashed) swatch.classList.add('dashed');
    const label = document.createElement('span');
    label.textContent = s.name;
    item.append(swatch, label);
    legend.appendChild(item);
  }
  container.appendChild(legend);
}

function makeTooltip(container) {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.hidden = true;
  container.appendChild(tip);
  return tip;
}

// ── Live line plot ────────────────────────────────────────────────────────

/**
 * A line plot whose curves grow with the replay.
 *
 * The axes are computed once from the FULL dataset and never move, so the
 * curve draws into a fixed frame rather than rescaling under the viewer every
 * step. Updating only rewrites each path's `d` attribute and moves the
 * playhead, which is cheap enough to run at replay speed - a full re-render of
 * several SVG charts per frame is not.
 *
 * @returns {{ update(index:number):void, destroy():void }}
 */
export function liveLinePlot(container, options) {
  const {
    series = [], xLabel, yLabel, yScale = 'linear',
    xFormat, yFormat, height = 148, xUnit, onPick, selected = null,
    yDomain = null, pinDomain = false, width: fixedWidth = null,
  } = options;
  let selectedId = selected;

  // Bigger charts use bigger tick text, so the gutters have to grow with them
  // or the rotated y label lands on top of the numbers.
  const big = height >= 300;
  const PAD = big
    ? { top: 20, right: 28, bottom: 56, left: 104 }
    : { top: 14, right: 16, bottom: 40, left: 62 };

  container.textContent = '';
  // A detached window sizes its chart explicitly; a docked one measures its
  // container, which is zero-width until it has been laid out.
  const width = Math.max(240, fixedWidth || container.clientWidth || 300);

  const allX = series.flatMap(s => s.points.map(p => p[0]));
  const allY = series.flatMap(s => s.points.map(p => p[1]));
  if (allX.length === 0) {
    container.appendChild(emptyState('no data'));
    return { update() {}, setSelected() {}, destroy() {} };
  }

  const svg = makeSvg(width, height);
  const [x0, x1] = extent(allX);
  const useLog = yScale === 'log';

  let yLo;
  let yHi;
  if (useLog) {
    const positive = allY.filter(v => v > 0);
    [yLo, yHi] = extent(positive.length ? positive : [1e-12, 1]);
    yLo = 10 ** Math.floor(Math.log10(yLo));
    yHi = 10 ** Math.ceil(Math.log10(yHi));
  } else {
    const raw = extent(allY);
    // pinDomain forces the declared domain even when the data would justify a
    // tighter fit, so successive redraws share one frame and can be compared.
    const full = pinDomain && yDomain ? yDomain : domainAwareRange(raw, yDomain);
    [yLo, yHi] = full || padRange(raw);
  }

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const xPos = v => PAD.left + (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0)) * plotW;
  const yPos = useLog
    ? v => {
      if (!(v > 0)) return height - PAD.bottom;
      const f = (Math.log10(v) - Math.log10(yLo)) / (Math.log10(yHi) - Math.log10(yLo));
      return PAD.top + (1 - f) * plotH;
    }
    : v => PAD.top + (1 - (v - yLo) / (yHi - yLo || 1)) * plotH;

  drawAxes(svg, {
    width, height,
    xTicks: niceTicks(x0, x1, 4),
    yTicks: useLog ? logTicks(yLo, yHi, 4) : niceTicks(yLo, yHi, 3),
    xPos, yPos, xLabel, yLabel, xFormat,
    yFormat: yFormat ?? (useLog ? v => v.toExponential(0) : undefined),
    pad: PAD,
  });

  const playhead = el('line', {
    y1: PAD.top, y2: height - PAD.bottom, class: 'crosshair', visibility: 'hidden',
  });
  svg.appendChild(playhead);

  const paths = series.map(s => {
    const path = el('path', {
      d: '', fill: 'none', stroke: s.color,
      'stroke-width': s.width ?? 2,
      'stroke-opacity': s.opacity ?? 1,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    });
    svg.appendChild(path);
    return path;
  });

  // A marker on the leading edge of the emphasised series.
  const leadIndex = series.findIndex(s => !s.faint);
  const lead = leadIndex >= 0
    ? el('circle', { r: 3, fill: series[leadIndex].color, visibility: 'hidden' })
    : null;
  if (lead) svg.appendChild(lead);

  container.appendChild(svg);
  buildLegend(container, series);

  // ── Interaction ────────────────────────────────────────────────────────
  const tip = makeTooltip(container);
  const hoverLine = el('line', {
    y1: PAD.top, y2: height - PAD.bottom, class: 'hoverline', visibility: 'hidden',
  });
  svg.appendChild(hoverLine);
  const hoverDot = el('circle', { r: 3.5, class: 'hover-dot', visibility: 'hidden' });
  svg.appendChild(hoverDot);

  const hit = el('rect', {
    x: PAD.left, y: PAD.top,
    width: plotW, height: plotH,
    fill: 'transparent', style: onPick ? 'cursor:pointer' : 'cursor:crosshair',
  });
  svg.appendChild(hit);

  let hovered = -1;

  function pointerToData(event) {
    const box = svg.getBoundingClientRect();
    const scale = width / box.width;
    return {
      px: (event.clientX - box.left) * scale,
      py: (event.clientY - box.top) * scale,
      box,
    };
  }

  /** Nearest drawn point across every series, so thin traces are still catchable. */
  function nearest(px, py, upTo) {
    let best = null;
    for (let i = 0; i < series.length; i++) {
      const pts = series[i].points;
      const limit = Math.min(upTo, pts.length - 1);
      for (let k = 0; k <= limit; k++) {
        const p = pts[k];
        if (!p || !Number.isFinite(p[1])) continue;
        if (useLog && !(p[1] > 0)) continue;
        const dx = xPos(p[0]) - px;
        const dy = yPos(p[1]) - py;
        const d2 = dx * dx + dy * dy;
        if (!best || d2 < best.d2) best = { d2, i, k, p };
      }
    }
    return best && best.d2 < 40 * 40 ? best : null;
  }

  function clearHover() {
    hovered = -1;
    hoverLine.setAttribute('visibility', 'hidden');
    hoverDot.setAttribute('visibility', 'hidden');
    tip.hidden = true;
    applyEmphasis();
  }

  hit.addEventListener('pointerleave', clearHover);
  hit.addEventListener('pointermove', event => {
    const { px, py, box } = pointerToData(event);
    const found = nearest(px, py, lastIndex);
    if (!found) { clearHover(); return; }

    hovered = found.i;
    applyEmphasis();

    const x = xPos(found.p[0]);
    hoverLine.setAttribute('x1', x);
    hoverLine.setAttribute('x2', x);
    hoverLine.setAttribute('visibility', 'visible');
    hoverDot.setAttribute('cx', x);
    hoverDot.setAttribute('cy', yPos(found.p[1]));
    hoverDot.setAttribute('fill', series[found.i].color);
    hoverDot.setAttribute('visibility', 'visible');

    const s = series[found.i];
    const label = s.name ?? s.label ?? 'fragment';
    tip.innerHTML =
      `<div class="tt-head">${(xFormat ?? fmt)(found.p[0])} ${xUnit ?? ''}</div>` +
      `<div class="tt-row"><span class="tt-swatch" style="background:${s.color}"></span>` +
      `${label}: <b>${(yFormat ?? fmt)(found.p[1])}</b></div>` +
      (onPick && s.pickId ? '<div class="tt-hint">click to follow</div>' : '');
    tip.hidden = false;
    const scale = width / box.width;
    const left = Math.min(x / scale + 12, box.width - tip.offsetWidth - 6);
    tip.style.left = `${Math.max(2, left)}px`;
    tip.style.top = `${PAD.top / scale}px`;
  });

  if (onPick) {
    hit.addEventListener('click', event => {
      const { px, py } = pointerToData(event);
      const found = nearest(px, py, lastIndex);
      if (found) onPick(series[found.i], found.i);
    });
  }

  /** Dim everything except the hovered and the selected trace. */
  function applyEmphasis() {
    series.forEach((s, i) => {
      const isLead = !s.faint;
      const isSelected = selectedId != null && s.pickId === selectedId;
      const isHovered = i === hovered;
      let opacity = s.opacity ?? 1;
      let strokeWidth = s.width ?? 2;
      if (isSelected) { opacity = 1; strokeWidth = 2; }
      if (isHovered) { opacity = 1; strokeWidth = Math.max(strokeWidth, 2); }
      if ((selectedId != null || hovered >= 0) && !isSelected && !isHovered && !isLead) {
        opacity = 0.12;
      }
      paths[i].setAttribute('stroke-opacity', opacity);
      paths[i].setAttribute('stroke-width', strokeWidth);
      // The selected trace takes the instrument accent so it reads as "the one
      // you picked" rather than merely "a brighter fragment".
      paths[i].setAttribute('stroke', isSelected && s.selectedColor
        ? s.selectedColor : s.color);
    });
  }

  function setSelected(id) {
    selectedId = id;
    applyEmphasis();
  }

  let lastIndex = 0;

  function update(index) {
    lastIndex = index;
    const upTo = Math.max(0, index);
    series.forEach((s, i) => {
      let d = '';
      let started = false;
      const limit = Math.min(upTo, s.points.length - 1);
      for (let k = 0; k <= limit; k++) {
        const p = s.points[k];
        if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) { started = false; continue; }
        if (useLog && !(p[1] > 0)) { started = false; continue; }
        d += `${started ? 'L' : 'M'}${xPos(p[0]).toFixed(2)},${yPos(p[1]).toFixed(2)}`;
        started = true;
      }
      paths[i].setAttribute('d', d);
    });

    if (lead && leadIndex >= 0) {
      const pts = series[leadIndex].points;
      const p = pts[Math.min(upTo, pts.length - 1)];
      if (p && Number.isFinite(p[1])) {
        lead.setAttribute('cx', xPos(p[0]));
        lead.setAttribute('cy', yPos(p[1]));
        lead.setAttribute('visibility', 'visible');
        playhead.setAttribute('x1', xPos(p[0]));
        playhead.setAttribute('x2', xPos(p[0]));
        playhead.setAttribute('visibility', 'visible');
      }
    }
  }

  update(0);
  applyEmphasis();
  return {
    update,
    setSelected,
    destroy: () => { container.textContent = ''; },
  };
}

function emptyState(message) {
  const div = document.createElement('div');
  div.className = 'empty';
  div.textContent = message;
  return div;
}
