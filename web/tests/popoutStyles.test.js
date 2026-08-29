/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { copyStyleSheets } from '../src/charts/popout.js';

function makeDoc() {
  return document.implementation.createHTMLDocument('detached');
}

describe('copyStyleSheets', () => {
  beforeEach(() => {
    document.head.querySelectorAll('style').forEach(s => s.remove());
  });

  it('carries a rule across so a detached figure is not rendered stripped', () => {
    // The bug: chart styles are injected into the opener's head, and a popped
    // out window is a separate document that inherits none of them. The
    // answer surface lost its shaded published band and dashed contours.
    const s = document.createElement('style');
    s.textContent = '.as-band { fill: rgba(154, 140, 196, 0.16); }';
    document.head.appendChild(s);

    const target = makeDoc();
    copyStyleSheets(document, target);

    const text = [...target.head.querySelectorAll('style')]
      .map(n => n.textContent).join('\n');
    expect(text).toContain('.as-band');
    expect(text).toContain('rgba(154, 140, 196, 0.16)');
  });

  it('separates copied rules with a real newline, not the text of one', () => {
    // Guards a mistake made writing this: the separator was once the literal
    // four characters 000A, which still passed a contains-check while
    // producing one unparseable run-on rule per sheet.
    const s = document.createElement('style');
    s.textContent = '.a { fill: red; }\n.b { fill: blue; }';
    document.head.appendChild(s);
    const target = makeDoc();
    copyStyleSheets(document, target);
    const text = target.head.querySelector('style').textContent;
    expect(text).not.toContain('000A');
    expect(text.split('\n').length).toBeGreaterThan(1);
  });

  it('carries every sheet, not only the first', () => {
    for (const css of ['.a { fill: red; }', '.b { fill: blue; }', '.c { fill: green; }']) {
      const s = document.createElement('style');
      s.textContent = css;
      document.head.appendChild(s);
    }
    const target = makeDoc();
    copyStyleSheets(document, target);
    const text = [...target.head.querySelectorAll('style')].map(n => n.textContent).join('\n');
    for (const cls of ['.a', '.b', '.c']) expect(text).toContain(cls);
  });

  it('links a cross-origin sheet rather than dropping it silently', () => {
    // cssRules throws on a cross-origin sheet by design. Falling back to a
    // link keeps the window styled instead of losing the sheet.
    const fakeFrom = {
      styleSheets: [{
        get cssRules() { throw new DOMException('cross-origin', 'SecurityError'); },
        href: 'https://example.com/fonts.css',
      }],
    };
    const target = makeDoc();
    copyStyleSheets(fakeFrom, target);
    const link = target.head.querySelector('link[rel="stylesheet"]');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://example.com/fonts.css');
  });

  it('survives an unreadable sheet that has no href at all', () => {
    const fakeFrom = {
      styleSheets: [{
        get cssRules() { throw new DOMException('nope', 'SecurityError'); },
        href: null,
      }],
    };
    const target = makeDoc();
    expect(() => copyStyleSheets(fakeFrom, target)).not.toThrow();
    expect(target.head.querySelectorAll('style, link').length).toBe(0);
  });

  it('copies nothing and throws nothing for a document with no sheets', () => {
    const target = makeDoc();
    expect(() => copyStyleSheets({ styleSheets: [] }, target)).not.toThrow();
  });
});
