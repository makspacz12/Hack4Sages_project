/**
 * tests/physics.test.js
 * Unit tests for the pure-data physics engine (physics.js).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPhysicsEngine,
  createPhysicsBody,
  addBody,
  removeBody,
  stepPhysics,
  getPositions,
  updateStaticPosition,
} from '../src/physics.js';

// ─── createPhysicsEngine ─────────────────────────────────────────────────────

describe('createPhysicsEngine', () => {
  it('returns default G and softening', () => {
    const e = createPhysicsEngine();
    expect(e.G).toBe(0.01);
    expect(e.softening).toBe(4);
  });

  it('accepts custom G and softening', () => {
    const e = createPhysicsEngine({ G: 1, softening: 0.5 });
    expect(e.G).toBe(1);
    expect(e.softening).toBe(0.5);
  });

  it('starts with empty bodies map', () => {
    const e = createPhysicsEngine();
    expect(e.bodies.size).toBe(0);
  });
});

// ─── createPhysicsBody ───────────────────────────────────────────────────────

describe('createPhysicsBody', () => {
  it('stores id, mass, position components', () => {
    const b = createPhysicsBody({ id: 'earth', mass: 100, position: { x: 1, y: 2, z: 3 } });
    expect(b.id).toBe('earth');
    expect(b.mass).toBe(100);
    expect(b.x).toBe(1);
    expect(b.y).toBe(2);
    expect(b.z).toBe(3);
  });

  it('defaults velocity to zero', () => {
    const b = createPhysicsBody({ id: 'r', mass: 1, position: { x: 0, y: 0, z: 0 } });
    expect(b.vx).toBe(0);
    expect(b.vy).toBe(0);
    expect(b.vz).toBe(0);
  });

  it('accepts explicit velocity', () => {
    const b = createPhysicsBody({
      id: 'r', mass: 1,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 1, y: 2, z: 3 },
    });
    expect(b.vx).toBe(1);
    expect(b.vy).toBe(2);
    expect(b.vz).toBe(3);
  });

  it('defaults isStatic to false', () => {
    const b = createPhysicsBody({ id: 'r', mass: 1, position: { x: 0, y: 0, z: 0 } });
    expect(b.isStatic).toBe(false);
  });

  it('stores isStatic: true when provided', () => {
    const b = createPhysicsBody({ id: 'r', mass: 1, position: { x: 0, y: 0, z: 0 }, isStatic: true });
    expect(b.isStatic).toBe(true);
  });
});

// ─── addBody / removeBody ────────────────────────────────────────────────────

describe('addBody', () => {
  it('adds body to engine', () => {
    const e = createPhysicsEngine();
    const b = createPhysicsBody({ id: 'sun', mass: 1e6, position: { x: 0, y: 0, z: 0 } });
    addBody(e, b);
    expect(e.bodies.size).toBe(1);
    expect(e.bodies.get('sun')).toBe(b);
  });

  it('overwrites existing body with same id', () => {
    const e = createPhysicsEngine();
    addBody(e, createPhysicsBody({ id: 'x', mass: 1, position: { x: 0, y: 0, z: 0 } }));
    addBody(e, createPhysicsBody({ id: 'x', mass: 2, position: { x: 1, y: 0, z: 0 } }));
    expect(e.bodies.size).toBe(1);
    expect(e.bodies.get('x').mass).toBe(2);
  });
});

describe('removeBody', () => {
  it('returns true when body existed', () => {
    const e = createPhysicsEngine();
    addBody(e, createPhysicsBody({ id: 'a', mass: 1, position: { x: 0, y: 0, z: 0 } }));
    expect(removeBody(e, 'a')).toBe(true);
    expect(e.bodies.size).toBe(0);
  });

  it('returns false when body did not exist', () => {
    const e = createPhysicsEngine();
    expect(removeBody(e, 'missing')).toBe(false);
  });
});

// ─── stepPhysics ─────────────────────────────────────────────────────────────

describe('stepPhysics', () => {
  it('does not move a static body', () => {
    const e = createPhysicsEngine({ G: 1, softening: 0 });
    addBody(e, createPhysicsBody({
      id: 'attractor', mass: 1000,
      position: { x: 0, y: 0, z: 0 },
      isStatic: true,
    }));
    const s = createPhysicsBody({ id: 'static', mass: 1, position: { x: 10, y: 0, z: 0 }, isStatic: true });
    addBody(e, s);
    stepPhysics(e, 1);
    expect(s.x).toBe(10);
    expect(s.vx).toBe(0);
  });

  it('dynamic body is attracted toward a massive static body', () => {
    const e = createPhysicsEngine({ G: 1, softening: 0 });
    addBody(e, createPhysicsBody({ id: 'sun', mass: 10000, position: { x: 0, y: 0, z: 0 }, isStatic: true }));
    const ast = createPhysicsBody({ id: 'ast', mass: 1, position: { x: 10, y: 0, z: 0 } });
    addBody(e, ast);
    stepPhysics(e, 0.1);
    // velocity x should become negative (attracted toward sun at x=0)
    expect(ast.vx).toBeLessThan(0);
    // position x should decrease
    expect(ast.x).toBeLessThan(10);
  });

  it('two dynamic bodies attract each other symmetrically', () => {
    const e = createPhysicsEngine({ G: 1, softening: 0 });
    const b1 = createPhysicsBody({ id: 'b1', mass: 100, position: { x: -5, y: 0, z: 0 } });
    const b2 = createPhysicsBody({ id: 'b2', mass: 100, position: { x:  5, y: 0, z: 0 } });
    addBody(e, b1);
    addBody(e, b2);
    stepPhysics(e, 0.1);
    // b1 pulled right, b2 pulled left
    expect(b1.vx).toBeGreaterThan(0);
    expect(b2.vx).toBeLessThan(0);
    // By symmetry magnitudes should be equal
    expect(Math.abs(b1.vx)).toBeCloseTo(Math.abs(b2.vx), 10);
  });

  it('heavily softened interaction does not crash', () => {
    const e = createPhysicsEngine({ G: 1, softening: 1000 });
    addBody(e, createPhysicsBody({ id: 'a', mass: 1e9, position: { x: 0, y: 0, z: 0 } }));
    const d = createPhysicsBody({ id: 'd', mass: 1, position: { x: 0, y: 0, z: 0 } });
    addBody(e, d);
    expect(() => stepPhysics(e, 1)).not.toThrow();
  });

  it('zero bodies does not throw', () => {
    expect(() => stepPhysics(createPhysicsEngine(), 1)).not.toThrow();
  });
});

// ─── getPositions ─────────────────────────────────────────────────────────────

describe('getPositions', () => {
  it('returns array of { id, x, y, z } for each body', () => {
    const e = createPhysicsEngine();
    addBody(e, createPhysicsBody({ id: 'p1', mass: 1, position: { x: 1, y: 2, z: 3 } }));
    addBody(e, createPhysicsBody({ id: 'p2', mass: 1, position: { x: 4, y: 5, z: 6 } }));
    const pos = getPositions(e);
    expect(pos).toHaveLength(2);
    expect(pos[0]).toMatchObject({ id: 'p1', x: 1, y: 2, z: 3 });
    expect(pos[1]).toMatchObject({ id: 'p2', x: 4, y: 5, z: 6 });
  });

  it('returned objects do not have velocity or mass keys (clean JSON)', () => {
    const e = createPhysicsEngine();
    addBody(e, createPhysicsBody({ id: 'x', mass: 99, position: { x: 0, y: 0, z: 0 } }));
    const entry = getPositions(e)[0];
    expect(Object.keys(entry).sort()).toEqual(['id', 'x', 'y', 'z']);
  });

  it('returns empty array for empty engine', () => {
    expect(getPositions(createPhysicsEngine())).toEqual([]);
  });
});

// ─── updateStaticPosition ─────────────────────────────────────────────────────

describe('updateStaticPosition', () => {
  it('moves a static body to new coordinates', () => {
    const e = createPhysicsEngine();
    addBody(e, createPhysicsBody({ id: 's', mass: 1, position: { x: 0, y: 0, z: 0 }, isStatic: true }));
    updateStaticPosition(e, 's', 10, 20, 30);
    const b = e.bodies.get('s');
    expect(b.x).toBe(10);
    expect(b.y).toBe(20);
    expect(b.z).toBe(30);
  });

  it('does nothing when id is not in engine', () => {
    expect(() => updateStaticPosition(createPhysicsEngine(), 'ghost', 0, 0, 0)).not.toThrow();
  });
});
