/**
 * objectSearchLogic.js
 * Pure, DOM-free functions for the object search panel.
 * Separated so they can be tested without a browser environment.
 */

export const TYPE_ORDER = ['star', 'planet', 'moon', 'asteroid'];

export const TYPE_META = {
  star:     { icon: '★', color: '#ffd97a' },
  planet:   { icon: '●', color: '#7ac3ff' },
  moon:     { icon: '◌', color: '#aaaaaa' },
  asteroid: { icon: '·', color: '#aabb88' },
};

/**
 * Return display meta (icon, color) for a body type string.
 * Unknown types get a neutral fallback.
 * @param {string} type
 * @returns {{ icon: string, color: string }}
 */
export function getTypeMeta(type) {
  return TYPE_META[(type ?? '').toLowerCase()] ?? { icon: '?', color: '#888' };
}

/**
 * Sort nodes by type priority (stars first, then planets, moons, asteroids).
 * Does not mutate the input array.
 * @param {Array<{body: {type?: string}}>} nodes
 * @param {string[]} [order]  custom priority list (default TYPE_ORDER)
 * @returns {Array}
 */
export function sortNodesByType(nodes, order = TYPE_ORDER) {
  return [...nodes].sort((a, b) => {
    const ai = order.indexOf((a.body.type ?? '').toLowerCase());
    const bi = order.indexOf((b.body.type ?? '').toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

/**
 * Return true when an item matches a search query.
 * Matches against name, type, and id (case-insensitive).
 * An empty/whitespace-only query always matches.
 *
 * @param {{ nameLower: string, type: string, id: string }} item
 * @param {string} query
 * @returns {boolean}
 */
export function matchesQuery(item, query) {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return true;
  return item.nameLower.includes(q)
    || (item.type ?? '').toLowerCase().includes(q)
    || item.id.toLowerCase().includes(q);
}
