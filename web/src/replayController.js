import { stateToElements, propagateElements, keplerSafe } from './orbits.js';
import { displayWorldPosition, sunRadiusAU } from './sceneScale.js';

/**
 * replayController.js
 * Pure-data controller for frame-based simulation replay.
 * No Three.js dependency – all frame/time logic lives here.
 */

export function createReplayController(simData) {
  return {
    frames:          simData.frames,
    meta:            simData.meta,
    objects:         simData.objects,
    currentFrame:    0,
    playing:         false,
    direction:       1,
    stepsPerSec:     simData.meta?.playbackFPS ?? 10,
    scaleMultiplier: 1,
    smooth:          true,
    _accumMs:        0,
  };
}

export function replayFrameCount(ctrl) {
  return ctrl.frames.length;
}

export function setReplayFrame(ctrl, index) {
  ctrl.currentFrame = Math.max(0, Math.min(ctrl.frames.length - 1, index));
  ctrl._accumMs = 0;
}

export function stepReplayFrame(ctrl, delta) {
  setReplayFrame(ctrl, ctrl.currentFrame + delta);
}

export function playReplay(ctrl) {
  const last = ctrl.frames.length - 1;
  if (last >= 0) {
    if (ctrl.direction > 0 && ctrl.currentFrame >= last) {
      setReplayFrame(ctrl, 0);
    } else if (ctrl.direction < 0 && ctrl.currentFrame <= 0) {
      setReplayFrame(ctrl, last);
    }
  }
  ctrl.playing = true;
}

export function pauseReplay(ctrl)  { ctrl.playing = false; ctrl._accumMs = 0; }

export function toggleReplay(ctrl) {
  if (ctrl.playing) pauseReplay(ctrl);
  else playReplay(ctrl);
}

export function setReplayDirection(ctrl, dir) {
  ctrl.direction = dir > 0 ? 1 : -1;
}

export function setReplayStepsPerSec(ctrl, n) {
  ctrl.stepsPerSec = Math.max(0.1, Number(n));
  ctrl._accumMs = 0;
}

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

  if (clamped === 0 || clamped === ctrl.frames.length - 1) {
    ctrl.playing  = false;
    ctrl._accumMs = 0;
  }

  return clamped !== prev;
}

export function getFramePositions(ctrl) {
  return ctrl.frames[ctrl.currentFrame]?.positions ?? [];
}

export function getFrameTime(ctrl) {
  return ctrl.frames[ctrl.currentFrame]?.time ?? 0;
}

function replayDisplayContext(ctrl) {
  const frame = ctrl.frames[ctrl.currentFrame];
  const sunPos = frame?.positions?.find(p => p.id === 'sun') ?? { x: 0, y: 0, z: 0 };
  return {
    sunPos,
    sunRAU: sunRadiusAU(ctrl.objects),
    linear: ctrl.meta?.positionScale ?? 60,
    mult: ctrl.scaleMultiplier ?? 1,
  };
}

function placeReplayBody(mesh, posAU, ctx) {
  const w = displayWorldPosition(posAU, ctx.sunPos, ctx.sunRAU, ctx.linear, ctx.mult);
  mesh.position.set(w.x, w.y, w.z);
}

/**
 * Apply current frame's positions to a map of Three.js meshes.
 */
export function applyReplayFrame(ctrl, meshById) {
  const ctx = replayDisplayContext(ctrl);
  for (const p of getFramePositions(ctrl)) {
    const mesh = meshById.get(p.id);
    if (mesh) placeReplayBody(mesh, p, ctx);
  }
}

export function applyReplayFrameLerp(ctrl, meshById) {
  const msPerFrame = 1000 / Math.max(0.1, ctrl.stepsPerSec ?? ctrl.meta?.playbackFPS ?? 10);
  const t          = ctrl.playing ? Math.min(1, Math.max(0, ctrl._accumMs / msPerFrame)) : 0;

  const frameA = ctrl.frames[ctrl.currentFrame];
  if (!frameA) return;

  const nextIdx = Math.max(0, Math.min(ctrl.frames.length - 1, ctrl.currentFrame + ctrl.direction));
  const frameB  = (t > 0 && nextIdx !== ctrl.currentFrame) ? ctrl.frames[nextIdx] : null;

  const ctx = replayDisplayContext(ctrl);

  const place = (id, x, y, z) => {
    const mesh = meshById.get(id);
    if (mesh) placeReplayBody(mesh, { id, x, y, z }, ctx);
  };

  if (!frameB) {
    for (const { id, x, y, z } of frameA.positions ?? []) place(id, x, y, z);
    return;
  }

  const dtGap = (frameB.time - frameA.time);
  const dt    = dtGap * t;

  const sunPos = (frameA.positions ?? []).find(p => p.id === 'sun');
  const sunVel = (frameA.velocities ?? []).find(v => v.id === 'sun');
  const velById = new Map((frameA.velocities ?? []).map(v => [v.id, v]));
  const posB = new Map((frameB.positions ?? []).map(p => [p.id, p]));

  for (const p of frameA.positions ?? []) {
    const { id } = p;
    if (id === 'sun' || !sunPos) { place(id, p.x, p.y, p.z); continue; }

    const v = velById.get(id);
    if (!v) { place(id, p.x, p.y, p.z); continue; }

    const elements = stateToElements(
      { x: p.x - sunPos.x, y: p.y - sunPos.y, z: p.z - sunPos.z },
      {
        x: v.vx - (sunVel?.vx ?? 0),
        y: v.vy - (sunVel?.vy ?? 0),
        z: v.vz - (sunVel?.vz ?? 0),
      },
    );

    if (!elements || !keplerSafe(elements, dtGap)) {
      const b = posB.get(id);
      if (b) {
        place(id, p.x + (b.x - p.x) * t, p.y + (b.y - p.y) * t, p.z + (b.z - p.z) * t);
      } else {
        place(id, p.x, p.y, p.z);
      }
      continue;
    }

    const rel = propagateElements(elements, dt);
    if (!rel) { place(id, p.x, p.y, p.z); continue; }

    const sunB = posB.get('sun');
    const ox = sunB ? sunPos.x + (sunB.x - sunPos.x) * t : sunPos.x;
    const oy = sunB ? sunPos.y + (sunB.y - sunPos.y) * t : sunPos.y;
    const oz = sunB ? sunPos.z + (sunB.z - sunPos.z) * t : sunPos.z;

    place(id, rel.x + ox, rel.y + oy, rel.z + oz);
  }
}
