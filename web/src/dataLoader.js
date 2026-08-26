/**
 * dataLoader.js
 * Handles loading and validation of solar-system data from JSON.
 */

const REQUIRED_BODY_FIELDS = ['id', 'name', 'radius', 'color', 'distance'];

/**
 * Fetch and parse a JSON file at the given URL.
 * @param {string} url
 * @returns {Promise<object>}
 */
export async function loadJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load JSON from "${url}": ${response.statusText}`);
  }
  return response.json();
}

/**
 * Validate that a body object contains all required fields with correct types.
 * @param {object} body
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateBody(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Body must be a non-null object'] };
  }

  for (const field of REQUIRED_BODY_FIELDS) {
    if (body[field] === undefined || body[field] === null) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  if (typeof body.radius === 'number' && body.radius <= 0) {
    errors.push('radius must be > 0');
  }
  if (typeof body.distance === 'number' && body.distance < 0) {
    errors.push('distance must be >= 0');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Recursively flatten a nested body tree into a flat array.
 * Each entry is annotated with a `parentId` field.
 * @param {object[]} bodies
 * @param {string|null} parentId
 * @returns {object[]}
 */
export function flattenBodies(bodies, parentId = null) {
  if (!Array.isArray(bodies)) return [];

  return bodies.reduce((acc, body) => {
    const flat = { ...body, parentId, children: undefined };
    acc.push(flat);
    if (Array.isArray(body.children) && body.children.length > 0) {
      acc.push(...flattenBodies(body.children, body.id));
    }
    return acc;
  }, []);
}

/**
 * Load the solar system JSON and return a flat, validated list of bodies.
 * Throws if any body fails validation.
 * @param {string} url
 * @returns {Promise<object[]>}
 */
export async function loadSolarSystem(url) {
  const data = await loadJSON(url);
  const flat = flattenBodies(data.bodies ?? []);

  for (const body of flat) {
    const { valid, errors } = validateBody(body);
    if (!valid) {
      throw new Error(`Invalid body "${body.id ?? '?'}": ${errors.join(', ')}`);
    }
  }

  return flat;
}
