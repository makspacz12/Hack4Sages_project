/**
 * sceneScale.js
 *
 * Display scaling for the 3D replay. Simulation data stay in real AU and
 * metres; only what is drawn is remapped.
 *
 * Sizes:  SUN_R × (R_body / R_sun)^(1/n)
 * Distances from the Sun: SUN_R × (d_AU / R_sun_AU)^(1/n)
 *
 * n defaults to SCENE_RATIO_ROOT (change there, or pass ?root=N in the URL).
 * Production target is n = 3 (cube root).
 */

export const SUN_R = 14.0;

/** Target exponent when settling on cube-root compression. */
export const DEFAULT_RATIO_EXPONENT = 1 / 3;

/**
 * Active root degree n for 1/n compression (sizes and distances).
 * Flip while comparing visuals; URL ?root=N overrides on load.
 */
export const SCENE_RATIO_ROOT = 3;

let ratioExponent = 1 / SCENE_RATIO_ROOT;

/** @deprecated use getRatioExponent() */
export const SIZE_RATIO_EXPONENT = DEFAULT_RATIO_EXPONENT;

export function getRatioExponent() {
  return ratioExponent;
}

export function setRatioExponent(exp) {
  if (Number.isFinite(exp) && exp > 0 && exp <= 1) ratioExponent = exp;
  return ratioExponent;
}

/** Human-readable exponent for UI, e.g. "1/4". */
export function formatRatioExponent() {
  const n = 1 / ratioExponent;
  if (Math.abs(n - Math.round(n)) < 1e-6) return `1/${Math.round(n)}`;
  return ratioExponent.toFixed(3);
}

/**
 * Read ?root=N (→ 1/N) or ?ratioExp=0.25 from the page URL.
 * @param {URLSearchParams} params
 */
export function applyRatioExpFromSearch(params) {
  const direct = params?.get('ratioExp');
  if (direct != null && direct !== '') {
    const n = Number(direct);
    if (Number.isFinite(n) && n > 0 && n <= 1) return setRatioExponent(n);
  }
  const root = params?.get('root');
  if (root != null && root !== '') {
    const n = Number(root);
    if (Number.isFinite(n) && n >= 2) return setRatioExponent(1 / n);
  }
  return ratioExponent;
}

export const KM_PER_AU = 149597870.7;

export const DEFAULT_SUN_RADIUS_M = 695_709_902;

/** Largest fragment draw radius as a fraction of Mercury's drawn radius. */
export const FRAGMENT_MAX_MERCURY_FRACTION = 0.33;

/**
 * @param {object[]} [objects]
 * @returns {number}
 */
export function sunRadiusMetres(objects) {
  const r = objects?.find(o => o.id === 'sun')?.info?.Radius?.value;
  return Number.isFinite(r) && r > 0 ? r : DEFAULT_SUN_RADIUS_M;
}

/**
 * @param {object[]} [objects]
 * @returns {number}
 */
export function sunRadiusAU(objects) {
  return sunRadiusMetres(objects) / 1000 / KM_PER_AU;
}

/**
 * @param {number} rMetres
 * @param {number} sunRadiusM
 * @param {number} [exp]
 * @returns {number}
 */
export function drawRadiusRelativeToSun(
  rMetres,
  sunRadiusM,
  exp = getRatioExponent(),
) {
  return SUN_R * (rMetres / sunRadiusM) ** exp;
}

/**
 * Heliocentric distance in AU → world units on the display orbit scale.
 * @param {number} distanceAU
 * @param {number} sunRadiusAU
 * @param {number} [exp]
 * @returns {number}
 */
export function displayHelioDistanceAU(
  distanceAU,
  sunRadiusAU,
  exp = getRatioExponent(),
) {
  if (distanceAU <= 0) return 0;
  return SUN_R * (distanceAU / sunRadiusAU) ** exp;
}

/**
 * Sun-relative offset in AU → display offset in world units.
 * @param {{ x: number, y: number, z: number }} offsetAU
 * @param {number} sunRadiusAU
 * @param {number} [exp]
 * @returns {{ x: number, y: number, z: number }}
 */
export function displayHelioOffset(
  offsetAU,
  sunRadiusAU,
  exp = getRatioExponent(),
) {
  const d = Math.hypot(offsetAU.x, offsetAU.y, offsetAU.z);
  if (d <= 0) return { x: 0, y: 0, z: 0 };
  const k = displayHelioDistanceAU(d, sunRadiusAU, exp) / d;
  return { x: offsetAU.x * k, y: offsetAU.y * k, z: offsetAU.z * k };
}

