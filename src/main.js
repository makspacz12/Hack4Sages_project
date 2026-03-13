/**
 * main.js
 * Entry point – orchestrates scene, camera, renderer, data loading,
 * object creation and the animation loop.
 */

import { loadSolarSystem } from './dataLoader.js';
import { createScene, addLighting, addStarfield } from './scene.js';
import { createCamera, createControls, resizeCamera, resizeControls } from './camera.js';
import { createRenderer, resizeRenderer } from './renderer.js';
import { createBodyNode } from './objectFactory.js';
import { createOrbitLine } from './orbitLine.js';
import { startAnimationLoop } from './animator.js';
import { registerClickHandler } from './picker.js';
import { createFocusController, setFocusTarget, clearFocus, updateFocus,
         activateFollow, deactivateFollow, activateOrbit, deactivateOrbit } from './focusController.js';
import { createSelectionGlow } from './selectionGlow.js';
import { addAsteroid, removeAsteroid, updateAsteroidPositions } from './asteroidManager.js';
import { initAsteroidUI, refreshAsteroidList } from './asteroidUI.js';
import { updateShaderTime } from './shaderMaterial.js';
import { createPhysicsEngine, stepPhysics } from './physics.js';
import {
  registerStaticBodies, registerAsteroidBody, removeAsteroidBody,
  syncStaticFromMeshes, syncDynamicToMeshes,
} from './physicsSync.js';
import {
  createTrail, updateTrail, removeTrail, setTrailsVisible, clearTrail,
  buildTrailPositions, setTrailHistory, setTrailColor,
} from './trailManager.js';
import {
  createReplayController, tickReplay, applyReplayFrame, applyReplayFrameLerp,
} from './replayController.js';
import { initReplayUI } from './replayUI.js';
import { createInfoPanel } from './infoPanel.js';
import { createRConsole } from './rConsole.js';
import { createUVShells, setUVVisible, tickUVAnimation, updateHeatForNodes } from './uvRadiation.js';
import { createObjectSearch } from './objectSearch.js';
import { createRollState, tickCameraRoll } from './cameraRoll.js';

/** Colour of the trail for the currently followed object – bright yellow-white. */
const FOLLOW_COLOR = '#ffffa0';

const APP_BASE_URL = import.meta.env.BASE_URL;

/** Build URL relative to Vite base path (works locally and on GitHub Pages). */
function withBase(path) {
  return `${APP_BASE_URL}${String(path).replace(/^\/+/, '')}`;
}

const DATA_URL = withBase('data/solar_system.json');

/** Build parent-id → Three.js Group lookup for attaching moons etc. */
function buildParentMap(nodes) {
  const map = new Map();
  for (const { body, pivot, mesh } of nodes) {
    map.set(body.id, { body, pivot, mesh });
  }
  return map;
}

/** Attach all pivots to their parent mesh or to the scene root. */
function attachNodesToScene(nodes, scene) {
  const parentMap = buildParentMap(nodes);

  for (const { body, pivot } of nodes) {
    if (!body.parentId) {
      scene.add(pivot);
    } else {
      const parent = parentMap.get(body.parentId);
      if (parent) {
        parent.mesh.add(pivot);
      } else {
        scene.add(pivot);
      }
    }
  }
}

/** Add orbit lines for every body that has a non-zero distance. */
function addOrbitLines(nodes, scene, parentMap) {
  for (const { body } of nodes) {
    if ((body.distance ?? 0) === 0) continue;
    const line = createOrbitLine(body.distance);

    if (!body.parentId) {
      scene.add(line);
    } else {
      const parent = parentMap.get(body.parentId);
      if (parent) parent.mesh.add(line);
      else scene.add(line);
    }
  }
}

