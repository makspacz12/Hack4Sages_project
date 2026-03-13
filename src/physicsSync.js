/**
 * physicsSync.js
 * Bridge between the pure physics engine (physics.js) and Three.js scene objects.
 *
 * Static bodies (planets / moons driven by orbital mechanics):
 *   syncStaticFromMeshes → reads mesh world positions → physics engine
 *
 * Dynamic bodies (asteroids under gravity):
 *   syncDynamicToMeshes  → reads physics engine positions → mesh + data record
 */

import * as THREE from 'three';
import {
  addBody, removeBody, createPhysicsBody, updateStaticPosition,
} from './physics.js';

const _worldPos = new THREE.Vector3();

/**
 * Register all orbital nodes as static (gravity sources whose positions
 * are controlled by the orbital mechanics layer, not by integration).
 * @param {object} engine      result of createPhysicsEngine()
 * @param {Array}  nodes       [{ body, pivot, mesh }] from objectFactory
 */
export function registerStaticBodies(engine, nodes) {
  for (const { body, mesh } of nodes) {
    mesh.getWorldPosition(_worldPos);
    addBody(engine, createPhysicsBody({
      id:       body.id,
      mass:     body.mass ?? 1,
      position: { x: _worldPos.x, y: _worldPos.y, z: _worldPos.z },
      isStatic: true,
    }));
  }
}

/**
 * Register a spawned asteroid as a dynamic physics body.
 * @param {object} engine
 * @param {object} asteroidData  AsteroidData record with position + velocity
 * @param {number} [mass=1]
 */
export function registerAsteroidBody(engine, asteroidData, mass = 1) {
  addBody(engine, createPhysicsBody({
    id:       asteroidData.id,
    mass,
    position: asteroidData.position,
    velocity: asteroidData.velocity,
    isStatic: false,
  }));
}

/**
 * Remove a dynamic asteroid from the engine when it is despawned.
 * @param {object} engine
 * @param {string} id
 */
export function removeAsteroidBody(engine, id) {
  removeBody(engine, id);
}

/**
 * Copy current world positions of orbital meshes into their physics bodies.
 * Call this every tick BEFORE stepPhysics so that gravity from orbiting
 * planets reflects their latest position.
 * @param {object} engine
 * @param {Array}  nodes  [{ body, pivot, mesh }]
 */
export function syncStaticFromMeshes(engine, nodes) {
  for (const { body, mesh } of nodes) {
    mesh.getWorldPosition(_worldPos);
    updateStaticPosition(engine, body.id, _worldPos.x, _worldPos.y, _worldPos.z);
  }
}

/**
 * Write back physics-integrated positions to asteroid meshes and data records.
 * Only operates on asteroids where data.usePhysics === true.
 * Call this every tick AFTER stepPhysics.
 * @param {object} engine
 * @param {Array}  asteroids  [{ data: AsteroidData, mesh: THREE.Mesh }]
 */
export function syncDynamicToMeshes(engine, asteroids) {
  for (const { data, mesh } of asteroids) {
    if (!data.usePhysics) continue;
    const b = engine.bodies.get(data.id);
    if (!b) continue;
    data.position.x = b.x;  data.position.y = b.y;  data.position.z = b.z;
    data.velocity.x = b.vx; data.velocity.y = b.vy; data.velocity.z = b.vz;
    mesh.position.set(b.x, b.y, b.z);
  }
}
