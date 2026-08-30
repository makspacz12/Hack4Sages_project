/**
 * The fragment surfaces encode measured properties, so they must stay legible
 * as measurements.
 *
 * Two failures this guards against, both of which looked fine in a screenshot:
 *
 * The albedo mapping was 0.28 + albedo * 1.5. The large constant floor swamped
 * the differences: a real 6.4x span from CM chondrite to rubble pile arrived on
 * screen as 2.0x, so every rock type looked like every other one and a cited
 * quantity was not legible in the thing it was driving.
 *
 * The noise was per-texel white noise - each pixel independent. Real regolith
 * has structure at many scales, because the processes that build it act over
 * areas. Uncorrelated noise reads as static however it is tuned.
 */

import { describe, it, expect } from 'vitest';
import { surfaceLevels, fragmentTexture, ROCK_SURFACE, describeSurface } from '../src/fragmentTexture.js';

// Tests the level computation directly rather than through a canvas: jsdom has
// no 2D backend, and this is the part that carries the physics anyway.
function levels(type) {
  const s = surfaceLevels(type);
  return { data: Array.from(s.levels, v => v * 255), width: s.width, height: s.height };
}

const mean = a => a.reduce((s, v) => s + v, 0) / a.length;

describe('fragment surfaces', () => {
  it('orders on-screen brightness the same way the catalogue orders albedo', () => {
    const types = Object.keys(ROCK_SURFACE);
    const byAlbedo = [...types].sort((a, b) => ROCK_SURFACE[a].albedo - ROCK_SURFACE[b].albedo);
    const byScreen = [...types].sort((a, b) => mean(levels(a).data) - mean(levels(b).data));
    expect(byScreen).toEqual(byAlbedo);
  });

  it('keeps enough of the real albedo span to tell the rock types apart', () => {
    const means = Object.keys(ROCK_SURFACE).map(t => mean(levels(t).data));
    const ratio = Math.max(...means) / Math.min(...means);
    // The true span is 6.4x; the old mapping delivered 2.0x, which was the bug.
    expect(ratio).toBeGreaterThan(3.0);
  });

  it('keeps the darkest material visible against a black sky', () => {
    // CM chondrite reflects 4.4% of the light falling on it. Rendered
    // literally it is a black disc, and the point is to be seen.
    expect(mean(levels('cm_chondrite').data)).toBeGreaterThan(30);
  });

  it('produces spatially correlated structure, not per-texel static', () => {
    // White noise has near-zero correlation between neighbouring texels.
    // A real surface has a lot. Measured as the mean absolute difference
    // between horizontally adjacent texels, relative to the overall spread.
    const { data, width, height } = levels('ordinary_chondrite');
    let adjacent = 0, n = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width - 1; x += 1) {
        adjacent += Math.abs(data[y * width + x] - data[y * width + x + 1]);
        n += 1;
      }
    }
    const meanAdjacentDiff = adjacent / n;
    // Distance between two independent random texels, for comparison.
    let random = 0;
    for (let i = 0; i < n; i += 1) {
      random += Math.abs(data[(i * 7919) % data.length] - data[(i * 104729) % data.length]);
    }
    const meanRandomDiff = random / n;
    // Neighbours must be markedly more alike than unrelated texels.
    expect(meanAdjacentDiff).toBeLessThan(meanRandomDiff * 0.5);
  });

  it('is deterministic, so two screenshots of one fragment agree', () => {
    const a = mean(levels('ice_rich').data);
    const b = mean(levels('ice_rich').data);
    expect(a).toBe(b);
  });

  it('returns null for a rock nobody measured', () => {
    expect(fragmentTexture('unobtainium')).toBeNull();
    expect(fragmentTexture(null)).toBeNull();
    expect(describeSurface('unobtainium')).toBeNull();
  });
});
