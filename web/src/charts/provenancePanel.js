/**
 * The reproducibility record, on screen.
 *
 * Every replay this project writes already carries a full provenance block: a
 * SHA-256 digest of the complete parameter set, the resolved seed, the source
 * commit and whether the tree was dirty, a command that reproduces the run, and
 * a live audit of which physical constants are cited and which are not.
 *
 * None of it reached the screen. A reader had to open the JSON to find out
 * whether the figure in front of them came from a clean tree, or which of the
 * numbers underneath it rest on a coefficient nobody has sourced. That is the
 * strongest claim this project can make about its own honesty, and it was
 * buried in a file.
 *
 * The audit is the part that matters most. A tool that marks its own weak
 * points is making a different kind of statement than one that presents every
 * number with equal confidence, and the distinction should be visible without
 * being asked for.
 */

/** Pull the provenance block out of a replay, tolerating older files. */
export function parseProvenance(payload) {
  const p = payload?.provenance;
  if (!p || typeof p !== 'object') return null;
  const audit = p.coefficients_under_audit ?? {};
  const entries = audit.entries ?? {};
  return {
    digest: typeof p.parameters_sha256 === 'string' ? p.parameters_sha256 : null,
    seed: p.seed ?? null,
    commit: p.source?.commit ?? null,
    dirty: p.source?.dirty === true,
    generated: p.generated_utc ?? null,
    reproduce: typeof p.reproduce === 'string' ? p.reproduce : null,
    unresolved: Number.isFinite(audit.unresolved_count) ? audit.unresolved_count : null,
    coefficients: Object.entries(entries).map(([id, e]) => ({
      id,
      status: e?.status ?? 'unknown',
      source: e?.source ?? null,
      issue: e?.issue ?? null,
      note: e?.note ?? null,
      overridden: e?.overridden_run === true,
    })),
  };
}

/** Short form of a digest or commit — enough to compare two runs by eye. */
export function shortHash(value, length = 12) {
  if (typeof value !== 'string' || value.length === 0) return '—';
  return value.slice(0, length);
}

/**
 * One line summarising whether a result can be trusted at a glance.
 *
 * Ordered by how badly each condition undermines the record: a dirty tree means
 * the commit does not describe the code that ran, which is worse than an
 * uncited coefficient, which is in turn worse than everything being in order.
 */
export function trustSummary(prov) {
  if (!prov) return { level: 'none', text: 'no provenance in this replay' };
  if (prov.dirty) {
    return {
      level: 'bad',
      text: 'generated from an uncommitted tree — the commit does not describe this run',
    };
  }
  if (prov.unresolved > 0) {
    return {
      level: 'warn',
      text: `${prov.unresolved} coefficient${prov.unresolved === 1 ? '' : 's'} still uncited`,
    };
  }
  return { level: 'ok', text: 'clean tree, every coefficient cited' };
}

const STYLE = `
  .pv { border-top: 1px solid var(--line-edge); padding: 10px 0 4px; font-size: 0.6875rem; }
  .pv-head {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 8px; cursor: pointer; user-select: none;
  }
  .pv-title {
    font-size: 0.625rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--ink-dim);
  }
  .pv-toggle {
    background: none; border: none; color: var(--ink-dim); cursor: pointer;
    font-family: inherit; font-size: 0.6875rem; padding: 0;
  }
  .pv-toggle:hover { color: var(--accent); }
  .pv-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .pv-trust { display: flex; align-items: baseline; gap: 6px; margin: 6px 0 2px; }
  .pv-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
  .pv-dot--ok   { background: var(--accent); }
  .pv-dot--warn { background: var(--warn); }
  .pv-dot--bad  { background: var(--data-trace); }
  .pv-dot--none { background: var(--ink-faint); }
  .pv-trust span { color: var(--ink); line-height: 1.4; }
  .pv-rows { margin-top: 8px; display: grid; gap: 4px; }
  .pv-row { display: grid; grid-template-columns: 68px 1fr; gap: 8px; align-items: baseline; }
  .pv-k { color: var(--ink-dim); font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.06em; }
  .pv-v { color: var(--ink-bright); font-variant-numeric: tabular-nums; word-break: break-all; }
  .pv-repro {
    margin-top: 8px; background: var(--bg-sunken); border: 1px solid var(--line-edge);
    padding: 6px 7px; color: var(--ink); font-size: 0.65625rem; line-height: 1.45;
    word-break: break-all; border-radius: 2px;
  }
  .pv-copy {
    margin-top: 5px; background: none; border: 1px solid var(--line-edge); color: var(--ink);
    font-family: inherit; font-size: 0.625rem; padding: 3px 7px; cursor: pointer;
    border-radius: 2px;
  }
  .pv-copy:hover { border-color: var(--accent); color: var(--ink-bright); }
  .pv-copy:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .pv-coeffs { margin-top: 9px; display: grid; gap: 5px; }
  .pv-coeff { display: grid; grid-template-columns: 9px 1fr; gap: 7px; align-items: start; }
  .pv-mark { font-size: 0.5625rem; line-height: 1.6; }
  .pv-mark--resolved   { color: var(--accent); }
  .pv-mark--unresolved { color: var(--warn); }
  .pv-mark--overridden { color: var(--data-trace); }
  .pv-cname { color: var(--ink); }
  .pv-cwhy { color: var(--ink-dim); display: block; margin-top: 2px; line-height: 1.45; }
`;

