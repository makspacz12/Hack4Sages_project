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

const SIZE_W = 256;
const SIZE_H = 128;

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

/**
 * Value noise on a coarse lattice, smoothly interpolated.
 *
 * The previous surface was per-texel white noise: every pixel drawn
 * independently. Real regolith is nothing like that. It has structure at many
 * scales - patches, boulders, crater ejecta - because the processes that build
 * it act over areas, not points. Uncorrelated noise reads as television static
 * no matter how it is tuned, which is why the fragments looked like grey fuzz
 * rather than like rock.
 *
 * This builds a lattice of random values and interpolates between them with a
 * smoothstep, giving blobs of a chosen size. Summing several octaves at
 * halving amplitude is ordinary fractal value noise, and it is what makes the
 * result read as a surface.
 */
function valueNoise(rand, cells) {
  const grid = new Float32Array(cells * cells);
  for (let i = 0; i < grid.length; i += 1) grid[i] = rand();
  const smooth = t => t * t * (3 - 2 * t);
  return (u, v) => {
    const x = u * cells, y = v * cells;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = smooth(x - x0), fy = smooth(y - y0);
    // Wrap in x, clamp in y: the map meets itself around the body, but the
    // poles of an equirectangular map converge, so wrapping there would fold
    // the noise back onto itself.
    const xi = i => ((i % cells) + cells) % cells;
    const yi = i => Math.max(0, Math.min(cells - 1, i));
    const g = (a, b) => grid[yi(b) * cells + xi(a)];
    const top = g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx;
    const bot = g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bot * fy;
  };
}

/** Fractal sum of value-noise octaves. */
function fbm(rand, baseCells, octaves) {
  const layers = [];
  let cells = baseCells;
  let amp = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    layers.push({ noise: valueNoise(rand, cells), amp });
    norm += amp;
    cells *= 2;
    amp *= 0.5;
  }
  return (u, v) => {
    let sum = 0;
    for (const l of layers) sum += l.noise(u, v) * l.amp;
    return sum / norm;
  };
}

/**
 * Craters, following a power-law size distribution.
 *
 * Every airless body in the Solar System is cratered, and the size-frequency
 * distribution is a power law: many small ones, few large ones. Drawing them
 * explicitly - rather than hoping noise happens to suggest them - is what
 * separates a surface that reads as an airless rock from one that reads as a
 * texture.
 *
 * Each crater is a dark floor with a brighter rim, which is how they appear
 * under most lighting: the excavated interior is shadowed, and the raised rim
 * catches the light.
 *
 * A rubble pile gets fewer of them, because it is a gravitational aggregate
 * that disrupts and reassembles rather than retaining an impact record.
 */
function craterField(rand, count) {
  const craters = [];
  for (let i = 0; i < count; i += 1) {
    // Power law with index -2: r = rmin * (1-U)^(-1/2), truncated so that a
    // single draw cannot cover the whole body.
    const r = Math.min(0.16, 0.012 * Math.pow(1 - rand() * 0.985, -0.5));
    craters.push({ u: rand(), v: rand(), r });
  }
  return (u, v) => {
    let delta = 0;
    for (const c of craters) {
      // Shortest distance in u, because the map wraps around the body.
      let du = Math.abs(u - c.u);
      if (du > 0.5) du = 1 - du;
      // v is halved because the map is twice as wide as it is tall, so a
      // crater stays round on the sphere rather than being stretched.
      const dv = (v - c.v) * 0.5;
      const d = Math.hypot(du, dv);
      if (d > c.r) continue;
      const t = d / c.r;
      // Dark floor out to 0.72 of the radius, bright rim beyond it.
      delta += t < 0.72 ? -0.16 * (1 - t / 0.72) : 0.13 * (1 - (t - 0.72) / 0.28);
    }
    return delta;
  };
}

const cache = new Map();

/**
 * A surface map for one rock type, or null when the type is unknown.
 *
 * Returns null rather than inventing a default, so an unrecognised rock keeps
 * its flat class colour instead of being given properties nobody measured.
 */
