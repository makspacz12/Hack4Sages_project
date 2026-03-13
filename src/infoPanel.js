/**
 * infoPanel.js
 * Floating info card that shows all available data for a clicked object.
 *
 * Usage:
 *   const panel = createInfoPanel();
 *   panel.show(simObj, framePositions, frameVelocities, posUnit);
 *   panel.updateFrame(framePositions, frameVelocities);
 *   panel.hide();
 */

// ── styles (injected once) ─────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('info-panel-style')) return;
  const s = document.createElement('style');
  s.id = 'info-panel-style';
  s.textContent = `
    #info-panel {
      position: fixed;
      top: 16px; right: 16px;
      width: 270px;
      max-height: calc(100vh - 100px);
      overflow-y: auto;
      background: rgba(8, 10, 22, 0.92);
      border: 1px solid #2a3860;
      border-radius: 10px;
      padding: 14px 16px 16px;
      font-family: monospace; font-size: 12px; color: #cbd;
      z-index: 800;
      display: none;
      box-shadow: 0 4px 24px rgba(0,0,0,.6);
      transition: opacity .15s;
    }
    #info-panel.visible { display: block; }

    /* header */
    #info-panel .ip-header {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 10px;
    }
    #info-panel .ip-dot {
      width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0;
    }
    #info-panel .ip-name {
      flex: 1; font-size: 14px; font-weight: bold; color: #eef; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
    }
    #info-panel .ip-type {
      font-size: 10px; background: #1a2240; border: 1px solid #3a4870;
      border-radius: 4px; padding: 1px 6px; color: #89a; letter-spacing: .04em;
      text-transform: uppercase;
    }
    #info-panel .ip-close {
      background: none; border: none; color: #667; cursor: pointer;
      font-size: 15px; line-height: 1; padding: 0 2px; margin-left: 4px;
    }
    #info-panel .ip-close:hover { color: #ccd; }

    /* section label */
    #info-panel .ip-section {
      font-size: 10px; letter-spacing: .08em; color: #556; text-transform: uppercase;
      margin: 10px 0 4px; border-top: 1px solid #1c2440; padding-top: 6px;
    }
    #info-panel .ip-section:first-of-type { margin-top: 0; }

    /* rows */
    #info-panel .ip-row {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 2px 0; gap: 8px;
    }
    #info-panel .ip-key  { color: #778; flex-shrink: 0; }
    #info-panel .ip-val  { color: #bdf; text-align: right; word-break: break-all; }
    #info-panel .ip-unit { color: #556; margin-left: 3px; font-size: 10px; }

    /* highlighted live rows */
    #info-panel .ip-row.live .ip-val { color: #8ef; }
    #info-panel .ip-row.live .ip-key { color: #5a8; }

    /* progress bars */
    #info-panel .ip-bar-row {
      display: flex; flex-direction: column; gap: 2px;
      padding: 3px 0;
    }
    #info-panel .ip-bar-header {
      display: flex; justify-content: space-between; align-items: baseline;
      gap: 8px;
    }
    #info-panel .ip-bar-key { color: #778; flex-shrink: 0; font-size: 11px; }
    #info-panel .ip-bar-val { color: #bdf; text-align: right; font-size: 11px; }
    #info-panel .ip-bar-unit { color: #556; margin-left: 2px; font-size: 10px; }
    #info-panel .ip-bar-track {
      height: 4px; background: #0e1220; border: 1px solid #1a2540;
      border-radius: 3px; overflow: hidden; position: relative;
    }
    #info-panel .ip-bar-fill {
      height: 100%; border-radius: 2px; transition: width 0.3s ease;
    }
  `;
  document.head.appendChild(s);
}

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Find a property entry for a given object id in the properties array.
 * @param {Array} properties  frame.properties array
 * @param {string} id         object id
 * @returns {object|null}
 */
function findPropertyById(properties, id) {
  return properties?.find(p => p.id === id) ?? null;
}

/** Format a number nicely (scientific for huge/tiny, fixed otherwise). */
function fmt(v) {
  if (typeof v !== 'number') return String(v);
  const abs = Math.abs(v);
  if (abs === 0) return '0';
  if (abs >= 1e6 || (abs < 1e-3 && abs > 0)) return v.toExponential(3);
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toPrecision(5).replace(/\.?0+$/, '');
}

