/**
 * The workspace menu: everything this tool can show, in one place, at the top.
 *
 * Before this, what the application could display was scattered across four
 * surfaces and mostly undiscoverable. Scene layers were six unlabelled
 * checkboxes in the bottom rail, next to the transport controls they have
 * nothing to do with. The analysis dock was one button that showed all six of
 * its figures or none. Two whole pages - the sensitivity screening and the
 * heatmap - were reachable only from a link inside another page. Nothing told a
 * visitor that the shielding figure follows the fragment they click, or that
 * any figure can be torn off into its own window.
 *
 * Trading terminals solved this a long time ago: one bar along the top, grouped
 * menus, and every panel the product owns listed by name with a short line
 * saying what it is. You open what you want and the rest stays out of the way.
 * The bottom of the screen is left to the transport, because scrubbing through
 * time is the one control that genuinely belongs under the picture.
 *
 * The catalogue is not written out here. The dock reports what it holds, so a
 * figure added later appears in this menu without anyone remembering to add it
 * - which is the only way the two stay in step.
 */

const STYLE = `
  #menu-bar {
    position: fixed; left: 0; right: 0; z-index: 930;
    top: var(--headline-h, 0px);
    display: flex; align-items: stretch; gap: 0;
    background: var(--bg-panel);
    border-bottom: 1px solid var(--line-edge);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11.5px; user-select: none;
  }
  .mb-menu { position: relative; }
  .mb-top {
    background: none; border: none; color: var(--ink); font: inherit;
    padding: 7px 13px; cursor: pointer; border-right: 1px solid var(--line-hair);
  }
  .mb-top:hover, .mb-menu.open .mb-top { background: var(--line-hair); color: var(--ink-bright); }
  .mb-top:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .mb-drop {
    position: absolute; top: 100%; left: 0; min-width: 310px;
    background: var(--bg-panel); border: 1px solid var(--line-edge); border-top: none;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12); padding: 4px 0; z-index: 931;
  }
  .mb-drop[hidden] { display: none; }
  .mb-group {
    font-size: 9px; letter-spacing: .09em; text-transform: uppercase;
    color: var(--ink-dim); padding: 7px 12px 3px;
  }
  .mb-item {
    display: flex; align-items: flex-start; gap: 9px; width: 100%;
    background: none; border: none; color: var(--ink); font: inherit;
    text-align: left; padding: 6px 12px; cursor: pointer;
  }
  .mb-item:hover { background: var(--line-hair); color: var(--ink-bright); }
  .mb-item:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .mb-check {
    width: 11px; flex: none; color: var(--accent); line-height: 1.45;
  }
  .mb-label { flex: 1; line-height: 1.45; }
  .mb-note {
    display: block; color: var(--ink-dim); font-size: 10px; margin-top: 1px;
    line-height: 1.4;
  }
  /* Tearing a figure off is a separate act from showing it, so it gets its own
     target rather than a modifier key nobody would discover. */
  .mb-pop {
    flex: none; background: none; border: 1px solid transparent; color: var(--ink-dim);
    font: inherit; font-size: 11px; padding: 0 4px; cursor: pointer;
    border-radius: 2px; line-height: 1.4;
  }
  .mb-pop:hover { color: var(--accent); border-color: var(--line-edge); }
  .mb-sep { height: 1px; background: var(--line-hair); margin: 4px 0; }
  .mb-spacer { flex: 1; }
  .mb-right {
    display: flex; align-items: center; gap: 12px; padding: 0 14px;
    color: var(--ink-dim); font-size: 10.5px;
  }
  .mb-right a { color: var(--ink-dim); text-decoration: none; }
  .mb-right a:hover { color: var(--accent); text-decoration: underline; }
`;

/**
 * @param {object} deps
 *  - charts: the live-chart dock api (catalogue, setVisible, isVisible)
 *  - scene: {layers: [{key,label,note,get,set}]}
 *  - panels: [{key,label,note,get,set}]
 *  - links: [{label,href,note}]
 */
