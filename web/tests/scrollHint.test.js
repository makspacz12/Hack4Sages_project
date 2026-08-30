/** @vitest-environment jsdom */
/**
 * The scroll boundary hint.
 *
 * These guard a bug that is invisible in a screenshot and obvious in a room:
 * a panel that hides 700px of content below its edge with nothing to say so,
 * which reads as a broken render rather than as more content.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { attachScrollHint } from '../src/ui/scrollHint.js';

function makeScroller({ contentHeight, viewHeight }) {
  const wrap = document.createElement('div');
  const scroller = document.createElement('div');
  const inner = document.createElement('div');
  scroller.appendChild(inner);
  wrap.appendChild(scroller);
  document.body.appendChild(wrap);
  // jsdom does no layout, so the geometry is defined explicitly.
  Object.defineProperty(scroller, 'scrollHeight', { value: contentHeight, configurable: true });
  Object.defineProperty(scroller, 'clientHeight', { value: viewHeight, configurable: true });
  scroller.scrollTop = 0;
  return { wrap, scroller };
}

describe('attachScrollHint', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('marks the boundary when content is hidden below the fold', () => {
    const { wrap, scroller } = makeScroller({ contentHeight: 1100, viewHeight: 400 });
    attachScrollHint(scroller, wrap);
    expect(wrap.classList.contains('has-more')).toBe(true);
  });

  it('says nothing when everything already fits', () => {
    const { wrap, scroller } = makeScroller({ contentHeight: 300, viewHeight: 400 });
    attachScrollHint(scroller, wrap);
    expect(wrap.classList.contains('has-more')).toBe(false);
  });

  it('clears once the reader reaches the end', () => {
    const { wrap, scroller } = makeScroller({ contentHeight: 1100, viewHeight: 400 });
    attachScrollHint(scroller, wrap);
    scroller.scrollTop = 700;
    scroller.dispatchEvent(new Event('scroll'));
    expect(wrap.classList.contains('has-more')).toBe(false);
  });

  it('comes back when the reader scrolls up again', () => {
    const { wrap, scroller } = makeScroller({ contentHeight: 1100, viewHeight: 400 });
    attachScrollHint(scroller, wrap);
    scroller.scrollTop = 700;
    scroller.dispatchEvent(new Event('scroll'));
    scroller.scrollTop = 0;
    scroller.dispatchEvent(new Event('scroll'));
    expect(wrap.classList.contains('has-more')).toBe(true);
  });

  it('tolerates a fractional scroll position at the very bottom', () => {
    // A fractional device pixel ratio leaves scrollTop a hair short of the end.
    const { wrap, scroller } = makeScroller({ contentHeight: 1100, viewHeight: 400 });
    attachScrollHint(scroller, wrap);
    scroller.scrollTop = 698.6;
    scroller.dispatchEvent(new Event('scroll'));
    expect(wrap.classList.contains('has-more')).toBe(false);
  });

  it('returns a refresh for callers that re-render their own content', () => {
    const { wrap, scroller } = makeScroller({ contentHeight: 300, viewHeight: 400 });
    const refresh = attachScrollHint(scroller, wrap);
    expect(wrap.classList.contains('has-more')).toBe(false);
    Object.defineProperty(scroller, 'scrollHeight', { value: 1400, configurable: true });
    refresh();
    expect(wrap.classList.contains('has-more')).toBe(true);
  });

  it('does not throw when the elements are missing', () => {
    expect(() => attachScrollHint(null, null)).not.toThrow();
  });
});
