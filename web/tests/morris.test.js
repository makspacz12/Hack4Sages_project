import { describe, it, expect } from 'vitest';
import {
  parseMorris, classify, changesSign, significant, oatExploredFraction, RATIO_LINES,
} from '../src/charts/morris.js';
import raw from '../public/data/morris_sample.json';

const m = parseMorris(raw);

describe('oatExploredFraction', () => {
  it('reproduces the two values Saltelli & Annoni print explicitly', () => {
    // "r(2) = pi(1/2)^2 ~ 0.78 ... r(3) = (4pi/3)(1/2)^3 ~ 0.52"
    expect(oatExploredFraction(2)).toBeCloseTo(Math.PI / 4, 12);
    expect(oatExploredFraction(3)).toBeCloseTo(Math.PI / 6, 12);
    expect(oatExploredFraction(2)).toBeCloseTo(0.785, 3);
    expect(oatExploredFraction(3)).toBeCloseTo(0.524, 3);
  });

  it('reproduces the twelve-dimensional figure from the same paper', () => {
    // "in 12 dimensions ... r = 0.000326, less than one-thousandth"
    expect(oatExploredFraction(12)).toBeCloseTo(3.26e-4, 6);
  });

  it('agrees with what the model wrote into the file for this run', () => {
    expect(oatExploredFraction(m.factors.length)).toBeCloseTo(m.oatFraction, 12);
  });

  it('collapses towards nothing as dimensions are added', () => {
    expect(oatExploredFraction(18)).toBeLessThan(1e-6);
    for (let k = 2; k < 20; k += 1) {
      expect(oatExploredFraction(k + 1)).toBeLessThan(oatExploredFraction(k));
    }
  });

  it('refuses a dimension that is not a positive integer', () => {
    expect(oatExploredFraction(0)).toBeNull();
    expect(oatExploredFraction(2.5)).toBeNull();
  });
});

describe('parseMorris', () => {
  it('reads the shipped screening', () => {
    expect(m).not.toBeNull();
    expect(m.factors.length).toBe(8);
    expect(m.evaluations).toBe(m.trajectories * (m.factors.length + 1));
  });

  it('sorts by influence, most influential first', () => {
    for (let i = 1; i < m.factors.length; i += 1) {
      expect(m.factors[i - 1].muStar).toBeGreaterThanOrEqual(m.factors[i].muStar);
    }
  });

  it('computes SEM as sigma over root r, which is Morris\'s own definition', () => {
    for (const f of m.factors) {
      expect(f.sem).toBeCloseTo(f.sigma / Math.sqrt(m.trajectories), 12);
    }
  });

  it('rejects a file that is not a Morris screening', () => {
    expect(parseMorris(null)).toBeNull();
    expect(parseMorris({ kind: 'tornado' })).toBeNull();
    expect(parseMorris({ kind: 'morris_screening' })).toBeNull();
  });
});

describe('what the screening actually says about this model', () => {
  const byId = id => m.factors.find(f => f.id === id);

  it('ranks the radiation coefficient among the top two', () => {
    const top = m.factors.slice(0, 2).map(f => f.id);
    expect(top).toContain('radiation_surv_coeff');
  });

  it('finds hydrolysis alive, which it was not before the freezing cut was removed', () => {
    // Both hydrolysis knobs used to sit at exactly 0.0 because water activity
    // was cut to zero below 273.15 K, making the whole channel dead.
    expect(byId('hydrolysis_ea').muStar).toBeGreaterThan(0);
    expect(byId('hydrolysis_surv_coeff').muStar).toBeGreaterThan(0);
  });

  it('finds fragment radius nearly irrelevant, as the unshielded swarm implies', () => {
    // Consistent with corr(log radius, log dose) = -0.61 and every fragment
    // being far smaller than an attenuation length.
    expect(byId('radius_max').muStar).toBeLessThan(1e-5);
  });
});

describe('classify', () => {
  it('uses the three slopes Garcia Sanchez et al. define', () => {
    expect(RATIO_LINES.map(r => r.ratio)).toEqual([0.1, 0.5, 1]);
    expect(classify({ ratio: 0.05 })).toBe('linear and additive');
    expect(classify({ ratio: 0.3 })).toBe('monotonic');
    expect(classify({ ratio: 0.7 })).toBe('almost monotonic');
    expect(classify({ ratio: 1.4 })).toBe('non-linear or interacting');
    expect(classify({ ratio: null })).toBe('no measured effect');
  });
});

describe('changesSign', () => {
  it('is false when every effect pushes the same way', () => {
    expect(changesSign({ muStar: 0.04, mu: -0.04 })).toBe(false);
    expect(changesSign({ muStar: 0.04, mu: 0.04 })).toBe(false);
  });

  it('is true when the signed mean is cancelled out', () => {
    expect(changesSign({ muStar: 0.04, mu: 0.001 })).toBe(true);
  });

  it('finds exactly one factor in this run whose effect flips', () => {
    // Only the least influential factor of the eight, fragment radius, pushes
    // both ways: |mu|/mu* = 0.75. Every other factor is strictly monotone to
    // within 0.04%, which is worth knowing - a screening where nothing changes
    // sign is one where a signed ranking would have been adequate, and the
    // exception is the factor that matters least.
    // Called with an arrow, not passed by reference: Array.filter supplies
    // the index as the second argument, which would land in `tolerance`.
    const flipping = m.factors.filter(f => changesSign(f)).map(f => f.id);
    expect(flipping).toEqual(['radius_max']);
  });
});

describe('significant', () => {
  it('applies the wedge to the SIGNED mean, as Morris does', () => {
    expect(significant({ mu: 1, sem: 0.1 })).toBe(true);
    expect(significant({ mu: 0.1, sem: 1 })).toBe(false);
    expect(significant({ mu: 1, sem: null })).toBeNull();
  });

  it('clears the top-ranked factor and not the bottom-ranked one', () => {
    expect(significant(m.factors[0])).toBe(true);
    expect(significant(m.factors.at(-1))).toBe(false);
  });
});
