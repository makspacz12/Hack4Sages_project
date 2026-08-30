/** @vitest-environment jsdom */
/**
 * Presentation mode.
 *
 * The research layout gives the scene about 40% of the viewport and surrounds
 * it with every model parameter and a column of figures. That is right for
 * exploring the model and wrong for a room, where nobody reads a parameter
 * list from row twelve. Chapters exist so a talk moves in known steps instead
 * of a camera being dragged live in front of an audience.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initPresentation, chapters } from '../src/presentation.js';

function press(key) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('presentation mode', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    document.head.innerHTML = '';
  });

  it('is off until asked for, and toggles on P', () => {
    const p = initPresentation({});
    expect(p.isActive()).toBe(false);
    press('p');
    expect(p.isActive()).toBe(true);
    expect(document.body.classList.contains('presenting')).toBe(true);
    press('p');
    expect(p.isActive()).toBe(false);
  });

  it('gives the panels back on exit, so nobody is stranded', () => {
    // Leaving the mode with the UI still stripped and no visible way back is
    // the failure that matters here.
    const setConsole = vi.fn();
    const setDock = vi.fn();
    initPresentation({ setConsoleVisible: setConsole, setDockVisible: setDock });
    press('p');
    setConsole.mockClear();
    setDock.mockClear();
    press('p');
    expect(setConsole).toHaveBeenCalledWith(true);
    expect(setDock).toHaveBeenCalledWith(true);
  });

  it('jumps to a chapter on its number key', () => {
    const setFrame = vi.fn();
    const frameCamera = vi.fn();
    initPresentation({
      controller: { frames: new Array(151) }, setFrame, frameCamera,
    });
    press('p');
    setFrame.mockClear();
    press('4');
    // Chapter 4 sits at the end of the run.
    expect(setFrame).toHaveBeenCalledWith(150);
    expect(frameCamera).toHaveBeenCalled();
  });

  it('ignores chapter keys until the mode is on', () => {
    const setFrame = vi.fn();
    initPresentation({ controller: { frames: new Array(151) }, setFrame });
    press('3');
    expect(setFrame).not.toHaveBeenCalled();
  });

  it('never steals a keystroke from a field being typed in', () => {
    const p = initPresentation({});
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    press('p');
    expect(p.isActive()).toBe(false);
  });

  it('leaves modified keystrokes to the browser', () => {
    const p = initPresentation({});
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }));
    expect(p.isActive()).toBe(false);
  });

  it('walks chapters with the arrow keys', () => {
    const setFrame = vi.fn();
    initPresentation({ controller: { frames: new Array(151) }, setFrame });
    press('p');            // opens at chapter 1
    setFrame.mockClear();
    press('ArrowRight');
    expect(setFrame).toHaveBeenCalled();
  });

  it('sends the chapter that needs the long run to the long run', () => {
    // Chapter 6 is about a finding that only exists at 100 kyr. It must name
    // the run rather than quietly showing the 3000 year one, where no
    // fragment is lost at all.
    const sixth = chapters().find(c => c.key === '6');
    expect(sixth.requiresRun).toBe('data/run_100kyr.json');
  });

  it('describes what the data supports, not a death animation', () => {
    // Every fragment ends the run holding 77.5% to 97.1% of its microbes, so
    // no chapter may promise sterilisation.
    const text = chapters().map(c => `${c.title} ${c.note}`).join(' ').toLowerCase();
    for (const word of ['sterilised', 'dies', 'death', 'graveyard']) {
      expect(text).not.toContain(word);
    }
  });

  it('offers exactly the six chapters the talk is built around', () => {
    const cs = chapters();
    expect(cs).toHaveLength(6);
    expect(cs.map(c => c.key)).toEqual(['1', '2', '3', '4', '5', '6']);
    for (const c of cs) {
      expect(c.title).toBeTruthy();
      expect(c.note).toBeTruthy();
      expect(c.zoom).toBeGreaterThan(0);
    }
  });
});

/**
 * The borrowed coefficient control.
 *
 * Chapter 5 MOVES the .lc-coeff block out of the analysis dock onto a stage
 * panel and back. Every test above passed a bare `deps`, so the dock element
 * never existed and this code returned early on every run - the riskiest part
 * of the module had no coverage at all, and an audit found a stranding bug in
 * it immediately.
 */
describe('borrowing the coefficient control', () => {
  function mountDock() {
    const dock = document.createElement('div');
    dock.id = 'live-charts';
    dock.innerHTML = `
      <div class="lc-before"></div>
      <div class="lc-coeff" hidden><input class="lc-coeff-slider"></div>
      <div class="lc-after"></div>`;
    document.body.appendChild(dock);
    return dock;
  }

  const where = () => {
    const el = document.querySelector('.lc-coeff');
    if (!el) return 'missing';
    if (el.closest('#stage-coeff')) return 'stage';
    if (el.closest('#live-charts')) return 'dock';
    return 'orphaned';
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    document.head.innerHTML = '';
  });

  it('moves it to the stage for chapter 5 and back for any other', () => {
    mountDock();
    initPresentation({ controller: { frames: new Array(151) } });
    press('p');
    expect(where()).toBe('dock');
    press('5');
    expect(where()).toBe('stage');
    press('2');
    expect(where()).toBe('dock');
  });

  it('shows it on stage even though the dock keeps it hidden', () => {
    mountDock();
    initPresentation({ controller: { frames: new Array(151) } });
    press('p');
    press('5');
    expect(document.querySelector('.lc-coeff').hidden).toBe(false);
    press('p');
    // and restores the dock's own hidden state on the way back
    expect(document.querySelector('.lc-coeff').hidden).toBe(true);
  });

  it('returns it to the same place in the dock, not just anywhere', () => {
    mountDock();
    initPresentation({ controller: { frames: new Array(151) } });
    press('p');
    press('5');
    press('p');
    const dock = document.getElementById('live-charts');
    const order = [...dock.children].map(e => e.className).filter(Boolean);
    expect(order).toEqual(['lc-before', 'lc-coeff', 'lc-after']);
  });

  it('survives the dock being replaced while the control is on stage', () => {
    // The parent is captured at borrow time. If the dock re-renders while
    // chapter 5 is up, insertBefore throws and the control is lost for the
    // rest of the session - unrecoverable without a reload, mid-talk.
    mountDock();
    initPresentation({ controller: { frames: new Array(151) } });
    press('p');
    press('5');
    expect(where()).toBe('stage');

    document.getElementById('live-charts').remove();
    const fresh = document.createElement('div');
    fresh.id = 'live-charts';
    document.body.appendChild(fresh);

    expect(() => press('p')).not.toThrow();
    expect(where()).toBe('dock');
  });

  it('never leaves the control outside the document', () => {
    mountDock();
    initPresentation({ controller: { frames: new Array(151) } });
    press('p');
    press('5');
    document.getElementById('live-charts').remove();
    press('p');
    expect(document.querySelector('.lc-coeff')?.isConnected).toBe(true);
  });

  it('does nothing when there is no control to borrow', () => {
    document.body.innerHTML = '<div id="live-charts"></div>';
    initPresentation({ controller: { frames: new Array(151) } });
    expect(() => { press('p'); press('5'); press('p'); }).not.toThrow();
  });
});
