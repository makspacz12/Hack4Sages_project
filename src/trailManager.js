/**
 * trailManager.js
 * Comet-like position trails for asteroids.
 * Each trail is a THREE.Line whose vertex colours fade from the
 * asteroid's colour at the head to black at the tail.
 *
 * No DOM – purely a Three.js geometry module.
 */

import * as THREE from 'three';

const DEFAULT_MAX_LEN = 80;

function hexToRgb(hex) {
  const c = new THREE.Color(hex);
  return { r: c.r, g: c.g, b: c.b };
}

/**
 * Create a trail Line, add it to the scene, and return a trail record.
 * @param {THREE.Scene} scene
 * @param {string}      colorHex  hex colour string matching the asteroid
 * @param {number}      [maxLen]  max history length (default 80)
 * @returns {{ line: THREE.Line, history: Array, maxLen: number, colorHex: string }}
 */
export function createTrail(scene, colorHex, maxLen = DEFAULT_MAX_LEN) {
  const posArr = new Float32Array(maxLen * 3);
  const colArr = new Float32Array(maxLen * 3);
  const geo    = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colArr, 3));
  geo.setDrawRange(0, 0);
  const mat  = new THREE.LineBasicMaterial({ vertexColors: true });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;  // always render even if bounding box is stale
  scene.add(line);
  return { line, history: [], maxLen, colorHex };
}

function rebuildGeometry(trail) {
  const { history, colorHex } = trail;
  const rgb     = hexToRgb(colorHex);
  const len     = history.length;
  const posAttr = trail.line.geometry.getAttribute('position');
  const colAttr = trail.line.geometry.getAttribute('color');

  for (let i = 0; i < len; i++) {
    const { x, y, z } = history[i];
    // t=0 → head (full colour), t=1 → tail (black)
    const t = len > 1 ? i / (len - 1) : 0;
    posAttr.setXYZ(i, x, y, z);
    colAttr.setXYZ(i, rgb.r * (1 - t), rgb.g * (1 - t), rgb.b * (1 - t));
  }
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
  trail.line.geometry.setDrawRange(0, len);
}

/**
 * Push the current world position onto the trail's history and refresh the geometry.
 */
export function updateTrail(trail, x, y, z) {
  trail.history.unshift({ x, y, z });
  if (trail.history.length > trail.maxLen) trail.history.length = trail.maxLen;
  rebuildGeometry(trail);
}

/**
 * Erase the trail's history and hide the line.
 */
export function clearTrail(trail) {
  trail.history.length = 0;
  trail.line.geometry.setDrawRange(0, 0);
}

/**
 * Remove the trail's Three.js objects from the scene and free GPU memory.
 */
export function removeTrail(scene, trail) {
  scene.remove(trail.line);
  trail.line.geometry.dispose();
  trail.line.material.dispose();
}

/**
 * Change the head colour of a trail and immediately refresh geometry.
 * @param {object} trail    trail record from createTrail
 * @param {string} colorHex new hex colour string
 */
export function setTrailColor(trail, colorHex) {
  trail.colorHex = colorHex;
  rebuildGeometry(trail);
}

/**
 * Show or hide every trail in the map.
 * When hiding, also clears history so no ghost trail appears on re-enable.
 * @param {Map<string, object>} trailMap
 * @param {boolean}             visible
 */
export function setTrailsVisible(trailMap, visible) {
  for (const trail of trailMap.values()) {
    trail.line.visible = visible;
    if (!visible) clearTrail(trail);
  }
}

/**
 * Pure function – no Three.js dependency.
 * Extract the last `trailLen` world positions for object `id` from sim frames,
 * ordered newest-first (index 0 = head / current position).
 *
 * @param {Array}  frames        ctrl.frames from a replayController
 * @param {number} currentFrame  index of the current frame
 * @param {number} trailLen      maximum number of positions to return
 * @param {string} id            object id to look up
 * @returns {Array<{x:number, y:number, z:number}>}
 */
export function buildTrailPositions(frames, currentFrame, trailLen, id) {
  const start  = Math.max(0, currentFrame - trailLen + 1);
  const result = [];
  for (let i = currentFrame; i >= start; i--) {
    const p = frames[i]?.positions?.find(pos => pos.id === id);
    if (p) result.push({ x: p.x, y: p.y, z: p.z });
  }
  return result;
}

/**
 * Replace the trail's history with a pre-built positions array and
 * refresh the GPU geometry immediately.
 * `positions[0]` is treated as the head (full colour).
 *
 * @param {object}                         trail      trail record from createTrail
 * @param {Array<{x:number,y:number,z:number}>} positions  newest-first array
 */
export function setTrailHistory(trail, positions) {
  trail.history = positions.slice(0, trail.maxLen);
  rebuildGeometry(trail);
}
