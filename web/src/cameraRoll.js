/**
 * cameraRoll.js
 * Holds Q / E keys → rolls the camera clockwise / counter-clockwise.
 *
 * Roll is implemented by rotating camera.up around the camera's forward
 * (look) axis. TrackballControls reads camera.up each frame, so this
 * integrates without any internal controls hacking.
 */

import * as THREE from 'three';

const ROLL_SPEED_RAD = 1.2;   // radians per second

// Reused objects – avoids per-frame allocation.
const _forward = new THREE.Vector3();
const _quat    = new THREE.Quaternion();

/**
 * Create a roll-state object and attach keydown/keyup listeners.
 * Call detach() to clean up listeners.
 *
 * @returns {{ q: boolean, e: boolean, detach: () => void }}
 */
export function createRollState() {
  const state = { q: false, e: false };

  function onDown(ev) {
    if (ev.code === 'KeyQ') state.q = true;
    if (ev.code === 'KeyE') state.e = true;
  }
  function onUp(ev) {
    if (ev.code === 'KeyQ') state.q = false;
    if (ev.code === 'KeyE') state.e = false;
  }

  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup',   onUp);

  state.detach = () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup',   onUp);
  };

  return state;
}

/**
 * Apply camera roll for one frame.
 * Q = clockwise (negative roll), E = counter-clockwise (positive roll).
 *
 * @param {{ q: boolean, e: boolean }} state  from createRollState()
 * @param {THREE.Camera}              camera
 * @param {number}                    dtSec   seconds since last frame
 */
export function tickCameraRoll(state, camera, dtSec) {
  const dir = (state.e ? 1 : 0) - (state.q ? 1 : 0);
  if (dir === 0) return;

  camera.getWorldDirection(_forward);
  const angle = dir * ROLL_SPEED_RAD * dtSec;
  _quat.setFromAxisAngle(_forward, angle);
  camera.up.applyQuaternion(_quat).normalize();
}
