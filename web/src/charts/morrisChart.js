/**
 * The Morris mu*-sigma screen, drawn the way the sources actually draw it.
 *
 * Square plotting area with equal unit scale on both axes, because the entire
 * reading is the ratio sigma/mu*, and a slope read off axes with different
 * scales is meaningless.
 */

import {
  RATIO_LINES, classify, changesSign, significant, oatExploredFraction,
} from './morris.js';

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  }
  return node;
}

function fmt(v, digits = 2) {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  return Math.abs(v) < 1e-3 || Math.abs(v) >= 1e4
    ? v.toExponential(digits) : v.toPrecision(digits + 1);
}

/**
 * @param {HTMLElement} container
 * @param {object} screening - from parseMorris
 * @param {object} opts - width, height, onPick, selected
 */
export function morrisChart(container, screening, opts = {}) {
  const { width = 300, height = 300, onPick, selected = null } = opts;
  container.textContent = '';
  if (!screening?.factors?.length) {
    const empty = document.createElement('div');
    empty.className = 'mo-empty';
    empty.textContent = 'no Morris screening in this build';
    container.appendChild(empty);
    return { setSelected() {}, destroy() {} };
  }

  const factors = screening.factors;
  const PAD = { top: 14, right: 14, bottom: 38, left: 52 };
  const size = Math.max(60, Math.min(width - PAD.left - PAD.right, height - PAD.top - PAD.bottom));
  const plotW = size;
  const plotH = size;

  // Equal scale on both axes. The top factor sets the range, and sigma is
  // included so a factor with small mu* but large sigma is not pushed off.
  const hi = Math.max(
    ...factors.map(f => f.muStar), ...factors.map(f => f.sigma),
  ) * 1.08;
  const x = v => PAD.left + (v / hi) * plotW;
  const y = v => PAD.top + plotH - (v / hi) * plotH;

  const svg = el('svg', {
    width, height: PAD.top + plotH + PAD.bottom, class: 'mo-svg', role: 'img',
    'aria-label':
      'Morris screening: mean absolute elementary effect on the horizontal axis, '
      + 'standard deviation on the vertical, equal scale, with lines of constant '
      + 'ratio marking linear, monotonic and interacting factors.',
  });

  // ── Ratio diagonals (Garcia Sanchez et al. 2014) ────────────────────────
  for (const r of RATIO_LINES) {
    // sigma = ratio * mu*, clipped to the box.
    const xEnd = Math.min(hi, hi / r.ratio);
    const yEnd = r.ratio * xEnd;
    svg.appendChild(el('line', {
      x1: x(0), y1: y(0), x2: x(xEnd), y2: y(yEnd), class: 'mo-ratio',
    }));
    const t = el('text', {
      x: x(xEnd) - 3, y: y(yEnd) - 4, class: 'mo-ratio-label',
      'text-anchor': 'end',
    });
    t.textContent = r.label;
    svg.appendChild(t);
  }

  svg.appendChild(el('rect', {
    x: PAD.left, y: PAD.top, width: plotW, height: plotH, class: 'mo-frame',
  }));

  // ── Axes ────────────────────────────────────────────────────────────────
  const ticks = 4;
  for (let i = 0; i <= ticks; i += 1) {
    const v = (hi * i) / ticks;
    svg.appendChild(el('line', {
      x1: x(v), y1: PAD.top + plotH, x2: x(v), y2: PAD.top + plotH + 4, class: 'mo-tick',
    }));
    const tx = el('text', { x: x(v), y: PAD.top + plotH + 15, class: 'mo-tick-label' });
    tx.textContent = fmt(v, 1);
    svg.appendChild(tx);
    svg.appendChild(el('line', {
      x1: PAD.left - 4, y1: y(v), x2: PAD.left, y2: y(v), class: 'mo-tick',
    }));
    const ty = el('text', {
      x: PAD.left - 6, y: y(v) + 3, class: 'mo-tick-label mo-tick-y',
    });
    ty.textContent = fmt(v, 1);
    svg.appendChild(ty);
  }

  const xl = el('text', {
    x: PAD.left + plotW / 2, y: PAD.top + plotH + 31, class: 'mo-axis-label',
  });
  xl.textContent = 'μ*  — influence';
  svg.appendChild(xl);
  const yl = el('text', {
    x: 12, y: PAD.top + plotH / 2, class: 'mo-axis-label',
    transform: `rotate(-90 12 ${PAD.top + plotH / 2})`,
  });
  yl.textContent = 'σ  — non-linearity / interaction';
  svg.appendChild(yl);

  // ── Factors ─────────────────────────────────────────────────────────────
  const marks = new Map();
  factors.forEach((f, i) => {
    const g = el('g', { class: 'mo-pt', 'data-id': f.id });

    // The signed mean beside the absolute one. A long connector is the
    // signature of a factor whose effect changes sign; they coincide, and the
    // connector vanishes, for a strictly monotone factor.
    if (changesSign(f)) {
      g.appendChild(el('line', {
        x1: x(Math.abs(f.mu)), y1: y(f.sigma), x2: x(f.muStar), y2: y(f.sigma),
        class: 'mo-signgap',
      }));
      g.appendChild(el('circle', {
        cx: x(Math.abs(f.mu)), cy: y(f.sigma), r: 2.6, class: 'mo-mu',
      }));
    }

    g.appendChild(el('circle', {
      cx: x(f.muStar), cy: y(f.sigma), r: 4.4,
      class: `mo-dot ${significant(f) ? 'mo-dot--sig' : 'mo-dot--ns'}`,
    }));

    // Only the top few are labelled in place; the rest are in the table, which
    // is the citable object anyway. Eighteen overlapping labels are worse than
    // six labels and a table beside them.
    if (i < 3) {
      // The most influential factor sits at the right edge by construction, so
      // a label always drawn to the right always overflows. Flip it inward
      // past the midpoint, and flip vertically near the top for the same
      // reason.
      const px = x(f.muStar);
      const py = y(f.sigma);
      const flipX = px > PAD.left + plotW * 0.55;
      const nearTop = py < PAD.top + 14;
      const t = el('text', {
        x: flipX ? px - 8 : px + 8,
        y: py + (nearTop ? 14 : 3),
        class: 'mo-label',
        'text-anchor': flipX ? 'end' : 'start',
      });
      t.textContent = f.label;
      g.appendChild(t);
    }

    const title = el('title');
    title.textContent =
      `${f.label}${f.unit ? ` [${f.unit}]` : ''}\n`
      + `μ* ${fmt(f.muStar)} · μ ${fmt(f.mu)} · σ ${fmt(f.sigma)}\n`
      + `σ/μ* ${f.ratio?.toFixed(2)} — ${classify(f)}\n`
      + `range ${fmt(f.low)} to ${fmt(f.high)}${f.log ? ' (log)' : ''}\n`
      + `${significant(f) ? 'outside' : 'inside'} Morris's ±2·SEM wedge`;
    g.appendChild(title);

    if (onPick) {
      g.style.cursor = 'pointer';
      g.addEventListener('click', () => onPick(f.id));
    }
    svg.appendChild(g);
    marks.set(f.id, g);
  });

  container.appendChild(svg);

  function setSelected(id) {
    for (const [key, g] of marks) g.classList.toggle('mo-pt--sel', key === id);
    svg.classList.toggle('mo-has-sel', Boolean(id));
  }
  setSelected(selected);

  return { setSelected, destroy() { container.textContent = ''; } };
}

