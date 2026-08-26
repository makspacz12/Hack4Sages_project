/**
 * tests/shaderMaterial.test.js
 * Tests for createPlanetMaterial, createSunMaterial, and updateShaderTime.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createPlanetMaterial,
  createSunMaterial,
  updateShaderTime,
  PLANET_VERT,
  PLANET_FRAG,
  SUN_VERT,
  SUN_FRAG,
} from '../src/shaderMaterial.js';

// ─── createPlanetMaterial ─────────────────────────────────────────────────────

describe('createPlanetMaterial', () => {
  it('returns a THREE.ShaderMaterial', () => {
    expect(createPlanetMaterial('#2E86AB')).toBeInstanceOf(THREE.ShaderMaterial);
  });

  it('has a uColor uniform set to the provided colour', () => {
    const mat      = createPlanetMaterial('#ff0000');
    const expected = new THREE.Color('#ff0000');
    expect(mat.uniforms.uColor.value.r).toBeCloseTo(expected.r);
    expect(mat.uniforms.uColor.value.g).toBeCloseTo(expected.g);
    expect(mat.uniforms.uColor.value.b).toBeCloseTo(expected.b);
  });

  it('has a uTime uniform initially set to 0', () => {
    const mat = createPlanetMaterial('#aabbcc');
    expect(mat.uniforms.uTime.value).toBe(0);
  });

  it('uses the PLANET_VERT vertex shader', () => {
    const mat = createPlanetMaterial('#aabbcc');
    expect(mat.vertexShader).toBe(PLANET_VERT);
  });

  it('uses the PLANET_FRAG fragment shader', () => {
    const mat = createPlanetMaterial('#aabbcc');
    expect(mat.fragmentShader).toBe(PLANET_FRAG);
  });

  it('each call returns a new material instance', () => {
    const a = createPlanetMaterial('#fff');
    const b = createPlanetMaterial('#fff');
    expect(a).not.toBe(b);
  });
});

// ─── createSunMaterial ───────────────────────────────────────────────────────

describe('createSunMaterial', () => {
  it('returns a THREE.ShaderMaterial', () => {
    expect(createSunMaterial('#FDB813')).toBeInstanceOf(THREE.ShaderMaterial);
  });

  it('has a uColor uniform set to the provided colour', () => {
    const mat      = createSunMaterial('#FDB813');
    const expected = new THREE.Color('#FDB813');
    expect(mat.uniforms.uColor.value.r).toBeCloseTo(expected.r);
  });

  it('has a uTime uniform initially set to 0', () => {
    expect(createSunMaterial('#FDB813').uniforms.uTime.value).toBe(0);
  });

  it('uses the SUN_VERT vertex shader', () => {
    expect(createSunMaterial('#FDB813').vertexShader).toBe(SUN_VERT);
  });

  it('uses the SUN_FRAG fragment shader', () => {
    expect(createSunMaterial('#FDB813').fragmentShader).toBe(SUN_FRAG);
  });

  it('sun and planet materials use different fragment shaders', () => {
    const planet = createPlanetMaterial('#fff');
    const sun    = createSunMaterial('#fff');
    expect(planet.fragmentShader).not.toBe(sun.fragmentShader);
  });
});

// ─── updateShaderTime ─────────────────────────────────────────────────────────

describe('updateShaderTime', () => {
  it('does not throw for an empty array', () => {
    expect(() => updateShaderTime([], 1)).not.toThrow();
  });

  it('sets uTime.value to the provided elapsed time', () => {
    const mat = createPlanetMaterial('#fff');
    updateShaderTime([mat], 3.5);
    expect(mat.uniforms.uTime.value).toBe(3.5);
  });

  it('updates multiple materials in one call', () => {
    const m1 = createPlanetMaterial('#fff');
    const m2 = createSunMaterial('#FDB813');
    updateShaderTime([m1, m2], 7);
    expect(m1.uniforms.uTime.value).toBe(7);
    expect(m2.uniforms.uTime.value).toBe(7);
  });

  it('successive calls overwrite the previous time', () => {
    const mat = createPlanetMaterial('#fff');
    updateShaderTime([mat], 1);
    updateShaderTime([mat], 5);
    expect(mat.uniforms.uTime.value).toBe(5);
  });

  it('skips materials without a uTime uniform (no crash)', () => {
    const plain = new THREE.MeshBasicMaterial();
    expect(() => updateShaderTime([plain], 1)).not.toThrow();
  });

  it('elapsed=0 sets uTime to 0', () => {
    const mat = createPlanetMaterial('#fff');
    updateShaderTime([mat], 10);
    updateShaderTime([mat], 0);
    expect(mat.uniforms.uTime.value).toBe(0);
  });
});

// ─── GLSL sanity checks ───────────────────────────────────────────────────────

describe('GLSL shader strings', () => {
  it('PLANET_VERT contains "vNormal"', () => {
    expect(PLANET_VERT).toContain('vNormal');
  });

  it('PLANET_FRAG references "uColor"', () => {
    expect(PLANET_FRAG).toContain('uColor');
  });

  it('PLANET_FRAG references "uTime"', () => {
    expect(PLANET_FRAG).toContain('uTime');
  });

  it('PLANET_FRAG implements ambient lighting floor', () => {
    expect(PLANET_FRAG).toContain('ambient');
  });

  it('PLANET_FRAG implements rim lighting', () => {
    expect(PLANET_FRAG).toContain('rim');
  });

  it('SUN_FRAG references corona', () => {
    expect(SUN_FRAG).toContain('corona');
  });

  it('SUN_FRAG references pulse / sin for animation', () => {
    expect(SUN_FRAG).toContain('sin');
  });
});
