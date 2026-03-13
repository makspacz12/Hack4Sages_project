/**
 * asteroidManager.js
 * Creates and updates free-flying asteroids that travel by linear velocity vectors.
 * Unlike orbital bodies, asteroids are NOT parented to a pivot – they live in world space.
 */

import * as THREE from 'three';
import { createGeometry } from './objectFactory.js';
import { createPlanetMaterial } from './shaderMaterial.js';

let _idCounter = 0;

/**
 * @typedef {object} AsteroidData
 * @property {string}  id
 * @property {{ x: number, y: number, z: number }} position   world-space
 * @property {{ x: number, y: number, z: number }} velocity   units per second
 * @property {number}  radius
 * @property {string}  color       hex string
 * @property {number}  mass        for gravity calculations
 * @property {boolean} usePhysics  if true, position is driven by physics engine
 */

/**
 * Build the plain-data record for a new asteroid.
 * @param {{ position, velocity, radius?, color?, mass?, usePhysics? }} params
 * @returns {AsteroidData}
 */
export function createAsteroidData({
  position, velocity,
  radius = 0.2, color = '#888888',
  mass = 10, usePhysics = false,
}) {
  return {
    id:         `asteroid_${++_idCounter}`,
    position:   { ...position },
    velocity:   { ...velocity },
    radius,
    color,
    mass,
    usePhysics,
  };
}

/**
 * Create the Three.js Mesh for an asteroid data record.
 * @param {AsteroidData} data
 * @returns {THREE.Mesh}
 */
export function createAsteroidMesh(data) {
  const geo  = createGeometry(data.radius, 12);
  const mat  = createPlanetMaterial(data.color);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(data.position.x, data.position.y, data.position.z);
  mesh.name = data.id;
  return mesh;
}

/**
 * Advance all asteroid positions by velocity × deltaSeconds.
 * @param {Array<{ data: AsteroidData, mesh: THREE.Mesh }>} asteroids
 * @param {number} deltaSeconds
 */
export function updateAsteroidPositions(asteroids, deltaSeconds) {
  for (const { data, mesh } of asteroids) {
    // Physics-driven bodies are moved by physicsSync – skip linear integration.
    if (data.usePhysics) continue;
    data.position.x += data.velocity.x * deltaSeconds;
    data.position.y += data.velocity.y * deltaSeconds;
    data.position.z += data.velocity.z * deltaSeconds;
    mesh.position.set(data.position.x, data.position.y, data.position.z);
  }
}

/**
 * Create an asteroid, add its mesh to the scene, and push it into the tracking array.
 * @param {THREE.Scene}  scene
 * @param {Array}        asteroids  mutable tracking array
 * @param {object}       params     same shape as createAsteroidData argument
 * @returns {{ data: AsteroidData, mesh: THREE.Mesh }}
 */
export function addAsteroid(scene, asteroids, params) {
  const data = createAsteroidData(params);
  const mesh = createAsteroidMesh(data);
  scene.add(mesh);
  asteroids.push({ data, mesh });
  return { data, mesh };
}

/**
 * Remove an asteroid by id, dispose its GPU resources, and remove from scene.
 * @param {THREE.Scene} scene
 * @param {Array}       asteroids
 * @param {string}      id
 * @returns {boolean}  true if found and removed
 */
export function removeAsteroid(scene, asteroids, id) {
  const idx = asteroids.findIndex(a => a.data.id === id);
  if (idx === -1) return false;
  const [{ mesh }] = asteroids.splice(idx, 1);
  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh.material.dispose();
  return true;
}
