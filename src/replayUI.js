/**
 * replayUI.js
 * Bottom player bar for frame-by-frame simulation replay.
 *
 * Controls:
 *   ⏮  first frame      ‹  step −1      ▶/⏸  play-pause
 *   ›  step +1           ⏭  last frame
 *   ━━━━━━━ scrubber ━━━━━━━
 *   Frame X / N  ·  t = T yr              step/s [___]
 *
 * Keyboard: Space/K=play-pause  ←/→=step  Home/End=jump
 */

import {
  setReplayFrame,
  stepReplayFrame,
  playReplay,
  pauseReplay,
  toggleReplay,
  setReplayDirection,
  setReplayStepsPerSec,
  replayFrameCount,
  getFrameTime,
} from './replayController.js';

// ── Styles ────────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('replay-ui-style')) return;
  const s = document.createElement('style');
  s.id = 'replay-ui-style';
  s.textContent = `
    #replay-bar {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      display: flex; flex-direction: column; gap: 5px;
      background: rgba(8, 10, 20, 0.90);
      border-top: 1px solid #2a3450;
      padding: 7px 20px 10px;
      font-family: monospace; font-size: 13px; color: #ccc;
      user-select: none; z-index: 900;
    }
    #replay-bar .rb-scrubber-row {
      display: flex; align-items: center; gap: 8px;
    }
    #replay-bar .rb-scrubber {
      flex: 1; cursor: pointer; accent-color: #5af; height: 4px;
    }
    #replay-bar .rb-controls {
      display: flex; align-items: center; justify-content: space-between;
    }
    #replay-bar .rb-btns { display: flex; gap: 4px; align-items: center; }
    #replay-bar button {
      background: #1a1e2e; color: #dde; border: 1px solid #3a4060;
      border-radius: 5px; padding: 4px 10px; cursor: pointer;
      font-size: 17px; line-height: 1; min-width: 36px;
    }
    #replay-bar button:hover { background: #2a3050; }
    #replay-bar button.rb-active { background: #1a3060; border-color: #5af; color: #7cf; }
    #replay-bar .rb-meta {
      display: flex; align-items: center; gap: 16px;
      font-size: 12px; color: #889;
    }
    #replay-bar .rb-label { flex: 1; white-space: nowrap; }
    #replay-bar .rb-sps {
      display: flex; align-items: center; gap: 6px; white-space: nowrap;
    }
    #replay-bar .rb-sps input[type=number] {
      width: 58px; background: #111520; color: #adf;
      border: 1px solid #3a4060; border-radius: 4px;
      padding: 2px 5px; font-family: monospace; font-size: 13px; text-align: right;
    }
    #replay-bar .rb-scale input[type=number] {
      width: 54px; background: #111520; color: #fda;
      border: 1px solid #3a4060; border-radius: 4px;
      padding: 2px 5px; font-family: monospace; font-size: 13px; text-align: right;
    }
    #replay-bar .rb-scale input[type=number]:focus { outline: 1px solid #fda; }
    #replay-bar .rb-scale input[type=number]::-webkit-inner-spin-button { opacity: .35; }
    #replay-bar .rb-scale {
      display: flex; align-items: center; gap: 6px; white-space: nowrap;
    }
    #replay-bar .rb-sps input[type=number]:focus { outline: 1px solid #5af; }
    #replay-bar .rb-sps input[type=number]::-webkit-inner-spin-button { opacity: .35; }
    #replay-bar .rb-timemark { font-size: 11px; color: #556; min-width: 48px; }
    #replay-bar .rb-timemark.right { text-align: left; }
    #replay-bar .rb-smooth {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: #889; white-space: nowrap; cursor: pointer;
    }
    #replay-bar .rb-smooth input[type=checkbox] {
      accent-color: #5af; width: 14px; height: 14px; cursor: pointer;
    }
    #replay-bar .rb-smooth label { cursor: pointer; }
  `;
  document.head.appendChild(s);
}

