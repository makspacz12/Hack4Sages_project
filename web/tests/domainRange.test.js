import { describe, expect, it } from 'vitest';
import { domainAwareRange } from '../src/charts/plot.js';

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
