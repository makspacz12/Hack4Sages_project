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
  .hl-q { font-size: 11px; color: var(--ink-dim); letter-spacing: 0.06em; text-transform: uppercase; }
  .hl-horizons { display: flex; gap: 4px; margin-left: auto; }
  .hl-h {
    background: none; border: 1px solid var(--line-edge); color: var(--ink-dim);
    font-family: inherit; font-size: 10.5px; padding: 2px 8px; cursor: pointer;
    border-radius: 2px;
  }
  .hl-h:hover { color: var(--ink-bright); border-color: var(--ink-faint); }
  .hl-h[aria-pressed="true"] { color: var(--accent); border-color: var(--accent); }
  .hl-h:focus-visible { outline: 2px solid var(--accent-lit); outline-offset: 2px; }

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
      90deg, #9a8cc4 0 6px, rgba(154,140,196,0.45) 6px 12px);
    border-left: 2px solid #9a8cc4; border-right: 2px solid #9a8cc4;
  }
  .hl-end {
    position: absolute; top: 0; font-size: 15px; font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .hl-end small { display: block; font-size: 9.5px; color: var(--ink-dim); margin-top: 2px; }
  .hl-end--lo { left: 0; text-align: left; }
  .hl-end--hi { right: 0; text-align: right; }

  .hl-read { font-size: 11.5px; color: var(--ink); line-height: 1.5; margin-top: 6px; }
  .hl-read b { color: var(--ink-bright); font-weight: normal; }
  .hl-warn { color: var(--warn); }
  .hl-note { font-size: 10.5px; color: var(--ink-dim); margin-top: 4px; line-height: 1.45; }
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
    <div class="hl-read"></div>
    <div class="hl-note"></div>
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
      + ` (Belbruno et al. 2012). `
      + `<span class="hl-warn">This is a range of answers consistent with the published`
      + ` literature, not a confidence interval</span> — c_rad is a fixed number we do`
      + ` not know, not a sampled one.`;
  }

  paint();
  return { root, paint, setHorizon(years) {
    const h = HORIZONS.find(x => x.years === years);
    if (h) { horizon = h; paint(); }
  } };
}
