/**
 * tests/physicsSync.test.js
 * Tests for the Three.js ⟷ physics-engine bridge (physicsSync.js).
 *
 * Mocks Three.js meshes with minimal stub objects so no WebGL is needed.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerStaticBodies,
  registerAsteroidBody,
  removeAsteroidBody,
  syncStaticFromMeshes,
  syncDynamicToMeshes,
} from '../src/physicsSync.js';
import {
  createPhysicsEngine,
  addBody,
  createPhysicsBody,
} from '../src/physics.js';

// Stub mesh: getWorldPosition fills a passed Vector3-like object.
function makeMesh(wx, wy, wz) {
  return {
    getWorldPosition(v) { v.x = wx; v.y = wy; v.z = wz; },
    position: { set(x, y, z) { this.x = x; this.y = y; this.z = z; }, x: 0, y: 0, z: 0 },
    _wx: wx, _wy: wy, _wz: wz,   // for mutation tests
  };
}

function makeNode(id, mass, wx, wy, wz) {
  return { body: { id, mass }, mesh: makeMesh(wx, wy, wz) };
}

// ─── registerStaticBodies ────────────────────────────────────────────────────

describe('registerStaticBodies', () => {
  it('adds one static physics body per node', () => {
    const engine = createPhysicsEngine();
    const nodes  = [makeNode('sun', 1000, 0, 0, 0), makeNode('earth', 100, 28, 0, 0)];
    registerStaticBodies(engine, nodes);
    expect(engine.bodies.size).toBe(2);
  });

  it('bodies are marked isStatic', () => {
    const engine = createPhysicsEngine();
    registerStaticBodies(engine, [makeNode('sun', 1000, 0, 0, 0)]);
    expect(engine.bodies.get('sun').isStatic).toBe(true);
  });

  it('uses mesh world position for initial placement', () => {
    const engine = createPhysicsEngine();
    registerStaticBodies(engine, [makeNode('earth', 100, 10, 5, -3)]);
    const b = engine.bodies.get('earth');
    expect(b.x).toBe(10);
    expect(b.y).toBe(5);
    expect(b.z).toBe(-3);
  });

  it('falls back to mass 1 when body.mass is undefined', () => {
    const engine = createPhysicsEngine();
    const node   = { body: { id: 'x' }, mesh: makeMesh(0, 0, 0) };
    registerStaticBodies(engine, [node]);
    expect(engine.bodies.get('x').mass).toBe(1);
  });
});

// ─── registerAsteroidBody ────────────────────────────────────────────────────

describe('registerAsteroidBody', () => {
  it('adds a dynamic body with correct id, mass and position', () => {
    const engine = createPhysicsEngine();
    const data   = { id: 'asteroid_1', position: { x: 5, y: 0, z: 10 }, velocity: { x: 1, y: 0, z: 0 } };
    registerAsteroidBody(engine, data, 7);
    const b = engine.bodies.get('asteroid_1');
    expect(b).toBeDefined();
    expect(b.mass).toBe(7);
    expect(b.isStatic).toBe(false);
    expect(b.x).toBe(5);
    expect(b.z).toBe(10);
  });

  it('defaults mass to 1 when omitted', () => {
    const engine = createPhysicsEngine();
    const data   = { id: 'a2', position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
    registerAsteroidBody(engine, data);
    expect(engine.bodies.get('a2').mass).toBe(1);
  });
});

// ─── removeAsteroidBody ───────────────────────────────────────────────────────

describe('removeAsteroidBody', () => {
  it('removes the body from the engine', () => {
    const engine = createPhysicsEngine();
    addBody(engine, createPhysicsBody({ id: 'ast', mass: 1, position: { x: 0, y: 0, z: 0 } }));
    removeAsteroidBody(engine, 'ast');
    expect(engine.bodies.has('ast')).toBe(false);
  });

  it('does not throw when body is missing', () => {
    expect(() => removeAsteroidBody(createPhysicsEngine(), 'ghost')).not.toThrow();
  });
});

// ─── syncStaticFromMeshes ─────────────────────────────────────────────────────

describe('syncStaticFromMeshes', () => {
  it('updates static body positions from mesh world positions', () => {
    const engine = createPhysicsEngine();
    const node   = makeNode('earth', 100, 0, 0, 0);
    registerStaticBodies(engine, [node]);

    // Simulate Earth orbiting — mesh world-position changes.
    node.mesh.getWorldPosition = (v) => { v.x = 20; v.y = 3; v.z = -1; };
    syncStaticFromMeshes(engine, [node]);

    const b = engine.bodies.get('earth');
    expect(b.x).toBe(20);
    expect(b.y).toBe(3);
    expect(b.z).toBe(-1);
  });

  it('ignores nodes whose id is not in the engine', () => {
    const engine = createPhysicsEngine();
    const node   = makeNode('missing', 1, 5, 5, 5);
    // Should not throw even though body was never registered.
    expect(() => syncStaticFromMeshes(engine, [node])).not.toThrow();
  });
});

// ─── syncDynamicToMeshes ─────────────────────────────────────────────────────

describe('syncDynamicToMeshes', () => {
  it('copies physics position back to mesh for physics-enabled asteroids', () => {
    const engine = createPhysicsEngine();
    const data   = { id: 'ast', usePhysics: true, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
    const mesh   = makeMesh(0, 0, 0);
    addBody(engine, createPhysicsBody({ id: 'ast', mass: 1, position: { x: 7, y: 2, z: -4 } }));
    // Manually force physics body to new position.
    const b = engine.bodies.get('ast');
    b.x = 7; b.y = 2; b.z = -4;

    syncDynamicToMeshes(engine, [{ data, mesh }]);

    expect(mesh.position.x).toBe(7);
    expect(mesh.position.y).toBe(2);
    expect(mesh.position.z).toBe(-4);
    expect(data.position).toEqual({ x: 7, y: 2, z: -4 });
  });

  it('skips asteroids where usePhysics is false', () => {
    const engine = createPhysicsEngine();
    const data   = { id: 'ast', usePhysics: false, position: { x: 0, y: 0, z: 0 }, velocity: {} };
    const mesh   = makeMesh(0, 0, 0);
    addBody(engine, createPhysicsBody({ id: 'ast', mass: 1, position: { x: 99, y: 99, z: 99 } }));

    syncDynamicToMeshes(engine, [{ data, mesh }]);

    expect(mesh.position.x).toBe(0);
  });

  it('skips asteroids whose id is not in the engine', () => {
    const engine = createPhysicsEngine();
    const data   = { id: 'orphan', usePhysics: true, position: { x: 5, y: 0, z: 0 }, velocity: {} };
    const mesh   = makeMesh(0, 0, 0);
    expect(() => syncDynamicToMeshes(engine, [{ data, mesh }])).not.toThrow();
    expect(mesh.position.x).toBe(0); // unchanged
  });

  it('also updates data.velocity from physics body', () => {
    const engine = createPhysicsEngine();
    const data   = { id: 'ast', usePhysics: true, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
    const mesh   = makeMesh(0, 0, 0);
    const b      = createPhysicsBody({ id: 'ast', mass: 1, position: { x: 0, y: 0, z: 0 }, velocity: { x: 3, y: -1, z: 2 } });
    addBody(engine, b);

    syncDynamicToMeshes(engine, [{ data, mesh }]);

    expect(data.velocity.x).toBe(3);
    expect(data.velocity.y).toBe(-1);
    expect(data.velocity.z).toBe(2);
  });
});
