/**
 * The headline band: one result, its full width, and where the width comes from.
 *
 * Everything else on this screen is a supporting argument. This is the claim.
 */

import {
  HORIZONS, doseRates, survivalRange, sterilisationTime, spreadAttribution,
  fmtFraction, fmtYears,
} from './headline.js';

const STYLE = `
  #headline {
    position: fixed; top: 0; left: 0; right: 0; z-index: 940;
    background: linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-panel) 100%);
    border-bottom: 1px solid var(--line-edge);
    padding: 10px 18px 11px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--ink-bright);
  }
  #headline.hidden { display: none; }
  .hl-top { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .hl-q { font-size: 0.6875rem; color: var(--ink-dim); letter-spacing: 0.06em; text-transform: uppercase; }
  .hl-horizons { display: flex; gap: 4px; margin-left: auto; }
  .hl-h {
    background: none; border: 1px solid var(--line-edge); color: var(--ink-dim);
    font-family: inherit; font-size: 0.65625rem; padding: 2px 8px; cursor: pointer;
    border-radius: 2px;
  }
  .hl-h:hover { color: var(--ink-bright); border-color: var(--ink-dim); }
  .hl-h[aria-pressed="true"] { color: var(--accent); border-color: var(--accent); }
  .hl-h:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .hl-box { margin: 9px 0 2px; position: relative; height: 46px; }
  .hl-axis {
    position: absolute; left: 0; right: 0; top: 21px; height: 3px;
    background: var(--line-hair);
  }
  /* The p-box itself. Deliberately a flat bar with hard ends and no gradient:
     a soft edge or a gradient would read as a density, and there is none. */
  .hl-span {
    position: absolute; top: 18px; height: 9px;
    background: repeating-linear-gradient(
      90deg, var(--data-secondary) 0 6px, rgba(154, 140, 196, 0.40) 6px 12px);
    border-left: 2px solid var(--data-secondary);
    border-right: 2px solid var(--data-secondary);
  }
  .hl-end {
    position: absolute; top: 0; font-size: 0.9375rem; font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .hl-end small { display: block; font-size: 0.59375rem; color: var(--ink-dim); margin-top: 2px; }
  .hl-end--lo { left: 0; text-align: left; }
  .hl-end--hi { right: 0; text-align: right; }

  .hl-read { font-size: 0.71875rem; color: var(--ink); line-height: 1.5; margin-top: 6px; }
  .hl-read b { color: var(--ink-bright); font-weight: normal; }
  .hl-warn { color: var(--warn); }
  .hl-note { font-size: 0.65625rem; color: var(--ink-dim); margin-top: 4px; line-height: 1.45; }
  .hl-caveat { font-size: 0.65625rem; color: var(--ink-dim); margin-top: 4px; line-height: 1.45; }

  /* The prose folds away.
   *
   * The band was 153px tall - 18% of a 1280x800 projector - and two of those
   * rows are sentences. They are worth reading once and are dead weight for
   * the rest of a talk, while the number and the bar above them are the point.
   * Collapsed, the band is about half the height and the scene gets the
   * difference. The state persists, so a presenter who folds it once is not
   * fighting it at every reload. */
  .hl-more {
    display: block; margin-top: 5px; padding: 0;
    background: none; border: 0; cursor: pointer;
    font-family: inherit; font-size: 0.59375rem; letter-spacing: .07em;
    text-transform: uppercase; color: var(--ink-faint);
  }
  .hl-more:hover, .hl-more:focus-visible { color: var(--accent); }
  .hl-more:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .hl-prose[hidden] { display: none; }
`;

/**
 * Mount the band. Returns a handle so the coefficient slider can drive it.
 */
