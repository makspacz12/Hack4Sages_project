/**
 * animator.js
 * Controls the render loop and orbital/rotation updates.
 */

const TWO_PI = Math.PI * 2;

/**
 * Compute the orbital angle for a body at a given simulation time.
 * @param {number} orbitalPeriod  years (0 = no orbit)
 * @param {number} simTime        current simulation time in years
 * @returns {number}  angle in radians
 */
export function computeOrbitalAngle(orbitalPeriod, simTime) {
  if (orbitalPeriod === 0) return 0;
  return (simTime / Math.abs(orbitalPeriod)) * TWO_PI * Math.sign(orbitalPeriod);
}

/**
 * Update all body pivots and mesh rotations for the current simulation time.
 * @param {Array<{ body: object, pivot: THREE.Group, mesh: THREE.Mesh }>} nodes
 * @param {number} simTime
 * @param {number} [speed=1]  multiplier – 0 freezes self-rotation
 */
export function updateOrbits(nodes, simTime, speed = 1) {
  for (const { body, pivot, mesh } of nodes) {
    pivot.rotation.y = computeOrbitalAngle(body.orbitalPeriod ?? 0, simTime);
    mesh.rotation.y += (body.rotationSpeed ?? 0) * speed;
  }
}

/**
 * Build and start the animation loop.
 * Returns a stop() function that cancels the loop.
 *
 * @param {object} opts
 * @param {THREE.WebGLRenderer}  opts.renderer
 * @param {THREE.Scene}          opts.scene
 * @param {THREE.Camera}         opts.camera
 * @param {OrbitControls}        opts.controls
 * @param {Array}                opts.nodes      same array passed to updateOrbits
 * @param {() => number}         opts.getSpeed   callback returning sim speed multiplier
 * @param {(dt: number, simTime: number) => void} [opts.onTick]  extra per-frame callback (scaledDeltaSec, simTimeYears)
 * @returns {{ stop: () => void }}
 */
export function startAnimationLoop({ renderer, scene, camera, controls, nodes, getSpeed, onTick }) {
  let rafId = null;
  let simTime = 0;
  const clock = { last: performance.now() };

  function tick(now) {
    rafId = requestAnimationFrame(tick);

    const deltaMs    = now - clock.last;
    clock.last       = now;
    const deltaSec   = deltaMs / 1000;
    const deltaYears = deltaSec * 0.05 * getSpeed();
    simTime += deltaYears;

    updateOrbits(nodes, simTime, getSpeed());
    onTick?.(deltaSec * getSpeed(), simTime);
    controls.update();
    renderer.render(scene, camera);
  }

  rafId = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(rafId) };
}
