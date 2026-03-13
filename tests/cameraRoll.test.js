/**
 * cameraRoll.test.js
 * Tests for tickCameraRoll – the pure frame-tick function.
 * createRollState is not unit-tested here (it touches window/DOM).
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { tickCameraRoll } from '../src/cameraRoll.js';

function makeCamera() {
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(0, 0, 100);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

describe('tickCameraRoll', () => {
  it('does nothing when no key is held', () => {
    const cam   = makeCamera();
    const upBefore = cam.up.clone();
    tickCameraRoll({ q: false, e: false }, cam, 0.016);
    expect(cam.up.x).toBeCloseTo(upBefore.x, 10);
    expect(cam.up.y).toBeCloseTo(upBefore.y, 10);
    expect(cam.up.z).toBeCloseTo(upBefore.z, 10);
  });

  it('camera.up stays unit length after E roll', () => {
    const cam = makeCamera();
    tickCameraRoll({ q: false, e: true }, cam, 0.1);
    expect(cam.up.length()).toBeCloseTo(1, 5);
  });

  it('camera.up stays unit length after Q roll', () => {
    const cam = makeCamera();
    tickCameraRoll({ q: true, e: false }, cam, 0.1);
    expect(cam.up.length()).toBeCloseTo(1, 5);
  });

  it('Q and E together cancel out (no net rotation)', () => {
    const cam      = makeCamera();
    const upBefore = cam.up.clone();
    tickCameraRoll({ q: true, e: true }, cam, 0.1);
    expect(cam.up.x).toBeCloseTo(upBefore.x, 10);
    expect(cam.up.y).toBeCloseTo(upBefore.y, 10);
    expect(cam.up.z).toBeCloseTo(upBefore.z, 10);
  });

  it('E rotates up in opposite direction to Q', () => {
    const camQ = makeCamera();
    const camE = makeCamera();
    tickCameraRoll({ q: true,  e: false }, camQ, 0.1);
    tickCameraRoll({ q: false, e: true  }, camE, 0.1);
    // The x-component of up should differ in sign
    expect(Math.sign(camQ.up.x)).not.toBe(0);
    expect(camQ.up.x).toBeCloseTo(-camE.up.x, 5);
  });

  it('longer dt produces larger rotation', () => {
    const cam1 = makeCamera();
    const cam2 = makeCamera();
    tickCameraRoll({ q: false, e: true }, cam1, 0.05);
    tickCameraRoll({ q: false, e: true }, cam2, 0.20);
    // cam2 should have rotated more – its up.x magnitude should be larger
    expect(Math.abs(cam2.up.x)).toBeGreaterThan(Math.abs(cam1.up.x));
  });
});