/**
 * The table under the chart. It is the citable artefact; the chart navigates it.
 *
 * The factor ranges are not decoration. mu* is measured relative to how far
 * each factor was moved, so a factor given a wide range looks more important
 * than one given a narrow one. Without the range column the ranking cannot be
 * interpreted at all, and this is the commonest way Morris plots mislead.
 */
export function morrisTable(container, screening) {
  container.textContent = '';
  if (!screening?.factors?.length) return;
  const t = document.createElement('table');
  t.className = 'mo-table';
  t.innerHTML = `
    <thead><tr>
      <th>factor</th><th>μ*</th><th>σ/μ*</th><th>shape</th><th>range explored</th>
    </tr></thead>
    <tbody>
      ${screening.factors.map(f => `
        <tr data-id="${f.id}">
          <td>${f.label}${f.unit ? ` <span class="mo-unit">[${f.unit}]</span>` : ''}</td>
          <td class="mo-num">${fmt(f.muStar)}</td>
          <td class="mo-num">${f.ratio === null ? '—' : f.ratio.toFixed(2)}</td>
          <td>${classify(f)}${changesSign(f) ? ' <span class="mo-flip">· flips sign</span>' : ''}</td>
          <td class="mo-num">${fmt(f.low)} – ${fmt(f.high)}${f.log ? ' <span class="mo-unit">log</span>' : ''}</td>
        </tr>
      `).join('')}
    </tbody>
  `;
  container.appendChild(t);
}

