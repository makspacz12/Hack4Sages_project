import { describe, it, expect } from 'vitest';
import {
  createReplayController, setReplayFrame, stepReplayFrame,
  playReplay, pauseReplay, toggleReplay, setReplayDirection,
  setReplayStepsPerSec,
  tickReplay, getFramePositions, getFrameTime, applyReplayFrame,
  replayFrameCount,
} from '../src/replayController.js';

const makeSimData = (n = 5) => ({
  meta:    { playbackFPS: 10, positionScale: 1, timeUnit: 'yr' },
  objects: [],
  frames:  Array.from({ length: n }, (_, i) => ({
    frame:     i,
    time:      i * 0.1,
    positions: [{ id: 'planet', x: i * 2, y: 0, z: 0 }],
  })),
});

describe('createReplayController', () => {
  it('initialises with defaults', () => {
    const ctrl = createReplayController(makeSimData());
    expect(ctrl.currentFrame).toBe(0);
    expect(ctrl.playing).toBe(false);
    expect(ctrl.direction).toBe(1);
    expect(replayFrameCount(ctrl)).toBe(5);
  });
});

describe('setReplayFrame', () => {
  it('clamps below 0', () => { const c = createReplayController(makeSimData());
    setReplayFrame(c, -5); expect(c.currentFrame).toBe(0); });
  it('clamps above max', () => { const c = createReplayController(makeSimData());
    setReplayFrame(c, 99); expect(c.currentFrame).toBe(4); });
  it('sets valid index', () => { const c = createReplayController(makeSimData());
    setReplayFrame(c, 3); expect(c.currentFrame).toBe(3); });
});

describe('stepReplayFrame', () => {
  it('steps forward', () => { const c = createReplayController(makeSimData());
    stepReplayFrame(c, 2); expect(c.currentFrame).toBe(2); });
  it('clamps at boundary', () => { const c = createReplayController(makeSimData());
    setReplayFrame(c, 4); stepReplayFrame(c, 10); expect(c.currentFrame).toBe(4); });
});

describe('playReplay / pauseReplay / toggleReplay', () => {
  it('plays, pauses, toggles', () => {
    const c = createReplayController(makeSimData());
    playReplay(c);   expect(c.playing).toBe(true);
    pauseReplay(c);  expect(c.playing).toBe(false);
    toggleReplay(c); expect(c.playing).toBe(true);
  });
});

describe('tickReplay', () => {
  it('returns false when paused', () => {
    const c = createReplayController(makeSimData(10));
    expect(tickReplay(c, 200)).toBe(false);
  });

  it('advances frame after enough time', () => {
    const c = createReplayController(makeSimData(10));
    playReplay(c);
    // FPS=10 → msPerFrame=100; send 150 ms → should step 1 frame
    const changed = tickReplay(c, 150);
    expect(changed).toBe(true);
    expect(c.currentFrame).toBe(1);
  });

  it('auto-pauses at last frame', () => {
    const c = createReplayController(makeSimData(3));
    setReplayFrame(c, 1);
    playReplay(c);
    tickReplay(c, 500);   // enough time to reach end
    expect(c.currentFrame).toBe(2);
    expect(c.playing).toBe(false);
  });

  it('rewinds when direction = -1', () => {
    const c = createReplayController(makeSimData(5));
    setReplayFrame(c, 3);
    setReplayDirection(c, -1);
    playReplay(c);
    tickReplay(c, 150);
    expect(c.currentFrame).toBe(2);
  });

  it('auto-pauses at frame 0 when rewinding', () => {
    const c = createReplayController(makeSimData(5));
    setReplayFrame(c, 1);
    setReplayDirection(c, -1);
    playReplay(c);
    tickReplay(c, 500);
    expect(c.currentFrame).toBe(0);
    expect(c.playing).toBe(false);
  });

  it('respects stepsPerSec setting', () => {
    const c = createReplayController(makeSimData(10));
    // default fps=10 → 100 ms/frame; set to 20 steps/s → 50 ms/frame
    setReplayStepsPerSec(c, 20);
    playReplay(c);
    // 75 ms > 50 ms/frame → should advance 1 frame
    const changed = tickReplay(c, 75);
    expect(changed).toBe(true);
  });
});

describe('getFramePositions / getFrameTime', () => {
  it('returns correct position', () => {
    const c = createReplayController(makeSimData());
    setReplayFrame(c, 2);
    const pos = getFramePositions(c);
    expect(pos[0]).toMatchObject({ id: 'planet', x: 4 });
  });

  it('returns correct time', () => {
    const c = createReplayController(makeSimData());
    setReplayFrame(c, 3);
    expect(getFrameTime(c)).toBeCloseTo(0.3);
  });
});

describe('applyReplayFrame', () => {
  it('updates mesh positions', () => {
    const c = createReplayController(makeSimData());
    setReplayFrame(c, 2);
    const mesh = { position: { set: (...a) => Object.assign(mesh.position, { x: a[0], y: a[1], z: a[2] }) } };
    applyReplayFrame(c, new Map([['planet', mesh]]));
    expect(mesh.position.x).toBe(4);  // frame 2 → x = 2*2 = 4
  });
});
