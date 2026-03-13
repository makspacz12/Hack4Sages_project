/**
 * uvRadiation.js
 * Visualises UV radiation from stars as a single billboard sprite with a
 * radial linear gradient: fully opaque at centre → transparent at the edge.
 *
 * Physics (used for heat intensity only):
 *   F(r) = L / (4π r²)   →  1/r² proxy, normalised to [0, 1]
 */

import * as THREE from 'three';

// ── Constants ──────────────────────────────────────────────────────────────
const M_SUN_KG    = 1.989e30;
const INNER_MULT  = 2;    // inner edge multiplier × star visual radius
const OUTER_MULT  = 30;   // outer edge multiplier × star visual radius
const MAX_OPACITY = 0.55;
const EXPAND_S    = 0.55;
const TEX_SIZE    = 256;

// ── Texture factory ────────────────────────────────────────────────────────
const _texCache = new Map();

/**
 * Build a radial-gradient canvas texture once and cache it.
 * Centre: opaque UV violet → edge: fully transparent (linear falloff).
 * @returns {THREE.CanvasTexture}
 */
export function buildGradientTexture() {
  if (_texCache.has('uv')) return _texCache.get('uv');
  const cv = (typeof OffscreenCanvas !== 'undefined')
    ? new OffscreenCanvas(TEX_SIZE, TEX_SIZE)
    : (() => { const c = document.createElement('canvas'); c.width = c.height = TEX_SIZE; return c; })();
  const ctx = cv.getContext('2d');
  const cx  = TEX_SIZE / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0.00, 'rgba(153, 34, 238, 0.90)');
  grad.addColorStop(0.35, 'rgba(153, 34, 238, 0.50)');
  grad.addColorStop(0.70, 'rgba(153, 34, 238, 0.18)');
  grad.addColorStop(1.00, 'rgba(153, 34, 238, 0.00)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  const tex = new THREE.CanvasTexture(cv);
  _texCache.set('uv', tex);
  return tex;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Derive star mass in solar units from a simData object.
 * @param {object} obj  simData objects[] entry
 * @returns {number}
 */
export function getMassSolar(obj) {
  if (obj.mass_solar != null) return Number(obj.mass_solar);
  const kg = obj.info?.Mass?.value ?? obj.info?.mass?.value ?? null;
  return kg != null ? kg / M_SUN_KG : 1.0;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a single UV glow sprite for a star and attach it to starMesh.
 * Returns a one-element array so callers using push(...shells) stay compatible.
 *
 * @param {object}         starObj   simData objects[] entry (type='star')
 * @param {THREE.Object3D} starMesh
 * @returns {THREE.Sprite[]}
 */
export function createUVShells(starObj, starMesh) {
  const visRadius = starObj.visual?.radius ?? 1;
  const diameter  = OUTER_MULT * visRadius * 2;
  const mat = new THREE.SpriteMaterial({
    map:         buildGradientTexture(),
    transparent: true,
    opacity:     MAX_OPACITY,
    depthWrite:  false,
    depthTest:   false,
    blending:    THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(diameter, diameter, 1);
  sprite.visible          = false;
  sprite.name             = `uv_${starObj.id}_glow`;
  sprite._uvTargetOpacity = MAX_OPACITY;
  sprite._uvTargetScale   = diameter;
  sprite._uvAnim          = { active: false, elapsed: 0, progress: 0 };
  starMesh.add(sprite);
  return [sprite];
}

/**
 * Advance UV glow expand animation (ease-out quad).
 * Safe to call every frame; no-ops when animation is complete.
 *
 * @param {THREE.Sprite[]} shells
 * @param {number}         dtSec   seconds since last frame
 */
export function tickUVAnimation(shells, dtSec) {
  for (const s of shells.flat()) {
    const a = s._uvAnim;
    if (!a?.active) continue;
    a.elapsed  += dtSec;
    a.progress  = Math.min(1, a.elapsed / EXPAND_S);
    const eased = 1 - (1 - a.progress) ** 2;
    const ts    = s._uvTargetScale;
    s.scale.set(ts * eased, ts * eased, 1);
    s.material.opacity = s._uvTargetOpacity * eased;
    if (a.progress >= 1) {
      a.active = false;
      s.scale.set(ts, ts, 1);
      s.material.opacity = s._uvTargetOpacity;
    }
  }
}

/**
 * Show or hide UV glow sprites. Showing triggers the expand animation.
 * @param {THREE.Sprite[]} shells
 * @param {boolean}        visible
 */
export function setUVVisible(shells, visible) {
  for (const s of shells.flat()) {
    if (visible) {
      s.visible          = true;
      s.scale.set(0, 0, 1);
      s.material.opacity = 0;
      s._uvAnim.elapsed  = 0;
      s._uvAnim.progress = 0;
      s._uvAnim.active   = true;
    } else {
      s.visible        = false;
      s._uvAnim.active = false;
    }
  }
}

/**
 * Dispose sprite material/texture and detach from parent.
 * @param {THREE.Sprite[]} shells
 */
export function destroyUVShells(shells) {
  for (const s of shells.flat()) {
    s.parent?.remove(s);
    s.material.map?.dispose();
    s.material.dispose();
  }
}

// ── Heat intensity helpers ─────────────────────────────────────────────────

/**
 * Normalised heat intensity [0, 1] at `dist` world-units from a star.
 * Uses 1/r² flux proxy, clamped to [inner, outer] range.
 *
 * @param {number} dist           distance in world-units
 * @param {number} starVisRadius  star visual radius from JSON
 * @returns {number}
 */
export function computeHeatIntensity(dist, starVisRadius) {
  const inner = INNER_MULT * starVisRadius;
  const outer = OUTER_MULT * starVisRadius;
  if (dist >= outer) return 0;
  if (dist <= inner) return 1;
  const fluxAt  = 1 / (dist  * dist);
  const fluxIn  = 1 / (inner * inner);
  const fluxOut = 1 / (outer * outer);
  return (fluxAt - fluxOut) / (fluxIn - fluxOut);
}

const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();

/**
 * Update uHeatIntensity uniform for all non-star meshes each frame.
 * @param {Array<{body,mesh}>} allNodes
 * @param {Array<{body,mesh}>} starNodes
 * @param {boolean}            uvEnabled
 */
export function updateHeatForNodes(allNodes, starNodes, uvEnabled) {
  for (const { body, mesh } of allNodes) {
    const uniforms = mesh.material?.uniforms;
    if (!uniforms?.uHeatIntensity) continue;
    if (!uvEnabled || starNodes.length === 0) {
      uniforms.uHeatIntensity.value = 0;
      continue;
    }
    mesh.getWorldPosition(_tmpA);
    let maxHeat = 0;
    for (const { body: sb, mesh: sm } of starNodes) {
      sm.getWorldPosition(_tmpB);
      const heat = computeHeatIntensity(_tmpA.distanceTo(_tmpB), sb.radius ?? 1);
      if (heat > maxHeat) maxHeat = heat;
    }
    uniforms.uHeatIntensity.value = maxHeat;
  }
}
