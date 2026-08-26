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

function injectStyles() {
  if (document.getElementById('control-panel-style')) return;
  const s = document.createElement('style');
  s.id = 'control-panel-style';
  s.textContent = `
    #run-console {
      position: fixed; top: 0; left: 0; bottom: var(--rail-h);
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
      position: fixed; top: var(--sp-3); left: var(--sp-3); z-index: 881;
    }
    #btn-run-console.docked { left: calc(var(--panel-w) + var(--sp-3)); }
  `;
  document.head.appendChild(s);
}

const GROUPS = [
  { title: 'Ejecta', keys: ['asteroids', 'v_min', 'v_max', 'cone_angle', 'seed'] },
  { title: 'Fragment', keys: ['fragment_radius', 'bio_fraction', 'dust_flux'] },
  { title: 'Integration', keys: ['years', 'dt', 'substeps'] },
  { title: 'Physics', keys: ['radiation_pressure', 'erosion', 'planets'] },
];

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
        section.appendChild(buildField(byKey.get(key)));
      }
      body.appendChild(section);
    }
  }

  function buildField(spec) {
    if (spec.type === 'bool') return buildToggle(spec);

    const wrap = document.createElement('div');
    wrap.className = 'rc-field';
    wrap.innerHTML = `
      <div class="rc-field-head">
        <span class="rc-field-label" title="${escapeAttr(spec.help ?? '')}">${spec.label}</span>
        <span class="rc-field-value"><span class="v"></span>${spec.unit ? `<span class="u">${spec.unit}</span>` : ''}</span>
      </div>
    `;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = spec.min;
    input.max = spec.max;
    input.step = spec.step;
    input.value = values[spec.key];
    input.setAttribute('aria-label', spec.label);
    wrap.appendChild(input);

    const valueEl = wrap.querySelector('.v');
    const paint = () => { valueEl.textContent = formatValue(spec, values[spec.key]); };

    input.addEventListener('input', () => {
      values[spec.key] = spec.type === 'int' ? parseInt(input.value, 10) : parseFloat(input.value);
      paint();
      refreshCost();
    });

    paint();
    inputs.set(spec.key, { input, paint });
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
    for (const { input } of inputs.values()) {
      if (input.tagName === 'INPUT') input.disabled = on;
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
      setStatus('bad', 'solver <b>offline</b>');
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
    body.innerHTML = `
      <div class="rc-msg">
        <b style="color:var(--ink)">Showing the bundled replay.</b><br><br>
        To choose parameters and run your own simulation, start the local solver:
        <br><br>
        <code>cd model</code><br>
        <code>python -m microbe_radiation_model.server</code>
        <br><br>
        Then reload this page. The solver runs the real REBOUND integration, so it
        needs <code>rebound</code> installed — see <code>RUNNING.md</code>.
      </div>
    `;
    framesOut.textContent = 'bundled replay';
    bodiesOut.textContent = '';
  }

  function setVisible(visible) {
    panel.classList.toggle('collapsed', !visible);
    toggle.classList.toggle('docked', visible);
    document.body.classList.toggle('console-docked', visible);
  }

  runBtn.addEventListener('click', run);
  resetBtn.addEventListener('click', () => {
    values = { ...defaults };
    for (const { paint } of inputs.values()) paint();
    for (const [key, { input }] of inputs) {
      if (input.tagName === 'INPUT') input.value = values[key];
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