/**
 * The cost comparison, stated at equal budget rather than as a slogan.
 *
 * The point is not that Morris is better because it is more expensive. This
 * screening cost 108 model evaluations; a one-at-a-time design over the same
 * eight factors costs the same order and reaches 1.6% of the space while
 * detecting no interactions whatsoever.
 */
export function morrisCostPanel(container, screening) {
  container.textContent = '';
  if (!screening) return;
  const k = screening.factors.length;
  const box = document.createElement('div');
  box.className = 'mo-cost';
  box.innerHTML = `
    <div class="mo-cost-row">
      <span>this screening</span>
      <b>Morris, k = ${k}, ${screening.trajectories} trajectories,
        ${screening.evaluations} evaluations</b>
    </div>
    <div class="mo-cost-row">
      <span>one-at-a-time, same k</span>
      <b>${(screening.oatFraction * 100).toPrecision(3)}% of the space,
        0 interactions detectable</b>
    </div>
    <div class="mo-cost-note">
      A one-at-a-time design's points all lie inside the hypersphere inscribed
      in the unit hypercube, whose volume ratio is
      r(k) = π<sup>k/2</sup> / (Γ(k/2+1)·2<sup>k</sup>)
      — and that is an upper bound, since the points actually lie on a
      hypercross of measure zero. At k = 18, the full knob set, r = ${
  oatExploredFraction(18).toExponential(1)}.
      Saltelli &amp; Annoni (2010), <i>Env. Modelling &amp; Software</i> 25(12):1508–1517.
    </div>
  `;
  container.appendChild(box);
}

export const MORRIS_STYLE = `
  .mo-svg { display: block; }
  .mo-empty { color: #8d7f74; font-size: 11px; padding: 10px 0; }
  .mo-frame { fill: none; stroke: #3a2f29; }
  .mo-ratio { stroke: #4a3e37; stroke-width: 1; stroke-dasharray: 4 3; }
  .mo-ratio-label { fill: #6f5f55; font-size: 8px; font-family: inherit; }
  .mo-tick { stroke: #3a2f29; }
  .mo-tick-label {
    fill: #8d7f74; font-size: 8.5px; font-family: inherit; text-anchor: middle;
  }
  .mo-tick-y { text-anchor: end; }
  .mo-axis-label {
    fill: #8d7f74; font-size: 9.5px; font-family: inherit; text-anchor: middle;
  }
  .mo-dot { stroke: rgba(18,16,14,0.9); stroke-width: 1; }
  .mo-dot--sig { fill: #f2ebe4; }
  /* Hollow when Morris's own wedge cannot call the mean effect non-zero. */
  .mo-dot--ns { fill: none; stroke: #8d7f74; stroke-width: 1.4; }
  .mo-mu { fill: none; stroke: #9a8cc4; stroke-width: 1.2; }
  .mo-signgap { stroke: #9a8cc4; stroke-width: 1; stroke-dasharray: 2 2; }
  .mo-label { fill: #cbbfb4; font-size: 9px; font-family: inherit; }
  .mo-has-sel .mo-dot { opacity: 0.3; }
  .mo-has-sel .mo-pt--sel .mo-dot { opacity: 1; stroke: #45c2ca; stroke-width: 1.6; }

  .mo-table {
    width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 8px;
    font-family: inherit;
  }
  .mo-table th {
    text-align: left; color: #8d7f74; font-weight: normal; padding: 3px 5px;
    border-bottom: 1px solid #3a2f29; text-transform: uppercase;
    letter-spacing: 0.05em; font-size: 9px;
  }
  .mo-table td { padding: 3px 5px; color: #cbbfb4; border-bottom: 1px solid #241d19; }
  .mo-num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .mo-unit { color: #6f5f55; }
  .mo-flip { color: #9a8cc4; }

  .mo-cost {
    margin-top: 10px; border: 1px solid #3a2f29; padding: 7px 8px; border-radius: 2px;
  }
  .mo-cost-row {
    display: flex; justify-content: space-between; gap: 10px; font-size: 10px;
    color: #8d7f74; line-height: 1.6;
  }
  .mo-cost-row b { color: #f2ebe4; font-weight: normal; text-align: right; }
  .mo-cost-note { font-size: 9.5px; color: #6f5f55; line-height: 1.5; margin-top: 5px; }
`;
