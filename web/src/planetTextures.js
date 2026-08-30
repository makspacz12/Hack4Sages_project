/**
 * Surface maps for the planets, the Sun and Saturn's rings.
 *
 * The bodies were flat single-colour spheres. That is defensible for context
 * geometry, but a scientific audience recognises Jupiter by its bands and Mars
 * by its rust, and recognising the scene without reading the labels is worth
 * something in a ten-minute talk.
 *
 * SIZE. The source maps are 2048x1024. Measured in the running scene a planet
 * spans roughly 2 to 30 pixels at ordinary zoom, so a 2048-pixel map
 * contributes about half a percent of its texels. They are prepared down to
 * 512x256 by web/tools/prepare_textures.mjs: still an order of magnitude more
 * detail than the largest on-screen size, and 0.18 MB for the whole set rather
 * than 4.8 MB, against a page already carrying a 7.4 MB replay.
 *
 * COLOUR SPACE. Every colour map must be tagged SRGBColorSpace. Leaving it at
 * the default makes the whole scene look washed out, and it is the single
 * commonest mistake with textures in modern three.js. Data maps - normals,
 * roughness - would stay linear, but none are used here.
 *
 * CREDIT. Textures from Solar System Scope, https://www.solarsystemscope.com/
 * textures/, released under CC BY 4.0: "You may use, adapt, and share these
 * textures for any purpose, even commercially." Attribution is required, and
 * is carried in the About panel and the README rather than only in this file.
 *
 * NASA imagery was considered and not used. It is usually public domain but
 * not automatically so - NASA's own terms note that third-party copyrighted
 * material appears on its sites - and the USGS mosaics are gigabyte-scale
 * science products needing reprojection, which is a day of work for an object
 * eight pixels across.
 */

import * as THREE from 'three';

const BASE = 'textures/';

/** Which map each body wears. Anything absent keeps its flat colour. */
export const TEXTURE_BY_ID = {
  sun: 'sun.jpg',
  planet_mercury: 'mercury.jpg',
  // The surface map, not the atmosphere: from space Venus IS its cloud deck,
  // a nearly featureless pale yellow, and showing the radar-mapped surface
  // would be showing something nobody has ever seen with their eyes.
  planet_venus: 'venus_atmosphere.jpg',
  planet_earth: 'earth_daymap.jpg',
  planet_mars: 'mars.jpg',
  planet_jupiter: 'jupiter.jpg',
  planet_saturn: 'saturn.jpg',
  planet_uranus: 'uranus.jpg',
  planet_neptune: 'neptune.jpg',
};

export const RING_TEXTURE = 'saturn_ring_alpha.png';

const loader = new THREE.TextureLoader();
const cache = new Map();

/**
 * Load one texture, correctly tagged, or null if it cannot be fetched.
 *
 * Failure is not fatal anywhere: the caller keeps the flat-coloured material,
 * which is exactly what the scene looked like before. A missing texture should
 * never cost anyone the rest of the visualisation.
 */
export function loadTexture(file, onLoad) {
  if (!file) return null;
  if (cache.has(file)) {
    const t = cache.get(file);
    if (t && onLoad) onLoad(t);
    return t;
  }
  const tex = loader.load(
    `${BASE}${file}`,
    (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      if (onLoad) onLoad(t);
    },
    undefined,
    () => { cache.set(file, null); },
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(file, tex);
  return tex;
}

/** The map for a body id, or null. */
export function textureFor(id) {
  return TEXTURE_BY_ID[id] ?? null;
}
