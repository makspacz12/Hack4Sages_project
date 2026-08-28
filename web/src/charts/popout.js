/**
 * Charts in their own browser windows, still driven by the simulation.
 *
 * A researcher watching a replay wants the 3D scene and the quantities it
 * produces visible at the same time, and a docked panel 330 pixels wide cannot
 * give both. A modal is worse: it covers the thing the chart is about.
 *
 * So a chart can be detached into a real window. It is not a screenshot and not
 * a copy - the parent keeps the reference and redraws it on every frame, so it
 * follows the replay, and selecting a fragment in either place highlights it in
 * both. On a second monitor that means the scene on one screen and the
 * measurements on the other, which is how this kind of work is actually done.
 *
 * Windows opened this way are same-origin, so the parent can build their DOM
 * directly; no message passing and nothing to keep in sync by hand. They are
 * closed when the opener unloads, because a chart that has stopped following
 * the run is worse than no chart - it shows numbers that look live and are not.
 */

const OPEN = new Map();

/** Style copied into each detached window so it matches the panel. */
const WINDOW_CSS = `
  :root { color-scheme: dark; }
  body {
    margin: 0; background: #14100e; color: #cbbfb4;
    font-family: monospace; display: flex; flex-direction: column;
    height: 100vh; overflow: hidden;
  }
  header {
    padding: 10px 14px; border-bottom: 1px solid #3a2f29;
    display: flex; align-items: baseline; gap: 10px; flex: none;
  }
  h1 { font-size: 13px; margin: 0; letter-spacing: 0.06em;
       text-transform: uppercase; color: #f2ebe4; font-weight: 600; }
  .note { font-size: 11px; color: #8d7f74; }
  .plot { flex: 1 1 auto; padding: 10px 14px; min-height: 0; }
  .plot svg { display: block; }
  footer {
    padding: 8px 14px; border-top: 1px solid #3a2f29;
    font-size: 11px; color: #98897d; flex: none;
  }
  .link { color: #45c2ca; }
`;

function isOpen(win) {
  try {
    return !!win && !win.closed;
  } catch {
    // A window navigated away from our origin throws on access.
    return false;
  }
}

/**
 * Detach one chart into its own window.
 *
 * `render(container, width, height)` is called whenever the window needs
 * redrawing and must return a handle with `update(frameIndex)` and optionally
 * `setSelected(id)`, matching the docked charts.
 */
export function openChartWindow(key, { title, note, render, onClose, footer }) {
  const existing = OPEN.get(key);
  if (existing && isOpen(existing.win)) {
    existing.win.focus();
    return existing;
  }

  const win = window.open(
    '', `chart_${key}`,
    'width=860,height=560,menubar=no,toolbar=no,location=no,status=no',
  );
  // Popup blockers return null. Say so rather than failing silently, because
  // the button will otherwise look broken.
  if (!win) return null;

  win.document.open();
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8">`
    + `<title>${title}</title><style>${WINDOW_CSS}</style></head><body>`
    + `<header><h1></h1><span class="note"></span></header>`
    + `<div class="plot"></div><footer></footer></body></html>`,
  );
  win.document.close();

  win.document.querySelector('h1').textContent = title;
  win.document.querySelector('.note').textContent = note ?? '';
  win.document.querySelector('footer').textContent =
    footer ?? 'follows the replay in the main window';

  const container = win.document.querySelector('.plot');
  const entry = { win, container, render, chart: null, key };

  const draw = () => {
    if (!isOpen(win)) return;
    const w = Math.max(320, win.innerWidth - 28);
    const h = Math.max(220, win.innerHeight - 108);
    entry.chart?.destroy?.();
    entry.chart = render(container, w, h);
  };
  entry.redraw = draw;
  draw();

  win.addEventListener('resize', draw);
  win.addEventListener('beforeunload', () => {
    OPEN.delete(key);
    onClose?.(key);
  });

  OPEN.set(key, entry);
  return entry;
}

/** Advance every detached window to a frame. */
export function updateChartWindows(frameIndex) {
  for (const [key, entry] of [...OPEN]) {
    if (!isOpen(entry.win)) {
      OPEN.delete(key);
      continue;
    }
    entry.chart?.update?.(frameIndex);
  }
}

/** Propagate a selection into every detached window. */
export function selectInChartWindows(id) {
  for (const [key, entry] of [...OPEN]) {
    if (!isOpen(entry.win)) {
      OPEN.delete(key);
      continue;
    }
    entry.chart?.setSelected?.(id);
  }
}

/** Rebuild every detached window from scratch, after the data behind it changed. */
export function redrawChartWindows() {
  for (const [key, entry] of [...OPEN]) {
    if (!isOpen(entry.win)) {
      OPEN.delete(key);
      continue;
    }
    entry.redraw?.();
  }
}

export function isChartWindowOpen(key) {
  const entry = OPEN.get(key);
  return !!entry && isOpen(entry.win);
}

export function openChartWindowCount() {
  let n = 0;
  for (const [key, entry] of [...OPEN]) {
    if (isOpen(entry.win)) n += 1;
    else OPEN.delete(key);
  }
  return n;
}

/**
 * Close every detached window.
 *
 * Registered against the opener's unload: a detached chart whose parent is gone
 * keeps showing the last frame it received, which reads as live data and is not.
 */
export function closeAllChartWindows() {
  for (const [key, entry] of [...OPEN]) {
    try {
      if (isOpen(entry.win)) entry.win.close();
    } catch { /* already gone */ }
    OPEN.delete(key);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', closeAllChartWindows);
}
