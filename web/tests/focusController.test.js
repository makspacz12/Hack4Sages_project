/**
 * tests/focusController.test.js
 * Tests for createFocusController, setFocusTarget, clearFocus, and updateFocus.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createFocusController,
  setFocusTarget,
  clearFocus,
  updateFocus,
  activateOrbit,
  deactivateOrbit,
  activateFollow,
  deactivateFollow,
} from '../src/focusController.js';

// ─── createFocusController ───────────────────────────────────────────────────

describe('createFocusController', () => {
  it('starts with active=false', () => {
    expect(createFocusController().active).toBe(false);
  });

  it('starts with target=null', () => {
    expect(createFocusController().target).toBeNull();
  });

  it('starts with orbitMode=false', () => {
    expect(createFocusController().orbitMode).toBe(false);
  });
});

// ─── setFocusTarget / clearFocus ─────────────────────────────────────────────

describe('setFocusTarget', () => {
  it('sets active=true when a mesh is provided', () => {
    const ctrl = createFocusController();
    const mesh = new THREE.Mesh();
    setFocusTarget(ctrl, mesh);
    expect(ctrl.active).toBe(true);
  });

  it('stores the mesh as ctrl.target', () => {
    const ctrl = createFocusController();
    const mesh = new THREE.Mesh();
    setFocusTarget(ctrl, mesh);
    expect(ctrl.target).toBe(mesh);
  });

  it('sets active=false when null is passed', () => {
    const ctrl = createFocusController();
    setFocusTarget(ctrl, new THREE.Mesh());
    setFocusTarget(ctrl, null);
    expect(ctrl.active).toBe(false);
  });
});

describe('clearFocus', () => {
  it('sets active=false', () => {
    const ctrl = createFocusController();
    setFocusTarget(ctrl, new THREE.Mesh());
    clearFocus(ctrl);
    expect(ctrl.active).toBe(false);
  });

  it('sets target=null', () => {
    const ctrl = createFocusController();
    setFocusTarget(ctrl, new THREE.Mesh());
    clearFocus(ctrl);
    expect(ctrl.target).toBeNull();
  });
});

// ─── updateFocus ─────────────────────────────────────────────────────────────

describe('updateFocus', () => {
  function makeCamera() {
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    cam.position.set(0, 0, 100);
    return cam;
  }

  function makeControls(target = new THREE.Vector3()) {
    // Minimal OrbitControls stub
    return { target: target.clone(), update: () => {} };
  }

  it('does not throw when ctrl.active=false', () => {
    const ctrl     = createFocusController();
    const camera   = makeCamera();
    const controls = makeControls();
    expect(() => updateFocus(ctrl, camera, controls)).not.toThrow();
  });

  it('moves controls.target exactly to the mesh world position', () => {
    const ctrl = createFocusController();

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1));
    mesh.position.set(50, 0, 0);
    setFocusTarget(ctrl, mesh);
    activateOrbit(ctrl); // orbit mode makes controls.target follow

    const camera   = makeCamera();
    const controls = makeControls(new THREE.Vector3(0, 0, 0));

    updateFocus(ctrl, camera, controls);
    // Target must be exactly at mesh world position (no lerp lag).
    expect(controls.target.x).toBeCloseTo(50);
    expect(controls.target.y).toBeCloseTo(0);
    expect(controls.target.z).toBeCloseTo(0);
  });

  it('does not push the camera position (zoom must stay user-controlled)', () => {
    const ctrl = createFocusController();

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1));
    mesh.position.set(50, 0, 0);
    setFocusTarget(ctrl, mesh);
    activateOrbit(ctrl);

    const camera   = makeCamera(); // camera at (0,0,100)
    const before   = camera.position.clone();
    const controls = makeControls(new THREE.Vector3(0, 0, 0));

    updateFocus(ctrl, camera, controls);
    expect(camera.position.x).toBeCloseTo(before.x);
    expect(camera.position.y).toBeCloseTo(before.y);
    expect(camera.position.z).toBeCloseTo(before.z);
  });

  it('tracks a moving mesh exactly across multiple frames', () => {
    const ctrl     = createFocusController();
    const mesh     = new THREE.Mesh(new THREE.SphereGeometry(1));
    const camera   = makeCamera();
    const controls = makeControls(new THREE.Vector3(0, 0, 0));
    setFocusTarget(ctrl, mesh);
    activateOrbit(ctrl);

    // Frame 1 – mesh at (10, 0, 0)
    mesh.position.set(10, 0, 0);
    mesh.updateMatrixWorld();
    updateFocus(ctrl, camera, controls);
    expect(controls.target.x).toBeCloseTo(10);

    // Frame 2 – mesh moved to (50, 20, -5) (fast asteroid)
    mesh.position.set(50, 20, -5);
    mesh.updateMatrixWorld();
    updateFocus(ctrl, camera, controls);
    expect(controls.target.x).toBeCloseTo(50);
    expect(controls.target.y).toBeCloseTo(20);
    expect(controls.target.z).toBeCloseTo(-5);
  });

  it('does not touch controls.target when active=false', () => {
    const ctrl     = createFocusController(); // active=false
    const camera   = makeCamera();
    const controls = makeControls(new THREE.Vector3(1, 2, 3));
    const before   = controls.target.clone();
    updateFocus(ctrl, camera, controls);
    expect(controls.target).toEqual(before);
  });

  it('does not touch controls.target in locked mode (orbitMode=false)', () => {
    const ctrl     = createFocusController();
    const mesh     = new THREE.Mesh();
    mesh.position.set(100, 0, 0);
    setFocusTarget(ctrl, mesh); // active=true but orbitMode stays false
    const camera   = makeCamera();
    const controls = makeControls(new THREE.Vector3(1, 2, 3));
    const before   = controls.target.clone();
    updateFocus(ctrl, camera, controls);
    expect(controls.target).toEqual(before);
  });

  it('clearFocus resets orbitMode and followMode', () => {
    const ctrl = createFocusController();
    const mesh = new THREE.Mesh();
    setFocusTarget(ctrl, mesh);
    activateOrbit(ctrl);
    activateFollow(ctrl);
    clearFocus(ctrl);
    expect(ctrl.orbitMode).toBe(false);
    expect(ctrl.followMode).toBe(false);
    expect(ctrl.active).toBe(false);
  });});