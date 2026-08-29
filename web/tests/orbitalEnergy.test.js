/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import {
  orbitalEnergySeries, fateCounts, SUN_MU_AU3_YR2,
} from '../src/charts/series.js';
import { doseBudget, doseBudgetRatio } from '../src/charts/doseModel.js';

/** A replay frame with one fragment at radius r moving at speed v. */
function frame(time, r, v, extra = {}) {
  return {
    time,
    positions: [{ id: 'sun', x: 0, y: 0, z: 0 }, { id: 'asteroid_001', x: r, y: 0, z: 0 }],
    velocities: [{ id: 'asteroid_001', vx: 0, vy: v, vz: 0 }],
    properties: [{ id: 'asteroid_001', population_fraction: 1, ...extra }],
  };
}

describe('orbitalEnergySeries', () => {
  it('puts a circular orbit at exactly half the potential', () => {
    // A circular orbit has v^2 = GM/r, so eps = GM/2r - GM/r = -GM/2r.
    const r = 2;
    const v = Math.sqrt(SUN_MU_AU3_YR2 / r);
    const [[, eps]] = orbitalEnergySeries([frame(0, r, v)]).get('asteroid_001');
    expect(eps).toBeCloseTo(-SUN_MU_AU3_YR2 / (2 * r), 10);
  });

  it('is exactly zero at escape speed, which is the whole point of the chart', () => {
    const r = 3;
    const v = Math.sqrt(2 * SUN_MU_AU3_YR2 / r);
    const [[, eps]] = orbitalEnergySeries([frame(0, r, v)]).get('asteroid_001');
    expect(Math.abs(eps)).toBeLessThan(1e-12);
  });

  it('changes sign above escape speed', () => {
    const r = 3;
    const fast = Math.sqrt(2 * SUN_MU_AU3_YR2 / r) * 1.01;
    const [[, eps]] = orbitalEnergySeries([frame(0, r, fast)]).get('asteroid_001');
    expect(eps).toBeGreaterThan(0);
  });

  it('skips a frame with no origin body rather than dividing by nothing', () => {
    const broken = { time: 0, positions: [], velocities: [], properties: [] };
    expect(() => orbitalEnergySeries([broken])).not.toThrow();
  });
});

describe('fateCounts', () => {
  it('counts a bound fragment as bound and never as arrived', () => {
    const frames = [frame(0, 2, Math.sqrt(SUN_MU_AU3_YR2 / 2))];
    const counts = fateCounts(orbitalEnergySeries(frames), frames, 0);
    expect(counts).toEqual({ bound: 1, unbound: 0, arrived: 0 });
  });

  it('reads arrival from the recorded status, not from the energy', () => {
    const frames = [frame(0, 2, Math.sqrt(SUN_MU_AU3_YR2 / 2), { status: 'arrived' })];
    const counts = fateCounts(orbitalEnergySeries(frames), frames, 0);
    expect(counts.arrived).toBe(1);
    expect(counts.bound).toBe(1);
  });
});

describe('doseBudget', () => {
  const frames = [
    { time: 0, properties: [{ gcr_local_flux: 1, radiation_decay_gy_per_year: 1e-4 }] },
    { time: 10, properties: [{ gcr_local_flux: 1, radiation_decay_gy_per_year: 1e-4 }] },
  ];

  it('integrates rate over the interval between frames', () => {
    const b = doseBudget(frames);
    expect(b.gcr.at(-1)).toEqual([10, 10]);
    expect(b.decay.at(-1)[1]).toBeCloseTo(1e-3, 12);
  });

  it('starts both channels at zero, because no time has passed yet', () => {
    const b = doseBudget(frames);
    expect(b.gcr[0]).toEqual([0, 0]);
    expect(b.decay[0]).toEqual([0, 0]);
  });

  it('reports the ratio the readout claims', () => {
    const r = doseBudgetRatio(doseBudget(frames));
    expect(r.ratio).toBeCloseTo(1e4, 6);
    // Share of the total, not the ratio to the other channel: the exact value
    // is 1e-3 / (10 + 1e-3) = 9.99900e-5, so 0.01% is a rounding of it, not
    // the number itself.
    expect(r.decayPercent).toBeCloseTo(0.0099990001, 9);
  });

  it('returns null rather than dividing by a dead channel', () => {
    expect(doseBudgetRatio({ gcr: [[0, 1]], decay: [[0, 0]] })).toBeNull();
  });

  it('gives the shipped replay the ratio the note advertises', async () => {
    const sim = (await import('../public/data/cosmos_visualizer_simulation.json')).default;
    const r = doseBudgetRatio(doseBudget(sim.frames));
    // Cosmic rays dominate internal U/Th/K decay by about four orders of
    // magnitude. If this ever falls below 100 the log axis is the wrong choice
    // and the "negligible channel" note is no longer true.
    expect(r.ratio).toBeGreaterThan(1000);
    expect(r.decayPercent).toBeLessThan(0.1);
  });
});

// The hover tooltip is the only place a fragment's own sampled coefficient
// reaches the reader, so it is worth asserting on the rendered DOM rather than
// on the string that feeds it. A unit test on the label alone would still have
// passed when the field was silently unused.
describe('fragment tooltips carry the sampled coefficient', () => {
  it('names the rock type and c_rad on hover', async () => {
    const { liveLinePlot } = await import('../src/charts/plot.js');
    document.body.innerHTML = '<div id="host" style="width:400px"></div>';
    const host = document.getElementById('host');
    const chart = liveLinePlot(host, {
      series: [{
        color: '#e2683c', pickId: 'asteroid_001',
        label: 'fragment 001 \u00b7 hydrated_silicate \u00b7 c_rad 4.15e-4 1/Gy',
        points: [[0, 1], [10, 0.9], [20, 0.8]],
      }],
      xLabel: 'time', yLabel: 'N / N0', height: 200, width: 400,
    });
    // Hover only searches the drawn part of the curve, so the replay has to
    // have advanced past frame 0 before there is anything to hit.
    chart.update(2);
    const svg = host.querySelector('svg');
    // The chart measures the SVG, not the hit rect, and listens for
    // pointermove rather than mousemove; jsdom reports a zero-sized box, so the
    // measurement has to be supplied.
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 });
    const hit = svg.querySelector('rect[fill="transparent"]');
    // Middle of the plot area: the midpoint of the curve in both axes.
    hit.dispatchEvent(new window.MouseEvent('pointermove', {
      bubbles: true, clientX: 223, clientY: 87,
    }));
    const tip = host.querySelector('.tooltip');
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toContain('c_rad 4.15e-4 1/Gy');
    expect(tip.textContent).toContain('hydrated_silicate');
  });
});