function row(key, val, unit = '', live = false) {
  const d = document.createElement('div');
  d.className = 'ip-row' + (live ? ' live' : '');
  d.innerHTML =
    `<span class="ip-key">${key}</span>` +
    `<span class="ip-val">${fmt(val)}<span class="ip-unit">${unit}</span></span>`;
  return d;
}

function section(title) {
  const d = document.createElement('div');
  d.className = 'ip-section';
  d.textContent = title;
  return d;
}

/**
 * Create a visual progress bar for a numeric value.
 * @param {string} key    Label
 * @param {number} val    Current value
 * @param {number} max    Maximum value (for percentage calculation)
 * @param {string} unit   Unit string
 * @param {string} color  CSS color for the fill
 * @returns {HTMLElement}
 */
function bar(key, val, max, unit = '', color = '#5af') {
  const percent = Math.max(0, Math.min(100, (val / max) * 100));
  
  const container = document.createElement('div');
  container.className = 'ip-bar-row';
  
  const header = document.createElement('div');
  header.className = 'ip-bar-header';
  header.innerHTML =
    `<span class="ip-bar-key">${key}</span>` +
    `<span class="ip-bar-val">${fmt(val)}<span class="ip-bar-unit">${unit}</span></span>`;
  
  const track = document.createElement('div');
  track.className = 'ip-bar-track';
  
  const fill = document.createElement('div');
  fill.className = 'ip-bar-fill';
  fill.style.width = `${percent}%`;
  fill.style.background = color;
  
  track.appendChild(fill);
  container.appendChild(header);
  container.appendChild(track);
  
  return container;
}

// ── factory ────────────────────────────────────────────────────────────────

/**
 * Create an info-panel instance and attach it to document.body.
 * @returns {{ show, updateFrame, hide }}
 */