/** Wire speed-control slider in the UI (live orbital mode only). */
function initSpeedControl() {
  let speed = 1;
  const wrap   = document.getElementById('speed-control');
  const slider = document.getElementById('speed');
  const label  = document.getElementById('speed-value');
  if (wrap)   wrap.style.display = 'flex';  // show it in live mode
  slider?.addEventListener('input', () => {
    speed = parseFloat(slider.value);
    if (label) label.textContent = `${speed.toFixed(1)}×`;
  });
  return () => speed;
}

/** Show/hide the "focused on: <name>" HUD label. */
function setFocusLabel(name) {
  const hud = document.getElementById('focus-hud');
  const el  = document.getElementById('focus-label');
  const btn = document.getElementById('follow-btn');
  if (el)  el.textContent = name ? `Focused: ${name}` : '';
  if (hud) hud.classList.toggle('visible', !!name);
  if (!name && btn) btn.classList.remove('active');
}

/** Handle window resize. */
function onResize(renderer, camera, controls) {
  window.addEventListener('resize', () => {
    resizeRenderer(renderer, window.innerWidth, window.innerHeight);
    resizeCamera(camera, window.innerWidth, window.innerHeight);
    resizeControls(controls);
  });
}

/**
 * Replay mode – loads simulation JSON and plays it frame-by-frame.
 * Activated by adding ?replay=data/test_replay.json to the URL.
 */
