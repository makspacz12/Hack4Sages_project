/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { ROCK_SURFACE, describeSurface, fragmentTexture } from '../src/fragmentTexture.js';
import sim from '../public/data/cosmos_visualizer_simulation.json';

describe('fragment surfaces are derived from measured properties', () => {
  it('covers every rock type the swarm actually contains', () => {
    // A missing type would silently fall back to a flat colour, which is a
    // safe failure but an invisible one.
    const inSwarm = new Set(
      (sim.frames ?? []).flatMap(f => (f.properties ?? []).map(p => p.rock_type)).filter(Boolean),
    );
    for (const type of inSwarm) {
      expect(ROCK_SURFACE[type], `no surface for ${type}`).toBeTruthy();
    }
  });

  it('matches the catalogued albedos, which is where the brightness comes from', () => {
    // These are the values in the model's rock catalogue. If the catalogue
    // changes, the surfaces must follow it rather than drifting into
    // decoration.
    expect(ROCK_SURFACE.ci_chondrite.albedo).toBeCloseTo(0.045, 6);
    expect(ROCK_SURFACE.rubble_pile.albedo).toBeCloseTo(0.283, 6);
    expect(ROCK_SURFACE.iron_nickel.density).toBe(4172);
    expect(ROCK_SURFACE.ice_rich.water).toBeCloseTo(0.35, 6);
  });

  it('orders brightness the way the albedos do', () => {
    // The darkest material in the catalogue must not render brighter than the
    // brightest, or the encoding is telling the opposite of the physics.
    const entries = Object.entries(ROCK_SURFACE);
    const darkest = entries.reduce((a, b) => (a[1].albedo <= b[1].albedo ? a : b));
    const brightest = entries.reduce((a, b) => (a[1].albedo >= b[1].albedo ? a : b));
    expect(darkest[0]).toBe('cm_chondrite');
    expect(brightest[0]).toBe('rubble_pile');
    expect(darkest[1].albedo).toBeLessThan(brightest[1].albedo);
  });

  it('is deterministic, so two screenshots of one fragment agree', () => {
    // A texture reseeded per load would make a figure irreproducible.
    const a = fragmentTexture('ice_rich');
    const b = fragmentTexture('ice_rich');
    expect(a).toBe(b);
  });

  it('refuses an unknown rock rather than inventing properties for it', () => {
    expect(fragmentTexture('not_a_rock')).toBeNull();
    expect(fragmentTexture(null)).toBeNull();
    expect(describeSurface('not_a_rock')).toBeNull();
  });

  it('can state the numbers behind any surface it draws', () => {
    const text = describeSurface('ci_chondrite');
    expect(text).toContain('0.045');
    expect(text).toContain('porosity');
    expect(text).toContain('water');
  });
});
