/**
 * scene.js
 * Creates and configures the Three.js scene (background, fog, lighting).
 */

import * as THREE from 'three';

/**
 * Create a scene with a starfield background color and subtle space fog.
 * @returns {THREE.Scene}
 */
export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000005);
  return scene;
}

/**
 * Add a point light at the sun position and a dim ambient fill light.
 * @param {THREE.Scene} scene
 * @returns {{ sunLight: THREE.PointLight, ambientLight: THREE.AmbientLight }}
 */
export function addLighting(scene) {
  const sunLight = new THREE.PointLight(0xffffff, 6, 2000, 1.2);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  const ambientLight = new THREE.AmbientLight(0x334466, 2.5);
  scene.add(ambientLight);

  return { sunLight, ambientLight };
}

/**
 * Generate a starfield as a Points object and add it to the scene.
 * @param {THREE.Scene} scene
 * @param {number} [count=8000]
 * @param {number} [spread=1800]
 * @returns {THREE.Points}
 */
export function addStarfield(scene, count = 8000, spread = 1800) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.4, sizeAttenuation: true });
  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
  return stars;
}
