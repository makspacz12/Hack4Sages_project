import { describe, it, expect } from 'vitest';
import {
  TYPE_ORDER,
  TYPE_META,
  getTypeMeta,
  sortNodesByType,
  matchesQuery,
} from '../src/objectSearchLogic.js';

// ── helpers ──────────────────────────────────────────────────────────────────
function makeNode(type, id = `${type}_1`, name = id) {
  return { body: { type, id, name } };
}

function makeItem(type, id, name = id) {
  return { type, id, nameLower: name.toLowerCase(), node: makeNode(type, id, name) };
}

// ── getTypeMeta ───────────────────────────────────────────────────────────────
describe('getTypeMeta', () => {
  it('returns meta for star', () => {
    const m = getTypeMeta('star');
    expect(m.icon).toBe('★');
    expect(m.color).toBe('#ffd97a');
  });

  it('returns meta for planet', () => {
    const m = getTypeMeta('planet');
    expect(m.icon).toBe('●');
    expect(m.color).toBe('#7ac3ff');
  });

  it('is case-insensitive (PLANET)', () => {
    expect(getTypeMeta('PLANET')).toEqual(getTypeMeta('planet'));
  });

  it('returns fallback for unknown type', () => {
    const m = getTypeMeta('galaxy');
    expect(m.icon).toBe('?');
    expect(m.color).toBe('#888');
  });

  it('returns fallback for undefined', () => {
    const m = getTypeMeta(undefined);
    expect(m.icon).toBe('?');
  });
});

// ── sortNodesByType ───────────────────────────────────────────────────────────
describe('sortNodesByType', () => {
  it('places stars before planets, planets before asteroids', () => {
    const nodes  = [makeNode('asteroid'), makeNode('planet'), makeNode('star')];
    const result = sortNodesByType(nodes);
    const types  = result.map(n => n.body.type);
    expect(types.indexOf('star')).toBeLessThan(types.indexOf('planet'));
    expect(types.indexOf('planet')).toBeLessThan(types.indexOf('asteroid'));
  });

  it('puts unknown types last', () => {
    const nodes  = [makeNode('nebula'), makeNode('star')];
    const result = sortNodesByType(nodes);
    expect(result[0].body.type).toBe('star');
    expect(result[result.length - 1].body.type).toBe('nebula');
  });

  it('does not mutate the input array', () => {
    const nodes = [makeNode('asteroid'), makeNode('star')];
    const copy  = [...nodes];
    sortNodesByType(nodes);
    expect(nodes).toEqual(copy);
  });

  it('accepts a custom order array', () => {
    const nodes  = [makeNode('star'), makeNode('planet')];
    const result = sortNodesByType(nodes, ['planet', 'star']);
    expect(result[0].body.type).toBe('planet');
  });
});

// ── matchesQuery ──────────────────────────────────────────────────────────────
describe('matchesQuery', () => {
  const earth = makeItem('planet', 'planet_earth', 'Earth');

  it('empty query matches everything', () => {
    expect(matchesQuery(earth, '')).toBe(true);
  });

  it('whitespace-only query matches everything', () => {
    expect(matchesQuery(earth, '   ')).toBe(true);
  });

  it('matches by nameLower', () => {
    expect(matchesQuery(earth, 'earth')).toBe(true);
  });

  it('matches by type', () => {
    expect(matchesQuery(earth, 'planet')).toBe(true);
  });

  it('matches by id', () => {
    expect(matchesQuery(earth, 'planet_earth')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesQuery(earth, 'EARTH')).toBe(true);
    expect(matchesQuery(earth, 'PLANET')).toBe(true);
  });

  it('returns false when nothing matches', () => {
    expect(matchesQuery(earth, 'xyz_no_match')).toBe(false);
  });
});
