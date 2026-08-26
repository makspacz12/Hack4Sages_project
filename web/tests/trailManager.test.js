/**
 * tests/trailManager.test.js
 * Tests for the comet trail system (trailManager.js).
 *
 * THREE.BufferGeometry / BufferAttribute work in Node without WebGL,
 * but THREE.WebGLRenderer is never constructed here so no GPU is needed.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  createTrail,
  updateTrail,
  clearTrail,
  removeTrail,
  setTrailsVisible,
  buildTrailPositions,
  setTrailHistory,
  setTrailColor,
} from '../src/trailManager.js';

/** Minimal scene stub that records add/remove calls. */
function makeScene() {
  const children = [];
  return {
    add:    (o) => children.push(o),
    remove: (o) => { const i = children.indexOf(o); if (i >= 0) children.splice(i, 1); },
    children,
  };
}

// ─── createTrail ─────────────────────────────────────────────────────────────

describe('createTrail', () => {
  it('adds a Line to the scene', () => {
    const scene = makeScene();
    createTrail(scene, '#ff0000');
    expect(scene.children).toHaveLength(1);
    expect(scene.children[0]).toBeInstanceOf(THREE.Line);
  });

  it('returns a record with empty history', () => {
    const trail = createTrail(makeScene(), '#ffffff');
    expect(trail.history).toEqual([]);
  });

  it('uses supplied maxLen default of 80', () => {
    const trail = createTrail(makeScene(), '#ffffff');
    expect(trail.maxLen).toBe(80);
  });

  it('respects a custom maxLen', () => {
    const trail = createTrail(makeScene(), '#ffffff', 20);
    expect(trail.maxLen).toBe(20);
  });

  it('stores the colorHex', () => {
    const trail = createTrail(makeScene(), '#aabbcc');
    expect(trail.colorHex).toBe('#aabbcc');
  });

  it('starts with drawRange count = 0', () => {
    const trail = createTrail(makeScene(), '#ffffff');
    expect(trail.line.geometry.drawRange.count).toBe(0);
  });

  it('sets frustumCulled = false', () => {
    const trail = createTrail(makeScene(), '#ffffff');
    expect(trail.line.frustumCulled).toBe(false);
  });
});

// ─── updateTrail ─────────────────────────────────────────────────────────────