export function createInfoPanel() {
  injectStyles();

  const panel = document.createElement('div');
  panel.id = 'info-panel';
  document.body.appendChild(panel);

  let _currentId = null;

  // ── live position / velocity section (replaced on updateFrame) ──────────
  let _liveSection = null;

  function buildLive(positions, velocities, properties, id, posUnit) {
    const frag = document.createDocumentFragment();
    frag.appendChild(section('Position (current frame)'));

    const pos = positions?.find(p => p.id === id) ?? null;
    const vel = velocities?.find(v => v.id === id) ?? null;

    if (pos) {
      frag.appendChild(row('x', pos.x, posUnit, true));
      frag.appendChild(row('y', pos.y, posUnit, true));
      frag.appendChild(row('z', pos.z, posUnit, true));
    } else {
      const na = document.createElement('div');
      na.className = 'ip-row'; na.textContent = '—';
      frag.appendChild(na);
    }

    if (vel && (vel.vx !== undefined)) {
      frag.appendChild(section('Velocity (current frame)'));
      frag.appendChild(row('vx', vel.vx, '', true));
      frag.appendChild(row('vy', vel.vy, '', true));
      frag.appendChild(row('vz', vel.vz, '', true));
    }

    // ── per-frame properties (radiation, temperature, etc.) ──────────────
    const prop = findPropertyById(properties, id);
    if (prop) {
      // Radiation section
      if (prop.uv_local_flux != null || prop.gcr_local_flux != null || prop.gamma_local_flux != null) {
        frag.appendChild(section('Radiation (current frame)'));
        if (prop.uv_local_flux != null)    frag.appendChild(bar('UV flux', prop.uv_local_flux, 200, 'W/m²', '#fc4'));
        if (prop.gcr_local_flux != null)   frag.appendChild(row('GCR flux', prop.gcr_local_flux, '', true));
        if (prop.gamma_local_flux != null) frag.appendChild(bar('Gamma flux', prop.gamma_local_flux, 100, 'Gy/yr', '#a6f'));
        if (prop.radiation_decay_gy_per_year != null) frag.appendChild(row('Decay dose', prop.radiation_decay_gy_per_year, 'Gy/yr', true));
      }
      // Temperature section
      if (prop.T_surface_K != null || prop.T_center_K != null) {
        frag.appendChild(section('Temperature (current frame)'));
        if (prop.T_surface_K != null) frag.appendChild(bar('Surface', prop.T_surface_K, 300, 'K', '#f84'));
        if (prop.T_center_K != null)  frag.appendChild(bar('Center', prop.T_center_K, 300, 'K', '#f84'));
      }
      // Biology section (for asteroids)
      if (prop.population_fraction != null || prop.hydrolysis_rate_s_inv != null) {
        frag.appendChild(section('Biology (current frame)'));
        if (prop.population_fraction != null)  frag.appendChild(bar('Population', prop.population_fraction * 100, 100, '%', '#4a8'));
        if (prop.hydrolysis_rate_s_inv != null) frag.appendChild(row('Hydrolysis', prop.hydrolysis_rate_s_inv, '1/s', true));
      }
      // Rock composition (show once, not per-frame)
      if (prop.rock_type != null || prop.uranium238_ppm != null) {
        frag.appendChild(section('Rock properties'));
        if (prop.rock_type != null)       frag.appendChild(row('Type', prop.rock_type, ''));
        if (prop.uranium238_ppm != null)  frag.appendChild(row('U-238', prop.uranium238_ppm, 'ppm'));
        if (prop.thorium232_ppm != null)  frag.appendChild(row('Th-232', prop.thorium232_ppm, 'ppm'));
        if (prop.potassium_percent != null) frag.appendChild(row('K', prop.potassium_percent, '%'));
      }
    }

    return frag;
  }

  /**
   * Show the panel for a given simulation object.
   * @param {object} simObj      entry from simData.objects[]
   * @param {Array}  positions   current frame's positions array (or null)
   * @param {Array}  velocities  current frame's velocities array (or null)
   * @param {Array}  properties  current frame's properties array (or null)
   * @param {string} posUnit     e.g. 'world-units'
   */
  function show(simObj, positions, velocities, properties, posUnit = '') {
    _currentId = simObj.id;
    panel.innerHTML = '';

    // ── header ─────────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'ip-header';

    const dot = document.createElement('div');
    dot.className = 'ip-dot';
    dot.style.background = simObj.visual?.color ?? '#aaa';

    const name = document.createElement('span');
    name.className = 'ip-name';
    name.textContent = simObj.name ?? simObj.id;

    const typeBadge = document.createElement('span');
    typeBadge.className = 'ip-type';
    typeBadge.textContent = simObj.type ?? 'object';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ip-close';
    closeBtn.title = 'Close  [Esc]';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', hide);

    header.append(dot, name, typeBadge, closeBtn);
    panel.appendChild(header);

    // ── visual properties ──────────────────────────────────────────────────
    if (simObj.visual) {
      panel.appendChild(section('Appearance'));
      const v = simObj.visual;
      if (v.radius  !== undefined) panel.appendChild(row('Radius',  v.radius, 'w.u.'));
      if (v.color   !== undefined) {
        const r = document.createElement('div');
        r.className = 'ip-row';
        r.innerHTML =
          `<span class="ip-key">Color</span>` +
          `<span class="ip-val" style="display:flex;align-items:center;gap:5px">` +
          `<span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${v.color};border:1px solid #444"></span>` +
          `${v.color}</span>`;
        panel.appendChild(r);
      }
      if (v.emissive) {
        const r = document.createElement('div');
        r.className = 'ip-row';
        r.innerHTML = `<span class="ip-key">Emissive</span><span class="ip-val">yes</span>`;
        panel.appendChild(r);
      }
    }

    // ── info dict ──────────────────────────────────────────────────────────
    if (simObj.info && Object.keys(simObj.info).length > 0) {
      panel.appendChild(section('Physical data'));
      for (const [key, entry] of Object.entries(simObj.info)) {
        const val  = entry?.value ?? entry;
        const unit = entry?.unit  ?? '';
        panel.appendChild(row(key, val, unit));
      }
    }

    // ── live frame data (position / velocity / properties) ────────────────
    _liveSection = document.createElement('div');
    _liveSection.id = 'ip-live';
    _liveSection.appendChild(buildLive(positions, velocities, properties, _currentId, posUnit));
    panel.appendChild(_liveSection);

    panel.classList.add('visible');
  }

  /**
   * Refresh only the live position/velocity/properties section when the frame changes.
   * @param {Array}  positions
   * @param {Array}  velocities
   * @param {Array}  properties
   * @param {string} posUnit
   */
  function updateFrame(positions, velocities, properties, posUnit = '') {
    if (!_currentId || !_liveSection) return;
    _liveSection.innerHTML = '';
    _liveSection.appendChild(buildLive(positions, velocities, properties, _currentId, posUnit));
  }

  function hide() {
    panel.classList.remove('visible');
    _currentId = null;
  }

  return { show, updateFrame, hide };
}
