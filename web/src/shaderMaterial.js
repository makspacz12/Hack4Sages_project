/**
 * shaderMaterial.js
 * Custom GLSL shaders for celestial bodies.
 *
 *  - Planet shader: Phong diffuse + strong ambient floor + rim atmosphere glow
 *  - Sun shader: Emissive colour + pulsing corona rim glow
 */

import * as THREE from 'three';

// ─── GLSL ────────────────────────────────────────────────────────────────────

export const PLANET_VERT = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos     = worldPos.xyz;
    vNormal       = normalize(normalMatrix * normal);
    vUv           = uv;
    gl_Position   = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const PLANET_FRAG = /* glsl */`
  uniform vec3      uColor;
  uniform sampler2D uMap;
  uniform float     uHasMap;
  uniform float uTime;
  uniform float uHeatIntensity;   // 0 = cool, 1 = burning

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    // Surface map where one is loaded, flat colour otherwise. The map is
    // MULTIPLIED by uColor rather than replacing it, so a body keeps its
    // identity tint and a failed texture load degrades to exactly what the
    // scene looked like before textures existed.
    vec3 base = uHasMap > 0.5
      ? texture2D(uMap, vUv).rgb * uColor * 1.9
      : uColor;
    vec3 toSun   = normalize(-vWorldPos);
    float diff   = max(dot(vNormal, toSun), 0.0);

    // Ambient floor, kept low.
    //
    // This was 0.55, so more than half of every planet's brightness was a
    // constant independent of direction and the terminator - the day/night
    // boundary that makes a sphere read as a sphere - was almost invisible.
    // That was the whole reason the planets looked like flat discs. At 0.12
    // the unlit side is still legible on a projector, which is what the floor
    // is for, without drowning the shading that carries the shape.
    float ambient = 0.12;

    // Soft fill from the camera direction, so the night side is dark rather
    // than black. Also reduced: it was competing with the sunlight.
    vec3 viewDir  = normalize(cameraPosition - vWorldPos);
    float fill    = max(dot(vNormal, viewDir), 0.0) * 0.10;

    // Specular highlight from sun.
    vec3 halfDir  = normalize(toSun + viewDir);
    float spec    = pow(max(dot(vNormal, halfDir), 0.0), 24.0) * 0.22;

    // Rim / atmosphere glow on planet edges.
    float rim     = 1.0 - max(dot(viewDir, vNormal), 0.0);
    rim           = pow(rim, 2.8) * 0.50;

    // Sunlight now dominates rather than merely tipping the balance.
    vec3 litColor = base * (ambient + diff * 1.15 + fill) + base * spec + vec3(rim * 0.30);

    // ── UV heat / burning effect ───────────────────────────
    if (uHeatIntensity > 0.001) {
      // Raw rim for fire effect (sharper falloff than atmosphere rim)
      float rawRim  = 1.0 - max(dot(viewDir, vNormal), 0.0);

      // Animated flicker: world-position noise approximation
      float flicker = 0.82 + 0.18 * sin(uTime * 11.0
                       + vWorldPos.x * 4.1 + vWorldPos.z * 3.3
                       + vWorldPos.y * 2.7);

      // Fire colour: nearly uniform orange with a subtle edge shift
      vec3 fireCoreColor = vec3(1.0, 0.55, 0.05);
      vec3 fireRimColor  = vec3(0.95, 0.30, 0.0);
      vec3 fireColor     = mix(fireCoreColor, fireRimColor, rawRim * 0.5);

      // Intensity: mostly flat across face, mild rim boost
      float faceHeat = uHeatIntensity * 0.55 * flicker;
      float rimHeat  = rawRim * 0.3 * uHeatIntensity * flicker;

      litColor += fireColor * (faceHeat + rimHeat);
    }

    gl_FragColor  = vec4(litColor, 1.0);
  }
`;

export const SUN_VERT = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos     = worldPos.xyz;
    vNormal       = normalize(normalMatrix * normal);
    vUv           = uv;
    gl_Position   = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const SUN_FRAG = /* glsl */`
  uniform vec3      uColor;
  uniform sampler2D uMap;
  uniform float     uHasMap;
  uniform float     uTime;

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    // Soft corona rim glow – bright on edges.
    float rim    = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float corona = pow(rim, 1.8) * 0.80;

    // Slow pulse for living-star feel.
    float pulse  = 0.93 + 0.07 * sin(uTime * 1.2);

    vec3 sunBase = uHasMap > 0.5 ? texture2D(uMap, vUv).rgb * uColor * 2.1 : uColor;
    vec3 col     = sunBase * pulse + sunBase * corona;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Material factories ───────────────────────────────────────────────────────

/**
 * Create a ShaderMaterial for a planet/moon.
 * Uniforms: uColor (vec3), uTime (float).
 * @param {string} colorHex  e.g. '#2E86AB'
 * @returns {THREE.ShaderMaterial}
 */
export function createPlanetMaterial(colorHex, map = null) {
  return new THREE.ShaderMaterial({
    vertexShader:   PLANET_VERT,
    fragmentShader: PLANET_FRAG,
    uniforms: {
      uColor:         { value: new THREE.Color(colorHex) },
      uMap:           { value: map },
      uHasMap:        { value: map ? 1 : 0 },
      uTime:          { value: 0 },
      uHeatIntensity: { value: 0 },
    },
  });
}

/**
 * Create a ShaderMaterial for an emissive star (sun).
 * Uniforms: uColor (vec3), uTime (float).
 * @param {string} colorHex  e.g. '#FDB813'
 * @returns {THREE.ShaderMaterial}
 */
export function createSunMaterial(colorHex, map = null) {
  return new THREE.ShaderMaterial({
    vertexShader:   SUN_VERT,
    fragmentShader: SUN_FRAG,
    uniforms: {
      uColor:  { value: new THREE.Color(colorHex) },
      uMap:    { value: map },
      uHasMap: { value: map ? 1 : 0 },
      uTime:   { value: 0 },
    },
  });
}

/**
 * Advance the uTime uniform on every shader material in the array.
 * Call once per frame, passing elapsed seconds.
 * @param {THREE.ShaderMaterial[]} materials
 * @param {number} elapsed  total elapsed seconds
 */
export function updateShaderTime(materials, elapsed) {
  for (const mat of materials) {
    if (mat.uniforms?.uTime !== undefined) {
      mat.uniforms.uTime.value = elapsed;
    }
  }
}
