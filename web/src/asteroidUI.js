/**
 * asteroidUI.js
 * Floating panel that lets the user spawn asteroids with a custom
 * world-space position and velocity vector.
 */

const PANEL_ID = 'asteroid-panel';

/** CSS injected once into <head>. */
const STYLES = `
#asteroid-toggle {
  position: fixed; top: 16px; right: 16px;
  background: #1a1a2e; color: #aad4f5; border: 1px solid #334;
  font-family: monospace; font-size: 13px; padding: 6px 14px;
  cursor: pointer; border-radius: 4px; z-index: 100;
}
#asteroid-toggle:hover { background: #22223b; }

#asteroid-panel {
  position: fixed; top: 52px; right: 16px;
  background: #0d0d1a; color: #ccc; border: 1px solid #334;
  font-family: monospace; font-size: 13px;
  padding: 14px 16px; border-radius: 6px; z-index: 100;
  display: none; width: 240px;
}
#asteroid-panel h2 { color: #aad4f5; margin: 0 0 10px; font-size: 14px; }
#asteroid-panel label { display: block; margin: 6px 0 2px; color: #999; }
#asteroid-panel input[type=number], #asteroid-panel input[type=color] {
  width: 100%; background: #111; color: #eee; border: 1px solid #335;
  padding: 3px 6px; font-family: monospace; font-size: 12px; border-radius: 3px;
}
#asteroid-panel input[type=checkbox] { width: auto; margin-right: 6px; cursor: pointer; }
#asteroid-panel .physics-row {
  display: flex; align-items: center; margin-top: 8px; color: #9cf;
}
#asteroid-panel input[type=color] { height: 28px; padding: 2px; cursor: pointer; }
.vec-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; }
.vec-row input { width: 100%; }
#asteroid-panel .hint { color: #556; font-size: 11px; margin-top: 4px; }
#asteroid-spawn-btn {
  margin-top: 12px; width: 100%;
  background: #1b3a5c; color: #aad4f5; border: 1px solid #2a5a8c;
  font-family: monospace; font-size: 13px; padding: 6px;
  cursor: pointer; border-radius: 4px;
}
#asteroid-spawn-btn:hover { background: #1f4a7a; }
#trail-toggle-btn {
  margin-top: 8px; width: 100%;
  background: #1a1a2e; color: #afd4ff; border: 1px solid #334;
  font-family: monospace; font-size: 13px; padding: 6px;
  cursor: pointer; border-radius: 4px;
}
#trail-toggle-btn.active { background: #1b3a5c; border-color: #2a5a8c; color: #7af; }
#asteroid-list { margin-top: 12px; max-height: 120px; overflow-y: auto; }
.asteroid-entry {
  display: flex; justify-content: space-between; align-items: center;
  padding: 2px 0; border-bottom: 1px solid #222; font-size: 11px;
}
.asteroid-entry .btn-focus {
  background: none; border: none; color: #7af; cursor: pointer; font-size: 12px;
  padding: 0 4px;
}
.asteroid-entry .btn-focus:hover { color: #adf; }
.asteroid-entry .btn-remove {
  background: none; border: none; color: #e06; cursor: pointer; font-size: 12px;
  padding: 0 4px;
}
.asteroid-entry .btn-remove:hover { color: #f66; }
`;

function injectStyles() {
  if (document.getElementById('asteroid-ui-styles')) return;
  const style = document.createElement('style');
  style.id = 'asteroid-ui-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function buildInputRow(labelText, id) {
  return `<label for="${id}">${labelText}</label>
          <input type="number" id="${id}" step="any" value="0" />`;
}

