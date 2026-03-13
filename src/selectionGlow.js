/**
 * selectionGlow.js
 * Blue halo sprite shown around the currently focused celestial body.
 *
 * The sprite is attached as a child of the focused mesh so it follows
 * it automatically.  Call update(time) every frame to animate the pulse.
 */

import * as THREE from 'three';

// ── Texture ───────────────────────────────────────────────────────────────────

let _glowTexture = null;

function getGlowTexture() {
  if (_glowTexture) return _glowTexture;

  const SIZE = 256;
  const cx   = SIZE / 2;
  const cv   = (typeof OffscreenCanvas !== 'undefined')
    ? new OffscreenCanvas(SIZE, SIZE)
    : (() => { const c = document.createElement('canvas'); c.width = c.height = SIZE; return c; })();
  const ctx  = cv.getContext('2d');

  // Transparent centre → bright blue ring → transparent outer edge
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0.00, 'rgba(60,  140, 255, 0.0)');
  grad.addColorStop(0.45, 'rgba(80,  160, 255, 0.15)');
  grad.addColorStop(0.70, 'rgba(100, 180, 255, 0.90)');
  grad.addColorStop(0.88, 'rgba(60,  140, 255, 0.35)');
  grad.addColorStop(1.00, 'rgba(40,  100, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  _glowTexture = new THREE.CanvasTexture(cv);
  return _glowTexture;
}

// ── Public API ────────────────────────────────────────────────────────────────

const SCALE_FACTOR = 3.0; // glow diameter = SCALE_FACTOR × mesh radius
const BASE_OPACITY = 0.75;
const PULSE_AMP    = 0.18; // ± opacity swing

/**
 * Create a selection-glow controller.
 * @returns {{ attach: Function, detach: Function, update: Function }}
 */
export function createSelectionGlow() {
  let sprite   = null;
  let parentMesh = null;

  function _buildSprite(radius) {
    const mat = new THREE.SpriteMaterial({
      map:        getGlowTexture(),
      blending:   THREE.AdditiveBlending,
      transparent: true,
      depthWrite:  false,
      opacity:     BASE_OPACITY,
    });
    const s = new THREE.Sprite(mat);
    const d = radius * SCALE_FACTOR * 2; // sprite size = full diameter
    s.scale.set(d, d, 1);
    s.renderOrder = 2;
    return s;
  }

  /**
   * Attach glow to a mesh. Safe to call multiple times – detaches previous.
   * Radius is read from the mesh's sphere geometry when available.
   * @param {THREE.Mesh} mesh
   */
  function attach(mesh) {
    detach();
    const r = mesh.geometry?.parameters?.radius ?? 1;
    sprite  = _buildSprite(r);
    parentMesh = mesh;
    mesh.add(sprite);
  }

  /** Remove glow from the current mesh. */
  function detach() {
    if (sprite && parentMesh) {
      parentMesh.remove(sprite);
      sprite.material.dispose();
    }
    sprite = parentMesh = null;
  }

  /**
   * Pulse the glow.  Call once per animation frame.
   * @param {number} time  elapsed seconds
   */
  function update(time) {
    if (!sprite) return;
    sprite.material.opacity = BASE_OPACITY + Math.sin(time * 2.4) * PULSE_AMP;
  }

  return { attach, detach, update };
}
