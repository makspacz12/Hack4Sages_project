/**
 * tests/asteroidManager.test.js
 * Tests for createAsteroidData, createAsteroidMesh,
 * updateAsteroidPositions, addAsteroid, and removeAsteroid.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  createAsteroidData,
  createAsteroidMesh,
  updateAsteroidPositions,
  addAsteroid,
  removeAsteroid,
} from '../src/asteroidManager.js';

const baseParams = {
  position: { x: 10, y: 0, z: 5 },
  velocity: { x: 2, y: -1, z: 0 },
  radius: 0.3,
  color: '#aabbcc',
};

// ─── createAsteroidData ──────────────────────────────────────────────────────

describe('createAsteroidData', () => {
  it('returns an object with a unique id', () => {
    const a = createAsteroidData(baseParams);
    const b = createAsteroidData(baseParams);
    expect(a.id).not.toBe(b.id);
  });

  it('copies position values', () => {
    const data = createAsteroidData(baseParams);
    expect(data.position).toEqual({ x: 10, y: 0, z: 5 });
    // must be a copy, not the same reference
    expect(data.position).not.toBe(baseParams.position);
  });

  it('copies velocity values', () => {
    const data = createAsteroidData(baseParams);
    expect(data.velocity).toEqual({ x: 2, y: -1, z: 0 });
    expect(data.velocity).not.toBe(baseParams.velocity);
  });

  it('uses supplied radius', () => {
    expect(createAsteroidData(baseParams).radius).toBe(0.3);
  });

  it('defaults radius to 0.2 when omitted', () => {
    const { radius, ...rest } = baseParams;
    expect(createAsteroidData(rest).radius).toBe(0.2);
  });

  it('defaults color to #888888 when omitted', () => {
    const { color, ...rest } = baseParams;
    expect(createAsteroidData(rest).color).toBe('#888888');
  });
});

// ─── createAsteroidMesh ──────────────────────────────────────────────────────

describe('createAsteroidMesh', () => {
  it('returns a THREE.Mesh', () => {
    const data = createAsteroidData(baseParams);
    expect(createAsteroidMesh(data)).toBeInstanceOf(THREE.Mesh);
  });

  it('positions mesh at the data.position coordinates', () => {
    const data = createAsteroidData(baseParams);
    const mesh = createAsteroidMesh(data);
    expect(mesh.position.x).toBe(10);
    expect(mesh.position.y).toBe(0);
    expect(mesh.position.z).toBe(5);
  });

  it('sets mesh.name = data.id', () => {
    const data = createAsteroidData(baseParams);
    const mesh = createAsteroidMesh(data);
    expect(mesh.name).toBe(data.id);
  });
});

// ─── updateAsteroidPositions ─────────────────────────────────────────────────

describe('updateAsteroidPositions', () => {
  it('does not throw with an empty array', () => {
    expect(() => updateAsteroidPositions([], 0.016)).not.toThrow();
  });

  it('advances position by velocity × deltaSeconds', () => {
    const data = createAsteroidData({ position: { x: 0, y: 0, z: 0 }, velocity: { x: 10, y: 5, z: -3 } });
    const mesh = createAsteroidMesh(data);
    updateAsteroidPositions([{ data, mesh }], 1); // 1 second
    expect(data.position.x).toBeCloseTo(10);
    expect(data.position.y).toBeCloseTo(5);
    expect(data.position.z).toBeCloseTo(-3);
    expect(mesh.position.x).toBeCloseTo(10);
  });

  it('is additive across multiple calls', () => {
    const data = createAsteroidData({ position: { x: 0, y: 0, z: 0 }, velocity: { x: 1, y: 0, z: 0 } });
    const mesh = createAsteroidMesh(data);
    const node = { data, mesh };
    updateAsteroidPositions([node], 1);
    updateAsteroidPositions([node], 1);
    expect(data.position.x).toBeCloseTo(2);
  });

  it('handles negative velocity (object moving backwards)', () => {
    const data = createAsteroidData({ position: { x: 10, y: 0, z: 0 }, velocity: { x: -5, y: 0, z: 0 } });
    const mesh = createAsteroidMesh(data);
    updateAsteroidPositions([{ data, mesh }], 2);
    expect(data.position.x).toBeCloseTo(0);
  });

  it('syncs mesh.position to data.position after update', () => {
    const data = createAsteroidData(baseParams);
    const mesh = createAsteroidMesh(data);
    updateAsteroidPositions([{ data, mesh }], 0.5);
    expect(mesh.position.x).toBeCloseTo(data.position.x);
    expect(mesh.position.y).toBeCloseTo(data.position.y);
    expect(mesh.position.z).toBeCloseTo(data.position.z);
  });
});

// ─── addAsteroid / removeAsteroid ─────────────────────────────────────────────

describe('addAsteroid and removeAsteroid', () => {
  let scene;
  let asteroids;

  beforeEach(() => {
    scene     = new THREE.Scene();
    asteroids = [];
  });

  it('addAsteroid pushes an entry into the tracking array', () => {
    addAsteroid(scene, asteroids, baseParams);
    expect(asteroids).toHaveLength(1);
  });

  it('addAsteroid adds the mesh to the scene', () => {
    const { mesh } = addAsteroid(scene, asteroids, baseParams);
    expect(scene.children).toContain(mesh);
  });

  it('addAsteroid returns { data, mesh }', () => {
    const result = addAsteroid(scene, asteroids, baseParams);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('mesh');
  });

  it('removeAsteroid returns false for unknown id', () => {
    expect(removeAsteroid(scene, asteroids, 'nope')).toBe(false);
  });

  it('removeAsteroid removes the entry from the array', () => {
    const { data } = addAsteroid(scene, asteroids, baseParams);
    removeAsteroid(scene, asteroids, data.id);
    expect(asteroids).toHaveLength(0);
  });

  it('removeAsteroid removes the mesh from the scene', () => {
    const { data, mesh } = addAsteroid(scene, asteroids, baseParams);
    removeAsteroid(scene, asteroids, data.id);
    expect(scene.children).not.toContain(mesh);
  });

  it('removeAsteroid returns true when found', () => {
    const { data } = addAsteroid(scene, asteroids, baseParams);
    expect(removeAsteroid(scene, asteroids, data.id)).toBe(true);
  });
});
