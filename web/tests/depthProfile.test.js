/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import {
  depthAtFraction, depthProfileChart, parseDepthProfile, penetrationRatio,
} from '../src/charts/depthProfile.js';

// Exponential attenuation with the project's real coefficients at 3460 kg/m^3:
// photons 1/e at ~0.029 m, cosmic rays at ~0.462 m.
const PHOTON_DEPTH = 0.0289;
const COSMIC_DEPTH = 0.4624;
const SAMPLES = Array.from({ length: 21 }, (_, i) => {
  const depth = (0.5 * i) / 20;
  return {
    depth_m: depth,
    radius_fraction: 1 - i / 20,
    photon_fraction: Math.exp(-depth / PHOTON_DEPTH),
    cosmic_ray_fraction: Math.exp(-depth / COSMIC_DEPTH),
  };
});
const PAYLOAD = {
  dose_depth_profile: {
    rock_type: 'basalt_vtype',
    rock_radius_m: 0.5,
    bio_radius_m: 0.1,
    density_kg_m3: 3460,
    photon_attenuation_depth_m: PHOTON_DEPTH,
    cosmic_ray_attenuation_depth_m: COSMIC_DEPTH,
    samples: SAMPLES,
  },
};

describe('parseDepthProfile', () => {
  it('reads a profile out of a replay', () => {
    const p = parseDepthProfile(PAYLOAD);
    expect(p.samples).toHaveLength(21);
    expect(p.rockRadius).toBe(0.5);
  });

  it('returns null for a replay that predates the profile', () => {
    expect(parseDepthProfile({ frames: [] })).toBeNull();
    expect(parseDepthProfile(null)).toBeNull();
    expect(parseDepthProfile({ dose_depth_profile: { samples: [] } })).toBeNull();
  });
});

describe('penetrationRatio', () => {
  it('reports how much deeper cosmic rays reach', () => {
    expect(penetrationRatio(parseDepthProfile(PAYLOAD))).toBeCloseTo(16, 0);
  });

  it('is null when a depth is missing', () => {
    expect(penetrationRatio({ photonDepth: null, cosmicDepth: 1 })).toBeNull();
  });
});

describe('depthAtFraction', () => {
  const p = parseDepthProfile(PAYLOAD);

  it('recovers the 1/e depth of each channel', () => {
    expect(depthAtFraction(p.samples, 'photon', Math.exp(-1)))
      .toBeCloseTo(PHOTON_DEPTH, 3);
    expect(depthAtFraction(p.samples, 'cosmic', Math.exp(-1)))
      .toBeCloseTo(COSMIC_DEPTH, 2);
  });

  it('interpolates in log space, not linearly', () => {
    // Halfway between two decades in log space is sqrt(10) times the lower,
    // not five times it. A linear interpolant would land elsewhere.
    const samples = [
      { depth: 0, photon: 1 },
      { depth: 2, photon: 0.01 },
    ];
    expect(depthAtFraction(samples, 'photon', 0.1)).toBeCloseTo(1.0, 9);
  });

  it('returns null when the target is never crossed', () => {
    expect(depthAtFraction(p.samples, 'photon', 2)).toBeNull();
    expect(depthAtFraction(p.samples, 'photon', 0)).toBeNull();
  });
});

describe('depthProfileChart', () => {
  const render = (profile) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    depthProfileChart(host, profile);
    return host;
  };

  it('draws one path per channel', () => {
    const host = render(parseDepthProfile(PAYLOAD));
    expect(host.querySelectorAll('path[data-channel]')).toHaveLength(2);
  });

  it('says so instead of throwing when there is no profile', () => {
    const host = render(null);
    expect(host.textContent).toContain('no depth profile');
    expect(host.querySelector('svg')).toBeNull();
  });

  it('marks the biological core boundary', () => {
    const host = render(parseDepthProfile(PAYLOAD));
    expect(host.textContent).toContain('biological core');
  });

  it('labels both channels', () => {
    const host = render(parseDepthProfile(PAYLOAD));
    expect(host.textContent).toContain('cosmic rays');
    expect(host.textContent).toContain('stellar photons');
  });

  it('carries an accessible description with the real numbers', () => {
    const host = render(parseDepthProfile(PAYLOAD));
    const label = host.querySelector('svg').getAttribute('aria-label');
    expect(label).toContain('0.029');
    expect(label).toContain('0.462');
  });

  it('survives a channel whose values underflow to zero', () => {
    const zeroed = JSON.parse(JSON.stringify(PAYLOAD));
    zeroed.dose_depth_profile.samples.forEach(s => { s.photon_fraction = 0; });
    const host = render(parseDepthProfile(zeroed));
    // The photon curve cannot be drawn on a log axis, the other still can.
    expect(host.querySelectorAll('path[data-channel]')).toHaveLength(1);
  });
});
