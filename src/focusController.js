/**
 * focusController.js
 * Smooth camera focus and follow for a selected celestial body.
 *
 * How it works:
 *   - Store a reference to the focused Three.js Mesh.
 *   - Each frame lerp OrbitControls.target → world position of that mesh.
 *   - If the camera is much farther than the suggested distance, also lerp it in.
 *   - Press Escape or pass null to clearFocus.
 */

import * as THREE from 'three';

// Reusable vectors – avoids per-frame allocation.
const _worldPos  = new THREE.Vector3();
const _prevWorld = new THREE.Vector3();

/**
 * @typedef {object} FocusController
 * @property {THREE.Mesh|null}    target
 * @property {boolean}            active      object is selected (for highlight, info panel)
 * @property {boolean}            orbitMode   controls.target follows the object
 * @property {boolean}            followMode  camera translates with the object
 * @property {THREE.Vector3|null} _prevPos    object world position last frame
 */

/**
 * Create a new focus controller (no active target).
 * @returns {FocusController}
 */
export function createFocusController() {
  return {
    target:     null,
    active:     false,
    orbitMode:  false,
    followMode: false,
    _prevPos:   null,
  };
}

/**
 * Set which mesh the camera should track. Pass null to clear.
 * @param {FocusController}    ctrl
 * @param {THREE.Mesh|null}    mesh
 */
export function setFocusTarget(ctrl, mesh) {
  ctrl.target = mesh;
  ctrl.active = mesh !== null;
}

/** Clear the active focus target. */
export function clearFocus(ctrl) {
  ctrl.target     = null;
  ctrl.active     = false;
  ctrl.orbitMode  = false;
  ctrl.followMode = false;
  ctrl._prevPos   = null;
}

/**
 * Enable orbit mode – controls.target follows the object.
 * Must be called while ctrl.target is already set.
 * @param {FocusController} ctrl
 */
export function activateOrbit(ctrl) {
  if (!ctrl.target) return;
  ctrl.orbitMode = true;
}

/** Disable orbit mode (controls.target stops following). */
export function deactivateOrbit(ctrl) {
  ctrl.orbitMode = false;
}

/**
 * Enable follow mode – camera will translate with the object each frame.
 * The user can still orbit freely with OrbitControls.
 * Must be called while ctrl.target is already set.
 * @param {FocusController} ctrl
 */
export function activateFollow(ctrl) {
  if (!ctrl.target) return;
  ctrl.orbitMode  = true; // follow requires orbit
  ctrl.followMode = true;
  ctrl.target.getWorldPosition(_prevWorld);
  ctrl._prevPos = _prevWorld.clone();
}

/** Disable follow mode (camera stops chasing the object). */
export function deactivateFollow(ctrl) {
  ctrl.followMode = false;
  ctrl._prevPos   = null;
}

/**
 * Call once per animation frame.
 * Lerps OrbitControls.target toward the focused mesh world position so the
 * orbit pivot stays centred on the object.
 * Camera zoom/distance is never touched – the user controls it freely.
 *
 * @param {FocusController}  ctrl
 * @param {THREE.Camera}     camera  (unused, kept for API compatibility)
 * @param {OrbitControls}    controls
 */
export function updateFocus(ctrl, camera, controls) {
  if (!ctrl.active || !ctrl.target) return;
  if (!ctrl.orbitMode) return; // locked mode: camera stays in place

  ctrl.target.getWorldPosition(_worldPos);

  if (ctrl.followMode && ctrl._prevPos) {
    // Translate camera by the delta the object moved this frame.
    // OrbitControls still handles rotation/zoom freely around the new target.
    camera.position.x += _worldPos.x - ctrl._prevPos.x;
    camera.position.y += _worldPos.y - ctrl._prevPos.y;
    camera.position.z += _worldPos.z - ctrl._prevPos.z;
    ctrl._prevPos.copy(_worldPos);
  }

  controls.target.copy(_worldPos);
}