/**
 * Build and attach the replay player bar.
 * @param {object}   ctrl           replayController state object
 * @param {Function} onFrameChange  called with ctrl after every frame change
 * @param {object}   [opts]
 * @param {Function} [opts.onUVToggle]    called with (boolean) when UV checkbox changes
 * @param {Function} [opts.onTrailToggle] called with (boolean) when comet-trail checkbox changes
 * @returns {{ refreshUI: (ctrl) => void, removeUI: () => void }}
 */
export function initReplayUI(ctrl, onFrameChange, opts = {}) {
  injectStyles();

  const total = replayFrameCount(ctrl);
  const unit  = ctrl.meta?.timeUnit ?? 'yr';

  const bar = document.createElement('div');
  bar.id = 'replay-bar';

  // ── row 1: scrubber with time markers ───────────────────────────────────
  const scrubRow = document.createElement('div');
  scrubRow.className = 'rb-scrubber-row';

  const markL = document.createElement('span');
  markL.className = 'rb-timemark';

  const scrubber = document.createElement('input');
  scrubber.type      = 'range';
  scrubber.className = 'rb-scrubber';
  scrubber.min   = 0;
  scrubber.max   = total - 1;
  scrubber.step  = 1;
  scrubber.value = ctrl.currentFrame;
  scrubber.addEventListener('input', () => {
    setReplayFrame(ctrl, Number(scrubber.value));
    notify();
  });

  const markR = document.createElement('span');
  markR.className = 'rb-timemark right';

  scrubRow.append(markL, scrubber, markR);

  // ── row 2: buttons  |  label + steps/sec ────────────────────────────────
  const ctrlRow = document.createElement('div');
  ctrlRow.className = 'rb-controls';

  const mkBtn = (icon, title, onClick) => {
    const b = document.createElement('button');
    b.textContent = icon; b.title = title;
    b.addEventListener('click', onClick);
    return b;
  };

  const btnFirst = mkBtn('⏮', 'First frame  [Home]',  () => { setReplayFrame(ctrl, 0); notify(); });
  const btnStepB = mkBtn('‹', 'Step back  [←]',         () => { pauseReplay(ctrl); stepReplayFrame(ctrl, -1); notify(); });
  const btnPlay  = mkBtn('▶', 'Play  [Space]',           () => { toggleReplay(ctrl); notify(); });
  const btnStepF = mkBtn('›', 'Step forward  [→]',       () => { pauseReplay(ctrl); stepReplayFrame(ctrl,  1); notify(); });
  const btnLast  = mkBtn('⏭', 'Last frame  [End]',       () => { setReplayFrame(ctrl, total - 1); notify(); });

  btnStepB.style.fontWeight = btnStepF.style.fontWeight = 'bold';

  const btnWrap = document.createElement('div');
  btnWrap.className = 'rb-btns';
  btnWrap.append(btnFirst, btnStepB, btnPlay, btnStepF, btnLast);

  // meta: label + steps-per-second input
  const metaWrap = document.createElement('div');
  metaWrap.className = 'rb-meta';

  const label = document.createElement('span');
  label.className = 'rb-label';

  const spsWrap = document.createElement('div');
  spsWrap.className = 'rb-sps';

  const spsInput = document.createElement('input');
  spsInput.type  = 'number';
  spsInput.min   = 1;
  spsInput.max   = 120;
  spsInput.step  = 1;
  spsInput.value = Math.round(ctrl.stepsPerSec ?? ctrl.meta?.playbackFPS ?? 10);
  spsInput.title = 'Steps per second';

  const commitSps = () => {
    const v = Math.max(1, Math.min(120, Number(spsInput.value)));
    spsInput.value = v;
    setReplayStepsPerSec(ctrl, v);
  };

  spsInput.addEventListener('change', commitSps);
  spsInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp')   { setReplayStepsPerSec(ctrl, Math.min(120, (ctrl.stepsPerSec) + 1)); spsInput.value = ctrl.stepsPerSec; e.preventDefault(); }
    if (e.key === 'ArrowDown') { setReplayStepsPerSec(ctrl, Math.max(1,   (ctrl.stepsPerSec) - 1)); spsInput.value = ctrl.stepsPerSec; e.preventDefault(); }
    e.stopPropagation();   // prevent ← → from triggering frame step
  });

  const spsLabel = document.createElement('span');
  spsLabel.textContent = 'step/s';

  spsWrap.append(spsInput, spsLabel);

  // world scale multiplier input
  const scaleWrap = document.createElement('div');
  scaleWrap.className = 'rb-scale';
  const scaleInput = document.createElement('input');
  scaleInput.type  = 'number';
  scaleInput.min   = 0.1;
  scaleInput.max   = 20;
  scaleInput.step  = 0.1;
  scaleInput.value = 1;
  scaleInput.title = 'World scale (multiplier)';
  const commitScale = () => {
    const v = Math.max(0.1, Math.min(20, Number(scaleInput.value)));
    scaleInput.value = v;
    opts.onWorldScaleChange?.(v);
  };
  scaleInput.addEventListener('change', commitScale);
  scaleInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp')   { scaleInput.value = Math.min(20,  +(+scaleInput.value + 0.1).toFixed(2)); commitScale(); e.preventDefault(); }
    if (e.key === 'ArrowDown') { scaleInput.value = Math.max(0.1, +(+scaleInput.value - 0.1).toFixed(2)); commitScale(); e.preventDefault(); }
    e.stopPropagation();
  });
  const scaleLbl = document.createElement('span');
  scaleLbl.textContent = '× scale';
  scaleLbl.style.color = '#fda';
  scaleWrap.append(scaleInput, scaleLbl);

  // smooth checkbox
  const smoothWrap = document.createElement('label');
  smoothWrap.className = 'rb-smooth';
  const smoothChk  = document.createElement('input');
  smoothChk.type    = 'checkbox';
  smoothChk.id      = 'rb-smooth-chk';
  smoothChk.checked = ctrl.smooth ?? false;
  smoothChk.addEventListener('change', () => {
    ctrl.smooth = smoothChk.checked;
  });
  smoothChk.addEventListener('keydown', e => e.stopPropagation());
  const smoothLbl = document.createElement('span');
  smoothLbl.textContent = 'Smoothing';
  smoothWrap.append(smoothChk, smoothLbl);

  // UV radiation checkbox
  const uvWrap = document.createElement('label');
  uvWrap.className = 'rb-smooth';
  uvWrap.style.color = '#bb88ff';
  const uvChk  = document.createElement('input');
  uvChk.type    = 'checkbox';
  uvChk.checked = false;
  uvChk.addEventListener('change', () => opts.onUVToggle?.(uvChk.checked));
  uvChk.addEventListener('keydown', e => e.stopPropagation());
  const uvLbl = document.createElement('span');
  uvLbl.textContent = 'UV Rad.';
  uvWrap.append(uvChk, uvLbl);

  // Comet trails checkbox
  const trailWrap = document.createElement('label');
  trailWrap.className = 'rb-smooth';
  trailWrap.style.color = '#88eeff';
  const trailChk = document.createElement('input');
  trailChk.type    = 'checkbox';
  trailChk.checked = false;
  trailChk.addEventListener('change', () => opts.onTrailToggle?.(trailChk.checked));
  trailChk.addEventListener('keydown', e => e.stopPropagation());
  const trailLbl = document.createElement('span');
  trailLbl.textContent = 'Comet trails';
  trailWrap.append(trailChk, trailLbl);

  // "Only followed trail" checkbox
  const onlyFollowWrap = document.createElement('label');
  onlyFollowWrap.className = 'rb-smooth';
  onlyFollowWrap.style.color = '#00eeff';
  const onlyFollowChk = document.createElement('input');
  onlyFollowChk.type    = 'checkbox';
  onlyFollowChk.checked = false;
  onlyFollowChk.addEventListener('change', () => opts.onOnlyFollowTrail?.(onlyFollowChk.checked));
  onlyFollowChk.addEventListener('keydown', e => e.stopPropagation());
  const onlyFollowLbl = document.createElement('span');
  onlyFollowLbl.textContent = 'Followed only';
  onlyFollowWrap.append(onlyFollowChk, onlyFollowLbl);

  // Planet trails checkbox
  const planetTrailWrap = document.createElement('label');
  planetTrailWrap.className = 'rb-smooth';
  planetTrailWrap.style.color = '#aabbcc';
  const planetTrailChk = document.createElement('input');
  planetTrailChk.type    = 'checkbox';
  planetTrailChk.checked = false;
  planetTrailChk.addEventListener('change', () => opts.onPlanetTrailToggle?.(planetTrailChk.checked));
  planetTrailChk.addEventListener('keydown', e => e.stopPropagation());
  const planetTrailLbl = document.createElement('span');
  planetTrailLbl.textContent = 'Planet trails';
  planetTrailWrap.append(planetTrailChk, planetTrailLbl);

  // Background starfield checkbox
  const bgWrap = document.createElement('label');
  bgWrap.className = 'rb-smooth';
  bgWrap.style.color = '#aaccff';
  const bgChk  = document.createElement('input');
  bgChk.type    = 'checkbox';
  bgChk.checked = true;
  bgChk.addEventListener('change', () => opts.onStarfieldToggle?.(bgChk.checked));
  bgChk.addEventListener('keydown', e => e.stopPropagation());
  const bgLbl = document.createElement('span');
  bgLbl.textContent = 'Starfield';
  bgWrap.append(bgChk, bgLbl);

  metaWrap.append(label, spsWrap, scaleWrap, smoothWrap, uvWrap, trailWrap, onlyFollowWrap, planetTrailWrap, bgWrap);
  ctrlRow.append(btnWrap, metaWrap);

  bar.append(scrubRow, ctrlRow);
  document.body.appendChild(bar);

  // ── keyboard shortcuts ────────────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    // Spacebar always pauses/plays – even when inputs are focused,
    // unless the user is actually typing text (search box, textarea, etc.).
    const tag      = document.activeElement?.tagName ?? '';
    const isText   = (tag === 'INPUT' && document.activeElement?.type === 'text') ||
                     tag === 'TEXTAREA';
    if (e.key === ' ' || e.key === 'k') {
      if (!isText) { e.preventDefault(); toggleReplay(ctrl); notify(); }
      return;
    }
    // All other shortcuts are skipped when any input is focused.
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); pauseReplay(ctrl); stepReplayFrame(ctrl,  1); notify(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); pauseReplay(ctrl); stepReplayFrame(ctrl, -1); notify(); }
    if (e.key === 'Home')       { e.preventDefault(); setReplayFrame(ctrl, 0);         notify(); }
    if (e.key === 'End')        { e.preventDefault(); setReplayFrame(ctrl, total - 1); notify(); }
  });

  // ── update helpers ─────────────────────────────────────────────────────
  function timeLabel(frameIdx) {
    const t = Number(ctrl.frames?.[frameIdx]?.time ?? 0).toFixed(2);
    return `t=${t} ${unit}`;
  }

  function refreshUI(c) {
    scrubber.value = c.currentFrame;

    markL.textContent = timeLabel(0);
    markR.textContent = timeLabel(total - 1);

    const t = Number(getFrameTime(c)).toFixed(2);
    label.textContent = `Frame ${c.currentFrame + 1} / ${total}   ·   t = ${t} ${unit}`;

    btnPlay.textContent = c.playing ? '⏸' : '▶';
    btnPlay.title       = c.playing ? 'Pause  [Space]' : 'Play  [Space]';
    btnPlay.classList.toggle('rb-active', c.playing);

    spsInput.value = Math.round(c.stepsPerSec ?? 10);
  }

  function notify() {
    refreshUI(ctrl);
    onFrameChange?.(ctrl);
  }

  refreshUI(ctrl);
  return { refreshUI, removeUI: () => bar.remove() };
}
