/**
 * Explanations that a reader can actually reach.
 *
 * Every parameter in this panel carried its explanation in a `title`
 * attribute, which is very nearly the worst place to put it. The HTML
 * specification says so itself: "Relying on the title attribute is currently
 * discouraged as many user agents do not expose the attribute in an accessible
 * manner ... which excludes keyboard-only users and touch-only users."
 *
 * Three concrete failures, all of which matter here. It never appears on
 * keyboard focus, so tabbing through the panel explains nothing. It cannot be
 * hovered, so a citation inside it can never be clicked. And it does not
 * appear at all on a touch screen.
 *
 * WCAG 2.2 SC 1.4.13 sets out what a replacement has to do: the content must be
 * dismissable without moving the pointer, hoverable so it can be read and its
 * links followed, and persistent until dismissed. All three are implemented
 * below.
 *
 * These bubbles carry the sentence explaining a quantity, its units, its
 * default, and - for the numbers this project does not know - the published
 * range and the paper it came from. That last part is why hoverable matters:
 * a citation you cannot click is decoration.
 */

const STYLE = `
  .tt-host { position: relative; display: inline-flex; align-items: center; gap: 5px; }
  .tt-trigger {
    display: inline-flex; align-items: center; justify-content: center;
    width: 13px; height: 13px; border-radius: 50%;
    border: 1px solid var(--line-strong); background: none; color: var(--ink-dim);
    font: inherit; font-size: 9px; line-height: 1; cursor: help; padding: 0;
    flex: none;
  }
  .tt-trigger:hover, .tt-trigger:focus-visible { border-color: var(--accent-lit); color: var(--accent-lit); }
  .tt-trigger:focus-visible { outline: 2px solid var(--accent-lit); outline-offset: 1px; }
  .tt-bubble {
    position: fixed; z-index: 990; max-width: 300px;
    background: var(--bg-panel); border: 1px solid var(--line-strong); border-radius: 3px;
    padding: 9px 11px; color: var(--ink);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px; line-height: 1.55;
    box-shadow: 0 8px 26px rgba(0, 0, 0, 0.14);
  }
  .tt-bubble[hidden] { display: none; }
  .tt-bubble b { color: var(--ink-bright); font-weight: 600; }
  .tt-meta {
    display: block; margin-top: 6px; padding-top: 6px;
    border-top: 1px solid var(--line-hair); color: var(--ink-dim); font-size: 10px;
  }
  .tt-warn { color: var(--warn); }
  .tt-bubble a { color: var(--accent-lit); }
`;

let bubble = null;
let openFor = null;
let hideTimer = null;

function ensureBubble() {
  bindEscape();
  if (!document.getElementById('tt-style')) {
    const s = document.createElement('style');
    s.id = 'tt-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }
  // Re-create if it was detached. One shared bubble is held in a module
  // variable, and anything that replaces the body's content - a panel
  // re-render, a page teardown - orphans it while the reference stays. Without
  // this check the tooltips break permanently the first time that happens, and
  // silently.
  if (bubble && !bubble.isConnected) bubble = null;
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'tt-bubble';
    bubble.setAttribute('role', 'tooltip');
    bubble.hidden = true;
    // Hoverable: moving onto the bubble cancels the pending hide, so a
    // citation inside it can be read and clicked.
    bubble.addEventListener('pointerenter', () => clearTimeout(hideTimer));
    bubble.addEventListener('pointerleave', scheduleHide);
    document.body.appendChild(bubble);
  }
  return bubble;
}

function place(trigger) {
  const r = trigger.getBoundingClientRect();
  bubble.style.visibility = 'hidden';
  bubble.hidden = false;
  const b = bubble.getBoundingClientRect();
  // Prefer below-right; flip when that would leave the viewport, so a bubble
  // on the last parameter in a tall panel is still readable.
  let left = r.left;
  let top = r.bottom + 6;
  if (left + b.width > window.innerWidth - 8) left = window.innerWidth - b.width - 8;
  if (top + b.height > window.innerHeight - 8) top = r.top - b.height - 6;
  bubble.style.left = `${Math.max(8, left)}px`;
  bubble.style.top = `${Math.max(8, top)}px`;
  bubble.style.visibility = '';
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, 140);
}

function hide() {
  if (!bubble) return;
  bubble.hidden = true;
  if (openFor) openFor.setAttribute('aria-expanded', 'false');
  openFor = null;
}

function show(trigger, html, id) {
  ensureBubble();
  clearTimeout(hideTimer);
  bubble.innerHTML = html;
  bubble.id = id;
  place(trigger);
  trigger.setAttribute('aria-describedby', id);
  trigger.setAttribute('aria-expanded', 'true');
  openFor = trigger;
}

let escapeBound = false;

/**
 * Bind the Escape handler on first use, not at import.
 *
 * This used to run at module scope, which gave the module an import-time side
 * effect on a global that need not exist: anything importing it in a non-DOM
 * environment threw ReferenceError before a single line of its own code ran.
 * A whole test file died that way, and it was not even a test of tooltips - it
 * imported something that imported something that imported this.
 */
function bindEscape() {
  if (escapeBound || typeof document === 'undefined') return;
  escapeBound = true;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openFor) { hide(); e.stopPropagation(); }
  });
}

let seq = 0;

/**
 * Attach an explanation to a label.
 *
 * Returns the host element, which contains the original label content and a
 * small trigger. The trigger responds to hover AND to keyboard focus, which is
 * the failure of `title` that matters most for a panel meant to be tabbed
 * through.
 */
export function withTooltip(labelEl, content) {
  if (!content) return labelEl;
  ensureBubble();
  const id = `tt-${seq += 1}`;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'tt-trigger';
  trigger.textContent = '?';
  trigger.setAttribute('aria-label', 'What is this?');
  trigger.setAttribute('aria-expanded', 'false');

  const html = typeof content === 'string' ? content : renderContent(content);

  const open = () => show(trigger, html, id);
  trigger.addEventListener('pointerenter', open);
  trigger.addEventListener('focus', open);
  trigger.addEventListener('pointerleave', scheduleHide);
  trigger.addEventListener('blur', hide);
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    if (openFor === trigger) hide(); else open();
  });

  const host = document.createElement('span');
  host.className = 'tt-host';
  labelEl.replaceWith(host);
  host.append(labelEl, trigger);
  return host;
}

/**
 * Build the bubble body from a structured explanation.
 *
 * The shape is deliberate: what it is, then what moving it does, then the
 * numbers, then - only where one exists - the published range and its source.
 * A parameter with no `band` is a parameter nobody is arguing about, and the
 * absence of that line carries that information.
 */
export function renderContent({ what, effect, unit, def, band, source, warn }) {
  const parts = [];
  if (what) parts.push(`<b>${what}</b>`);
  if (effect) parts.push(effect);
  const meta = [];
  if (def !== undefined && def !== null) {
    meta.push(`default ${def}${unit ? ` ${unit}` : ''}`);
  }
  if (band) meta.push(`published range ${band}`);
  if (source) meta.push(source);
  let html = parts.join('<br><br>');
  if (warn) html += `<br><br><span class="tt-warn">${warn}</span>`;
  if (meta.length) html += `<span class="tt-meta">${meta.join(' · ')}</span>`;
  return html;
}

/** Close any open bubble; used when a panel that owns triggers is torn down. */
export function hideTooltip() { hide(); }