function buildPanelHTML() {
  return `
    <h2>Add Asteroid</h2>
    <label>Position (x, y, z)</label>
    <div class="vec-row">
      <input type="number" id="ast-px" step="any" value="0"  placeholder="x" />
      <input type="number" id="ast-py" step="any" value="0"  placeholder="y" />
      <input type="number" id="ast-pz" step="any" value="30" placeholder="z" />
    </div>
    <label>Velocity (x, y, z) <span class="hint">units/s &nbsp;|&nbsp; orbit ≈1.8 u/s</span></label>
    <div class="vec-row">
      <input type="number" id="ast-vx" step="any" value="1.8"  placeholder="vx" />
      <input type="number" id="ast-vy" step="any" value="0"  placeholder="vy" />
      <input type="number" id="ast-vz" step="any" value="0"  placeholder="vz" />
    </div>
    <label>Radius</label>
    <input type="number" id="ast-r" step="0.05" min="0.05" value="0.3" />
    <label>Mass</label>
    <input type="number" id="ast-mass" step="1" min="0.1" value="10" />
    <label>Color</label>
    <input type="color" id="ast-color" value="#aaaaaa" />
    <div class="physics-row">
      <input type="checkbox" id="ast-use-physics" />
      <label for="ast-use-physics" style="margin:0;color:#9cf">Enable gravity</label>
    </div>
    <button id="asteroid-spawn-btn">Spawn asteroid</button>
    <button id="trail-toggle-btn">☄ Trails: OFF</button>
    <div id="asteroid-list"></div>
  `;
}

function readVec(xi, yi, zi) {
  return {
    x: parseFloat(document.getElementById(xi).value) || 0,
    y: parseFloat(document.getElementById(yi).value) || 0,
    z: parseFloat(document.getElementById(zi).value) || 0,
  };
}

function refreshList(asteroids, onRemove, onFocus) {
  const list = document.getElementById('asteroid-list');
  if (!list) return;
  list.innerHTML = asteroids.map(a =>
    `<div class="asteroid-entry">
      <span>${a.data.id}</span>
      <span>
        <button class="btn-focus" title="Focus camera" data-id="${a.data.id}">◎</button>
        <button class="btn-remove" title="Remove"       data-id="${a.data.id}">✕</button>
      </span>
     </div>`
  ).join('');
  list.querySelectorAll('.btn-focus').forEach(btn =>
    btn.addEventListener('click', () => onFocus?.(btn.dataset.id))
  );
  list.querySelectorAll('.btn-remove').forEach(btn =>
    btn.addEventListener('click', () => onRemove(btn.dataset.id))
  );
}

/**
 * Inject the asteroid panel and toggle button into the page.
 * @param {(params: object) => { data, mesh }} onSpawn      called when user clicks Spawn
 * @param {(id: string)    => void}            onRemove     called when user removes an entry
 * @param {Array}                              asteroids    live array for list refresh
 * @param {(id: string)    => void}            [onFocus]    called when user clicks ◎ Focus
 * @param {(enabled: boolean) => void}         [onTrailToggle] called when trail toggle changes
 */
export function initAsteroidUI(onSpawn, onRemove, asteroids, onFocus, onTrailToggle) {
  injectStyles();

  const toggle = document.createElement('button');
  toggle.id = 'asteroid-toggle';
  toggle.textContent = '☄ Asteroids';
  document.body.appendChild(toggle);

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = buildPanelHTML();
  document.body.appendChild(panel);

  toggle.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  let trailsOn = false;
  document.getElementById('trail-toggle-btn').addEventListener('click', () => {
    trailsOn = !trailsOn;
    const btn = document.getElementById('trail-toggle-btn');
    btn.textContent = `☄ Trails: ${trailsOn ? 'ON' : 'OFF'}`;
    btn.classList.toggle('active', trailsOn);
    onTrailToggle?.(trailsOn);
  });

  document.getElementById('asteroid-spawn-btn').addEventListener('click', () => {
    const params = {
      position:   readVec('ast-px', 'ast-py', 'ast-pz'),
      velocity:   readVec('ast-vx', 'ast-vy', 'ast-vz'),
      radius:     Math.max(0.05, parseFloat(document.getElementById('ast-r').value) || 0.3),
      mass:       Math.max(0.1,  parseFloat(document.getElementById('ast-mass').value) || 10),
      usePhysics: document.getElementById('ast-use-physics').checked,
      color:      document.getElementById('ast-color').value,
    };
    onSpawn(params);
    refreshList(asteroids, onRemove, onFocus);
  });
}

/**
 * Refresh the displayed asteroid list (call after spawn or remove).
 * @param {Array}                   asteroids
 * @param {(id: string) => void}    onRemove
 * @param {(id: string) => void}    [onFocus]
 */
export function refreshAsteroidList(asteroids, onRemove, onFocus) {
  refreshList(asteroids, onRemove, onFocus);
}