async function mainReplay(replayUrl) {
  const resp = await fetch(replayUrl);
  if (!resp.ok) throw new Error(`Cannot load replay: ${resp.statusText}`);
  const simData = await resp.json();

  const scene    = createScene();
  const camera   = createCamera(window.innerWidth / window.innerHeight);
  const renderer = createRenderer();
  const controls = createControls(camera, renderer.domElement);
  const rollState = createRollState();

  addLighting(scene);
  const starfieldMesh = addStarfield(scene);
  const nodes = (simData.objects ?? []).map(obj => {
    const body = {
      id:        obj.id,
      name:      obj.name ?? obj.id,
      radius:    obj.visual?.radius  ?? 1,
      color:     obj.visual?.color   ?? '#ffffff',
      distance:  0,
      parentId:  null,
      emissive:  obj.visual?.emissive ?? false,
      type:      obj.type ?? 'planet',
    };
    const { pivot, mesh } = createBodyNode(body);
    scene.add(pivot);
    return { body, pivot, mesh };
  });

  // id → mesh lookup for fast position updates.
  const meshById = new Map(nodes.map(n => [n.body.id, n.mesh]));

  // ── UV radiation shells ───────────────────────────────────────
  // For each star object, create 5 concentric UV shells (initially hidden).
  const allUVShells = [];
  const starNodes   = [];
  for (const obj of simData.objects ?? []) {
    if ((obj.type ?? '').toLowerCase() !== 'star') continue;
    const mesh = meshById.get(obj.id);
    if (!mesh) continue;
    const shells = createUVShells(obj, mesh);
    allUVShells.push(...shells);
    starNodes.push({ body: { id: obj.id, radius: obj.visual?.radius ?? 1 }, mesh });
  }

  let uvEnabled          = false;
  let trailsEnabled       = false;
  let onlyFollowTrail     = false;
  let planetTrailsEnabled = false;

  /** Compute whether a given trail id should be visible right now. */
  function trailShouldBeVisible(id) {
    const entry = replayTrailMap.get(id);
    const type  = (entry?.type ?? '');
    if (type === 'planet') return planetTrailsEnabled;
    // asteroid / comet — filtered by "followed only" toggle
    if (onlyFollowTrail) return id === _followedTrailId;
    return trailsEnabled;
  }

  /** Re-apply visibility to every trail based on current flags. */
  function syncAllTrailVisibility() {
    for (const [id, { trail }] of replayTrailMap) {
      const vis = trailShouldBeVisible(id);
      trail.line.visible = vis;
      if (!vis) { trail.history.length = 0; trail.line.geometry.setDrawRange(0, 0); }
    }
  }

  // ── Comet trails for replay-mode objects ─────────────────────────────
  const TRAIL_LEN        = 10;   // asteroids
  const PLANET_TRAIL_LEN = 40;   // planets – longer arc
  const PLANET_TRAIL_COLOR = '#778899'; // slate-grey
  const trailPosScale  = simData.meta?.positionScale ?? 1;
  const replayTrailMap = new Map();
  for (const { body, mesh } of nodes) {
    const t = (body.type ?? '').toLowerCase();
    if (t === 'asteroid') {
      const color = simData.objects?.find(o => o.id === body.id)?.visual?.color ?? '#aaaaaa';
      const trail = createTrail(scene, color, TRAIL_LEN);
      trail.line.visible = false;
      replayTrailMap.set(body.id, { trail, mesh, type: 'asteroid', trailLen: TRAIL_LEN });
    } else if (t === 'planet') {
      const trail = createTrail(scene, PLANET_TRAIL_COLOR, PLANET_TRAIL_LEN);
      trail.line.visible = false;
      replayTrailMap.set(body.id, { trail, mesh, type: 'planet', trailLen: PLANET_TRAIL_LEN });
    }
  }

  /**
   * Rebuild every asteroid trail from the last TRAIL_LEN frames of sim data.
   * Works both during playback and scrubbing because it reads ctrl.frames[]
   * directly instead of accumulating live positions.
   */
  function rebuildReplayTrails() {
    for (const [id, { trail, trailLen }] of replayTrailMap) {
      const vis = trailShouldBeVisible(id);
      trail.line.visible = vis;
      if (!vis) { trail.history.length = 0; trail.line.geometry.setDrawRange(0, 0); continue; }
      const positions = buildTrailPositions(ctrl.frames, ctrl.currentFrame, trailLen, id);
      const tScale    = trailPosScale * (ctrl.scaleMultiplier ?? 1);
      const scaled    = positions.map(p => ({
        x: p.x * tScale, y: p.y * tScale, z: p.z * tScale,
      }));
      setTrailHistory(trail, scaled);
    }
  }

  const ctrl = createReplayController(simData);
  applyReplayFrame(ctrl, meshById);   // apply frame 0 immediately

  // Lookup: id → full simData object (for info panel)
  const objById  = new Map((simData.objects ?? []).map(o => [o.id, o]));
  const posUnit  = simData.meta?.positionUnit ?? '';
  const infoPanel = createInfoPanel();

  /** Return { positions, velocities } for the current frame. */
  const curFrame = () => ctrl.frames?.[ctrl.currentFrame] ?? {};

  // Focus-on-click works in replay mode too.
  const focusCtrl  = createFocusController();
  const selectionGlow = createSelectionGlow();
  const bodyByMesh = new Map(nodes.map(n => [n.mesh, n.body]));

  // ── Follow trail colour (replay mode) ──────────────────────────────────
  let _followedTrailId = null;
  function applyFollowTrailColor(newId) {
    if (_followedTrailId !== null) {
      const e = replayTrailMap.get(_followedTrailId);
      if (e !== undefined && e._savedColor !== undefined) {
        setTrailColor(e.trail, e._savedColor);
        delete e._savedColor;
      }
    }
    _followedTrailId = newId ?? null;
    if (_followedTrailId !== null) {
      const e = replayTrailMap.get(_followedTrailId);
      if (e) { e._savedColor = e.trail.colorHex; setTrailColor(e.trail, FOLLOW_COLOR); }
    }
    syncAllTrailVisibility();
    rebuildReplayTrails();
  }

  // Focus mode cycling button: locked → orbit → follow → locked
  const followBtn = document.getElementById('follow-btn');
  if (followBtn) {
    followBtn.addEventListener('click', () => {
      if (!focusCtrl.active) return; // nothing selected
      
      if (!focusCtrl.orbitMode) {
        // locked → orbit
        activateOrbit(focusCtrl);
        followBtn.textContent = '🔄';
        followBtn.className = 'orbit';
        followBtn.title = 'Orbit: camera pivot tracks object';
      } else if (!focusCtrl.followMode) {
        // orbit → follow
        activateFollow(focusCtrl);
        followBtn.textContent = '🎥';
        followBtn.className = 'active';
        followBtn.title = 'Follow: camera moves with object';
      } else {
        // follow → locked
        deactivateFollow(focusCtrl);
        deactivateOrbit(focusCtrl);
        followBtn.textContent = '📌';
        followBtn.className = '';
        followBtn.title = 'Locked: object selected, camera stationary';
      }
    });
  }

  // ── Searchable object list ───────────────────────────────────────────
  const objectSearch = createObjectSearch(nodes, simData, (node, simObj) => {
    setFocusTarget(focusCtrl, node.mesh);
    activateOrbit(focusCtrl);
    if (followBtn) {
      followBtn.textContent = '🔄';
      followBtn.className = 'orbit';
      followBtn.title = 'Orbit: camera pivot tracks object';
    }
    selectionGlow.attach(node.mesh);
    setFocusLabel(node.body?.name ?? '');
    applyFollowTrailColor(node.body.id);
    if (simObj) {
      const { positions, velocities, properties } = curFrame();
      infoPanel.show(simObj, positions, velocities, properties, posUnit);
    }
  });
  objectSearch.mount();

  registerClickHandler(
    renderer.domElement,
    camera,
    () => nodes.map(n => n.mesh),
    (mesh) => {
      const body = bodyByMesh.get(mesh);
      setFocusTarget(focusCtrl, mesh);
      activateOrbit(focusCtrl);
      if (followBtn) {
        followBtn.textContent = '🔄';
        followBtn.className = 'orbit';
        followBtn.title = 'Orbit: camera pivot tracks object';
      }
      selectionGlow.attach(mesh);
      setFocusLabel(body?.name ?? '');
      objectSearch.setActive(body?.id);
      applyFollowTrailColor(body?.id ?? null);
      const obj = objById.get(body?.id);
      if (obj) {
        const { positions, velocities, properties } = curFrame();
        infoPanel.show(obj, positions, velocities, properties, posUnit);
      }
    },
    () => {
      clearFocus(focusCtrl);
      selectionGlow.detach();
      setFocusLabel(null);
      infoPanel.hide();
      applyFollowTrailColor(null);
      if (followBtn) { followBtn.textContent = '📌'; followBtn.className = ''; followBtn.title = 'Focus mode (click to cycle)'; }
    },
  );
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      clearFocus(focusCtrl);
      selectionGlow.detach();
      setFocusLabel(null);
      infoPanel.hide();
      applyFollowTrailColor(null);
      if (followBtn) { followBtn.textContent = '📌'; followBtn.className = ''; followBtn.title = 'Focus mode (click to cycle)'; }
    }
  });

  const { refreshUI } = initReplayUI(ctrl, (c) => {
    applyReplayFrame(c, meshById);
    rebuildReplayTrails();   // scrubbing: rebuild trail from data, not live positions
    const { positions, velocities, properties } = curFrame();
    infoPanel.updateFrame(positions, velocities, properties, posUnit);
  }, {
    onUVToggle: (enabled) => {
      uvEnabled = enabled;
      setUVVisible(allUVShells, enabled);
      if (!enabled) updateHeatForNodes(nodes, starNodes, false);
    },
    onTrailToggle: (enabled) => {
      trailsEnabled = enabled;
      syncAllTrailVisibility();
      rebuildReplayTrails();
    },
    onOnlyFollowTrail: (enabled) => {
      onlyFollowTrail = enabled;
      syncAllTrailVisibility();
      rebuildReplayTrails();
    },
    onPlanetTrailToggle: (enabled) => {
      planetTrailsEnabled = enabled;
      syncAllTrailVisibility();
      rebuildReplayTrails();
    },
    onWorldScaleChange: (mult) => {
      ctrl.scaleMultiplier = mult;
      rebuildReplayTrails();
    },
    onStarfieldToggle: (enabled) => {
      starfieldMesh.visible = enabled;
    },
  });

  onResize(renderer, camera, controls);

  let elapsed = 0;

  startAnimationLoop({
    renderer, scene, camera, controls,
    nodes:    [],          // no orbital mechanics in replay mode
    getSpeed: () => 1,     // raw wall-clock delta reaches onTick
    onTick:   (scaledDeltaSec) => {
      elapsed += scaledDeltaSec;
      const dtMs = scaledDeltaSec * 1000;
      tickUVAnimation(allUVShells, scaledDeltaSec);
      updateHeatForNodes(nodes, starNodes, uvEnabled);
      const frameChanged = tickReplay(ctrl, dtMs);
      if (ctrl.smooth) {
        applyReplayFrameLerp(ctrl, meshById);
        if (frameChanged) {
          refreshUI(ctrl);
          const { positions, velocities, properties } = curFrame();
          infoPanel.updateFrame(positions, velocities, properties, posUnit);
          rebuildReplayTrails();
        }
      } else if (frameChanged) {
        applyReplayFrame(ctrl, meshById);
        refreshUI(ctrl);
        const { positions, velocities, properties } = curFrame();
        infoPanel.updateFrame(positions, velocities, properties, posUnit);
        rebuildReplayTrails();
      }
      updateFocus(focusCtrl, camera, controls);
      tickCameraRoll(rollState, camera, scaledDeltaSec);
      selectionGlow.update(elapsed);
    },
  });
}

