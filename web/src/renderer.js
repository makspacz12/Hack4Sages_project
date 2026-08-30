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

  // Tone mapping, so bright material rolls off instead of hard-clipping.
  //
  // Nothing was set here, which meant any colour above 1.0 was simply cut. The
  // brightest bodies were landing well above it: measured against the shipped
  // maps, Uranus reached 197,257,266 at the subsolar point and Saturn 264 in
  // red - clipped flat, so the cloud banding at the middle of the disc, the
  // part the eye actually looks at, was a uniform white patch with no
  // structure. ACES compresses that shoulder rather than cutting it, which
  // returns the banding without darkening the midtones.
  //
  // Exposure stays at 1.0: the shader already sets its own levels, and this is
  // here to recover highlights, not to relight the scene.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  // Textures are tagged SRGBColorSpace on load, so the output must be sRGB too
  // or the whole scene renders washed out. This is the default in current
  // three.js, but it is set explicitly because the shipped look depends on it.
  renderer.outputColorSpace = THREE.SRGBColorSpace;

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
