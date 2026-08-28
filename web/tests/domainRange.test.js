/**
 * @vitest-environment jsdom
 *
 * The suite runs in node by default, which is why no chart had ever been
 * rendered by a test - and why a ReferenceError in the render path shipped.
 */
import { describe, expect, it } from 'vitest';
import { domainAwareRange, liveLinePlot } from '../src/charts/plot.js';

describe('domainAwareRange', () => {
  it('shows the full scale when a survival curve is essentially flat', () => {
    // The bundled replay: 1.000000 down to 0.999457 over 2.5 years.
    expect(domainAwareRange([0.999457, 1.0], [0, 1])).toEqual([0, 1]);
  });

  it('lets real change fill the chart', () => {
    // A run where most of the population dies must not be flattened.
    expect(domainAwareRange([0.05, 1.0], [0, 1])).toBeNull();
  });

  it('switches over at the stated threshold', () => {
    expect(domainAwareRange([0.98, 1.0], [0, 1], 0.02)).toBeNull();
    expect(domainAwareRange([0.985, 1.0], [0, 1], 0.02)).toEqual([0, 1]);
  });

  it('does nothing for a quantity with no natural domain', () => {
    // Distance and speed are unbounded above; they must keep autoscaling.
    expect(domainAwareRange([1.428, 1.429], undefined)).toBeNull();
    expect(domainAwareRange([1.428, 1.429], null)).toBeNull();
  });

  it('ignores a degenerate domain rather than dividing by zero', () => {
    expect(domainAwareRange([0.5, 0.5], [1, 1])).toBeNull();
    expect(domainAwareRange([0.5, 0.5], [1, 0])).toBeNull();
  });

  it('handles a completely constant series', () => {
    expect(domainAwareRange([1.0, 1.0], [0, 1])).toEqual([0, 1]);
  });
});

describe('liveLinePlot renders with a domain', () => {
  // The unit tests above passed while the chart was throwing
  // "ReferenceError: config is not defined" on every page load, because they
  // only exercised the pure function. These render the real thing.
  const flat = [{
    name: 'swarm mean',
    points: [[0, 1.0], [1, 0.9997], [2, 0.999457]],
  }];

  function render(options) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const chart = liveLinePlot(host, { series: flat, ...options });
    chart.update(2);
    return host;
  }

  it('renders without throwing when a domain is given', () => {
    const host = render({ yDomain: [0, 1] });
    expect(host.querySelector('svg')).toBeTruthy();
    expect(host.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('renders without throwing when no domain is given', () => {
    const host = render({});
    expect(host.querySelector('svg')).toBeTruthy();
  });

  it('labels the axis over the full domain, not the data range', () => {
    const labels = [...render({ yDomain: [0, 1], yFormat: v => v.toFixed(2) })
      .querySelectorAll('text')].map(t => t.textContent);
    // Must show the real scale, never zoom into the fifth decimal.
    expect(labels).toContain('0.00');
    expect(labels.some(l => l.startsWith('0.9994'))).toBe(false);
  });

  it('still autoscales a quantity that has no natural domain', () => {
    const labels = [...render({ yDomain: null, yFormat: v => v.toFixed(4) })
      .querySelectorAll('text')].map(t => t.textContent);
    expect(labels).not.toContain('0.0000');
  });
});
