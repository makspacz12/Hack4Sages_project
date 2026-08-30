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

  it('describes what the data supports, not a death animation', () => {
    // Every fragment ends the run holding 77.5% to 97.1% of its microbes, so
    // no chapter may promise sterilisation.
    const text = chapters().map(c => `${c.title} ${c.note}`).join(' ').toLowerCase();
    for (const word of ['sterilised', 'dies', 'death', 'graveyard']) {
      expect(text).not.toContain(word);
    }
  });

  it('offers exactly the five chapters the talk is built around', () => {
    const cs = chapters();
    expect(cs).toHaveLength(5);
    expect(cs.map(c => c.key)).toEqual(['1', '2', '3', '4', '5']);
    for (const c of cs) {
      expect(c.title).toBeTruthy();
      expect(c.note).toBeTruthy();
      expect(c.zoom).toBeGreaterThan(0);
    }
  });
});