/**
 * Render the panel into `container`.
 *
 * Collapsed to the trust line by default. The one-line verdict is what most
 * readers need; the digest and the coefficient list are for the one who wants
 * to check.
 */
export function provenancePanel(container, payload) {
  const prov = parseProvenance(payload);
  container.textContent = '';

  if (!document.getElementById('pv-style')) {
    const s = document.createElement('style');
    s.id = 'pv-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  const root = document.createElement('div');
  root.className = 'pv';
  const trust = trustSummary(prov);

  root.innerHTML = `
    <div class="pv-head">
      <span class="pv-title">Provenance</span>
      <button class="pv-toggle" type="button" aria-expanded="false">details</button>
    </div>
    <div class="pv-trust">
      <span class="pv-dot pv-dot--${trust.level}" aria-hidden="true"></span>
      <span>${trust.text}</span>
    </div>
    <div class="pv-body" hidden></div>
  `;

  const body = root.querySelector('.pv-body');
  if (prov) {
    const rows = [
      ['digest', shortHash(prov.digest, 16)],
      ['seed', prov.seed ?? '—'],
      ['commit', shortHash(prov.commit) + (prov.dirty ? ' + uncommitted' : '')],
    ];
    body.innerHTML = `
      <div class="pv-rows">
        ${rows.map(([k, v]) => `
          <div class="pv-row"><span class="pv-k">${k}</span><span class="pv-v">${v}</span></div>
        `).join('')}
      </div>
      ${prov.reproduce ? `
        <div class="pv-repro">${prov.reproduce}</div>
        <button class="pv-copy" type="button">copy reproduce command</button>
      ` : ''}
      <div class="pv-coeffs">
        ${prov.coefficients.map(c => {
          const state = c.overridden ? 'overridden' : c.status;
          const mark = state === 'resolved' ? '●' : state === 'overridden' ? '◆' : '○';
          const why = c.issue || c.note || c.source || '';
          return `
            <div class="pv-coeff">
              <span class="pv-mark pv-mark--${state}" title="${state}">${mark}</span>
              <span class="pv-cname">${c.id.replace(/_/g, ' ')}
                <span class="pv-cwhy">${why.slice(0, 150)}${why.length > 150 ? '…' : ''}</span>
              </span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    const copy = body.querySelector('.pv-copy');
    copy?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(prov.reproduce);
        copy.textContent = 'copied';
      } catch {
        // Clipboard access can be refused; the command is visible above
        // regardless, so say what happened rather than failing silently.
        copy.textContent = 'select the text above to copy';
      }
      setTimeout(() => { copy.textContent = 'copy reproduce command'; }, 2200);
    });
  }

  const toggle = root.querySelector('.pv-toggle');
  toggle.addEventListener('click', () => {
    const opening = body.hidden;
    body.hidden = !opening;
    toggle.setAttribute('aria-expanded', String(opening));
    toggle.textContent = opening ? 'hide' : 'details';
  });

  container.appendChild(root);
  return { provenance: prov, trust };
}