export function headlineBanner(container, simData, bands) {
  const rates = doseRates(simData?.frames ?? []);
  if (!rates.length) return null;

  if (!document.getElementById('hl-style')) {
    const s = document.createElement('style');
    s.id = 'hl-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  const root = document.createElement('div');
  root.id = 'headline';
  root.innerHTML = `
    <div class="hl-top">
      <span class="hl-q">Surviving fraction after <span class="hl-hlabel"></span> in transit</span>
      <span class="hl-horizons"></span>
    </div>
    <div class="hl-box">
      <div class="hl-axis"></div>
      <div class="hl-span"></div>
      <div class="hl-end hl-end--lo"></div>
      <div class="hl-end hl-end--hi"></div>
    </div>
    <div class="hl-prose">
      <div class="hl-read"></div>
      <div class="hl-note"></div>
    </div>
    <div class="hl-caveat"></div>
    <button type="button" class="hl-more" aria-expanded="true"></button>
  `;
  container.appendChild(root);

  let horizon = HORIZONS.find(h => h.years === 1e6) ?? HORIZONS.at(-1);

  const buttons = root.querySelector('.hl-horizons');
  for (const h of HORIZONS) {
    const b = document.createElement('button');
    b.className = 'hl-h';
    b.type = 'button';
    b.textContent = h.label;
    b.title = h.note;
    b.addEventListener('click', () => { horizon = h; paint(); });
    buttons.appendChild(b);
  }

  function paint() {
    const range = survivalRange(rates, horizon.years, bands);
    const steril = sterilisationTime(rates, bands);
    const attr = spreadAttribution(rates, horizon.years, bands);
    if (!range) return;

    root.querySelector('.hl-hlabel').textContent = horizon.label;
    for (const b of buttons.children) {
      b.setAttribute('aria-pressed', String(b.textContent === horizon.label));
    }

    root.querySelector('.hl-end--lo').innerHTML =
      `${fmtFraction(null, range.log10Low)}<small>most sensitive organism, most irradiated fragment</small>`;
    root.querySelector('.hl-end--hi').innerHTML =
      `${fmtFraction(null, range.log10High)}<small>most resistant, least irradiated</small>`;

    // Inset so the bar never runs under its own end labels.
    const span = root.querySelector('.hl-span');
    span.style.left = '30%';
    span.style.right = '30%';

    const decades = range.decades;
    const share = attr ? Math.round(attr.coefficientShare * 100) : null;
    root.querySelector('.hl-read').innerHTML =
      `<b>${decades < 1
        ? `a factor of ${(10 ** decades).toFixed(1)}`
        : `${decades.toFixed(0)} orders of magnitude`}</b>`
      + (decades < 1 ? ` separates the two ends.` : ` separate the two ends.`)
      + (share !== null
        ? ` One coefficient, <b>c_rad</b>, accounts for <b>${share}%</b> of that;`
          + ` the entire ${simData?.frames?.at(-1)?.time?.toFixed(0) ?? '—'}-year`
          + ` N-body run accounts for the rest.`
        : '');

    root.querySelector('.hl-note').innerHTML =
      `Sterilised (N/N₀ = 10⁻⁶) after <b>${fmtYears(steril.fast)}</b> to`
      + ` <b>${fmtYears(steril.slow)}</b>, against transfer times of tens of Myr`
      + ` (Belbruno et al. 2012).`;

    // The caveat is deliberately NOT inside the collapsible prose. Folding the
    // band away is a layout convenience; hiding the statement that this range
    // is not a confidence interval would let the headline number be read as
    // one, which is the single most damaging misreading available here.
    root.querySelector('.hl-caveat').innerHTML =
      `<span class="hl-warn">A range of answers consistent with the published`
      + ` literature, not a confidence interval</span>. c_rad is a fixed number`
      + ` we do not know, not a sampled one.`;
  }

  /* Fold the prose away.
   *
   * Collapsed by default on a short screen, because that is where the band's
   * 153px hurt most - a 1280x800 projector gave it 18% of the height for two
   * sentences. On a tall display there is room, so it starts open. An explicit
   * choice always wins over both, and persists. */
  const PROSE_KEY = 'lp.headlineProse';
  const prose = root.querySelector('.hl-prose');
  const moreBtn = root.querySelector('.hl-more');

  function readStoredProse() {
    try {
      const v = localStorage.getItem(PROSE_KEY);
      return v === null ? null : v === 'open';
    } catch { return null; }   // private windows throw on access
  }

  function setProse(open) {
    prose.hidden = !open;
    moreBtn.setAttribute('aria-expanded', String(open));
    moreBtn.textContent = open
      ? 'Hide the reasoning'
      : 'How this number was reached';
    try { localStorage.setItem(PROSE_KEY, open ? 'open' : 'closed'); } catch { /* ignore */ }
  }

  /* Closed by default, on every screen.
   *
   * It used to open itself on a tall display, on the reasoning that there was
   * room for it. Room is not the test: the band's job at first paint is to
   * state the result, and two paragraphs of argument underneath it are
   * something a reader should be able to ask for rather than have to dismiss.
   * The number, the range and the caveat stay visible; the reasoning is one
   * click away and remembers being opened. */
  const stored = readStoredProse();
  setProse(stored === null ? false : stored);
  moreBtn.addEventListener('click', () => setProse(prose.hidden));

  paint();
  return { root, paint, setHorizon(years) {
    const h = HORIZONS.find(x => x.years === years);
    if (h) { horizon = h; paint(); }
  } };
}
