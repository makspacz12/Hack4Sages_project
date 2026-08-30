/**
 * Presentation mode, and the chapters a talk moves through.
 *
 * WHY A SEPARATE MODE. The research layout gives the 3D scene about 40% of the
 * viewport and surrounds it with every model parameter, a column of figures and
 * a transport bar of toggles. That is the right tool for someone exploring the
 * model, and the wrong one for a room: nobody in row twelve reads a parameter
 * list, and the presenter already knows what is in it. The full UI is kept
 * intact and one keystroke away - this only changes what is on screen.
 *
 * WHY CHAPTERS RATHER THAN LIVE NAVIGATION. Dragging a camera into place on
 * stage costs time and composure, and a dropped view in front of an audience
 * is hard to recover from. Each chapter is one keystroke that sets the camera,
 * the time, and which panels are visible, so the talk moves in known steps.
 *
 * The chapter content follows what the data actually supports. It does not
 * build to microbes dying, because none do: every fragment ends the 3000-year
 * run holding between 77.5% and 97.1% of its population. The honest story is
 * that the Solar System leg is survivable and the uncertainty lives in one
 * coefficient - which is why the last chapter is the live c_rad drag rather
 * than a dramatic finish in the 3D view.
 */

/** Where each chapter puts the camera, as a multiple of the framing radius. */
const CHAPTERS = [
  {
    key: '1',
    title: 'The rock',
    note: 'Mars at ejection. Martian meteorites prove this happens.',
    frame: 0,
    zoom: 0.30,
    panels: { console: false, dock: false },
  },
  {
    key: '2',
    title: 'The swarm',
    note: '14 fragments, periods 1.8 to 75 years. The ellipses breathe as the '
        + 'planets pull on them.',
    frame: 0,
    zoom: 1.0,
    panels: { console: false, dock: false },
  },
  {
    key: '3',
    title: 'Dose accumulating',
    note: 'Colour is absorbed dose, 0 to 1000 Gy on a fixed scale.',
    frame: 0.5,
    zoom: 1.0,
    panels: { console: false, dock: false },
  },
  {
    key: '4',
    title: 'Size is the story',
    note: 'Attenuation depth is half a metre. Every fragment here is '
        + 'transparent to cosmic rays.',
    frame: 1,
    zoom: 0.65,
    panels: { console: false, dock: true },
  },
  {
    key: '5',
    title: 'The honest answer',
    note: 'One coefficient spans a factor of 17 in the literature, and 43 '
        + 'orders of magnitude in the answer.',
    frame: 1,
    zoom: 1.0,
    panels: { console: false, dock: true },
  },
];

export function chapters() {
  return CHAPTERS.map(c => ({ ...c }));
}

const STYLE = `
  body.presenting #run-console,
  body.presenting #menu-bar,
  body.presenting #dose-legend .dl-title { display: none !important; }

  /* The band keeps its headline number - that range is the thesis - but the
     prose folds away; it is what the presenter is saying out loud. */
  body.presenting .hl-prose,
  body.presenting .hl-more { display: none !important; }

  /* The transport keeps play, the scrubber and the speed. The seven layer
     checkboxes become chapter keys. */
  body.presenting #replay-bar label { display: none !important; }

  #chapter-hud {
    position: fixed; left: 50%; transform: translateX(-50%);
    bottom: calc(var(--rail-h) + 14px);
    z-index: 940; pointer-events: none;
    display: none; align-items: baseline; gap: 12px;
    padding: 8px 18px; border-radius: 3px;
    background: rgba(11, 14, 20, 0.86);
    font-family: var(--font-mono); color: var(--scene-ink);
    max-width: min(52rem, 90vw);
  }
  body.presenting #chapter-hud.live { display: flex; }
  #chapter-hud .ch-num {
    font-size: 0.6875rem; opacity: 0.6; flex: none;
  }
  #chapter-hud .ch-title {
    font-size: 0.9375rem; font-weight: 600; flex: none;
  }
  #chapter-hud .ch-note { font-size: 0.75rem; opacity: 0.82; line-height: 1.45; }

  #present-hint {
    position: fixed; right: 12px; top: calc(var(--headline-h, 0px) + 8px);
    z-index: 940; pointer-events: none;
    font-family: var(--font-mono); font-size: 0.625rem;
    color: var(--scene-ink); opacity: 0.5;
    display: none;
  }
  body.presenting #present-hint { display: block; }
`;

/**
 * Wire up presentation mode.
 *
 * `deps` supplies the few things a chapter needs to move: the replay
 * controller, a camera framing function, and the panel toggles. Everything
 * else it does through the body class, so the layout stays in CSS.
 */
export function initPresentation(deps = {}) {
  if (typeof document === 'undefined') return { toggle() {}, isActive: () => false };

  if (!document.getElementById('presentation-style')) {
    const s = document.createElement('style');
    s.id = 'presentation-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  const hud = document.createElement('div');
  hud.id = 'chapter-hud';
  document.body.appendChild(hud);

  const hint = document.createElement('div');
  hint.id = 'present-hint';
  hint.textContent = 'P exit · 1-5 chapters';
  document.body.appendChild(hint);

  let active = false;
  let current = -1;

  function showChapter(index) {
    const ch = CHAPTERS[index];
    if (!ch) return;
    current = index;

    // Time first, so the camera frames what the chapter is about.
    const frames = deps.controller?.frames?.length ?? 0;
    if (frames > 0 && deps.setFrame) {
      deps.setFrame(Math.round(ch.frame * (frames - 1)));
    }
    deps.frameCamera?.(ch.zoom);
    deps.setConsoleVisible?.(ch.panels.console);
    deps.setDockVisible?.(ch.panels.dock);

    hud.innerHTML = '';
    const num = document.createElement('span');
    num.className = 'ch-num';
    num.textContent = `${index + 1}/${CHAPTERS.length}`;
    const title = document.createElement('span');
    title.className = 'ch-title';
    title.textContent = ch.title;
    const note = document.createElement('span');
    note.className = 'ch-note';
    note.textContent = ch.note;
    hud.append(num, title, note);
    hud.classList.add('live');
  }

  function setActive(on) {
    active = on;
    document.body.classList.toggle('presenting', on);
    if (!on) {
      hud.classList.remove('live');
      current = -1;
      // Give the research layout its panels back, or leaving the mode strands
      // the user with a stripped UI and no obvious way to restore it.
      deps.setConsoleVisible?.(true);
      deps.setDockVisible?.(true);
    } else {
      showChapter(0);
    }
    deps.onChange?.(on);
  }

  window.addEventListener('keydown', (e) => {
    // Never steal a keystroke from a field someone is typing in.
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    if (e.key === 'p' || e.key === 'P') {
      setActive(!active);
      e.preventDefault();
      return;
    }
    if (!active) return;
    const idx = CHAPTERS.findIndex(c => c.key === e.key);
    if (idx >= 0) { showChapter(idx); e.preventDefault(); return; }
    if (e.key === 'ArrowRight' && current < CHAPTERS.length - 1) {
      showChapter(current + 1); e.preventDefault();
    }
    if (e.key === 'ArrowLeft' && current > 0) {
      showChapter(current - 1); e.preventDefault();
    }
    if (e.key === 'Escape') { setActive(false); e.preventDefault(); }
  });

  return {
    toggle: () => setActive(!active),
    isActive: () => active,
    showChapter,
  };
}
