/**
 * Surfaces for the ejecta fragments, generated from their own properties.
 *
 * WHY NOT A PHOTOGRAPH. The planets wear real maps because real maps exist:
 * Jupiter has been photographed. These fragments have not. They are 1.4 mm to
 * 58 mm stones this model invented by sampling a size distribution, and there
 * is no image of any of them. Dressing them in a downloaded picture of comet
 * 67P would put a specific, real, measured object on screen and label it as
 * something the simulation produced - an invented appearance presented with
 * the authority of a photograph, in a talk whose whole argument is that this
 * tool marks what it does and does not know.
 *
 * WHAT IS DRAWN INSTEAD. The rock catalogue carries measured properties for
 * every type - albedo, porosity, water fraction, density, each cited to a
 * source in the model. Those drive the surface directly:
 *
 *   albedo   -> base brightness. CI chondrite at 0.045 is among the darkest
 *               material in the Solar System; rubble pile at 0.283 is bright.
 *   porosity -> pitting. A 55% porous organic aggregate is visibly rough; a
 *               1% porous iron-nickel fragment is nearly smooth.
 *   water    -> bright inclusions, for the ice-rich and hydrated types.
 *   density  -> the metallic sheen, via a specular term for the iron end.
 *
 * So the texture is an ENCODING of the physics the model already computes with,
 * not an illustration. Two fragments that look different look different because
 * their catalogued properties differ, and a reader who asks why is given a
 * number rather than an aesthetic.
 *
 * It also costs nothing to download: the maps are drawn into a canvas at load,
 * 128x64 each, which is ample for a body a few pixels across.
 */

import * as THREE from 'three';

/**
 * Measured properties per rock type, from the model's rock catalogue
 * (model/microbe_radiation_model/materials/rocks/rock_variants_from_sources.py,
 * each field cited to a source there).
 */
export const ROCK_SURFACE = {
  hydrated_silicate:  { albedo: 0.155,  porosity: 0.22, water: 0.12,   density: 2890 },
  iron_nickel:        { albedo: 0.1203, porosity: 0.01, water: 0.0001, density: 4172 },
  ordinary_chondrite: { albedo: 0.25,   porosity: 0.08, water: 0.002,  density: 2670 },
  organic_rich:       { albedo: 0.0706, porosity: 0.55, water: 0.08,   density: 2386 },
  ice_rich:           { albedo: 0.09,   porosity: 0.10, water: 0.35,   density: 2162 },
  ci_chondrite:       { albedo: 0.045,  porosity: 0.11, water: 0.18,   density: 1190 },
  cm_chondrite:       { albedo: 0.044,  porosity: 0.22, water: 0.10,   density: 1194 },
  rubble_pile:        { albedo: 0.283,  porosity: 0.41, water: 0.02,   density: 1900 },
};

const SIZE_W = 128;
const SIZE_H = 64;

/**
 * Deterministic noise.
 *
 * Seeded from the rock type, so a given type always looks the same across
 * reloads and across machines. A texture that changed between runs would make
 * two screenshots of the same fragment disagree, which is not acceptable in a
 * figure someone may put in a paper.
 */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const cache = new Map();

/**
 * A surface map for one rock type, or null when the type is unknown.
 *
 * Returns null rather than inventing a default, so an unrecognised rock keeps
 * its flat class colour instead of being given properties nobody measured.
 */
export function fragmentTexture(rockType) {
  if (!rockType || !ROCK_SURFACE[rockType]) return null;
  if (cache.has(rockType)) return cache.get(rockType);
  if (typeof document === 'undefined') return null;

  const p = ROCK_SURFACE[rockType];
  const canvas = document.createElement('canvas');
  canvas.width = SIZE_W;
  canvas.height = SIZE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const rand = seeded(hashString(rockType));
  const img = ctx.createImageData(SIZE_W, SIZE_H);

  // Albedo sets the mean level. It is a reflectance, so it maps to brightness
  // directly, but lifted off zero: a 4.5% albedo body rendered literally would
  // be a black disc, and the point is to be seen against a dark sky.
  const base = 0.28 + p.albedo * 1.5;
  // Porous material scatters light unevenly, so it shows more variation.
  const grain = 0.10 + p.porosity * 0.45;

  for (let y = 0; y < SIZE_H; y += 1) {
    for (let x = 0; x < SIZE_W; x += 1) {
      // Two octaves: broad mottling plus fine grain, which reads as rock
      // rather than as noise at any zoom the scene allows.
      const coarse = rand();
      const fine = rand();
      let v = base + (coarse - 0.5) * grain + (fine - 0.5) * grain * 0.4;

      // Water-bearing types get bright inclusions - frost and hydrated
      // minerals scattered through a darker matrix.
      if (p.water > 0.05 && rand() < p.water * 0.35) {
        v += 0.25 + p.water * 0.4;
      }
      // Dense metallic material gets occasional bright facets rather than
      // uniform brightening: iron reflects specularly, it is not pale.
      if (p.density > 3500 && rand() < 0.05) {
        v += 0.35;
      }

      v = Math.max(0, Math.min(1, v));
      const i = (y * SIZE_W + x) * 4;
      const level = Math.round(v * 255);
      img.data[i] = level;
      img.data[i + 1] = level;
      img.data[i + 2] = level;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(rockType, tex);
  return tex;
}

/** One-line description of why a rock looks the way it does, for a tooltip. */
export function describeSurface(rockType) {
  const p = ROCK_SURFACE[rockType];
  if (!p) return null;
  return `albedo ${p.albedo}, porosity ${(p.porosity * 100).toFixed(0)}%, `
    + `water ${(p.water * 100).toFixed(1)}% by mass`;
}
