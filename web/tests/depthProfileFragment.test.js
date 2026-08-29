import { describe, it, expect } from 'vitest';
import {
  parseDepthProfile, profileForFragment, fragmentDensity, depthAtFraction,
} from '../src/charts/depthProfile.js';
import sim from '../public/data/cosmos_visualizer_simulation.json';

const base = parseDepthProfile(sim);
const props = sim.frames[5].properties.filter(p => p.rock_type);
const byId = id => props.find(p => p.id === id);

describe('fragmentDensity', () => {
  it('recovers a density that is constant within a rock type', () => {
    // Three separate hydrated-silicate fragments of different sizes. If the
    // recovery were approximate these would drift apart; they do not.
    const rhos = props
      .filter(p => p.rock_type === 'hydrated_silicate')
      .map(fragmentDensity);
    expect(rhos.length).toBeGreaterThan(1);
    for (const r of rhos) expect(r).toBeCloseTo(rhos[0], 6);
  });

  it('puts iron-nickel densest and CI chondrite least dense, as the minerals require', () => {
    const iron = fragmentDensity(props.find(p => p.rock_type === 'iron_nickel'));
    const ci = fragmentDensity(props.find(p => p.rock_type === 'ci_chondrite'));
    expect(iron).toBeGreaterThan(4000);
    expect(ci).toBeLessThan(1500);
  });

  it('returns null rather than a nonsense density for a massless record', () => {
    expect(fragmentDensity({ radius: 1, mass: 0 })).toBeNull();
    expect(fragmentDensity({})).toBeNull();
  });
});

describe('profileForFragment', () => {
  it('is a single exponential outside the core and provably not inside it', () => {
    // Both halves matter to the reconstruction. Outside the core it relies on
    // the curve being exp(-depth / Lambda_rock); inside it relies on the
    // opposite. An earlier version of profileForFragment assumed one
    // exponential all the way in - it matched to twelve digits near the
    // surface and was wrong by a quarter at the centre.
    const shell = base.rockRadius - base.bioRadius;
    const outside = base.samples.filter(s => s.depth <= shell);
    expect(outside.length).toBeGreaterThan(1);
    for (const s of outside) {
      expect(s.cosmic).toBeCloseTo(Math.exp(-s.depth / base.cosmicDepth), 12);
      expect(s.photon).toBeCloseTo(Math.exp(-s.depth / base.photonDepth), 12);
    }
    const centre = base.samples.at(-1);
    // The core is lighter than the rock, so it attenuates less and the true
    // centre sits ABOVE the single-exponential extrapolation.
    expect(centre.cosmic).toBeGreaterThan(Math.exp(-centre.depth / base.cosmicDepth));
  });

  it('reproduces the exported curve when handed the exported stone', () => {
    // The rescaling must be an identity at the reference density, or every
    // other number it produces is suspect.
    const same = profileForFragment(base, {
      radius: base.rockRadius,
      mass: base.density * (4 / 3) * Math.PI * base.rockRadius ** 3,
    });
    expect(same.photonDepth).toBeCloseTo(base.photonDepth, 12);
    expect(same.cosmicDepth).toBeCloseTo(base.cosmicDepth, 12);
    // Same grid as the exporter, so the curves compare point for point.
    expect(same.samples.length).toBe(base.samples.length);
    same.samples.forEach((s, i) => {
      expect(s.depth).toBeCloseTo(base.samples[i].depth, 12);
      expect(s.cosmic).toBeCloseTo(base.samples[i].cosmic, 12);
      expect(s.photon).toBeCloseTo(base.samples[i].photon, 12);
    });
  });

  it('lengthens the attenuation depth in a less dense rock, exactly as 1/rho', () => {
    const ci = byId('asteroid_008');           // CI chondrite, ~1190 kg/m3
    const p = profileForFragment(base, ci);
    expect(p.cosmicDepth).toBeCloseTo(base.cosmicDepth * base.density / p.density, 12);
    expect(p.cosmicDepth).toBeGreaterThan(base.cosmicDepth);
  });

  it('shortens it in iron-nickel, which is denser than the reference', () => {
    const p = profileForFragment(base, byId('asteroid_002'));
    expect(p.cosmicDepth).toBeLessThan(base.cosmicDepth);
  });

  it('finds the whole swarm essentially unshielded, and says so', () => {
    // A real result, not a broken assertion. The ejecta size distribution is a
    // truncated power law from 1 mm with q = 2, so the median fragment is 2 mm
    // and you expect 0.14 fragments above 10 cm in a swarm of fourteen. The
    // cosmic-ray attenuation length is 0.46 m in the reference rock and longer
    // in the lighter ones, so every fragment here is far smaller than the
    // shielding it would need. Rock does not protect this swarm.
    for (const prop of props) {
      const centre = profileForFragment(base, prop).samples.at(-1).cosmic;
      expect(centre).toBeGreaterThan(0.9);
    }
  });

  it('still orders the fragments by size, which is the whole claim of the figure', () => {
    const sorted = [...props].sort((a, b) => a.radius - b.radius);
    const centres = sorted.map(p => profileForFragment(base, p).samples.at(-1).cosmic);
    // Density varies between rock types, so the ordering is not strict across
    // the whole swarm; the extremes are what the figure has to get right.
    expect(centres.at(0)).toBeGreaterThan(centres.at(-1));
  });

  it('starts every curve at unity at the surface', () => {
    for (const prop of props) {
      const p = profileForFragment(base, prop);
      expect(p.samples[0].depth).toBe(0);
      expect(p.samples[0].photon).toBeCloseTo(1, 12);
      expect(p.samples[0].cosmic).toBeCloseTo(1, 12);
    }
  });

  it('ends each curve at the fragment\'s own radius, not the reference radius', () => {
    for (const prop of props) {
      const p = profileForFragment(base, prop);
      expect(p.samples.at(-1).depth).toBeCloseTo(prop.radius, 12);
      expect(p.rockRadius).toBeCloseTo(prop.radius, 12);
    }
  });

  it('keeps the biological core as a share of the stone, so it scales with it', () => {
    const frac = base.bioRadius / base.rockRadius;
    const p = profileForFragment(base, byId('asteroid_005'));
    expect(p.bioRadius / p.rockRadius).toBeCloseTo(frac, 12);
  });

  it('falls back to the reference rather than throwing on a bad record', () => {
    expect(profileForFragment(base, null)).toBe(base);
    expect(profileForFragment(base, { radius: 0, mass: 0 })).toBe(base);
    expect(profileForFragment(null, byId('asteroid_001'))).toBeNull();
  });

  it('describes a stone that is actually in the swarm', () => {
    // The bug this replaces: the exported profile is a 0.5 m stone at
    // 3460 kg/m3, and no fragment in the run is anywhere near it.
    const radii = props.map(p => p.radius);
    expect(radii).not.toContain(base.rockRadius);
    for (const prop of props) {
      expect(profileForFragment(base, prop).rockRadius).toBe(prop.radius);
    }
  });
});