async function main() {
  // ── Mode detection ───────────────────────────────────────────────────────
  // Default: replay mode with solar_simulation.json
  // ?replay=path/to/file.json → custom simulation file
  // ?live → original orbital-mechanics solar system
  const params     = new URLSearchParams(location.search);
  const customFile = params.get('replay');
  const liveMode   = params.has('live');

  // R console is mode-independent — mount it immediately.
  createRConsole().mount();

  if (!liveMode) {
    const replayUrl = customFile
      ? (/^https?:\/\//i.test(customFile) ? customFile : withBase(customFile))
      : withBase('data/cosmos_visualizer_simulation.json');
    await mainReplay(replayUrl);
    return;
  }

  const flatBodies = await loadSolarSystem(DATA_URL);

  const scene    = createScene();
  const camera   = createCamera(window.innerWidth / window.innerHeight);
  const renderer = createRenderer();
  const controls = createControls(camera, renderer.domElement);
  const rollState = createRollState();

  addLighting(scene);
  addStarfield(scene);

  const nodes = flatBodies.map(body => {
    const { pivot, mesh } = createBodyNode(body);
    return { body, pivot, mesh };
  });

  attachNodesToScene(nodes, scene);
  addOrbitLines(nodes, scene, buildParentMap(nodes));

  // ── Physics engine ───────────────────────────────────────────────────────
  // G=0.0001 gives circular orbit velocity ≈1.83 u/s at r=30 (matching
  // the default spawn velocity of 2 u/s → nice elliptical orbit).
  const physicsEngine = createPhysicsEngine({ G: 0.0001, softening: 1 });
  registerStaticBodies(physicsEngine, nodes);

  // ── Focus-on-click ───────────────────────────────────────────────────────
  const focusCtrl   = createFocusController();
  const selectionGlow = createSelectionGlow();
  const bodyByMesh  = new Map(nodes.map(n => [n.mesh, n.body]));
  const asteroids   = [];

  // ── Follow trail colour (live mode) ───────────────────────────────────
  // Uses function declaration (hoisted) so trailMap can be declared below.
  let _followedTrailId = null;
  function applyFollowTrailColor(newId) {
    if (_followedTrailId !== null) {
      const t = trailMap.get(_followedTrailId);
      if (t !== undefined && t._savedColor !== undefined) { setTrailColor(t, t._savedColor); delete t._savedColor; }
    }
    _followedTrailId = newId ?? null;
    if (_followedTrailId !== null) {
      const t = trailMap.get(_followedTrailId);
      if (t) { t._savedColor = t.colorHex; setTrailColor(t, FOLLOW_COLOR); }
    }
  }

  // Focus mode cycling button (same DOM element, re-wired for live mode)
  const followBtnLive = document.getElementById('follow-btn');
  if (followBtnLive) {
    followBtnLive.addEventListener('click', () => {
      if (!focusCtrl.active) return; // nothing selected
      
      if (!focusCtrl.orbitMode) {
        // locked → orbit
        activateOrbit(focusCtrl);
        followBtnLive.textContent = '🔄';
        followBtnLive.className = 'orbit';
        followBtnLive.title = 'Orbit: camera pivot tracks object';
      } else if (!focusCtrl.followMode) {
        // orbit → follow
        activateFollow(focusCtrl);
        followBtnLive.textContent = '🎥';
        followBtnLive.className = 'active';
        followBtnLive.title = 'Follow: camera moves with object';
      } else {
        // follow → locked
        deactivateFollow(focusCtrl);
        deactivateOrbit(focusCtrl);
        followBtnLive.textContent = '📌';
        followBtnLive.className = '';
        followBtnLive.title = 'Locked: object selected, camera stationary';
      }
    });
  }            // live asteroid tracking array
  const trailMap    = new Map();      // id → trail record
  let   trailsEnabled = false;

  const liveInfoPanel = createInfoPanel();

  /** Convert a flat body record into a simObj-style object for the info panel. */
  function bodyToSimObj(body) {
    const info = {};
    if (body.mass          != null) info['Mass']           = { value: body.mass,          unit: '' };
    if (body.radius        != null) info['Radius']         = { value: body.radius,        unit: 'w.u.' };
    if (body.distance      != null) info['Distance']       = { value: body.distance,      unit: 'w.u.' };
    if (body.orbitalPeriod != null) info['Orbital period'] = { value: body.orbitalPeriod, unit: 'yr' };
    if (body.parentId      != null) info['Orbits']         = { value: body.parentId,      unit: '' };
    return {
      id:     body.id,
      name:   body.name ?? body.id,
      type:   body.type ?? 'planet',
      visual: { radius: body.radius, color: body.color, emissive: body.emissive ?? false },
      info,
    };
  }

  // Flat list of meshes for raycasting – refreshed lazily via getter.
  const getMeshes = () => [
    ...nodes.map(n => n.mesh),
    ...asteroids.map(a => a.mesh),
  ];

  registerClickHandler(
    renderer.domElement,
    camera,
    getMeshes,
    (mesh) => {
      setFocusTarget(focusCtrl, mesh);
      activateOrbit(focusCtrl);
      if (followBtnLive) {
        followBtnLive.textContent = '🔄';
        followBtnLive.className = 'orbit';
        followBtnLive.title = 'Orbit: camera pivot tracks object';
      }
      selectionGlow.attach(mesh);
      const body = bodyByMesh.get(mesh);
      setFocusLabel(body?.name ?? mesh.name);
      const ast = asteroids.find(a => a.mesh === mesh);
      applyFollowTrailColor(ast?.data.id ?? null);
      if (body) liveInfoPanel.show(bodyToSimObj(body), null, null, null, 'j.w.');
    },
    () => {
      clearFocus(focusCtrl);
      selectionGlow.detach();
      setFocusLabel(null);
      if (followBtnLive) { followBtnLive.textContent = '📌'; followBtnLive.className = ''; followBtnLive.title = 'Focus mode (click to cycle)'; }
    },
  );
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      clearFocus(focusCtrl);
      selectionGlow.detach();
      setFocusLabel(null);
      liveInfoPanel.hide();
      applyFollowTrailColor(null);
      if (followBtnLive) { followBtnLive.textContent = '📌'; followBtnLive.className = ''; followBtnLive.title = 'Focus mode (click to cycle)'; }
    }
  });

  // ── Shared asteroid callbacks ───────────────────────────────────────
  function onAsteroidFocus(id) {
    const entry = asteroids.find(a => a.data.id === id);
    if (!entry) return;
    setFocusTarget(focusCtrl, entry.mesh);
    activateOrbit(focusCtrl);
    if (followBtnLive) {
      followBtnLive.textContent = '🔄';
      followBtnLive.className = 'orbit';
      followBtnLive.title = 'Orbit: camera pivot tracks object';
    }
    selectionGlow.attach(entry.mesh);
    setFocusLabel(entry.data.id);
    applyFollowTrailColor(id);
  }

  function onAsteroidRemove(id) {
    const entry = asteroids.find(a => a.data.id === id);
    if (entry) {
      if (focusCtrl.target === entry.mesh) {
        clearFocus(focusCtrl);
        selectionGlow.detach();
        setFocusLabel(null);
        if (followBtnLive) { followBtnLive.textContent = '📌'; followBtnLive.className = ''; followBtnLive.title = 'Focus mode (click to cycle)'; }
      }
      bodyByMesh.delete(entry.mesh);
      if (entry.data.usePhysics) removeAsteroidBody(physicsEngine, id);
      const trail = trailMap.get(id);
      if (trail) { removeTrail(scene, trail); trailMap.delete(id); }
    }
    removeAsteroid(scene, asteroids, id);
    refreshAsteroidList(asteroids, onAsteroidRemove, onAsteroidFocus);
  }

  // ── Asteroid UI ───────────────────────────────────────────────────────
  initAsteroidUI(
    (params) => {
      const entry = addAsteroid(scene, asteroids, params);
      bodyByMesh.set(entry.mesh, { name: entry.data.id });
      if (entry.data.usePhysics) {
        registerAsteroidBody(physicsEngine, entry.data, entry.data.mass);
      }
      const trail = createTrail(scene, entry.data.color);
      trail.line.visible = trailsEnabled;
      trailMap.set(entry.data.id, trail);
    },
    onAsteroidRemove,
    asteroids,
    onAsteroidFocus,
    (enabled) => {
      trailsEnabled = enabled;
      setTrailsVisible(trailMap, enabled);
    },
  );

  // ── Animation loop ───────────────────────────────────────────────────────
  const getSpeed = initSpeedControl();
  onResize(renderer, camera, controls);

  // Collect shader materials from all static nodes.
  const staticShaderMats = nodes.map(n => n.mesh.material);
  let elapsed = 0;

  startAnimationLoop({
    renderer, scene, camera, controls, nodes, getSpeed,
    onTick: (deltaSec) => {
      elapsed += deltaSec;
      // Update uTime on static bodies + any live asteroids.
      const astMats = asteroids.map(a => a.mesh.material);
      updateShaderTime([...staticShaderMats, ...astMats], elapsed);

      updateAsteroidPositions(asteroids, deltaSec);

      // Physics: sub-stepped integration to stay stable at any sim speed.
      // Cap individual dt at 1/60 s to prevent Euler blow-up.
      const PHYS_MAX_DT = 1 / 60;
      let   physRemain  = deltaSec;
      while (physRemain > 0) {
        const subDt = Math.min(physRemain, PHYS_MAX_DT);
        syncStaticFromMeshes(physicsEngine, nodes);
        stepPhysics(physicsEngine, subDt);
        physRemain -= subDt;
      }
      syncDynamicToMeshes(physicsEngine, asteroids);

      // Comet trails – only when enabled.
      if (trailsEnabled) {
        for (const { data } of asteroids) {
          const trail = trailMap.get(data.id);
          if (trail) updateTrail(trail, data.position.x, data.position.y, data.position.z);
        }
      }

      updateFocus(focusCtrl, camera, controls);
      tickCameraRoll(rollState, camera, deltaSec);
      selectionGlow.update(elapsed);
    },
  });
}

main().catch(err => {
  console.error('Failed to initialise Cosmos 3D:', err);
});
