/**
 * camera.js
 * Creates and manages the perspective camera and orbit controls.
 */

import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';

/**
 * Create a perspective camera positioned at a good overview distance.
 * @param {number} aspect  width / height
 * @returns {THREE.PerspectiveCamera}
 */
export function createCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 5000);
  camera.position.set(0, 80, 180);
  camera.lookAt(0, 0, 0);
  return camera;
}

/**
 * Attach TrackballControls to the camera.
 * Unlike OrbitControls, TrackballControls has no polar-angle limit –
 * the camera can freely rotate in any direction including "over the poles".
 * @param {THREE.PerspectiveCamera} camera
 * @param {HTMLElement} domElement
 * @returns {TrackballControls}
 */
export function createControls(camera, domElement) {
  const controls = new TrackballControls(camera, domElement);
  controls.rotateSpeed       = 2.0;
  controls.zoomSpeed         = 1.2;
  controls.panSpeed          = 0.8;
  controls.staticMoving      = false;   // enable damping
  controls.dynamicDampingFactor = 0.12;
  controls.minDistance       = 5;
  controls.maxDistance       = 900;
  return controls;
}

/**
 * Update camera aspect ratio and projection matrix on resize.
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} width
 * @param {number} height
 */
export function resizeCamera(camera, width, height) {
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

/**
 * Notify TrackballControls of a viewport resize so its internal
 * screen dimensions stay in sync.
 * @param {TrackballControls} controls
 */
export function resizeControls(controls) {
  controls.handleResize();
}
