/**
 * orbitLine.js
 * Creates dashed circular orbit path lines.
 */

import * as THREE from 'three';

/**
 * Build a flat circle of points (XZ plane) for an orbit of the given radius.
 * @param {number} radius
 * @param {number} [segments=128]
 * @returns {Float32Array}
 */
export function buildOrbitPoints(radius, segments = 128) {
  const pts = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    pts[i * 3]     = Math.cos(angle) * radius;
    pts[i * 3 + 1] = 0;
    pts[i * 3 + 2] = Math.sin(angle) * radius;
  }
  return pts;
}

/**
 * Create a Three.js LineLoop representing an orbital path.
 * @param {number} radius
 * @param {string} [color='#333355']
 * @returns {THREE.LineLoop}
 */
export function createOrbitLine(radius, color = '#333355') {
  const pts = buildOrbitPoints(radius);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 });
  return new THREE.LineLoop(geo, mat);
}