/**
 * Map one body's replay position (AU, barycentric) to world units.
 * The Sun keeps its small linear drift; everything else is Sun-relative.
 *
 * @param {{ id?: string, x: number, y: number, z: number }} posAU
 * @param {{ x: number, y: number, z: number }} sunPosAU
 * @param {number} sunRadiusAU
 * @param {number} [linearScale]  meta.positionScale × scaleMultiplier for Sun drift
 * @param {number} [multiplier]   extra uniform scale (defaults to 1)
 */
export function displayWorldPosition(
  posAU,
  sunPosAU,
  sunRadiusAU,
  linearScale = 60,
  multiplier = 1,
) {
  const sunWU = {
    x: sunPosAU.x * linearScale,
    y: sunPosAU.y * linearScale,
    z: sunPosAU.z * linearScale,
  };
  if (posAU.id === 'sun') {
    return {
      x: sunWU.x * multiplier,
      y: sunWU.y * multiplier,
      z: sunWU.z * multiplier,
    };
  }
  const vis = displayHelioOffset(
    { x: posAU.x - sunPosAU.x, y: posAU.y - sunPosAU.y, z: posAU.z - sunPosAU.z },
    sunRadiusAU,
  );
  return {
    x: (sunWU.x + vis.x) * multiplier,
    y: (sunWU.y + vis.y) * multiplier,
    z: (sunWU.z + vis.z) * multiplier,
  };
}

/**
 * @param {object[]} [objects]
 * @returns {((obj: object) => number|null)|null}
 */
export function planetDrawRadiusFactory(objects) {
  const sunR = sunRadiusMetres(objects);
  const drawnById = new Map();
  for (const obj of objects ?? []) {
    if ((obj.type ?? '').toLowerCase() !== 'planet') continue;
    const rMetres = obj.info?.Radius?.value;
    if (!Number.isFinite(rMetres) || rMetres <= 0) continue;
    drawnById.set(obj.id, drawRadiusRelativeToSun(rMetres, sunR));
  }
  if (drawnById.size < 1) return null;
  return (obj) => drawnById.get(obj.id) ?? null;
}

/**
 * @param {object[]} [frames]
 * @param {object[]} [objects]
 * @returns {((id: string) => number|null)|null}
 */
export function fragmentDrawRadiusFactory(frames, objects) {
  const radii = new Map();
  for (const frame of frames ?? []) {
    for (const prop of frame?.properties ?? []) {
      if (prop?.id?.startsWith('asteroid_')
          && Number.isFinite(prop.radius)
          && prop.radius > 0
          && !radii.has(prop.id)) {
        radii.set(prop.id, prop.radius);
      }
    }
  }
  if (radii.size < 1) return null;

  const sunR = sunRadiusMetres(objects);
  const mercuryR = objects?.find(o => o.id === 'planet_mercury')?.info?.Radius?.value;
  const mercuryDrawn = Number.isFinite(mercuryR) && mercuryR > 0
    ? drawRadiusRelativeToSun(mercuryR, sunR)
    : SUN_R * 0.06;
  const cap = mercuryDrawn * FRAGMENT_MAX_MERCURY_FRACTION;

  const physical = (r) => drawRadiusRelativeToSun(r, sunR);
  const maxPhysical = Math.max(...[...radii.values()].map(physical));
  const boost = maxPhysical > 0 ? cap / maxPhysical : 1;

  return (id) => {
    const rMetres = radii.get(id);
    if (!Number.isFinite(rMetres) || rMetres <= 0) return null;
    return physical(rMetres) * boost;
  };
}

/**
 * @param {object} obj
 * @param {{ objects?: object[], fragmentRadiusFn?: (id: string) => number|null }} opts
 * @returns {number}
 */
export function drawObjectRadius(obj, { objects, fragmentRadiusFn } = {}) {
  if (obj.id === 'sun') return SUN_R;

  const type = (obj.type ?? '').toLowerCase();
  if (type === 'planet') {
    const fn = planetDrawRadiusFactory(objects);
    return fn?.(obj) ?? obj.visual?.radius ?? 1;
  }

  if (fragmentRadiusFn) {
    return fragmentRadiusFn(obj.id) ?? obj.visual?.radius ?? 1;
  }

  return obj.visual?.radius ?? 1;
}
