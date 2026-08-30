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
    /* The live drag. Survival factorises exactly, so moving this recomputes
       the whole answer in the browser with no new run - which is the thing
       nobody else can demonstrate on stage. */
    coefficient: true,
  },
  {
    key: '6',
    title: 'Wait a hundred times longer',
    note: 'Erosion, not radiation, decides this. Seven of fourteen fragments '
        + 'are ground away; lifetime is radius divided by erosion rate.',
    frame: 1,
    zoom: 1.0,
    panels: { console: false, dock: true },
    /* This chapter is about a different run, so it says so rather than
       pretending the bundled replay shows it. The 3000 year run loses no
       fragment at all; the finding only exists at 100 kyr. */
    requiresRun: 'data/run_100kyr.json',
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
  #chapter-hud .ch-switch {
    pointer-events: auto; flex: none;
    padding: 3px 10px; border-radius: 3px;
    border: 1px solid var(--accent-lit); background: none;
    color: var(--accent-lit); font: inherit; font-size: 0.6875rem;
    cursor: pointer;
  }
  #chapter-hud .ch-switch:hover { background: rgba(74, 144, 217, 0.16); }
  #chapter-hud { pointer-events: none; }

  /* The coefficient, promoted to the stage.
   *
   * Chapter 5 is the live drag: c_rad spans a factor of seventeen in the
   * literature and that becomes 43 orders of magnitude in the answer, which is
   * the demonstration nothing else in the talk can match. It only works
   * because survival factorises exactly, so the browser recomputes it with no
   * new run.
   *
   * The control is MOVED here, not copied. Two sliders for one number can
   * disagree, and the one on stage would be the one nobody had wired to
   * anything. This is the same element with the same handlers, borrowed for
   * the chapter and put back afterwards. */
  #stage-coeff {
    position: fixed; left: 50%; transform: translateX(-50%);
    bottom: calc(var(--rail-h) + 5.5rem);
    z-index: 941; display: none;
    width: min(38rem, 82vw);
    padding: 14px 20px 16px; border-radius: 4px;
    background: rgba(11, 14, 20, 0.90);
    border: 1px solid var(--scene-line);
    font-family: var(--font-mono); color: var(--scene-ink);
  }
  body.presenting #stage-coeff.live { display: block; }
  /* On the dark stage panel the dock's own ink tokens are unreadable, so the
     borrowed control is re-inked rather than restyled. */
  #stage-coeff .lc-coeff { display: block; padding: 0; border: 0; background: none; }
  #stage-coeff .lc-coeff-label { font-size: 0.8125rem; color: var(--scene-ink); }
  #stage-coeff .lc-coeff-val { color: #fff; font-size: 1rem; }
  #stage-coeff .lc-coeff-slider { height: 1.5rem; }
  #stage-coeff .lc-coeff-band,
  #stage-coeff .lc-coeff-presets button { color: var(--scene-ink); opacity: 0.85; }
  #stage-coeff .lc-coeff-num {
    background: rgba(255,255,255,0.08); color: #fff;
    border-color: var(--scene-line);
  }

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
/**
 * The live instance, so a second call replaces the first rather than stacking.
 *
 * Every call added another keydown listener on window and appended another set
 * of panels. Called once in main.js that was harmless - but two instances mean
 * one press of P toggles the mode twice, i.e. does nothing, which is a
 * baffling failure to debug on stage and is exactly what happened the first
 * time this module was exercised properly by tests.
 */
let live = null;

export function initPresentation(deps = {}) {
  if (typeof document === 'undefined') return { toggle() {}, isActive: () => false };

  // Tear down any previous instance first.
  if (live) {
    live.dispose();
    live = null;
  }

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

  const stage = document.createElement('div');
  stage.id = 'stage-coeff';
  document.body.appendChild(stage);

  /* Borrow the coefficient control, and always give it back.
   *
   * The element is moved out of the analysis dock and returned to exactly the
   * place it came from, so the dock is not left with a hole in it after a
   * talk. Its handlers travel with it because it is the same node - a copy
   * would be a second slider for one number, and the two could disagree. */
  let borrowed = null;
  let borrowedHome = null;

  function borrowCoefficient(on) {
    if (on) {
      if (borrowed) return;
      // Scoped to the dock first, because that is where it lives - but fall
      // back to the document, so a control that was left on the stage panel by
      // a failed restore is picked up again rather than lost.
      const el = document.querySelector('#live-charts .lc-coeff')
        ?? document.querySelector('.lc-coeff');
      if (!el) return;
      borrowed = el;
      borrowedHome = { parent: el.parentNode, next: el.nextSibling, hidden: el.hidden };
      // The dock hides it until a fragment is selected; on stage it is the
      // whole point of the chapter, so it is shown.
      el.hidden = false;
      stage.appendChild(el);
      stage.classList.add('live');
    } else {
      stage.classList.remove('live');
      if (!borrowed || !borrowedHome) { borrowed = null; borrowedHome = null; return; }
      borrowed.hidden = borrowedHome.hidden;

      /* Put it back where it came from, and if that place is gone, put it
       * somewhere it can still be reached.
       *
       * The parent and next-sibling are captured once at borrow time. If the
       * dock re-renders or is replaced while chapter 5 is on stage, that
       * parent is no longer in the document and insertBefore throws
       * NotFoundError - leaving the control detached, the dock permanently
       * without it, and no recovery short of a page reload. Mid-talk that is
       * the worst outcome available. */
      const home = borrowedHome.parent?.isConnected
        ? borrowedHome.parent
        : document.getElementById('live-charts');
      try {
        if (home && borrowedHome.next?.parentNode === home) {
          home.insertBefore(borrowed, borrowedHome.next);
        } else if (home) {
          home.appendChild(borrowed);
        } else {
          // Nothing to return it to. Leaving it on a hidden stage panel keeps
          // it in the document, so a later chapter 5 can still find it.
          stage.appendChild(borrowed);
        }
      } catch {
        stage.appendChild(borrowed);
      }
      borrowed = null;
      borrowedHome = null;
    }
  }

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
    borrowCoefficient(Boolean(ch.coefficient));

    hud.innerHTML = '';

    /* A chapter that needs a different run says so instead of silently
       showing the wrong one. Switching reloads, so it is offered rather than
       done: a presenter should not lose their place to a stray keypress. */
    if (ch.requiresRun) {
      const loaded = new URLSearchParams(location.search).get('replay') ?? '';
      if (loaded !== ch.requiresRun) {
        const warn = document.createElement('button');
        warn.type = 'button';
        warn.className = 'ch-switch';
        warn.textContent = 'Load the 100 kyr run';
        warn.addEventListener('click', () => {
          const url = new URL(location.href);
          url.searchParams.set('replay', ch.requiresRun);
          location.assign(url.toString());
        });
        hud.appendChild(warn);
      }
    }
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
      borrowCoefficient(false);
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

  const onKeyDown = (e) => {
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
  };
  window.addEventListener('keydown', onKeyDown);

  /** Remove this instance's listener and its panels. */
  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    if (active) setActive(false);   // returns the borrowed control first
    hud.remove();
    hint.remove();
    stage.remove();
    document.body.classList.remove('presenting');
  }

  live = {
    toggle: () => setActive(!active),
    isActive: () => active,
    showChapter,
    dispose,
  };
  return live;
}
