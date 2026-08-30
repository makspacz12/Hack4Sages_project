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
  uniform float     uAirless;
  uniform float     uHasMap;
  uniform float uTime;
  uniform float uHeatIntensity;   // 0 = cool, 1 = burning

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    // Surface map where one is loaded, flat colour otherwise.
    //
    // The map REPLACES uColor rather than multiplying it. Multiplying was
    // colour times colour: the texture already carries the body's real
    // appearance, and scaling that by a saturated identity tint destroyed it.
    // Measured against the shipped maps, the subsolar result was
    //
    //   earth    mean 84,101,130  ->  29,101,214   red channel annihilated,
    //                                              so continents could not
    //                                              appear at all
    //   mars     mean 183,99,72   ->  263,50,7     one channel clipped, two
    //                                              crushed
    //   uranus   mean 155,203,210 ->  147,331,399  two channels clipped
    //   saturn, venus, jupiter, neptune all clipped or crushed as well
    //
    // Seven of the nine bodies were either blowing out to white or losing a
    // channel entirely, which is what made them read as grey mud. The Sun
    // escaped only by accident: its #FFD580 nearly matches its own texture,
    // so for that one body the multiply was close to a no-op. That accident
    // is the entire reason the Sun looked right while the planets did not.
    //
    // uColor is still the fallback when no map loaded, so a failed texture
    // fetch degrades to exactly what the scene looked like before textures
    // existed - the property the old comment was protecting, kept intact.
    vec3 base = uHasMap > 0.5
      ? texture2D(uMap, vUv).rgb
      : uColor;
    vec3 toSun   = normalize(-vWorldPos);
    vec3 toEye   = normalize(cameraPosition - vWorldPos);

    // Airless bodies are not Lambertian.
    //
    // Regolith backscatters: light returns toward its source rather than
    // spreading as cos(i). Measured on Bennu, the Lunar-Lambert partition is
    // L(a) = exp(-0.009a), so L(0) = 1.0 - at low phase the surface is PURE
    // Lommel-Seeliger with no Lambertian component at all, and the independent
    // Minnaert fit agrees at k = 0.530 (k = 0.5 is the Lommel-Seeliger limit).
    //   Golish et al. 2021, Icarus 357, 113724
    //
    // The visible consequence is exactly what makes real asteroid photographs
    // look unlike renders: a Lambertian sphere fades smoothly from the middle
    // outward and reads as a billiard ball, while a real airless body stays
    // evenly bright almost to the terminator and then falls off sharply.
    //
    // Applied only where it is true. The fragments are airless rock, and so
    // are Mercury and Mars; Jupiter and the other gas giants have no regolith
    // and no surface, so for them uAirless is 0 and the term stays Lambertian.
    float ci     = max(dot(vNormal, toSun), 0.0);
    float ce     = max(dot(vNormal, toEye), 0.0);
    float ls     = ci / max(ci + ce, 1e-4);
    // Lommel-Seeliger returns at most 0.5, so it is doubled to sit on the same
    // scale as the cosine it replaces.
    float diff   = mix(ci, ls * 2.0 * step(1e-4, ci), uAirless);

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
    // Fill from the camera, raised from 0.10 to 0.34.
    //
    // The lighting is physically right - the Sun is at the origin and lights
    // outward - but the default camera looks INWARD from beyond the swarm, so
    // the hemisphere facing it is the night side of every planet. Rendered
    // strictly, the scene is a bright Sun surrounded by black discs, which is
    // what the sky really looks like from out there and is useless to an
    // audience. The fill is the one term that lights what the viewer can
    // actually see, so it carries the surface detail here.
    float fill    = max(dot(vNormal, viewDir), 0.0) * 0.34;

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

    vec3 sunBase = uHasMap > 0.5 ? texture2D(uMap, vUv).rgb * 1.35 : uColor;
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
export function createPlanetMaterial(colorHex, map = null, airless = false) {
  return new THREE.ShaderMaterial({
    vertexShader:   PLANET_VERT,
    fragmentShader: PLANET_FRAG,
    uniforms: {
      uColor:         { value: new THREE.Color(colorHex) },
      uMap:           { value: map },
      uHasMap:        { value: map ? 1 : 0 },
      // Backscattering regolith, for bodies that actually have any. See the
      // note beside the diffuse term in PLANET_FRAG.
      uAirless:       { value: airless ? 1 : 0 },
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
