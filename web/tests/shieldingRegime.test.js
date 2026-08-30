/**
 * What the swarm can and cannot claim about shielding.
 *
 * This is the model's most important limitation, and it is arithmetic rather
 * than opinion. Galactic cosmic rays attenuate with a characteristic column
 * density of about 96 g/cm2, which at meteoritic density (~3 g/cm3) is roughly
 * 0.33 m of rock. The bundled fragments span 1.3 to 57.5 mm in radius, i.e.
 * 0.4 to 17 g/cm2 - a few percent of one attenuation length.
 *
 * So the run shows what an essentially UNSHIELDED fragment experiences. That
 * is a legitimate thing to compute, and it is the regime Mileikowsky et al.
 * (2000) place at 12-15 Myr survival for bodies under 3 cm. It is not a
 * metre-class boulder, which is what their 1 Myr-behind-1 m figure describes,
 * and the two must not be confused when the result is quoted.
 */

import { describe, it, expect } from 'vitest';
import sim from '../public/data/cosmos_visualizer_simulation.json';

/** Column density along a radius, in g/cm2, for a radius in metres. */
function columnDensity(radiusM, densityKgM3 = 3000) {
  return radiusM * 100 * (densityKgM3 / 1000);
}

/** Fraction of the cosmic-ray flux reaching the core. */
function transmitted(radiusM, attenuationGcm2 = 96) {
  return Math.exp(-columnDensity(radiusM) / attenuationGcm2);
}

describe('the shielding regime of the bundled swarm', () => {
  const radii = (() => {
    const out = new Map();
    for (const f of sim.frames) {
      for (const p of f.properties ?? []) {
        if (p?.id?.startsWith('asteroid_') && p.radius > 0 && !out.has(p.id)) {
          out.set(p.id, p.radius);
        }
      }
    }
    return [...out.values()].sort((a, b) => a - b);
  })();

  it('covers the millimetre-to-centimetre range, not the metre range', () => {
    expect(radii).toHaveLength(14);
    expect(radii[0]).toBeGreaterThan(0.001);
    expect(radii.at(-1)).toBeLessThan(0.1);
  });

  it('leaves even the largest fragment essentially transparent', () => {
    // 57.5 mm transmits about 84% of the flux to its core.
    const best = transmitted(radii.at(-1));
    expect(best).toBeGreaterThan(0.8);
  });

  it('leaves the smallest fragment completely transparent', () => {
    expect(transmitted(radii[0])).toBeGreaterThan(0.99);
  });

  it('would need roughly a metre before shielding matters', () => {
    // The comparison that makes the limitation concrete: a 1 m boulder stops
    // 95% of what reaches this swarm's largest stone.
    expect(transmitted(1.0)).toBeLessThan(0.06);
    expect(transmitted(0.5)).toBeLessThan(0.25);
  });

  it('states the limitation where a reader will meet it', async () => {
    const { readFile } = await import('node:fs/promises');
    const help = await readFile(new URL('../src/ui/paramHelp.js', import.meta.url), 'utf8');
    // The parameter that controls size must say the swarm is unshielded, not
    // leave the reader to work it out.
    expect(help).toMatch(/essentially unshielded/i);
    expect(help).toMatch(/96 g\/cm2/);
  });
});
