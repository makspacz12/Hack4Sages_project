/**
 * controlPanel.js
 * The run console: choose parameters, launch a simulation, watch it progress,
 * load the result into the scene.
 *
 * The parameter list is fetched from the API rather than hard-coded, so the
 * controls can never offer something the model does not accept. When the API is
 * not running the panel still renders - in a read-only "offline" state that
 * explains how to start the server, with the shipped replay left on screen.
 */

import { health, parameters, startRun, waitForRun } from '../api.js';
import FROZEN_SCHEMA from '../paramSchema.json';
import {
  valueToPos, posToValue,
  valueToPosLinear, posToValueLinear,
  clampMin, clampMax, formatRadius,
} from './rangeLog.js';

function injectStyles() {
  if (document.getElementById('control-panel-style')) return;
  const s = document.createElement('style');
  s.id = 'control-panel-style';
  s.textContent = `
    #run-console {
      /* Sits below the headline band, whose height is measured at runtime and
         published as --headline-h. Defaults to 0 so this panel is still
         positioned correctly on pages that carry no band. */
      position: fixed; top: var(--headline-h, 0px); left: 0; bottom: var(--rail-h);
      width: var(--panel-w); z-index: 880;
      background: var(--bg-panel);
      border-right: 1px solid var(--line-edge);
      display: flex; flex-direction: column;
      font-family: var(--font-ui);
      transition: transform .16s ease;
    }
    #run-console.collapsed { transform: translateX(calc(-1 * var(--panel-w))); }

    #run-console .rc-head {
      padding: var(--sp-3) var(--sp-4);
      border-bottom: 1px solid var(--line-edge);
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--sp-3); flex: 0 0 auto;
    }
    #run-console .rc-brand { font-size: 12px; font-weight: 700; letter-spacing: .11em;
      text-transform: uppercase; color: var(--ink-bright); }
    #run-console .rc-tagline { font-size: 10.5px; color: var(--ink-faint); margin-top: 3px;
      line-height: 1.4; max-width: 30ch; }
    #run-console .rc-nav {
      display: inline-block; margin-top: var(--sp-2);
      font-size: 10.5px; color: var(--accent); text-decoration: none;
    }
    #run-console .rc-nav:hover { text-decoration: underline; }

    #run-console .rc-status {
      display: flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-4);
      border-bottom: 1px solid var(--line-hair);
      background: var(--bg-sunken); flex: 0 0 auto;
    }
    #run-console .rc-status-text { font-size: 10.5px; color: var(--ink-dim); }
    #run-console .rc-status-text b { color: var(--ink); font-weight: 600; }

    #run-console .rc-body { flex: 1 1 auto; overflow-y: auto; }

    #run-console .rc-group { border-bottom: 1px solid var(--line-hair); padding: var(--sp-3) 0 var(--sp-2); }
    #run-console .rc-group-title {
      padding: 0 var(--sp-4) var(--sp-2);
      font-size: 9.5px; font-weight: 700; letter-spacing: .12em;
      text-transform: uppercase; color: var(--ink-faint);
    }

    #run-console .rc-field { padding: var(--sp-2) var(--sp-4); }
    #run-console .rc-field-head {
      display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2);
    }
    #run-console .rc-field-label {
      font-size: 11px; color: var(--ink); cursor: help;
      border-bottom: 1px dotted transparent;
    }
    #run-console .rc-field:hover .rc-field-label { border-bottom-color: var(--line-strong); }
    #run-console .rc-field-value {
      font-family: var(--font-mono); font-variant-numeric: tabular-nums;
      font-size: 11.5px; color: var(--ink-bright);
    }
    #run-console .rc-field-value .u { color: var(--ink-faint); margin-left: 3px; font-size: 10px; }
    /* The typed value is the control; the slider beneath it is the coarse one. */
    #run-console .rc-msg-sub {
      color: var(--ink-faint); font-size: 11px; margin: 6px 0 10px;
    }
    #run-console .rc-howto {
      background: none; border: 1px solid var(--line); color: var(--ink-dim);
      font-family: inherit; font-size: 11px; padding: 4px 9px;
      cursor: pointer; border-radius: 2px;
    }
    #run-console .rc-howto:hover { border-color: var(--accent); color: var(--ink); }
    #run-console .rc-howto:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    #run-console .rc-howto-body { margin-top: 10px; font-size: 11px; line-height: 1.5; }
    #run-console .rc-num {
      background: transparent;
      border: 1px solid transparent;
      border-bottom-color: var(--line);
      color: var(--ink);
      font-family: inherit;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      text-align: right;
      width: 8ch;
      padding: 1px 3px;
      border-radius: 2px;
    }
    #run-console .rc-num:hover { border-color: var(--line); }
    #run-console .rc-num:focus {
      outline: none;
      border-color: var(--accent);
      background: rgba(0, 0, 0, 0.35);
    }
    /* Not a number: keep what was typed so it can be corrected, and say so. */
    #run-console .rc-num.invalid {
      border-color: var(--bad, #e2683c);
      color: var(--bad, #e2683c);
    }
    /* Accepted but moved to the nearest legal value - never silently. */
    #run-console .rc-num.out-of-range { border-color: var(--warn, #d8a33c); }
    #run-console .rc-num-lo, #run-console .rc-num-hi { width: 6.5ch; }
    #run-console .rc-dash { color: var(--ink-faint); margin: 0 2px; }

    #run-console input[type=range] {
      -webkit-appearance: none; appearance: none;
      width: 100%; height: 3px; margin: 9px 0 2px;
      background: var(--line-edge); border-radius: 2px; outline: none; cursor: pointer;
    }
    #run-console input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 12px; height: 12px; border-radius: 50%;
      background: var(--accent); border: 2px solid var(--bg-panel); cursor: pointer;
    }
    #run-console input[type=range]::-moz-range-thumb {
      width: 12px; height: 12px; border-radius: 50%;
      background: var(--accent); border: 2px solid var(--bg-panel); cursor: pointer;
    }
    #run-console input[type=range]:disabled { opacity: .4; cursor: not-allowed; }

    #run-console .rc-dual { position: relative; height: 24px; margin: 6px 0 2px; }
    #run-console .rc-dual-track {
      position: absolute; left: 0; right: 0; top: 11px; height: 3px;
      background: var(--line-edge); border-radius: 2px; pointer-events: none;
    }
    #run-console .rc-dual-fill {
      position: absolute; top: 0; bottom: 0; border-radius: 2px; background: var(--accent-dim);
    }
    #run-console .rc-dual input[type=range] {
      position: absolute; left: 0; width: 100%; margin: 0; top: 6px;
      height: 12px; background: transparent; pointer-events: none;
    }
    #run-console .rc-dual input[type=range]::-webkit-slider-thumb { pointer-events: auto; }
    #run-console .rc-dual input[type=range]::-moz-range-thumb { pointer-events: auto; }
    #run-console .rc-dual input[type=range]::-webkit-slider-runnable-track,
    #run-console .rc-dual input[type=range]::-moz-range-track { background: transparent; }
    #run-console .rc-dual input.rc-dual-hi { z-index: 3; }
    #run-console .rc-dual input.rc-dual-lo { z-index: 4; }

    #run-console .rc-toggle {
      display: flex; align-items: center; justify-content: space-between;
      padding: 7px var(--sp-4); cursor: pointer;
    }
    #run-console .rc-toggle:hover { background: var(--bg-raised); }
    #run-console .rc-toggle span { font-size: 11px; color: var(--ink); }
    #run-console .rc-switch {
      width: 30px; height: 16px; border-radius: 9px; position: relative;
      background: var(--line-edge); transition: background .14s; flex: 0 0 auto;
    }
    #run-console .rc-switch::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 12px; height: 12px; border-radius: 50%;
      background: var(--ink-faint); transition: transform .14s, background .14s;
    }
    #run-console .rc-toggle.on .rc-switch { background: var(--accent-dim); }
    #run-console .rc-toggle.on .rc-switch::after { transform: translateX(14px); background: var(--accent); }

    #run-console .rc-foot {
      flex: 0 0 auto; border-top: 1px solid var(--line-edge);
      padding: var(--sp-3) var(--sp-4); background: var(--bg-sunken);
    }
    #run-console .rc-cost {
      display: flex; justify-content: space-between;
      font-size: 10.5px; color: var(--ink-dim); margin-bottom: var(--sp-2);
      font-family: var(--font-mono);
    }
    #run-console .rc-actions { display: flex; gap: var(--sp-2); }
    #run-console .rc-actions .ui-btn { flex: 1 1 auto; }

    #run-console .rc-progress {
      margin-top: var(--sp-3); display: none;
    }
    #run-console .rc-progress.on { display: block; }
    #run-console .rc-bar {
      height: 3px; background: var(--line-edge); border-radius: 2px; overflow: hidden;
    }
    #run-console .rc-bar-fill {
      height: 100%; width: 0%; background: var(--accent); transition: width .18s linear;
    }
    #run-console .rc-progress-text {
      margin-top: 5px; font-size: 10.5px; font-family: var(--font-mono); color: var(--ink-dim);
      display: flex; justify-content: space-between;
    }

    #run-console .rc-msg {
      margin: var(--sp-3) var(--sp-4) 0; padding: var(--sp-2) var(--sp-3);
      border-left: 2px solid var(--warn); background: rgba(240,180,41,.06);
      font-size: 10.5px; line-height: 1.5; color: var(--ink-dim);
    }
    #run-console .rc-msg.bad { border-left-color: var(--bad); background: rgba(224,86,79,.07); }
    #run-console .rc-msg code {
      font-family: var(--font-mono); font-size: 10px; color: var(--ink);
      background: var(--bg-raised); padding: 1px 4px; border-radius: 2px;
    }

    #btn-run-console {
      /* Offset by the headline band's measured height, or this button sits
         underneath it and cannot be clicked at all. */
      position: fixed; top: calc(var(--headline-h, 0px) + var(--sp-3));
      left: var(--sp-3); z-index: 881;
    }
    #btn-run-console.docked { left: calc(var(--panel-w) + var(--sp-3)); }
  `;
  document.head.appendChild(s);
}

