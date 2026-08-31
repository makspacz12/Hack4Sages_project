/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import sim from '../public/data/run_100kyr.json';
import {
  sizeDecidesData, sizeDecidesSummary, sizeDecidesChart, correlation,
  TRAVELLED_AU,
} from '../src/charts/sizeDecides.js';

const rows = sizeDecidesData(sim.frames);
const summary = sizeDecidesSummary(rows);

describe('the two relations the figure rests on', () => {
  it('measures a launch speed for every fragment', () => {
    expect(rows).toHaveLength(14);
    for (const r of rows) expect(r.speedKmS, r.id).toBeGreaterThan(0);
  });

  it('finds ejection speed falling as fragments get larger', () => {
    // The mechanism. Without this the figure has no story, only a coincidence
    // between two fragments' fates.
    expect(summary.speedCorrelation).toBeLessThan(-0.6);
    expect(summary.smallest.speedKmS).toBeGreaterThan(15);
    expect(summary.largest.speedKmS).toBeLessThan(6);
  });

  it('puts the launch speeds in a physically sane range', () => {
    // Mars escape velocity is 5.03 km/s; nothing here should be below it, and
    // a fragment above about 30 km/s would be leaving the Solar System.
    for (const r of rows) {
      expect(r.speedKmS, r.id).toBeGreaterThan(5);
      expect(r.speedKmS, r.id).toBeLessThan(30);
    }
  });

  it('finds that almost nothing actually goes anywhere', () => {
    expect(summary.travellers).toHaveLength(2);
    expect(summary.stayHomeMaxAU).toBeLessThan(TRAVELLED_AU);
    // The twelve that stay put never leave the region they were ejected into.
    expect(summary.stayHomeMaxAU).toBeGreaterThan(2);
  });

  it('finds the travellers are the smallest fragments in the swarm', () => {
    // rows are sorted small to large, so the travellers must be at the front.
    const travellerIds = new Set(summary.travellers.map(r => r.id));
    expect(new Set([rows[0].id, rows[1].id])).toEqual(travellerIds);
  });

  it('finds those same travellers destroyed by erosion', () => {
    expect(summary.travellersLost).toBe(2);
    for (const r of summary.travellers) {
      expect(r.endKyr, r.id).toBeLessThan(40);
    }
  });

  it('measures heliocentric distance from the Sun, not from the origin', () => {
    // The Sun is displaced from the origin by the giant planets. Measuring
    // from (0,0,0) is wrong by that displacement, which is not negligible
    // against a fragment sitting at 1 AU.
    const src = sizeDecidesData(sim.frames);
    const far = src.reduce((a, b) => (b.maxAU > a.maxAU ? b : a));
    expect(far.maxAU).toBeGreaterThan(40);
    expect(far.maxAU).toBeLessThan(50);
  });
});

describe('correlation', () => {
  it('is exactly 1 and -1 on perfect lines', () => {
    expect(correlation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 12);
    expect(correlation([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 12);
  });

  it('declines rather than dividing by zero on a flat series', () => {
    expect(correlation([1, 1, 1, 1], [2, 4, 6, 8])).toBeNull();
    expect(correlation([1, 2], [3, 4])).toBeNull();
  });
});

describe('the figure declines when it has nothing to compare', () => {
  it('makes no summary from a replay with no velocities', () => {
    const stripped = sim.frames.slice(0, 3).map(f => ({ ...f, velocities: [] }));
    expect(sizeDecidesData(stripped)).toEqual([]);
    expect(sizeDecidesSummary([])).toBeNull();
  });

  it('survives an empty replay', () => {
    expect(sizeDecidesData([])).toEqual([]);
    expect(sizeDecidesData(null)).toEqual([]);
  });
});

describe('the figure renders', () => {
  const draw = () => {
    const host = document.createElement('div');
    sizeDecidesChart(host, rows, { width: 300 });
    return host;
  };

  it('draws both panels, so every fragment appears twice', () => {
    const host = draw();
    const dots = [...host.querySelectorAll('circle')]
      .filter(c => c.getAttribute('fill') !== 'none');
    expect(dots).toHaveLength(rows.length * 2);
  });

  it('rings the travellers in both panels', () => {
    const host = draw();
    const rings = [...host.querySelectorAll('circle')]
      .filter(c => c.getAttribute('fill') === 'none');
    expect(rings).toHaveLength(summary.travellers.length * 2);
  });

  it('marks fate by fill, so it does not rest on colour alone', () => {
    const host = draw();
    const hollow = [...host.querySelectorAll('circle')]
      .filter(c => c.getAttribute('fill') === 'var(--bg-panel)');
    const destroyed = rows.filter(r => r.destroyed).length;
    expect(hollow).toHaveLength(destroyed * 2);
  });

  it('never uses two vertical scales in one panel', () => {
    // Two y axes would let the crossing point be chosen rather than measured.
    // Each panel rules exactly one vertical axis line.
    const host = draw();
    const verticals = [...host.querySelectorAll('line')]
      .filter(l => l.getAttribute('x1') === l.getAttribute('x2'));
    expect(verticals).toHaveLength(2);
  });

  it('names both quantities and the shared axis', () => {
    const text = draw().textContent;
    expect(text).toMatch(/ejection speed \[km\/s\]/);
    expect(text).toMatch(/how long the rock lasted \[kyr\]/);
    expect(text).toMatch(/fragment radius/);
  });

  it('puts the whole fragment record in the hover text', () => {
    const host = draw();
    const titles = [...host.querySelectorAll('title')].map(t => t.textContent);
    expect(titles.some(t => /Left Mars at .* km\/s, reached .* AU/.test(t)))
      .toBe(true);
    expect(titles.some(t => /destroyed at/.test(t))).toBe(true);
    expect(titles.some(t => /still intact at/.test(t))).toBe(true);
  });

  it('says so plainly rather than throwing on too few fragments', () => {
    const host = document.createElement('div');
    expect(sizeDecidesChart(host, [], {})).toBeNull();
    expect(host.textContent).toMatch(/no launch velocities/);
  });
});
