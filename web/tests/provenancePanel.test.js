/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import {
  parseProvenance, provenancePanel, shortHash, trustSummary,
} from '../src/charts/provenancePanel.js';

const CLEAN = {
  provenance: {
    parameters_sha256: '6501f241e70c6a0612fe2de9aa11bb22cc33dd44ee55ff6677889900aabbccdd',
    seed: 20260829,
    generated_utc: '2026-08-29T00:00:00Z',
    reproduce: 'python -m microbe_radiation_model --asteroids 14 --seed 20260829',
    source: { commit: '23bb77ed15ce4455', dirty: false },
    coefficients_under_audit: {
      unresolved_count: 0,
      entries: {
        internal_dose_coefficients: { status: 'resolved', source: 'Cresswell et al. 2018' },
        hydrolysis: { status: 'resolved', source: 'Lindahl & Nyberg 1972' },
      },
    },
  },
};

const messy = (over) => ({
  provenance: {
    ...CLEAN.provenance,
    source: { commit: 'deadbeef', dirty: true },
    coefficients_under_audit: {
      unresolved_count: 1,
      entries: {
        hydrolysis_survival_coefficient: {
          status: 'unresolved', issue: 'Hard-coded as 1.2/0.001 with no cited source.',
        },
        ...over,
      },
    },
  },
});

describe('parseProvenance', () => {
  it('reads the record out of a replay', () => {
    const p = parseProvenance(CLEAN);
    expect(p.seed).toBe(20260829);
    expect(p.dirty).toBe(false);
    expect(p.coefficients).toHaveLength(2);
  });

  it('returns null for a replay that carries none', () => {
    expect(parseProvenance({ frames: [] })).toBeNull();
    expect(parseProvenance(null)).toBeNull();
  });

  it('marks an overridden coefficient distinctly from a cited one', () => {
    const p = parseProvenance(messy({
      cosmic_ray_attenuation: { status: 'overridden', overridden_run: true },
    }));
    const c = p.coefficients.find(x => x.id === 'cosmic_ray_attenuation');
    expect(c.overridden).toBe(true);
  });
});

describe('trustSummary', () => {
  it('a dirty tree outranks an uncited coefficient', () => {
    // The commit not describing the code that ran is worse than a known gap.
    const both = trustSummary(parseProvenance(messy({})));
    expect(both.level).toBe('bad');
    expect(both.text).toContain('uncommitted');
  });

  it('reports uncited coefficients when the tree is clean', () => {
    const p = parseProvenance(CLEAN);
    p.dirty = false;
    p.unresolved = 2;
    const t = trustSummary(p);
    expect(t.level).toBe('warn');
    expect(t.text).toContain('2 coefficients');
  });

  it('says so when everything is in order', () => {
    expect(trustSummary(parseProvenance(CLEAN)).level).toBe('ok');
  });

  it('handles a replay with no record at all', () => {
    expect(trustSummary(null).level).toBe('none');
  });

  it('gets the plural right for a single coefficient', () => {
    const p = parseProvenance(CLEAN);
    p.unresolved = 1;
    expect(trustSummary(p).text).toContain('1 coefficient still');
  });
});

describe('shortHash', () => {
  it('shortens to a comparable prefix', () => {
    expect(shortHash('abcdef0123456789', 8)).toBe('abcdef01');
  });

  it('shows a dash rather than "undefined"', () => {
    expect(shortHash(undefined)).toBe('—');
    expect(shortHash('')).toBe('—');
  });
});

describe('provenancePanel', () => {
  const render = (payload) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    provenancePanel(host, payload);
    return host;
  };

  it('shows the verdict without being expanded', () => {
    const host = render(CLEAN);
    expect(host.textContent).toContain('every coefficient cited');
    expect(host.querySelector('.pv-body').hidden).toBe(true);
  });

  it('warns visibly about an uncommitted tree', () => {
    expect(render(messy({})).textContent).toContain('uncommitted');
  });

  it('reveals the digest and the reproduce command on demand', () => {
    const host = render(CLEAN);
    host.querySelector('.pv-toggle').click();
    expect(host.querySelector('.pv-body').hidden).toBe(false);
    expect(host.textContent).toContain('6501f241e70c6a06');
    expect(host.textContent).toContain('--seed 20260829');
  });

  it('names the uncited coefficient and why', () => {
    const host = render(messy({}));
    host.querySelector('.pv-toggle').click();
    expect(host.textContent).toContain('hydrolysis survival coefficient');
    expect(host.textContent).toContain('no cited source');
  });

  it('renders without throwing when there is no provenance', () => {
    const host = render({ frames: [] });
    expect(host.textContent).toContain('no provenance');
    expect(host.querySelector('.pv')).toBeTruthy();
  });
});
