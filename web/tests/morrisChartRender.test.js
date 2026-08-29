/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { parseMorris } from '../src/charts/morris.js';
import { morrisChart, morrisTable, morrisCostPanel } from '../src/charts/morrisChart.js';
import raw from '../public/data/morris_sample.json';

const screening = parseMorris(raw);

function render(opts = {}) {
  document.body.innerHTML = '<div id="host"></div>';
  const host = document.getElementById('host');
  const chart = morrisChart(host, screening, { width: 520, height: 520, ...opts });
  return { host, chart, svg: host.querySelector('svg') };
}

describe('morrisChart', () => {
  it('draws one mark per factor', () => {
    const { svg } = render();
    expect(svg.querySelectorAll('.mo-dot').length).toBe(screening.factors.length);
  });

  it('draws the three ratio lines from Garcia Sanchez et al.', () => {
    const { svg } = render();
    expect(svg.querySelectorAll('.mo-ratio').length).toBe(3);
  });

  it('hollows out the factors that fail the Morris wedge', () => {
    const { svg } = render();
    const filled = svg.querySelectorAll('.mo-dot--sig').length;
    const hollow = svg.querySelectorAll('.mo-dot--ns').length;
    expect(filled).toBeGreaterThan(0);
    expect(hollow).toBeGreaterThan(0);
    expect(filled + hollow).toBe(screening.factors.length);
  });

  it('draws a sign connector only for the factor that flips', () => {
    const { svg } = render();
    expect(svg.querySelectorAll('.mo-signgap').length).toBe(1);
  });

  it('keeps every label inside the drawing area', () => {
    // The most influential factor sits at the right edge by construction, so a
    // label always drawn rightwards always overflowed.
    const { svg } = render();
    const width = Number(svg.getAttribute('width'));
    for (const t of svg.querySelectorAll('.mo-label')) {
      const x = Number(t.getAttribute('x'));
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(width);
      if (t.getAttribute('text-anchor') === 'start') {
        // Leave room for the text itself when it runs rightwards.
        expect(x + t.textContent.length * 5).toBeLessThan(width);
      }
    }
  });

  it('gives both axes their meaning, not just their symbol', () => {
    const { svg } = render();
    const labels = [...svg.querySelectorAll('.mo-axis-label')].map(t => t.textContent);
    expect(labels.some(l => l.includes('influence'))).toBe(true);
    expect(labels.some(l => l.includes('interaction'))).toBe(true);
  });

  it('puts the range and the shape class in the hover title', () => {
    const { svg } = render();
    const title = svg.querySelector('.mo-pt title').textContent;
    expect(title).toContain('σ/μ*');
    expect(title).toContain('range');
    expect(title).toContain('wedge');
  });

  it('says so plainly when there is no screening', () => {
    document.body.innerHTML = '<div id="host"></div>';
    const host = document.getElementById('host');
    expect(() => morrisChart(host, null)).not.toThrow();
    expect(host.textContent).toContain('no Morris screening');
  });
});

describe('morrisTable', () => {
  it('carries the explored range, without which the ranking is uninterpretable', () => {
    // mu* is measured relative to how far each factor was moved, so a factor
    // given a wide range looks more important than one given a narrow one.
    document.body.innerHTML = '<div id="t"></div>';
    const host = document.getElementById('t');
    morrisTable(host, screening);
    const headers = [...host.querySelectorAll('th')].map(h => h.textContent);
    expect(headers.join(' ')).toContain('range explored');
    expect(host.querySelectorAll('tbody tr').length).toBe(screening.factors.length);
    expect(host.textContent).toContain('log');
  });
});

describe('morrisCostPanel', () => {
  it('states the comparison at equal budget, not as a slogan', () => {
    document.body.innerHTML = '<div id="c"></div>';
    const host = document.getElementById('c');
    morrisCostPanel(host, screening);
    const text = host.textContent;
    expect(text).toContain(String(screening.evaluations));
    expect(text).toContain('1.59');
    expect(text).toContain('0 interactions');
    expect(text).toContain('upper bound');
  });
});
