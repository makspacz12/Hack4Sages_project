/**
 * tests/dataLoader.test.js
 * Tests for validateBody() and flattenBodies().
 */

import { describe, it, expect } from 'vitest';
import { validateBody, flattenBodies } from '../src/dataLoader.js';

// ─── validateBody ────────────────────────────────────────────────────────────

describe('validateBody', () => {
  const validBody = {
    id: 'earth',
    name: 'Earth',
    radius: 0.92,
    color: '#2E86AB',
    distance: 28,
  };

  it('returns valid=true for a correct body', () => {
    const result = validateBody(validBody);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid=false and lists error when id is missing', () => {
    const { id, ...bodyWithoutId } = validBody;
    const result = validateBody(bodyWithoutId);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('id'))).toBe(true);
  });

  it('returns valid=false and lists error when name is missing', () => {
    const { name, ...body } = validBody;
    const result = validateBody(body);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('name'))).toBe(true);
  });

  it('returns valid=false when radius is zero', () => {
    const result = validateBody({ ...validBody, radius: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('radius'))).toBe(true);
  });

  it('returns valid=false when radius is negative', () => {
    const result = validateBody({ ...validBody, radius: -1 });
    expect(result.valid).toBe(false);
  });

  it('returns valid=false when distance is negative', () => {
    const result = validateBody({ ...validBody, distance: -5 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('distance'))).toBe(true);
  });

  it('accepts distance = 0 (for the sun)', () => {
    const result = validateBody({ ...validBody, distance: 0 });
    expect(result.valid).toBe(true);
  });

  it('returns valid=false when called with null', () => {
    const result = validateBody(null);
    expect(result.valid).toBe(false);
  });

  it('returns valid=false when called with a primitive', () => {
    const result = validateBody('not-an-object');
    expect(result.valid).toBe(false);
  });

  it('reports multiple errors at once', () => {
    const result = validateBody({ id: 'x' }); // missing name, radius, color, distance
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

// ─── flattenBodies ───────────────────────────────────────────────────────────

describe('flattenBodies', () => {
  const sampleTree = [
    {
      id: 'sun',
      name: 'Sun',
      radius: 5,
      color: '#FDB813',
      distance: 0,
      children: [
        {
          id: 'earth',
          name: 'Earth',
          radius: 0.92,
          color: '#2E86AB',
          distance: 28,
          children: [
            {
              id: 'moon',
              name: 'Moon',
              radius: 0.25,
              color: '#AAA',
              distance: 2.5,
              children: [],
            },
          ],
        },
        {
          id: 'mars',
          name: 'Mars',
          radius: 0.5,
          color: '#C1440E',
          distance: 38,
          children: [],
        },
      ],
    },
  ];

  it('flattens a 3-level tree into 4 items', () => {
    const flat = flattenBodies(sampleTree);
    expect(flat).toHaveLength(4);
  });

  it('preserves all body ids', () => {
    const ids = flattenBodies(sampleTree).map(b => b.id);
    expect(ids).toContain('sun');
    expect(ids).toContain('earth');
    expect(ids).toContain('moon');
    expect(ids).toContain('mars');
  });

  it('sets parentId=null for root bodies', () => {
    const flat = flattenBodies(sampleTree);
    const sun = flat.find(b => b.id === 'sun');
    expect(sun.parentId).toBeNull();
  });

  it('sets parentId="sun" for direct children of sun', () => {
    const flat = flattenBodies(sampleTree);
    const earth = flat.find(b => b.id === 'earth');
    const mars  = flat.find(b => b.id === 'mars');
    expect(earth.parentId).toBe('sun');
    expect(mars.parentId).toBe('sun');
  });

  it('sets parentId="earth" for the moon', () => {
    const flat = flattenBodies(sampleTree);
    const moon = flat.find(b => b.id === 'moon');
    expect(moon.parentId).toBe('earth');
  });

  it('removes the children array from flat items', () => {
    const flat = flattenBodies(sampleTree);
    for (const body of flat) {
      expect(body.children).toBeUndefined();
    }
  });

  it('returns [] for an empty input array', () => {
    expect(flattenBodies([])).toEqual([]);
  });

  it('returns [] when input is not an array', () => {
    expect(flattenBodies(null)).toEqual([]);
    expect(flattenBodies(undefined)).toEqual([]);
  });

  it('handles a single body with no children', () => {
    const single = [{ id: 'x', name: 'X', radius: 1, color: '#fff', distance: 0, children: [] }];
    const flat = flattenBodies(single);
    expect(flat).toHaveLength(1);
    expect(flat[0].parentId).toBeNull();
  });
});
