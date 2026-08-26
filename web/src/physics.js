/**
 * physics.js
 * Pure-data Newtonian gravity engine – zero Three.js dependency.
 *
 * Plug-in  API: updateStaticPosition(engine, id, x, y, z)
 * Plug-out API: getPositions(engine) → [{ id, x, y, z }]
 *
 * Static bodies (planets) contribute gravity but their positions are
 * set each frame by the orbital-mechanics layer via updateStaticPosition.
 * Dynamic bodies (asteroids) are fully integrated by stepPhysics.
 */

/**
 * Create a physics engine.
 * @param {{ G?: number, softening?: number }} [opts]
 *   G         – gravitational constant (tune for your unit scale, default 0.01)
 *   softening – distance floor preventing divide-by-zero at r≈0 (default 4)
 * @returns {{ bodies: Map, G: number, softening: number }}
 */
export function createPhysicsEngine({ G = 0.01, softening = 4 } = {}) {
  return { bodies: new Map(), G, softening };
}

/**
 * Create a physics body record.
 * @param {{ id, mass, position, velocity?, isStatic? }} params
 * @returns {object}
 */
export function createPhysicsBody({
  id, mass,
  position,
  velocity = { x: 0, y: 0, z: 0 },
  isStatic = false,
}) {
  return {
    id, mass, isStatic,
    x: position.x, y: position.y, z: position.z,
    vx: velocity.x, vy: velocity.y, vz: velocity.z,
  };
}

/** Add a body to the engine. */
export function addBody(engine, body) {
  engine.bodies.set(body.id, body);
}

/** Remove a body by id. Returns true if it existed. */
export function removeBody(engine, id) {
  return engine.bodies.delete(id);
}

/**
 * Advance the simulation by dt seconds.
 * Two-pass integration: all accelerations are computed from current positions,
 * then all velocities and positions are updated. This preserves Newton's 3rd
 * law symmetry and prevents leapfrog drift in N-body simulations.
 * Gravity kernel: a = G * m_other / (r² + ε²)  (softened)
 * @param {{ bodies: Map, G: number, softening: number }} engine
 * @param {number} dt  time step in seconds
 */
export function stepPhysics(engine, dt) {
  const { bodies, G, softening } = engine;
  const soft2 = softening * softening;
  const arr   = [...bodies.values()];

  // Pass 1: compute acceleration for every dynamic body.
  const accels = new Map();
  for (const b of arr) {
    if (b.isStatic) continue;
    let ax = 0, ay = 0, az = 0;
    for (const other of arr) {
      if (other.id === b.id) continue;
      const dx = other.x - b.x;
      const dy = other.y - b.y;
      const dz = other.z - b.z;
      const r2 = dx * dx + dy * dy + dz * dz + soft2;
      const r  = Math.sqrt(r2);
      const inv = (G * other.mass / r2) / r;
      ax += inv * dx;  ay += inv * dy;  az += inv * dz;
    }
    accels.set(b.id, { ax, ay, az });
  }

  // Pass 2: integrate velocity and position using the pre-computed accels.
  for (const b of arr) {
    if (b.isStatic) continue;
    const { ax, ay, az } = accels.get(b.id);
    b.vx += ax * dt;  b.vy += ay * dt;  b.vz += az * dt;
    b.x  += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  }
}

/**
 * Plug-out: returns a clean JSON-serialisable position array.
 * Suitable for sending to an external application.
 * @returns {Array<{ id: string, x: number, y: number, z: number }>}
 */
export function getPositions(engine) {
  return [...engine.bodies.values()].map(({ id, x, y, z }) => ({ id, x, y, z }));
}

/**
 * Plug-in: update a static body's position from an external source
 * (e.g. receiving data from another application, or from orbital mechanics).
 */
export function updateStaticPosition(engine, id, x, y, z) {
  const b = engine.bodies.get(id);
  if (!b) return;
  b.x = x;  b.y = y;  b.z = z;
}
