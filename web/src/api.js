/**
 * api.js
 * Client for the local simulation API (model/microbe_radiation_model/server.py).
 *
 * The server is optional. When it is not running - which is the normal case for
 * the deployed site, and for anyone without REBOUND installed - the visualizer
 * falls back to the replay shipped in public/data. Every function here reports
 * that cleanly rather than throwing, so the UI can show "offline" instead of
 * breaking.
 */

const DEFAULT_BASE = 'http://127.0.0.1:8000';

/** Where to reach the API: ?api=<url> overrides, otherwise localhost:8000. */
export function apiBase() {
  const override = new URLSearchParams(location.search).get('api');
  if (override) return override.replace(/\/+$/, '');
  return DEFAULT_BASE;
}

async function request(path, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(body.error ?? `HTTP ${response.status}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Is the API reachable, and can it actually integrate?
 * @returns {Promise<{online:boolean, rebound:boolean, reboundx:boolean, reason?:string}>}
 */
export async function health() {
  try {
    const body = await request('/api/health', {}, 2500);
    return { online: true, rebound: !!body.rebound, reboundx: !!body.reboundx };
  } catch (error) {
    return {
      online: false, rebound: false, reboundx: false,
      reason: error.name === 'AbortError' ? 'no response' : error.message,
    };
  }
}

/** Parameter schema and defaults, so the UI never drifts from the model. */
export async function parameters() {
  return request('/api/parameters', {}, 5000);
}

/** Start a run. Resolves with the initial run snapshot (status "queued"). */
export async function startRun(values) {
  return request('/api/runs', { method: 'POST', body: JSON.stringify(values) }, 15000);
}

/** Current status of a run. */
export async function runStatus(id) {
  return request(`/api/runs/${id}`, {}, 5000);
}

/** The finished replay. Large, so it gets a generous timeout. */
export async function runReplay(id) {
  return request(`/api/runs/${id}/replay`, {}, 120000);
}

/** Previously started runs, newest first. */
export async function listRuns() {
  return request('/api/runs', {}, 5000);
}

/**
 * Poll a run to completion.
 *
 * @param {string} id
 * @param {(snapshot:object) => void} onProgress
 * @param {{intervalMs?:number, signal?:AbortSignal}} [options]
 * @returns {Promise<object>} the final snapshot
 */
export async function waitForRun(id, onProgress, { intervalMs = 400, signal } = {}) {
  for (;;) {
    if (signal?.aborted) throw new Error('cancelled');
    const snapshot = await runStatus(id);
    onProgress?.(snapshot);
    if (snapshot.status === 'done' || snapshot.status === 'error') return snapshot;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
