/**
 * tests/animator.test.js
 * Tests for computeOrbitalAngle() and updateOrbits().
 */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { computeOrbitalAngle, updateOrbits } from '../src/animator.js';

// ─── computeOrbitalAngle ─────────────────────────────────────────────────────

describe('computeOrbitalAngle', () => {
  it('returns 0 when orbitalPeriod is 0 (sun has no orbit)', () => {
    expect(computeOrbitalAngle(0, 100)).toBe(0);
  });

  it('returns 0 at simTime = 0 regardless of period', () => {
    expect(computeOrbitalAngle(1, 0)).toBe(0);
    expect(computeOrbitalAngle(2.5, 0)).toBe(0);
  });

  it('returns 2π after exactly one orbital period', () => {
    const angle = computeOrbitalAngle(1, 1); // period=1yr, time=1yr
    expect(angle).toBeCloseTo(Math.PI * 2);
  });

  it('returns π after half an orbital period', () => {
    const angle = computeOrbitalAngle(1, 0.5);
    expect(angle).toBeCloseTo(Math.PI);
  });

  it('scales correctly for longer periods (Jupiter ~11.86 yr)', () => {
    const angle = computeOrbitalAngle(11.86, 11.86);
    expect(angle).toBeCloseTo(Math.PI * 2);
  });

  it('returns a negative angle for retrograde orbit (negative period)', () => {
    const angle = computeOrbitalAngle(-0.016, 0.016);
    expect(angle).toBeCloseTo(-Math.PI * 2);
  });

  it('angle grows linearly with simTime', () => {
    const a1 = computeOrbitalAngle(1, 1);
    const a2 = computeOrbitalAngle(1, 2);
    expect(a2).toBeCloseTo(a1 * 2);
  });
});

// ─── updateOrbits ────────────────────────────────────────────────────────────

describe('updateOrbits', () => {
  function makeFakeNode(overrides = {}) {
    const pivot = new THREE.Group();
    const mesh  = new THREE.Mesh();
    const body  = {
      orbitalPeriod: 1,
      rotationSpeed: 0.01,
      ...overrides,
    };
    return { body, pivot, mesh };
  }

  it('does not throw with an empty nodes array', () => {
    expect(() => updateOrbits([], 0)).not.toThrow();
  });

  it('updates pivot.rotation.y for a node with orbitalPeriod=1 at simTime=0.5', () => {
    const node = makeFakeNode({ orbitalPeriod: 1 });
    updateOrbits([node], 0.5);
    expect(node.pivot.rotation.y).toBeCloseTo(Math.PI);
  });

  it('does not change pivot.rotation.y for a body with orbitalPeriod=0', () => {
    const node = makeFakeNode({ orbitalPeriod: 0 });
    node.pivot.rotation.y = 0;
    updateOrbits([node], 999);
    expect(node.pivot.rotation.y).toBe(0);
  });

  it('increments mesh.rotation.y by rotationSpeed each call', () => {
    const node = makeFakeNode({ rotationSpeed: 0.05 });
    node.mesh.rotation.y = 0;
    updateOrbits([node], 0);
    expect(node.mesh.rotation.y).toBeCloseTo(0.05);
    updateOrbits([node], 0);
    expect(node.mesh.rotation.y).toBeCloseTo(0.1);
  });

  it('handles negative rotationSpeed (retrograde rotation)', () => {
    const node = makeFakeNode({ rotationSpeed: -0.02 });
    node.mesh.rotation.y = 0;
    updateOrbits([node], 0);
    expect(node.mesh.rotation.y).toBeCloseTo(-0.02);
  });

  it('updates multiple nodes independently', () => {
    const n1 = makeFakeNode({ orbitalPeriod: 1 });
    const n2 = makeFakeNode({ orbitalPeriod: 2 });
    updateOrbits([n1, n2], 1);
    expect(n1.pivot.rotation.y).toBeCloseTo(Math.PI * 2);
    expect(n2.pivot.rotation.y).toBeCloseTo(Math.PI);
  });
});

// ─── orbitLine helpers ───────────────────────────────────────────────────────

import { buildOrbitPoints } from '../src/orbitLine.js';

describe('buildOrbitPoints', () => {
  it('returns a Float32Array', () => {
    expect(buildOrbitPoints(10)).toBeInstanceOf(Float32Array);
  });

  it('has length = segments * 3', () => {
    const pts = buildOrbitPoints(10, 64);
    expect(pts.length).toBe(64 * 3);
  });

  it('first point is approximately (radius, 0, 0)', () => {
    const pts = buildOrbitPoints(10);
    expect(pts[0]).toBeCloseTo(10); // x
    expect(pts[1]).toBeCloseTo(0);  // y
    expect(pts[2]).toBeCloseTo(0);  // z
  });

  it('all y-components are 0 (orbit is flat on XZ plane)', () => {
    const pts = buildOrbitPoints(20, 32);
    for (let i = 0; i < 32; i++) {
      expect(pts[i * 3 + 1]).toBe(0);
    }
  });

  it('all points lie at distance ≈ radius from origin', () => {
    const r = 15;
    const pts = buildOrbitPoints(r, 64);
    for (let i = 0; i < 64; i++) {
      const x = pts[i * 3];
      const z = pts[i * 3 + 2];
      expect(Math.sqrt(x * x + z * z)).toBeCloseTo(r, 5);
    }
  });
});