describe('updateTrail', () => {
  it('prepends each position to history (newest first)', () => {
    const trail = createTrail(makeScene(), '#ff0000');
    updateTrail(trail, 1, 0, 0);
    updateTrail(trail, 2, 0, 0);
    updateTrail(trail, 3, 0, 0);
    expect(trail.history[0]).toEqual({ x: 3, y: 0, z: 0 });
    expect(trail.history[1]).toEqual({ x: 2, y: 0, z: 0 });
    expect(trail.history[2]).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('caps history at maxLen', () => {
    const trail = createTrail(makeScene(), '#ff0000', 5);
    for (let i = 0; i < 10; i++) updateTrail(trail, i, 0, 0);
    expect(trail.history).toHaveLength(5);
  });

  it('updates drawRange count to history length', () => {
    const trail = createTrail(makeScene(), '#ff0000');
    updateTrail(trail, 0, 0, 0);
    updateTrail(trail, 1, 0, 0);
    expect(trail.line.geometry.drawRange.count).toBe(2);
  });

  it('sets position buffer correctly', () => {
    const trail = createTrail(makeScene(), '#ffffff');
    updateTrail(trail, 7, 8, 9);
    const pos = trail.line.geometry.getAttribute('position');
    expect(pos.getX(0)).toBeCloseTo(7);
    expect(pos.getY(0)).toBeCloseTo(8);
    expect(pos.getZ(0)).toBeCloseTo(9);
  });

  it('head vertex has full colour, tail vertex is dark', () => {
    const trail = createTrail(makeScene(), '#ffffff', 10);
    for (let i = 0; i < 10; i++) updateTrail(trail, i, 0, 0);
    const col = trail.line.geometry.getAttribute('color');
    // Head (index 0) should be white (≈1,1,1)
    expect(col.getX(0)).toBeCloseTo(1, 1);
    // Tail (index 9) should be near black (≈0,0,0)
    expect(col.getX(9)).toBeCloseTo(0, 1);
  });
});

// ─── clearTrail ──────────────────────────────────────────────────────────────

describe('clearTrail', () => {
  it('empties the history array', () => {
    const trail = createTrail(makeScene(), '#ff0000');
    updateTrail(trail, 1, 2, 3);
    clearTrail(trail);
    expect(trail.history).toHaveLength(0);
  });

  it('resets drawRange count to 0', () => {
    const trail = createTrail(makeScene(), '#ff0000');
    updateTrail(trail, 1, 2, 3);
    clearTrail(trail);
    expect(trail.line.geometry.drawRange.count).toBe(0);
  });
});

// ─── removeTrail ─────────────────────────────────────────────────────────────

describe('removeTrail', () => {
  it('removes the line from the scene', () => {
    const scene = makeScene();
    const trail = createTrail(scene, '#ff0000');
    removeTrail(scene, trail);
    expect(scene.children).toHaveLength(0);
  });
});

// ─── setTrailsVisible ────────────────────────────────────────────────────────

describe('setTrailsVisible', () => {
  it('hides all trails and clears histories when visible=false', () => {
    const scene = makeScene();
    const t1 = createTrail(scene, '#ff0000');
    const t2 = createTrail(scene, '#00ff00');
    updateTrail(t1, 1, 0, 0);
    updateTrail(t2, 2, 0, 0);
    const map = new Map([['a', t1], ['b', t2]]);

    setTrailsVisible(map, false);

    expect(t1.line.visible).toBe(false);
    expect(t2.line.visible).toBe(false);
    expect(t1.history).toHaveLength(0);
    expect(t2.history).toHaveLength(0);
  });

  it('shows all trails when visible=true', () => {
    const scene = makeScene();
    const t1 = createTrail(scene, '#ff0000');
    t1.line.visible = false;
    const map = new Map([['a', t1]]);
    setTrailsVisible(map, true);
    expect(t1.line.visible).toBe(true);
  });

  it('does nothing on empty map', () => {
    expect(() => setTrailsVisible(new Map(), true)).not.toThrow();
  });
});

// ─── buildTrailPositions ──────────────────────────────────────────────────────

/**
 * Helper: build a minimal ctrl.frames-like array.
 * Each frame has a `positions` array with one entry per id.
 */
function makeFrames(ids, count) {
  return Array.from({ length: count }, (_, i) =>
    ({ positions: ids.map(id => ({ id, x: i, y: i * 2, z: 0 })) })
  );
}

describe('buildTrailPositions', () => {
  it('returns empty array when frames is empty', () => {
    expect(buildTrailPositions([], 0, 10, 'obj1')).toEqual([]);
  });

  it('returns positions newest-first (head at index 0)', () => {
    const frames = makeFrames(['a'], 5); // frames 0..4, x = frame index
    const result = buildTrailPositions(frames, 3, 4, 'a');
    expect(result[0].x).toBe(3); // currentFrame
    expect(result[1].x).toBe(2);
    expect(result[2].x).toBe(1);
    expect(result[3].x).toBe(0);
  });

  it('limits to trailLen positions', () => {
    const frames = makeFrames(['a'], 20);
    const result = buildTrailPositions(frames, 19, 5, 'a');
    expect(result).toHaveLength(5);
  });

  it('skips frames where object is missing', () => {
    const frames = makeFrames(['b'], 5); // 'a' is absent
    const result = buildTrailPositions(frames, 4, 5, 'a');
    expect(result).toHaveLength(0);
  });

  it('returns correct xyz values', () => {
    const frames = makeFrames(['obj'], 3);
    const result = buildTrailPositions(frames, 2, 3, 'obj');
    expect(result[0]).toEqual({ x: 2, y: 4, z: 0 });
    expect(result[1]).toEqual({ x: 1, y: 2, z: 0 });
  });

  it('handles currentFrame = 0', () => {
    const frames = makeFrames(['a'], 5);
    const result = buildTrailPositions(frames, 0, 10, 'a');
    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(0);
  });
});

// ─── setTrailHistory ─────────────────────────────────────────────────────────

describe('setTrailHistory', () => {
  it('sets trail.history to the provided positions', () => {
    const trail = createTrail(makeScene(), '#ffffff');
    const pos   = [{ x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 0 }];
    setTrailHistory(trail, pos);
    expect(trail.history).toEqual(pos);
  });

  it('truncates to trail.maxLen', () => {
    const trail = createTrail(makeScene(), '#ffffff', 2);
    const pos   = [{ x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }];
    setTrailHistory(trail, pos);
    expect(trail.history).toHaveLength(2);
  });

  it('updates drawRange count to match history length', () => {
    const trail = createTrail(makeScene(), '#ffffff');
    setTrailHistory(trail, [{ x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }]);
    expect(trail.line.geometry.drawRange.count).toBe(2);
  });

  it('clears geometry when given empty array', () => {
    const trail = createTrail(makeScene(), '#ffffff');
    updateTrail(trail, 5, 5, 5);
    setTrailHistory(trail, []);
    expect(trail.line.geometry.drawRange.count).toBe(0);
    expect(trail.history).toHaveLength(0);
  });
});

// ─── setTrailColor ────────────────────────────────────────────────────────────

describe('setTrailColor', () => {
  it('updates trail.colorHex', () => {
    const trail = createTrail(makeScene(), '#ff0000');
    setTrailColor(trail, '#00eeff');
    expect(trail.colorHex).toBe('#00eeff');
  });

  it('rebuilds geometry with the new colour (head vertex matches new color)', () => {
    const trail = createTrail(makeScene(), '#ff0000', 4);
    updateTrail(trail, 1, 0, 0);
    setTrailColor(trail, '#0000ff'); // pure blue
    const col = trail.line.geometry.getAttribute('color');
    // head (index 0): blue channel should be ~1, red ~0
    expect(col.getZ(0)).toBeCloseTo(1, 1);
    expect(col.getX(0)).toBeCloseTo(0, 1);
  });

  it('does not change history', () => {
    const trail = createTrail(makeScene(), '#aaaaaa');
    updateTrail(trail, 5, 5, 5);
    const before = [...trail.history];
    setTrailColor(trail, '#00eeff');
    expect(trail.history).toEqual(before);
  });
});
