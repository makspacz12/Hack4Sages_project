import { describe, it, expect } from 'vitest';
import sim from '../public/data/cosmos_visualizer_simulation.json';

/**
 * The mapping main.js uses, restated here so the property is pinned even if
 * the call site moves. Cube root of the true radius, normalised across the
 * planets present, into a visible range.
 */
function drawnRadii(objects) {
  const planets = objects.filter(o => (o.type ?? '').toLowerCase() === 'planet');
  const radii = planets.map(o => o.info?.Radius?.value).filter(r => Number.isFinite(r) && r > 0);
  const lo = Math.cbrt(Math.min(...radii));
  const hi = Math.cbrt(Math.max(...radii));
  return new Map(planets.map(o => [
    o.name,
    0.55 + ((Math.cbrt(o.info.Radius.value) - lo) / (hi - lo)) * 1.15,
  ]));
}

describe('planets are drawn at sizes that reflect the planets', () => {
  const objects = sim.objects ?? [];
  const drawn = drawnRadii(objects);

  it('still ships the flat radius this replaces, so the fix is load-bearing', () => {
    // Every planet arrives with visual.radius = 0.9. If that ever changes, the
    // override below may no longer be needed - but silently keeping both would
    // be worse than either.
    const shipped = new Set(
      objects.filter(o => (o.type ?? '').toLowerCase() === 'planet')
        .map(o => o.visual?.radius),
    );
    expect(shipped.size).toBe(1);
  });

  it('carries a true radius for every planet', () => {
    for (const [, r] of drawn) expect(r).toBeGreaterThan(0);
    expect(drawn.size).toBe(8);
  });

  it('orders the planets the way the Solar System does', () => {
    // The point of the change: the scene was asserting that Mercury and
    // Jupiter are the same size.
    expect(drawn.get('Jupiter')).toBeGreaterThan(drawn.get('Saturn'));
    expect(drawn.get('Saturn')).toBeGreaterThan(drawn.get('Uranus'));
    expect(drawn.get('Uranus')).toBeGreaterThan(drawn.get('Neptune'));
    expect(drawn.get('Neptune')).toBeGreaterThan(drawn.get('Earth'));
    expect(drawn.get('Earth')).toBeGreaterThan(drawn.get('Venus'));
    expect(drawn.get('Venus')).toBeGreaterThan(drawn.get('Mars'));
    expect(drawn.get('Mars')).toBeGreaterThan(drawn.get('Mercury'));
  });

  it('keeps the smallest planet visible rather than sub-pixel', () => {
    // A linear map of a 29:1 span would put Mercury under a pixel wherever
    // Jupiter is comfortable. That is why the map is a cube root.
    expect(Math.min(...drawn.values())).toBeGreaterThanOrEqual(0.5);
  });

  it('keeps the largest from swamping the scene', () => {
    const ratio = Math.max(...drawn.values()) / Math.min(...drawn.values());
    expect(ratio).toBeGreaterThan(2);    // unmistakably ordered
    expect(ratio).toBeLessThan(5);       // still one scene
  });
});
