/**
 * replayController.js
 * Pure-data controller for frame-based simulation replay.
 * No Three.js dependency – all frame/time logic lives here.
 *
 * Usage:
 *   const ctrl = createReplayController(simData); // simData = parsed JSON
 *   playReplay(ctrl);
 *   // in render loop:
 *   if (tickReplay(ctrl, dtMs)) applyReplayFrame(ctrl, meshById);
 */

/**
 * Create a replay controller from parsed simulation JSON.
 * @param {object} simData  parsed simulation_template / solar_simulation JSON
 * @returns {object} controller
 */
export function createReplayController(simData) {
  return {
    frames:          simData.frames,
    meta:            simData.meta,
    objects:         simData.objects,
    currentFrame:    0,
    playing:         false,
    direction:       1,           // +1 forward, -1 rewind
    stepsPerSec:     simData.meta?.playbackFPS ?? 10,  // editable by UI
    scaleMultiplier: 1,           // runtime world-scale factor (editable by UI)
    _accumMs:        0,
  };
}

/** Total number of frames in this replay. */
export function replayFrameCount(ctrl) {
  return ctrl.frames.length;
}

/** Jump to a specific frame index (clamped). */
export function setReplayFrame(ctrl, index) {
  ctrl.currentFrame = Math.max(0, Math.min(ctrl.frames.length - 1, index));
  ctrl._accumMs = 0;
}

/** Step by ±delta frames. */
export function stepReplayFrame(ctrl, delta) {
  setReplayFrame(ctrl, ctrl.currentFrame + delta);
}

export function playReplay(ctrl)   { ctrl.playing = true; }
export function pauseReplay(ctrl)  { ctrl.playing = false; ctrl._accumMs = 0; }
export function toggleReplay(ctrl) { ctrl.playing = !ctrl.playing; ctrl._accumMs = 0; }

/** Set playback direction: +1 = forward, -1 = rewind. */
export function setReplayDirection(ctrl, dir) {
  ctrl.direction = dir > 0 ? 1 : -1;
}

/** Change how many simulation steps are played per second of wall-clock time. */
export function setReplayStepsPerSec(ctrl, n) {
  ctrl.stepsPerSec = Math.max(0.1, Number(n));
  ctrl._accumMs = 0;
}

/**
 * Advance internal timer by dtMs wall-clock milliseconds.
 * Returns true if the frame index changed (caller should re-apply frame).
 * Automatically pauses when reaching start or end.
 * @param {object} ctrl
 * @param {number} dtMs   wall-clock milliseconds since last call
 * @returns {boolean}
 */
export function tickReplay(ctrl, dtMs) {
  if (!ctrl.playing) return false;

  const msPerFrame = 1000 / Math.max(0.1, ctrl.stepsPerSec ?? ctrl.meta?.playbackFPS ?? 10);

  ctrl._accumMs += dtMs;
  if (ctrl._accumMs < msPerFrame) return false;

  const steps    = Math.floor(ctrl._accumMs / msPerFrame);
  ctrl._accumMs -= steps * msPerFrame;

  const prev     = ctrl.currentFrame;
  const next     = ctrl.currentFrame + steps * ctrl.direction;
  const clamped  = Math.max(0, Math.min(ctrl.frames.length - 1, next));
  ctrl.currentFrame = clamped;

  // Auto-pause at boundaries
  if (clamped === 0 || clamped === ctrl.frames.length - 1) {
    ctrl.playing  = false;
    ctrl._accumMs = 0;
  }

  return clamped !== prev;
}

/**
 * Return the positions array of the current frame.
 * @returns {Array<{ id, x, y, z }>}
 */
export function getFramePositions(ctrl) {
  return ctrl.frames[ctrl.currentFrame]?.positions ?? [];
}

/**
 * Return the simulation time of the current frame.
 * @returns {number}
 */
export function getFrameTime(ctrl) {
  return ctrl.frames[ctrl.currentFrame]?.time ?? 0;
}

/**
 * Apply current frame's positions to a map of Three.js meshes.
 * positionScale from meta is applied automatically.
 * @param {object}            ctrl
 * @param {Map<string,object>} meshById  id → THREE.Mesh (or any {position.set})
 */
export function applyReplayFrame(ctrl, meshById) {
  const scale = (ctrl.meta?.positionScale ?? 1) * (ctrl.scaleMultiplier ?? 1);
  for (const { id, x, y, z } of getFramePositions(ctrl)) {
    const mesh = meshById.get(id);
    if (mesh) mesh.position.set(x * scale, y * scale, z * scale);
  }
}

/**
 * Like applyReplayFrame but linearly interpolates between the current frame
 * and the next frame (in playback direction) using the sub-frame accumulator.
 *
 * Should be called every render tick when smooth motion is enabled —
 * it reads ctrl._accumMs to derive t ∈ [0, 1).
 *
 * @param {object}             ctrl
 * @param {Map<string,object>}  meshById
 */
export function applyReplayFrameLerp(ctrl, meshById) {
  const scale      = (ctrl.meta?.positionScale ?? 1) * (ctrl.scaleMultiplier ?? 1);
  const msPerFrame = 1000 / Math.max(0.1, ctrl.stepsPerSec ?? ctrl.meta?.playbackFPS ?? 10);
  // t ∈ [0,1): how far we are into the *next* frame interval
  const t          = ctrl.playing ? Math.min(1, Math.max(0, ctrl._accumMs / msPerFrame)) : 0;

  const frameA = ctrl.frames[ctrl.currentFrame];
  if (!frameA) return;

  // In which direction are we heading?
  const nextIdx = Math.max(0, Math.min(ctrl.frames.length - 1, ctrl.currentFrame + ctrl.direction));
  const frameB  = (t > 0 && nextIdx !== ctrl.currentFrame) ? ctrl.frames[nextIdx] : null;

  if (!frameB) {
    // No next frame / paused — just apply current frame exactly
    const scale2 = scale; // already includes scaleMultiplier
    for (const { id, x, y, z } of frameA.positions ?? []) {
      const mesh = meshById.get(id);
      if (mesh) mesh.position.set(x * scale2, y * scale2, z * scale2);
    }
    return;
  }

  // Build id→pos lookup for frameB
  const posB = new Map((frameB.positions ?? []).map(p => [p.id, p]));

  for (const { id, x: x0, y: y0, z: z0 } of frameA.positions ?? []) {
    const mesh = meshById.get(id);
    if (!mesh) continue;
    const b = posB.get(id);
    if (!b) {
      mesh.position.set(x0 * scale, y0 * scale, z0 * scale);
      continue;
    }
    mesh.position.set(
      (x0 + (b.x - x0) * t) * scale,
      (y0 + (b.y - y0) * t) * scale,
      (z0 + (b.z - z0) * t) * scale,
    );
  }
}
