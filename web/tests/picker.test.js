/**
 * tests/picker.test.js
 * Tests for eventToNDC() and raycastMeshes().
 */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { eventToNDC, raycastMeshes } from '../src/picker.js';

// ─── eventToNDC ──────────────────────────────────────────────────────────────

describe('eventToNDC', () => {
  const makeEl = (left, top, width, height) => ({
    getBoundingClientRect: () => ({ left, top, width, height }),
  });

  it('returns (0, 0) for the center of the element', () => {
    const el  = makeEl(0, 0, 200, 100);
    const ndc = eventToNDC({ clientX: 100, clientY: 50 }, el);
    expect(ndc.x).toBeCloseTo(0);
    expect(ndc.y).toBeCloseTo(0);
  });

  it('returns (-1, 1) for top-left corner', () => {
    const el  = makeEl(0, 0, 200, 100);
    const ndc = eventToNDC({ clientX: 0, clientY: 0 }, el);
    expect(ndc.x).toBeCloseTo(-1);
    expect(ndc.y).toBeCloseTo(1);
  });

  it('returns (1, -1) for bottom-right corner', () => {
    const el  = makeEl(0, 0, 200, 100);
    const ndc = eventToNDC({ clientX: 200, clientY: 100 }, el);
    expect(ndc.x).toBeCloseTo(1);
    expect(ndc.y).toBeCloseTo(-1);
  });

  it('accounts for a non-zero element offset', () => {
    const el  = makeEl(50, 30, 200, 100);
    // click right at top-left of element
    const ndc = eventToNDC({ clientX: 50, clientY: 30 }, el);
    expect(ndc.x).toBeCloseTo(-1);
    expect(ndc.y).toBeCloseTo(1);
  });

  it('returns a THREE.Vector2 instance', () => {
    const el  = makeEl(0, 0, 100, 100);
    const ndc = eventToNDC({ clientX: 50, clientY: 50 }, el);
    expect(ndc).toBeInstanceOf(THREE.Vector2);
  });
});

// ─── raycastMeshes ───────────────────────────────────────────────────────────

describe('raycastMeshes', () => {
  function makeScene() {
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    // No explicit updateMatrixWorld – Three.js evaluates lazily during raycast.

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 16),
      new THREE.MeshBasicMaterial(),
    );
    mesh.position.set(0, 0, 0);
    scene.add(mesh);
    return { camera, mesh };
  }

  it('returns null when the mesh list is empty', () => {
    const { camera } = makeScene();
    const ndc    = new THREE.Vector2(0, 0);
    const result = raycastMeshes(ndc, camera, []);
    expect(result).toBeNull();
  });

  it('hits a sphere centred at origin when pointing straight at it', () => {
    const { camera, mesh } = makeScene();
    const result = raycastMeshes(new THREE.Vector2(0, 0), camera, [mesh]);
    expect(result).toBe(mesh);
  });

  it('returns null when pointing far off to the side', () => {
    const { camera, mesh } = makeScene();
    // NDC (0.99, 0.99) is near the corner, away from the centred sphere
    const result = raycastMeshes(new THREE.Vector2(0.99, 0.99), camera, [mesh]);
    expect(result).toBeNull();
  });

  it('returns the closest mesh when two overlap', () => {
    const { camera } = makeScene();

    // front at z=0 (origin, 10 units from camera), back at z=-5 (15 units away).
    // No explicit matrix updates – Three.js lazy-evaluates during raycast.
    const front = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), new THREE.MeshBasicMaterial());
    front.position.set(0, 0, 0);

    const back = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), new THREE.MeshBasicMaterial());
    back.position.set(0, 0, -5);

    const result = raycastMeshes(new THREE.Vector2(0, 0), camera, [front, back]);
    expect(result).toBe(front);
  });
});
