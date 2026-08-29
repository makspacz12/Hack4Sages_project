/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { answerSurfaceChart } from '../src/charts/answerSurfaceChart.js';
import sim from '../public/data/cosmos_visualizer_simulation.json';

const BANDS = { cMin: 2.5e-5, cMax: 4.3e-4, cDefault: 2.5e-4 };

function render(extra = {}) {
  document.body.innerHTML = '<div id="host"></div>';
  const host = document.getElementById('host');
  const chart = answerSurfaceChart(host, {
    frames: sim.frames, bands: BANDS, horizonYears: 1e6,
    colorForRockType: () => '#e2683c',
    width: 400, height: 300, ...extra,
  });
  return { host, chart, svg: host.querySelector('svg') };
}

describe('answerSurfaceChart renders', () => {
  // The lesson from a NameError that shipped to the live site: unit tests on
  // the maths pass while the render path throws. These exercise the DOM.
  it('draws one dot per fragment', () => {
    const { svg } = render();
    expect(svg.querySelectorAll('.as-dot').length).toBe(14);
  });

  it('draws every contour and labels the ones on screen', () => {
    const { svg } = render();
    expect(svg.querySelectorAll('.as-contour').length).toBe(6);
    const labels = [...svg.querySelectorAll('.as-contour-label')].map(t => t.textContent);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.join(' ')).toContain('sterilised');
  });

  it('shades the published band as a strip with real height', () => {
    const { svg } = render();
    const band = svg.querySelector('.as-band');
    expect(band).toBeTruthy();
    expect(Number(band.getAttribute('height'))).toBeGreaterThan(4);
  });

  it('labels both axes with their units', () => {
    const { svg } = render();
    const labels = [...svg.querySelectorAll('.as-axis-label')].map(t => t.textContent);
    expect(labels).toContain('accumulated dose [Gy]');
    expect(labels).toContain('c_rad [1/Gy]');
  });

  it('rules a narrow log axis with minor ticks, not one lonely decade', () => {
    // The dose axis spans 0.8 of a decade. Decade ticks alone gave the whole
    // figure three labels.
    const { svg } = render();
    const ticks = [...svg.querySelectorAll('.as-tick-label')].map(t => t.textContent);
    expect(ticks.length).toBeGreaterThan(6);
    for (const t of ticks) expect(t).toMatch(/^(10[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+|[2359])$/);
    // Both axes must carry at least one power-of-ten anchor, or the minors
    // have nothing to be minor to.
    expect(ticks.filter(t => t.startsWith('10')).length).toBeGreaterThan(1);
  });

  it('puts the whole fragment record in the hover title', () => {
    const { svg } = render();
    const title = svg.querySelector('.as-pt title').textContent;
    expect(title).toContain('fragment');
    expect(title).toContain('c_rad');
    expect(title).toContain('N/N₀');
    expect(title).toMatch(/radius [\d.]+ mm/);
  });

  it('dims the swarm only once something is selected', () => {
    const { chart, svg } = render();
    expect(svg.classList.contains('as-has-sel')).toBe(false);
    chart.setSelected('asteroid_003');
    expect(svg.classList.contains('as-has-sel')).toBe(true);
    expect(svg.querySelector('[data-id="asteroid_003"]').classList.contains('as-pt--sel')).toBe(true);
    chart.setSelected(null);
    expect(svg.classList.contains('as-has-sel')).toBe(false);
  });

  it('reports the picked fragment so the whole dock can follow it', () => {
    const picked = [];
    const { svg } = render({ onPick: id => picked.push(id) });
    svg.querySelector('[data-id="asteroid_005"]').dispatchEvent(
      new window.MouseEvent('click', { bubbles: true }),
    );
    expect(picked).toEqual(['asteroid_005']);
  });

  it('moves the coefficient marker up as the coefficient rises', () => {
    const { chart, svg } = render();
    const marker = svg.querySelector('.as-current');
    expect(marker.getAttribute('visibility')).toBe('hidden');
    chart.setCoefficient(BANDS.cMin);
    const low = Number(marker.getAttribute('y1'));
    chart.setCoefficient(BANDS.cMax);
    const high = Number(marker.getAttribute('y1'));
    expect(marker.getAttribute('visibility')).toBe('visible');
    // Bigger coefficient means further up the axis, which is a smaller y.
    expect(high).toBeLessThan(low);
  });

  it('says so plainly rather than throwing on a replay with no dose', () => {
    document.body.innerHTML = '<div id="host"></div>';
    const host = document.getElementById('host');
    expect(() => answerSurfaceChart(host, { frames: [], bands: BANDS })).not.toThrow();
    expect(host.textContent).toContain('no dose data');
  });
});