const GROUPS = [
  { title: 'Ejecta', keys: ['asteroids', 'v_min', 'v_max', 'cone_angle', 'seed'] },
  { title: 'Fragment', keys: ['radius_min', 'radius_max', 'bio_fraction', 'dust_flux'] },
  { title: 'Integration', keys: ['years', 'dt', 'substeps'] },
  { title: 'Physics', keys: ['radiation_pressure', 'erosion', 'planets'] },
];

/** Schema keys rendered as one dual-thumb control. */
const RANGE_PAIRS = {
  radius_min: { hi: 'radius_max', label: 'Fragment radius', log: true },
  v_min: { hi: 'v_max', label: 'Ejection speed', log: false },
};
const RANGE_PAIR_HIS = new Set(Object.values(RANGE_PAIRS).map(p => p.hi));
const DUAL_STEPS = 1000;

/**
 * @param {(runId:string, snapshot:object) => void} onFinished called when a run completes
 * @returns {{ mount():object }}
 */
export function createControlPanel({ onFinished }) {
  injectStyles();

  const panel = document.createElement('aside');
  panel.id = 'run-console';
  panel.className = 'ui-scroll';
  panel.innerHTML = `
    <div class="rc-head">
      <div>
        <div class="rc-brand">Lithopanspermia</div>
        <div class="rc-tagline">Mars ejecta transport, radiation dose and
          microbial survival — a digital twin.</div>
        <a class="rc-nav" href="./research.html">Research background →</a>
        <a class="rc-nav" href="./grid.html">Survival heatmap →</a>
        <a class="rc-nav" href="./sensitivity.html">Sensitivity tornado →</a>
      </div>
    </div>
    <div class="rc-status">
      <span class="ui-dot" id="rc-dot"></span>
      <span class="rc-status-text" id="rc-status-text">checking solver…</span>
    </div>
    <div class="rc-body ui-scroll" id="rc-body"></div>
    <div class="rc-foot">
      <div class="rc-cost">
        <span id="rc-frames">— frames</span>
        <span id="rc-bodies">— bodies</span>
      </div>
      <div class="rc-actions">
        <button class="ui-btn ui-btn--primary" id="rc-run" disabled>Run simulation</button>
        <button class="ui-btn" id="rc-reset" title="Restore defaults">Reset</button>
      </div>
      <div class="rc-progress" id="rc-progress">
        <div class="rc-bar"><div class="rc-bar-fill" id="rc-bar-fill"></div></div>
        <div class="rc-progress-text">
          <span id="rc-progress-label">integrating…</span>
          <span id="rc-progress-pct">0%</span>
        </div>
      </div>
    </div>
  `;

  const toggle = document.createElement('button');
  toggle.id = 'btn-run-console';
  toggle.className = 'ui-btn';
  toggle.textContent = 'Run console';

  const body = panel.querySelector('#rc-body');
  const dot = panel.querySelector('#rc-dot');
  const statusText = panel.querySelector('#rc-status-text');
  const runBtn = panel.querySelector('#rc-run');
  const resetBtn = panel.querySelector('#rc-reset');
  const progressBox = panel.querySelector('#rc-progress');
  const barFill = panel.querySelector('#rc-bar-fill');
  const progressLabel = panel.querySelector('#rc-progress-label');
  const progressPct = panel.querySelector('#rc-progress-pct');
  const framesOut = panel.querySelector('#rc-frames');
  const bodiesOut = panel.querySelector('#rc-bodies');

  let specs = [];
  let values = {};
  let defaults = {};
  const inputs = new Map();
  let busy = false;

  // ── Rendering ───────────────────────────────────────────────────────────

  function renderFields() {
    body.textContent = '';
    const byKey = new Map(specs.map(s => [s.key, s]));

    for (const group of GROUPS) {
      const present = group.keys.filter(k => byKey.has(k));
      if (present.length === 0) continue;

      const section = document.createElement('div');
      section.className = 'rc-group';
      const title = document.createElement('div');
      title.className = 'rc-group-title';
      title.textContent = group.title;
      section.appendChild(title);

      for (const key of present) {
        if (RANGE_PAIR_HIS.has(key)) continue;
        const meta = RANGE_PAIRS[key];
        if (meta && byKey.has(meta.hi)) {
          section.appendChild(buildRangeField(byKey.get(key), byKey.get(meta.hi), meta));
        } else {
          section.appendChild(buildField(byKey.get(key)));
        }
      }
      body.appendChild(section);
    }
  }

  function buildRangeField(minSpec, maxSpec, meta) {
    const absMin = Math.min(minSpec.min, maxSpec.min);
    const absMax = Math.max(minSpec.max, maxSpec.max);
    const unit = minSpec.unit || maxSpec.unit || '';
    const help = minSpec.help || maxSpec.help || '';
    const toPos = meta.log ? valueToPos : valueToPosLinear;
    const toVal = meta.log ? posToValue : posToValueLinear;
    const fmt = (v) => (meta.log ? formatRadius(v) : formatValue(minSpec, v));

    const wrap = document.createElement('div');
    wrap.className = 'rc-field';
    wrap.innerHTML = `
      <div class="rc-field-head">
        <span class="rc-field-label" title="${escapeAttr(help)}">${meta.label}</span>
        <span class="rc-field-value">
          <input class="rc-num rc-num-lo" type="text" inputmode="decimal" spellcheck="false">
          <span class="rc-dash">–</span>
          <input class="rc-num rc-num-hi" type="text" inputmode="decimal" spellcheck="false">
          ${unit ? `<span class="u">${unit}</span>` : ''}
        </span>
      </div>
      <div class="rc-dual"><div class="rc-dual-track"><div class="rc-dual-fill"></div></div></div>
    `;
    const dual = wrap.querySelector('.rc-dual');
    const fill = wrap.querySelector('.rc-dual-fill');
    const loNum = wrap.querySelector('.rc-num-lo');
    const hiNum = wrap.querySelector('.rc-num-hi');
    loNum.setAttribute('aria-label', `${meta.label} minimum${unit ? ` in ${unit}` : ''}`);
    hiNum.setAttribute('aria-label', `${meta.label} maximum${unit ? ` in ${unit}` : ''}`);
    loNum.title = hiNum.title = `${absMin} to ${absMax}`;

    const mkThumb = (cls, label) => {
      const input = document.createElement('input');
      input.type = 'range';
      input.className = cls;
      input.min = '0';
      input.max = String(DUAL_STEPS);
      input.step = '1';
      input.setAttribute('aria-label', `${label} (coarse)`);
      input.tabIndex = -1;
      return input;
    };
    const loInput = mkThumb('rc-dual-lo', `${meta.label} minimum`);
    const hiInput = mkThumb('rc-dual-hi', `${meta.label} maximum`);
    dual.append(loInput, hiInput);

    const paint = () => {
      const loPos = toPos(values[minSpec.key], absMin, absMax);
      const hiPos = toPos(values[maxSpec.key], absMin, absMax);
      loInput.value = String(Math.round(loPos * DUAL_STEPS));
      hiInput.value = String(Math.round(hiPos * DUAL_STEPS));
      fill.style.left = `${loPos * 100}%`;
      fill.style.width = `${Math.max(0, hiPos - loPos) * 100}%`;
      // Untouched boxes carry the full value; the abbreviated form used by the
      // slider readout cannot be typed back in.
      if (document.activeElement !== loNum) loNum.value = String(values[minSpec.key]);
      if (document.activeElement !== hiNum) hiNum.value = String(values[maxSpec.key]);
      loNum.classList.remove('invalid');
      hiNum.classList.remove('invalid');
    };

    /** Accept a typed bound, keeping lo below hi and both inside the range. */
    const commitBound = (which) => {
      const el = which === 'lo' ? loNum : hiNum;
      const parsed = parseFloat(el.value.trim().replace(',', '.'));
      if (!Number.isFinite(parsed)) { el.classList.add('invalid'); return; }
      const inRange = Math.min(absMax, Math.max(absMin, parsed));
      values[which === 'lo' ? minSpec.key : maxSpec.key] = which === 'lo'
        ? clampMin(inRange, values[maxSpec.key], absMin, absMax)
        : clampMax(inRange, values[minSpec.key], absMin, absMax);
      paint();
      refreshCost();
    };

    for (const [which, el] of [['lo', loNum], ['hi', hiNum]]) {
      el.addEventListener('change', () => commitBound(which));
      el.addEventListener('blur', () => commitBound(which));
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commitBound(which); el.blur(); }
        if (e.key === 'Escape') { paint(); el.blur(); }
      });
      el.addEventListener('input', () => el.classList.remove('invalid'));
    }

    loInput.addEventListener('input', () => {
      const raw = toVal(Number(loInput.value) / DUAL_STEPS, absMin, absMax);
      values[minSpec.key] = clampMin(raw, values[maxSpec.key], absMin, absMax);
      paint();
      refreshCost();
    });
    hiInput.addEventListener('input', () => {
      const raw = toVal(Number(hiInput.value) / DUAL_STEPS, absMin, absMax);
      values[maxSpec.key] = clampMax(raw, values[minSpec.key], absMin, absMax);
      paint();
      refreshCost();
    });

    paint();
    inputs.set(`range:${minSpec.key}:${maxSpec.key}`, { inputs: [loInput, hiInput], paint });
    return wrap;
  }

  function buildField(spec) {
    if (spec.type === 'bool') return buildToggle(spec);

    const wrap = document.createElement('div');
    wrap.className = 'rc-field';
    // The number box is the primary control and the slider is the coarse one.
    //
    // A slider alone cannot express an exact value, and for this tool that is
    // disqualifying: a seed spans four thousand million integers, so a pixel of
    // travel covers millions of them and a specific run can never be requested
    // again by dragging. An ejection speed of 5.03 km/s is likewise unreachable
    // if the step is 0.1. Anyone reproducing a published run has a number, not
    // a gesture.
    wrap.innerHTML = `
      <div class="rc-field-head">
        <label class="rc-field-label" title="${escapeAttr(spec.help ?? '')}">${spec.label}</label>
        <span class="rc-field-value">
          <input class="rc-num" type="text" inputmode="decimal" spellcheck="false">
          ${spec.unit ? `<span class="u">${spec.unit}</span>` : ''}
        </span>
      </div>
    `;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = spec.min;
    input.max = spec.max;
    input.step = spec.step;
    input.value = values[spec.key];
    input.setAttribute('aria-label', `${spec.label} (coarse)`);
    input.tabIndex = -1;          // the number box is the tab stop
    wrap.appendChild(input);

    const numEl = wrap.querySelector('.rc-num');
    numEl.setAttribute('aria-label', `${spec.label}${spec.unit ? ` in ${spec.unit}` : ''}`);
    numEl.title = `${spec.min} to ${spec.max}`;
    wrap.querySelector('.rc-field-label').htmlFor = numEl.id
      = `rc-${spec.key}-${Math.random().toString(36).slice(2, 7)}`;

    const paint = () => {
      // Full precision in the box, not the display rounding: a field that shows
      // 0.3 for a value of 0.25 cannot be typed back in.
      if (document.activeElement !== numEl) numEl.value = String(values[spec.key]);
      input.value = String(values[spec.key]);
      numEl.classList.remove('invalid');
    };

    /** Accept a typed value, clamping to the declared range. */
    const commit = () => {
      const raw = numEl.value.trim().replace(',', '.');
      const parsed = spec.type === 'int' ? parseInt(raw, 10) : parseFloat(raw);
      if (!Number.isFinite(parsed)) {
        numEl.classList.add('invalid');
        return;
      }
      const clamped = Math.min(spec.max, Math.max(spec.min, parsed));
      const wasClamped = clamped !== parsed;
      values[spec.key] = clamped;
      numEl.value = String(clamped);
      input.value = String(clamped);
      // Say so when a value was moved rather than silently accepting it. The
      // marker is only cleared by typing again: `blur` fires a second commit
      // on the already-clamped text, which would otherwise erase the warning
      // the instant the field loses focus.
      if (wasClamped) numEl.classList.add('out-of-range');
      refreshCost();
    };

    numEl.addEventListener('change', commit);
    numEl.addEventListener('blur', commit);
    numEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); numEl.blur(); }
      if (e.key === 'Escape') { paint(); numEl.blur(); }
    });
    numEl.addEventListener('input',
      () => numEl.classList.remove('invalid', 'out-of-range'));

    input.addEventListener('input', () => {
      values[spec.key] = spec.type === 'int' ? parseInt(input.value, 10) : parseFloat(input.value);
      numEl.value = String(values[spec.key]);
      numEl.classList.remove('out-of-range', 'invalid');
      refreshCost();
    });

    paint();
    inputs.set(spec.key, { input, paint, numEl });
    return wrap;
  }

  function buildToggle(spec) {
    const wrap = document.createElement('div');
    wrap.className = 'rc-toggle';
    wrap.setAttribute('role', 'switch');
    wrap.tabIndex = 0;
    wrap.title = spec.help ?? '';
    wrap.innerHTML = `<span>${spec.label}</span><span class="rc-switch"></span>`;

    const paint = () => {
      wrap.classList.toggle('on', !!values[spec.key]);
      wrap.setAttribute('aria-checked', String(!!values[spec.key]));
    };
    const flip = () => {
      if (busy) return;
      values[spec.key] = !values[spec.key];
      paint();
    };
    wrap.addEventListener('click', flip);
    wrap.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    });

    paint();
    inputs.set(spec.key, { input: wrap, paint });
    return wrap;
  }

  function formatValue(spec, value) {
    if (spec.type === 'int') return String(value);
    if (Math.abs(value) < 1e-3 && value !== 0) return value.toExponential(1);
    if (spec.step >= 1) return value.toFixed(0);
    if (spec.step >= 0.1) return value.toFixed(1);
    if (spec.step >= 0.01) return value.toFixed(2);
    return value.toFixed(3);
  }

  function refreshCost() {
    const frames = Math.max(2, Math.round(values.years / values.dt));
    const bodies = (values.planets ? 9 : 1) + 50 + values.asteroids;
    framesOut.textContent = `${frames.toLocaleString()} frames`;
    bodiesOut.textContent = `${bodies.toLocaleString()} bodies`;
    // A rough warning before someone asks for a run that will take an hour.
    const heavy = frames * values.asteroids > 400000;
    framesOut.style.color = heavy ? 'var(--warn)' : '';
  }

  function setStatus(kind, html) {
    dot.className = `ui-dot ui-dot--${kind}`;
    statusText.innerHTML = html;
  }

  function note(text, bad = false) {
    body.querySelectorAll('.rc-msg').forEach(n => n.remove());
    const div = document.createElement('div');
    div.className = `rc-msg${bad ? ' bad' : ''}`;
    div.innerHTML = text;
    body.prepend(div);
  }

  function setBusy(on) {
    busy = on;
    runBtn.disabled = on;
    resetBtn.disabled = on;
    for (const entry of inputs.values()) {
      const els = entry.inputs ?? (entry.input ? [entry.input] : []);
      for (const el of els) {
        if (el.tagName === 'INPUT') el.disabled = on;
      }
    }
    progressBox.classList.toggle('on', on);
    runBtn.textContent = on ? 'Running…' : 'Run simulation';
  }

  // ── Run flow ────────────────────────────────────────────────────────────

  async function run() {
    setBusy(true);
    barFill.style.width = '0%';
    progressPct.textContent = '0%';
    progressLabel.textContent = 'queued';
    setStatus('busy', 'running…');

    try {
      const started = await startRun(values);
      const final = await waitForRun(started.id, snap => {
        const pct = Math.round((snap.progress ?? 0) * 100);
        barFill.style.width = `${pct}%`;
        progressPct.textContent = `${pct}%`;
        progressLabel.textContent = snap.status === 'running'
          ? `frame ${snap.step.toLocaleString()} / ${snap.total.toLocaleString()}`
          : snap.status;
      });

      if (final.status === 'error') {
        setStatus('bad', 'run failed');
        note(`The run failed: ${escapeHtml(final.error ?? 'unknown error')}`, true);
        return;
      }

      progressLabel.textContent = 'loading replay';
      setStatus('ok', `solver <b>ready</b> · ${final.total.toLocaleString()} frames`);
      body.querySelectorAll('.rc-msg').forEach(n => n.remove());
      // Hand the run id to the page rather than the replay itself: reloading
      // with ?run=<id> rebuilds the scene cleanly instead of tearing down and
      // reassembling a live three.js world.
      onFinished(started.id, final);
    } catch (error) {
      setStatus('bad', 'solver unreachable');
      note(`Could not reach the solver: ${escapeHtml(error.message)}.`, true);
    } finally {
      setBusy(false);
    }
  }

  // ── Boot ────────────────────────────────────────────────────────────────

  async function boot() {
    const state = await health();

    if (!state.online) {
      // Render the full panel anyway, from the schema frozen into the bundle.
      //
      // This branch used to wipe the panel body and leave one sentence and a
      // disabled button, which meant that for almost every visitor - the
      // solver is a local process nobody has running - the panel showed no
      // parameters at all. The schema is small, rarely changes, and is already
      // the single source of truth for validation, so there is no reason to
      // need a network round trip to know what the knobs are.
      //
      // Everything stays editable. What the browser can recompute exactly, it
      // still recomputes; only the button that needs a solver is told the
      // solver is missing.
      setStatus('bad', 'solver <b>offline</b>');
      specs = FROZEN_SCHEMA.parameters ?? [];
      defaults = { ...FROZEN_SCHEMA.defaults };
      values = { ...FROZEN_SCHEMA.defaults };
      renderFields();
      refreshCost();
      runBtn.disabled = true;
      renderOffline();
      return;
    }
    if (!state.rebound) {
      setStatus('warn', 'solver up, <b>no REBOUND</b>');
    } else {
      setStatus('ok', `solver <b>ready</b>${state.reboundx ? ' · REBOUNDx' : ''}`);
    }

    try {
      const schema = await parameters();
      specs = schema.parameters ?? [];
      defaults = { ...schema.defaults };
      values = { ...schema.defaults };
      renderFields();
      refreshCost();
      runBtn.disabled = !state.rebound;
      if (!state.rebound) {
        note('The solver is running but <code>rebound</code> is not importable in '
           + 'its environment, so it cannot integrate anything. Install it with '
           + '<code>pip install rebound astropy</code>, then restart the solver. '
           + '<br><br>REBOUND ships a wheel for Windows, macOS and Linux. '
           + '<code>reboundx</code> — needed only for radiation pressure — has no '
           + 'Windows wheel and does not compile under MSVC; without it the run '
           + 'still works and that one force is skipped.');
      }
    } catch (error) {
      setStatus('bad', 'schema unavailable');
      note(`Could not read the parameter schema: ${escapeHtml(error.message)}`, true);
    }
  }

  function renderOffline() {
    // One line and a button, not a wall of instructions.
    //
    // The replay is the normal way to look at this: it needs no setup and it is
    // what most visitors will ever use. Telling everyone how to start a solver
    // they have not asked for buries that. The setup lives behind a disclosure
    // for the people who want it.
    // Prepended, not assigned: the controls rendered above must survive.
    const msg = document.createElement('div');
    msg.innerHTML = `
      <div class="rc-msg">
        <b style="color:var(--ink)">Showing the bundled replay.</b>
        <div class="rc-msg-sub">The controls below are live and every value is
          editable. Anything the browser can recompute exactly &mdash; survival
          against the inactivation coefficient &mdash; updates as you type.
          Starting the solver is only needed to integrate a new swarm.</div>
        <button class="rc-howto" type="button" aria-expanded="false">
          How do I run my own?
        </button>
        <div class="rc-howto-body" hidden>
          Start the local solver, then reload:
          <br><br>
          <code>cd model</code><br>
          <code>.venv/bin/python -m microbe_radiation_model.server</code>
          <br><br>
          Use the interpreter from the project's virtual environment, not a bare
          <code>python</code> — the solver runs the real REBOUND integration and
          needs <code>rebound</code> and <code>astropy</code>. On Windows that is
          <code>.venv&#92;Scripts&#92;python.exe</code>.
          <br><br>
          If port 8000 is taken, start it with <code>--port 8010</code> and open
          this page with <code>?api=http://127.0.0.1:8010</code>.
          <br><br>
          Full setup: <code>RUNNING.md</code>.
        </div>
      </div>
    `;
    body.insertBefore(msg, body.firstChild);
    const howto = msg.querySelector('.rc-howto');
    const howtoBody = msg.querySelector('.rc-howto-body');
    howto?.addEventListener('click', () => {
      const open = howtoBody.hidden;
      howtoBody.hidden = !open;
      howto.setAttribute('aria-expanded', String(open));
      howto.textContent = open ? 'Hide' : 'How do I run my own?';
    });
    // Leave the cost readout alone. The fields above are editable now, so it
    // should keep reporting what the CURRENT settings would cost - that is the
    // question a reader has while typing, and it needs no solver to answer.
  }

  function setVisible(visible) {
    panel.classList.toggle('collapsed', !visible);
    toggle.classList.toggle('docked', visible);
    document.body.classList.toggle('console-docked', visible);
  }

  runBtn.addEventListener('click', run);
  resetBtn.addEventListener('click', () => {
    values = { ...defaults };
    for (const [key, entry] of inputs) {
      if (entry.inputs) {
        entry.paint();
        continue;
      }
      if (entry.input?.tagName === 'INPUT') {
        entry.input.value = values[key];
      }
      entry.paint();
    }
    refreshCost();
  });
  toggle.addEventListener('click', () => setVisible(panel.classList.contains('collapsed')));

  function mount() {
    document.body.append(panel, toggle);
    setVisible(true);
    boot();
    return api;
  }

  const api = { mount, setVisible };
  return api;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}