/**
 * The greyscale surface for one rock type, as a plain array of 0..1 levels.
 *
 * Separate from the canvas because this is the part that carries the physics:
 * it turns catalogued albedo, porosity, water and density into a surface, and
 * it can be checked without a graphics context. `fragmentTexture` below is
 * only the painting step.
 *
 * Returns null for a rock nobody measured, rather than inventing a default.
 */
export function surfaceLevels(rockType, width = SIZE_W, height = SIZE_H) {
  const p = ROCK_SURFACE[rockType];
  if (!p) return null;

  const rand = seeded(hashString(rockType));

  // Albedo sets the mean level.
  //
  // The mapping was 0.28 + albedo * 1.5, which lifted the darkest material off
  // black but compressed the catalogue badly: the real span from CM chondrite
  // at 0.044 to rubble pile at 0.283 is a factor of 6.4, and it arrived on
  // screen as a factor of 2.0. Every rock type looked like every other one, so
  // albedo - a measured, cited quantity - was not legible in the very thing it
  // was driving.
  //
  // The compression came from the FLOOR, not the gain: a large constant added
  // to every type swamps the differences between them. Lowering the floor from
  // 0.28 to 0.10 and raising the gain restores most of the ordering -
  //
  //   CM chondrite  0.044 -> 0.228     (darkest, still clearly visible)
  //   rubble pile   0.283 -> 0.921     (brightest)
  //   on-screen ratio 4.05x, against 2.04x before and 6.43x in truth
  //
  // A floor is still needed, because a body rendered at its true 4.4%
  // reflectance is a black disc against a black sky, and the point is to be
  // seen. 0.10 is the smallest that keeps the darkest two types apart from the
  // background.
  const base = 0.10 + p.albedo * 2.9;
  // Porous material scatters light unevenly, so it shows more variation.
  const grain = 0.10 + p.porosity * 0.45;

  // Three scales - broad patches, fine grain, and the crater record - because
  // a real surface has structure at every scale the eye can resolve.
  const patches = fbm(rand, 4, 3);
  const fine = fbm(rand, 16, 2);
  const craters = craterField(rand, p.porosity > 0.35 ? 14 : 34);

  const levels = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      let level = base
        + (patches(u, v) - 0.5) * grain * 1.4
        + (fine(u, v) - 0.5) * grain * 0.5
        + craters(u, v);

      // Water-bearing types get bright inclusions - frost and hydrated
      // minerals scattered through a darker matrix. Tied to the fine noise so
      // they form coherent patches rather than isolated speckles.
      if (p.water > 0.05 && fine(u, v) > 1 - p.water * 0.9) {
        level += 0.2 + p.water * 0.35;
      }
      // Dense metallic material gets bright facets: iron reflects specularly,
      // rather than being uniformly pale.
      if (p.density > 3500 && patches(u, v) > 0.86) {
        level += 0.3;
      }

      levels[y * width + x] = Math.max(0, Math.min(1, level));
    }
  }
  return { levels, width, height };
}

/**
 * A surface map for one rock type, or null when the type is unknown.
 *
 * Paints what surfaceLevels computed. Returns null rather than inventing a
 * default, so an unrecognised rock keeps its flat class colour instead of
 * being given properties nobody measured.
 */
export function fragmentTexture(rockType) {
  if (!rockType || !ROCK_SURFACE[rockType]) return null;
  if (cache.has(rockType)) return cache.get(rockType);
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE_W;
  canvas.height = SIZE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const surface = surfaceLevels(rockType, SIZE_W, SIZE_H);
  if (!surface) return null;

  const img = ctx.createImageData(SIZE_W, SIZE_H);
  for (let i = 0; i < surface.levels.length; i += 1) {
    const shade = Math.round(surface.levels[i] * 255);
    img.data[i * 4] = shade;
    img.data[i * 4 + 1] = shade;
    img.data[i * 4 + 2] = shade;
    img.data[i * 4 + 3] = 255;
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
