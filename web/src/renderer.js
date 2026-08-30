/**
 * renderer.js
 * Creates and configures the WebGL renderer.
 */

import * as THREE from 'three';

/**
 * Create a WebGLRenderer that fills the whole window.
 * @returns {THREE.WebGLRenderer}
 */
export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Shadow mapping is off deliberately. It was enabled, and every mesh set
  // castShadow/receiveShadow, but NO light in this scene has castShadow = true
  // and the planets use a raw ShaderMaterial that never reads a shadow map.
  // The scene was paying for a feature that could not render.
  renderer.shadowMap.enabled = false;
  document.body.appendChild(renderer.domElement);
  return renderer;
}

/**
 * Resize the renderer and update pixel ratio on window resize.
 * @param {THREE.WebGLRenderer} renderer
 * @param {number} width
 * @param {number} height
 */
export function resizeRenderer(renderer, width, height) {
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}
