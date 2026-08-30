/**
 * objectFactory.js
 * Creates Three.js meshes and pivot groups for celestial bodies.
 */

import * as THREE from 'three';
import { createPlanetMaterial, createSunMaterial } from './shaderMaterial.js';
import { loadTexture, textureFor } from './planetTextures.js';
import { fragmentTexture } from './fragmentTexture.js';

/**
 * Create a sphere geometry for a given radius and detail level.
 * Bounding sphere is pre-computed so raycasting works without a render cycle.
 * @param {number} radius
 * @param {number} [segments=32]
 * @returns {THREE.SphereGeometry}
 */
export function createGeometry(radius, segments = 32) {
  const geo = new THREE.SphereGeometry(radius, segments, segments);
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Create a shader material for a body.
 * Stars use the sun (emissive + corona) shader; everything else uses the
 * planet (Phong + rim) shader.
 * @param {string}  color     hex color string, e.g. "#FDB813"
 * @param {boolean} emissive  true for the sun / stars
 * @returns {THREE.ShaderMaterial}
 */
export function createMaterial(color, emissive, id = null, rockType = null) {
  // Two sources, deliberately different in kind. The Sun and the eight planets
  // get photographic maps, because photographs of them exist. A fragment gets
  // a surface GENERATED from its own catalogued albedo, porosity and water
  // content - see fragmentTexture.js for why a downloaded comet picture would
  // be the wrong thing here. The fifty Gaia stars get neither.
  const map = rockType ? fragmentTexture(rockType) : loadTexture(textureFor(id));
  return emissive ? createSunMaterial(color, map) : createPlanetMaterial(color, map);
}

/**
 * Create a sphere mesh from body data.
 * @param {object} body  flat body descriptor from dataLoader
 * @returns {THREE.Mesh}
 */
export function createSphereMesh(body) {
  const geo = createGeometry(body.radius);
  const mat = createMaterial(body.color, body.emissive, body.id, body.rockType);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.z = THREE.MathUtils.degToRad(body.tilt ?? 0);
  // Shadow flags are left off: no light in this scene casts, and the planet
  // material is a raw ShaderMaterial that never reads a shadow map.
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.name = body.id;
  return mesh;
}

/**
 * Create a flat ring mesh for Saturn-like rings.
 * @param {number} innerRadius
 * @param {number} outerRadius
 * @param {string} color
 * @returns {THREE.Mesh}
 */
export function createRingMesh(innerRadius, outerRadius, color) {
  const geo = new THREE.RingGeometry(innerRadius, outerRadius, 64);
  const mat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

/**
 * Build a complete body node: a pivot Group that orbits its parent,
 * containing the sphere mesh (and optional ring).
 * @param {object} body
 * @returns {{ pivot: THREE.Group, mesh: THREE.Mesh }}
 */
export function createBodyNode(body) {
  const pivot = new THREE.Group();
  pivot.name = `pivot_${body.id}`;

  const mesh = createSphereMesh(body);
  mesh.position.set(body.distance, 0, 0);
  pivot.add(mesh);

  if (body.hasRings) {
    const ring = createRingMesh(body.ringInnerRadius, body.ringOuterRadius, body.ringColor);
    ring.position.set(body.distance, 0, 0);
    pivot.add(ring);
  }

  return { pivot, mesh };
}