export function menuBar(container, deps) {
  if (!document.getElementById('mb-style')) {
    const s = document.createElement('style');
    s.id = 'mb-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  const root = document.createElement('nav');
  root.id = 'menu-bar';
  root.setAttribute('aria-label', 'Workspace');

  const menus = [];

  /** One top-level menu with a dropdown that rebuilds each time it opens. */
  function addMenu(label, build) {
    const wrap = document.createElement('div');
    wrap.className = 'mb-menu';
    const top = document.createElement('button');
    top.type = 'button';
    top.className = 'mb-top';
    top.textContent = label;
    top.setAttribute('aria-haspopup', 'true');
    top.setAttribute('aria-expanded', 'false');
    const drop = document.createElement('div');
    drop.className = 'mb-drop';
    drop.hidden = true;
    wrap.append(top, drop);
    root.appendChild(wrap);

    const entry = { wrap, top, drop, build };
    menus.push(entry);

    top.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = drop.hidden;
      closeAll();
      if (opening) open(entry);
    });
    return entry;
  }

  function open(entry) {
    // Rebuilt on open, never cached: a checkmark that reflects state from the
    // last time the menu happened to be opened is worse than no checkmark.
    entry.drop.textContent = '';
    entry.build(entry.drop);
    entry.drop.hidden = false;
    entry.wrap.classList.add('open');
    entry.top.setAttribute('aria-expanded', 'true');
  }

  function closeAll() {
    for (const m of menus) {
      m.drop.hidden = true;
      m.wrap.classList.remove('open');
      m.top.setAttribute('aria-expanded', 'false');
    }
  }

  function groupLabel(drop, text) {
    const g = document.createElement('div');
    g.className = 'mb-group';
    g.textContent = text;
    drop.appendChild(g);
  }

  /** A row that toggles something, optionally with a tear-off button. */
  function item(drop, { checked, label, note, onSelect, onPop }) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'flex-start';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mb-item';
    btn.setAttribute('role', 'menuitemcheckbox');
    btn.setAttribute('aria-checked', String(Boolean(checked)));
    btn.innerHTML =
      `<span class="mb-check">${checked ? '✓' : ''}</span>`
      + `<span class="mb-label">${label}`
      + (note ? `<span class="mb-note">${note}</span>` : '')
      + '</span>';
    btn.addEventListener('click', () => { onSelect(); closeAll(); });
    row.appendChild(btn);

    if (onPop) {
      const pop = document.createElement('button');
      pop.type = 'button';
      pop.className = 'mb-pop';
      pop.textContent = '⎘';
      pop.title = 'Open in its own window';
      pop.addEventListener('click', (e) => {
        e.stopPropagation();
        onPop();
        closeAll();
      });
      row.appendChild(pop);
    }
    drop.appendChild(row);
    return row;
  }

  function separator(drop) {
    const d = document.createElement('div');
    d.className = 'mb-sep';
    drop.appendChild(d);
  }

  // ── Figures ─────────────────────────────────────────────────────────────
  addMenu('Figures', (drop) => {
    const entries = deps.charts?.catalogue?.() ?? [];
    if (!entries.length) {
      groupLabel(drop, 'no figures in this replay');
      return;
    }
    let lastGroup = null;
    for (const e of entries) {
      if (e.group !== lastGroup) { groupLabel(drop, e.group); lastGroup = e.group; }
      item(drop, {
        checked: e.isVisible(),
        label: e.title,
        note: e.note,
        onSelect: () => e.setVisible(!e.isVisible()),
        onPop: e.detach ?? null,
      });
    }
    separator(drop);
    item(drop, {
      checked: deps.charts.isVisible(),
      label: 'Analysis dock',
      note: 'the whole column of figures at the right',
      onSelect: () => deps.charts.setVisible(!deps.charts.isVisible()),
    });
  });

  // ── Scene ───────────────────────────────────────────────────────────────
  addMenu('Scene', (drop) => {
    groupLabel(drop, 'layers');
    for (const layer of deps.scene?.layers ?? []) {
      item(drop, {
        checked: layer.get(),
        label: layer.label,
        note: layer.note,
        onSelect: () => layer.set(!layer.get()),
      });
    }
  });

  // ── Panels ──────────────────────────────────────────────────────────────
  addMenu('Panels', (drop) => {
    groupLabel(drop, 'workspace');
    for (const p of deps.panels ?? []) {
      item(drop, {
        checked: p.get(),
        label: p.label,
        note: p.note,
        onSelect: () => p.set(!p.get()),
      });
    }
  });

  // ── Analysis (other pages) ──────────────────────────────────────────────
  addMenu('Analysis', (drop) => {
    groupLabel(drop, 'separate pages');
    for (const link of deps.links ?? []) {
      const a = document.createElement('a');
      a.className = 'mb-item';
      a.href = link.href;
      a.innerHTML =
        '<span class="mb-check"></span>'
        + `<span class="mb-label">${link.label}`
        + (link.note ? `<span class="mb-note">${link.note}</span>` : '')
        + '</span>';
      drop.appendChild(a);
    }
  });

  const spacer = document.createElement('div');
  spacer.className = 'mb-spacer';
  root.appendChild(spacer);

  const right = document.createElement('div');
  right.className = 'mb-right';
  root.appendChild(right);

  document.addEventListener('click', closeAll);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });

  container.appendChild(root);

  // Publish the bar's own height the same way the headline publishes its own,
  // so everything anchored to the top clears BOTH rather than just the band.
  const measure = () => {
    document.documentElement.style.setProperty(
      '--menubar-h', `${Math.ceil(root.getBoundingClientRect().height)}px`,
    );
  };
  measure();
  if (typeof ResizeObserver === 'function') new ResizeObserver(measure).observe(root);
  else window.addEventListener('resize', measure);

  return { root, closeAll, rightSlot: right };
}
