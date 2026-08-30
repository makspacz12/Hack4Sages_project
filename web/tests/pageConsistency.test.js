import { describe, it, expect } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';

const PAGES = ['index.html', 'research.html', 'grid.html', 'sensitivity.html',
  'further_details.html'];

async function read(p) { return readFile(p, 'utf8'); }

describe('every page belongs to the same product', () => {
  it('never uses the old product name', async () => {
    // Two pages still said "COSMOS 3D" long after the project was renamed, so
    // a reader moving between them saw two different products.
    for (const page of PAGES) {
      const html = await read(page);
      expect(html, page).not.toMatch(/COSMOS 3D/i);
    }
  });

  it('defines no colour of its own', async () => {
    // research.html and further_details.html each carried an independent
    // palette through the entire light-theme migration and were still
    // rendering on a blue-black ground when every other page had moved.
    for (const page of PAGES) {
      const html = await read(page);
      const literals = [...html.matchAll(/(?:color|background)\s*:\s*(#[0-9a-f]{3,8})/gi)]
        .map(m => m[1]);
      expect(literals, `${page} defines colours instead of using tokens`).toEqual([]);
    }
  });
});

describe('nothing links somewhere empty', () => {
  it('does not send a reader to a page that says content is coming', async () => {
    // The audience for this is a conference. A dead end is worse than an
    // absent link.
    const empty = [];
    for (const page of PAGES) {
      const html = await read(page);
      if (/content coming soon/i.test(html)) empty.push(page);
    }
    for (const page of PAGES) {
      const html = await read(page);
      for (const dead of empty) {
        if (page === dead) continue;
        expect(html, `${page} links to the empty ${dead}`).not.toContain(`href="./${dead}"`);
      }
    }
  });
});

describe('no page ships a script for markup it does not have', () => {
  it('references no element id that never appears', async () => {
    // research.html shipped a WebR console whose markup had been deleted: it
    // threw TypeError on every load and 130 lines of CSS styled nothing.
    for (const page of PAGES) {
      const html = await read(page);
      const looked = [...html.matchAll(/getElementById\(['"]([\w-]+)['"]\)/g)].map(m => m[1]);
      for (const id of looked) {
        expect(html, `${page} looks up #${id}, which it never defines`)
          .toMatch(new RegExp(`id=["']${id}["']`));
      }
    }
  });
});

/**
 * A panel offset must never be restated as a pixel literal.
 *
 * `#btn-live-charts.docked { right: 344px; }` was the old 21rem dock plus a
 * gutter, written out by hand. When the dock became min(21rem, 26vw) so it
 * would stop eating a narrow projector, the button kept pointing at 344px and
 * floated over the dock's own heading. The offset has to be derived from the
 * token, so that changing the token moves everything that depends on it.
 */
describe('panel offsets track their tokens', () => {
  const SOURCES = ['src/liveCharts.js', 'src/ui/controlPanel.js', 'src/ui/theme.css'];

  it('never hardcodes a pixel offset in the panel-width range', async () => {
    const offenders = [];
    for (const rel of SOURCES) {
      const text = await readFile(new URL(`../${rel}`, import.meta.url), 'utf8');
      const re = /(left|right)\s*:\s*(\d{3,})px/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        // Anything this wide is a panel edge, not a small nudge.
        if (Number(m[2]) >= 200) offenders.push(`${rel}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('caps each side panel so it cannot swallow a narrow screen', async () => {
    const css = await readFile(new URL('../src/ui/theme.css', import.meta.url), 'utf8');
    for (const token of ['--panel-w', '--dock-w']) {
      const m = css.match(new RegExp(`${token}\s*:\s*([^;]+);`));
      expect(m, `${token} must be defined`).toBeTruthy();
      // A viewport-relative cap is what keeps the 3D scene visible at 1280px.
      expect(m[1]).toMatch(/vw/);
    }
  });
});
