/**
 * tests/objectFactory.test.js
 * Tests for geometry/material factories and createBodyNode.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createGeometry,
  createMaterial,
  createRingMesh,
  createBodyNode,
} from '../src/objectFactory.js';

// ─── createGeometry ──────────────────────────────────────────────────────────

describe('createGeometry', () => {
  it('returns a SphereGeometry', () => {
    const geo = createGeometry(1);
    expect(geo).toBeInstanceOf(THREE.SphereGeometry);
  });

  it('uses the supplied radius', () => {
    const geo = createGeometry(3);
    const params = geo.parameters;
    expect(params.radius).toBe(3);
  });

  it('defaults to 32 segments', () => {
    const geo = createGeometry(1);
    expect(geo.parameters.widthSegments).toBe(32);
  });

  it('accepts a custom segment count', () => {
    const geo = createGeometry(1, 16);
    expect(geo.parameters.widthSegments).toBe(16);
  });
});

// ─── createMaterial ──────────────────────────────────────────────────────────

describe('createMaterial', () => {
  it('returns a THREE.ShaderMaterial', () => {
    const mat = createMaterial('#ff0000', false);
    expect(mat).toBeInstanceOf(THREE.ShaderMaterial);
  });

  it('non-emissive material has a uColor uniform', () => {
    const mat = createMaterial('#aaaaaa', false);
    expect(mat.uniforms).toHaveProperty('uColor');
  });

  it('emissive material also has a uColor uniform', () => {
    const mat = createMaterial('#FDB813', true);
    expect(mat.uniforms).toHaveProperty('uColor');
  });

  it('emissive material uses a different fragment shader than non-emissive', () => {
    const planet = createMaterial('#aaaaaa', false);
    const sun    = createMaterial('#FDB813', true);
    expect(planet.fragmentShader).not.toBe(sun.fragmentShader);
  });
});

// ─── createRingMesh ──────────────────────────────────────────────────────────

describe('createRingMesh', () => {
  it('returns a THREE.Mesh', () => {
    const ring = createRingMesh(3, 5.5, '#C2A35A');
    expect(ring).toBeInstanceOf(THREE.Mesh);
  });

  it('ring is rotated 90 degrees around X (flat ring)', () => {
    const ring = createRingMesh(3, 5.5, '#C2A35A');
    expect(ring.rotation.x).toBeCloseTo(Math.PI / 2);
  });

  it('uses DoubleSide so it is visible from both faces', () => {
    const ring = createRingMesh(3, 5.5, '#C2A35A');
    expect(ring.material.side).toBe(THREE.DoubleSide);
  });
});

// ─── createBodyNode ──────────────────────────────────────────────────────────

describe('createBodyNode', () => {
  const earthBody = {
    id: 'earth',
    name: 'Earth',
    radius: 0.92,
    color: '#2E86AB',
    emissive: false,
    distance: 28,
    orbitalPeriod: 1.0,
    rotationSpeed: 0.01,
    tilt: 23.44,
    hasRings: false,
  };

  it('returns an object with pivot and mesh', () => {
    const { pivot, mesh } = createBodyNode(earthBody);
    expect(pivot).toBeInstanceOf(THREE.Group);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it('pivot name is "pivot_<id>"', () => {
    const { pivot } = createBodyNode(earthBody);
    expect(pivot.name).toBe('pivot_earth');
  });

  it('mesh position.x equals body.distance', () => {
    const { mesh } = createBodyNode(earthBody);
    expect(mesh.position.x).toBe(28);
  });

  it('mesh is child of pivot', () => {
    const { pivot, mesh } = createBodyNode(earthBody);
    expect(pivot.children).toContain(mesh);
  });

  it('adds a ring child when hasRings=true', () => {
    const saturnBody = {
      ...earthBody,
      id: 'saturn',
      hasRings: true,
      ringInnerRadius: 3,
      ringOuterRadius: 5.5,
      ringColor: '#C2A35A',
    };
    const { pivot } = createBodyNode(saturnBody);
    expect(pivot.children).toHaveLength(2); // sphere + ring
  });

  it('no ring child when hasRings=false', () => {
    const { pivot } = createBodyNode(earthBody);
    expect(pivot.children).toHaveLength(1);
  });
});
