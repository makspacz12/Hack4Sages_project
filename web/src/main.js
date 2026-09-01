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
import { osculatingOrbit } from './orbits.js';
import { startAnimationLoop } from './animator.js';
import { registerClickHandler } from './picker.js';
import { createFocusController, setFocusTarget, clearFocus, updateFocus,
         activateFollow, deactivateFollow, activateOrbit, deactivateOrbit } from './focusController.js';
import { createSelectionGlow } from './selectionGlow.js';
import { addAsteroid, removeAsteroid, updateAsteroidPositions } from './asteroidManager.js';
import { initAsteroidUI, refreshAsteroidList } from './asteroidUI.js';
import { updateShaderTime, syncSceneSunLighting } from './shaderMaterial.js';
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
  setReplayFrame,
} from './replayController.js';
import {
  createOrbitalClock, tickOrbitalClock, resetOrbitalClock, applyOrbitalClock,
} from './orbitalClock.js';
import {
  SUN_R,
  planetDrawRadiusFactory,
  fragmentDrawRadiusFactory,
  displayWorldPosition,
  displayHelioDistanceAU,
  sunRadiusAU,
} from './sceneScale.js';
import {
  doseColor, dosesAtFrame, doseLegendStops, DOSE_MAX_GY,
} from './doseColor.js';
import { initReplayUI } from './replayUI.js';
import { createInfoPanel } from './infoPanel.js';
import { createUVShells, setUVVisible, tickUVAnimation, updateHeatForNodes } from './uvRadiation.js';
import { createObjectSearch } from './objectSearch.js';
import { createLiveCharts } from './liveCharts.js';
import { menuBar, applyScale, currentScale } from './ui/menuBar.js';
import { createControlPanel } from './ui/controlPanel.js';
import { initPresentation } from './presentation.js';
import { runReplay } from './api.js';
import './ui/theme.css';
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
async function mainReplay(source) {
  // Accepts either a URL to fetch or an already-parsed replay, so a run coming
  // back from the local solver does not have to be written out and re-read.
  let simData;
  if (typeof source === 'string') {
    const resp = await fetch(source);
    if (!resp.ok) throw new Error(`Cannot load replay from "${source}": ${resp.status} ${resp.statusText}`);
    simData = await resp.json();
  } else {
    simData = source;
  }

  const scene    = createScene();
  const camera   = createCamera(window.innerWidth / window.innerHeight);
  const renderer = createRenderer();
  const controls = createControls(camera, renderer.domElement);
  const rollState = createRollState();

  /**
   * Draw the planets at sizes that reflect the planets.
   *
   * Every planet shipped with visual.radius = 0.9, so Mercury was rendered
   * exactly as large as Jupiter. That is not a cosmetic problem: this is a
   * scientific presentation, and the scene was asserting something false about
   * the bodies in it. The true radii were in the file all along, under
   * info.Radius, and simply were not read.
   *
   * Mapped by CUBE ROOT rather than linearly. The real span is 29:1, so a
   * linear map would put Mercury below a pixel at any zoom where Jupiter is
   * comfortable; the cube root - the ratio of their linear dimensions if you
   * think in volumes - keeps the ordering unmistakable while keeping the
   * smallest body visible.
   *
   * Heliocentric distances use the same exponent: d_vis = SUN_R × (d_AU/R☉_AU)^(1/3),
   * so (SUN_R/d_vis) = (R☉/d_real)^(1/3). Simulation data stay in real AU.
   */
  const planetRadius = planetDrawRadiusFactory(simData.objects ?? []);
  const fragmentRadius = fragmentDrawRadiusFactory(
    simData.frames ?? [], simData.objects ?? [],
  );
  const sunRAU = sunRadiusAU(simData.objects);

  addLighting(scene);
  const starfieldMesh = addStarfield(scene);
  // Rock type is a per-frame property rather than an object field, so it is
  // taken from the first frame that names each fragment. It decides the
  // fragment's surface, which is generated from that rock's catalogued
  // albedo, porosity and water content.
  const rockTypeOf = new Map();
  for (const frame of simData.frames ?? []) {
    for (const prop of frame?.properties ?? []) {
      if (prop?.id && prop.rock_type && !rockTypeOf.has(prop.id)) {
        rockTypeOf.set(prop.id, prop.rock_type);
      }
    }
  }

  const nodes = (simData.objects ?? []).map(obj => {
    const body = {
      id:        obj.id,
      name:      obj.name ?? obj.id,
      radius: ((obj.type ?? '').toLowerCase() === 'planet' && planetRadius
        ? planetRadius(obj) : null)
        ?? (fragmentRadius ? fragmentRadius(obj.id) : null)
        ?? (obj.id === 'sun' ? SUN_R : obj.visual?.radius) ?? 1,
      color:     obj.visual?.color   ?? '#ffffff',
      distance:  0,
      parentId:  null,
      emissive:  obj.visual?.emissive ?? false,
      type:      obj.type ?? 'planet',
      rockType:  rockTypeOf.get(obj.id) ?? null,
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

  /* The fifty Gaia stars start hidden.
   *
   * They sit between 268,551 and 1,024,535 AU - the nearest is nearly nine
   * thousand times Neptune's distance. Any framing that includes them makes
   * the entire Solar System a point, and any framing that shows the swarm
   * leaves them off screen, so in the default view they are fifty objects that
   * can never usefully share a frame with the thing the talk is about.
   *
   * Hidden, not deleted: they carry the stellar UV shells, and the destination
   * of an interstellar transfer is a legitimate thing to want to see. The
   * Scene menu turns them back on. */
  const gaiaMeshes = starNodes
    .filter(n => n.body.id.startsWith('gaia_'))
    .map(n => n.mesh);
  let gaiaVisible = false;
  for (const mesh of gaiaMeshes) mesh.visible = false;

  let uvEnabled          = false;
  let trailsEnabled       = false;
  let onlyFollowTrail     = false;
  let planetTrailsEnabled = false;

  /** Compute whether a given trail id should be visible right now. */
  function trailShouldBeVisible(id) {
    const entry = replayTrailMap.get(id);
    const type  = (entry?.type ?? '');
    if (type === 'planet') return planetTrailsEnabled;
    // asteroid / comet, filtered by "followed only" toggle
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
  // Literal for the same reason as orbitLine: THREE.Color cannot resolve a
  // custom property. Tracks --ink-dim by hand.
  const PLANET_TRAIL_COLOR = '#98897d';
  const trailLinearScale = simData.meta?.positionScale ?? 60;
  const replayTrailMap = new Map();
  for (const { body, mesh } of nodes) {
    const t = (body.type ?? '').toLowerCase();
    if (t === 'asteroid') {
      // Literal fallback: this reaches THREE.Color, which cannot resolve a CSS
      // custom property. Tracks --ink-dim by hand.
      const color = simData.objects?.find(o => o.id === body.id)?.visual?.color ?? '#98897d';
      const trail = createTrail(scene, color, TRAIL_LEN);
      trail.line.visible = false;
      replayTrailMap.set(body.id, { trail, mesh, type: 'asteroid', trailLen: TRAIL_LEN });
    } else if (t === 'planet') {
      const trail = createTrail(scene, PLANET_TRAIL_COLOR, PLANET_TRAIL_LEN);
      trail.line.visible = false;
      replayTrailMap.set(body.id, { trail, mesh, type: 'planet', trailLen: PLANET_TRAIL_LEN });
    }
  }

  function displayPos(posAU, sunPosAU) {
    const mult = ctrl.scaleMultiplier ?? 1;
    return displayWorldPosition(
      posAU, sunPosAU, sunRAU, trailLinearScale, mult,
    );
  }

  /**
   * Rebuild every asteroid trail from the last TRAIL_LEN frames of sim data.
   * Works both during playback and scrubbing because it reads ctrl.frames[]
   * directly instead of accumulating live positions.
   */
  function rebuildReplayTrails() {
    const frame = ctrl.frames?.[ctrl.currentFrame];
    const origin = frame?.positions?.find(p => p.id === 'sun');
    const originV = frame?.velocities?.find(v => v.id === 'sun');
    const velById = new Map((frame?.velocities ?? []).map(v => [v.id, v]));
    const posById = new Map((frame?.positions ?? []).map(p => [p.id, p]));

    for (const [id, { trail, trailLen, type }] of replayTrailMap) {
      const vis = trailShouldBeVisible(id);
      trail.line.visible = vis;
      if (!vis) { trail.history.length = 0; trail.line.geometry.setDrawRange(0, 0); continue; }

      // Draw the orbit the body is on, not the chords between the frames it
      // was sampled at.
      //
      // A frame is written every 20 years and the fragments have periods from
      // 1.8 to 74.6 years, so consecutive samples are separated by up to
      // eleven complete revolutions. Joining ten of them with straight lines
      // produced a figure that corresponded to no path anything ever took -
      // and it was the most conspicuous thing on the screen. Position and
      // velocity determine the orbit exactly, so the whole ellipse is solved
      // for and drawn instead. It is right at every point rather than at ten
      // points, and it does not care how coarsely time was sampled.
      const pos = posById.get(id);
      const vel = velById.get(id);
      if (origin && pos && vel) {
        const orbit = osculatingOrbit(
          pos, { x: vel.vx, y: vel.vy, z: vel.vz }, origin,
          {
            segments: type === 'planet' ? 160 : 220,
            originVelocity: originV
              ? { x: originV.vx, y: originV.vy, z: originV.vz } : null,
          },
        );
        if (orbit) {
          setTrailHistory(trail, orbit.points.map(q => displayPos(
            { x: q.x, y: q.y, z: q.z }, origin,
          )), { closed: true });
          continue;
        }
      }

      // Unbound, or a body with no velocity in this replay: there is no closed
      // curve to draw, so fall back to the sampled path. It is still a chord
      // figure, but an escaping fragment is not looping, so consecutive
      // samples are genuinely near the path it took.
      const positions = buildTrailPositions(ctrl.frames, ctrl.currentFrame, trailLen, id);
      setTrailHistory(trail, positions.map(p => displayPos(p, origin)));
    }
  }

  /**
   * Frame the camera on the swarm rather than on a fixed guess.
   *
   * The camera opened at a hard-coded distance chosen for the old demo. With
   * the orbits drawn properly it became obvious that this was wrong: the inner
   * planets filled the view while most of the fragment ellipses swept off the
   * edges of the screen, so the one thing the scene exists to show - where the
   * ejecta actually goes - was the part you could not see.
   *
   * The distance is set from the swarm's own median aphelion, not its maximum.
   * A single fragment reaching 31 AU would otherwise shrink everything else to
   * a point; the median keeps the bulk of the swarm in frame and lets the
   * outlier run past the edge, which is the honest way round - the outlier is
   * visibly an outlier.
   */
  function frameCameraOnSwarm(zoom = 1) {
    const frame = simData.frames?.[0];
    const origin = frame?.positions?.find(p => p.id === 'sun');
    const originV = frame?.velocities?.find(v => v.id === 'sun');
    if (!origin) return;
    const posById = new Map((frame.positions ?? []).map(p => [p.id, p]));
    const aphelia = [];
    for (const v of frame.velocities ?? []) {
      if (!v.id?.startsWith('asteroid_')) continue;
      const pos = posById.get(v.id);
      if (!pos) continue;
      const orbit = osculatingOrbit(
        pos, { x: v.vx, y: v.vy, z: v.vz }, origin,
        {
          segments: 8,
          originVelocity: originV ? { x: originV.vx, y: originV.vy, z: originV.vz } : null,
        },
      );
      if (orbit) aphelia.push(orbit.elements.a * (1 + orbit.elements.e));
    }
    if (!aphelia.length) return;
    aphelia.sort((a, b) => a - b);
    const median = aphelia[Math.floor(aphelia.length / 2)];
    const mult = ctrl.scaleMultiplier ?? 1;
    const radius = displayHelioDistanceAU(median, sunRAU) * mult;
    // 60 degree vertical field of view, so half-height = distance * tan(30).
    // The 1.9 leaves the swarm comfortably inside the frame rather than
    // touching its edges.
    const want = (radius * 1.9 * zoom) / Math.tan((Math.PI / 180) * 30);
    // Never closer than the Sun's own radius plus a margin, whatever is asked.
    const distance = Math.max(SUN_R * 2.2, want);
    camera.position.set(0, distance * 0.42, distance * 0.92);
    camera.lookAt(0, 0, 0);
    controls?.target?.set?.(0, 0, 0);
    controls?.update?.();
  }

  const ctrl = createReplayController(simData);

  /* The second clock. The transport counts the 3000 years the dose is
     integrated over; this one runs the geometry at a rate an orbit is actually
     visible at. Sound because the two quantities have different time
     structure - orbits are periodic in years, dose is a straight line to
     0.19% - so neither is misrepresented by being shown at its own rate. */
  const orbitalClock = createOrbitalClock();

  /* Paint each fragment by the dose it has absorbed.
   *
   * Dose rather than survival: every fragment ends the run between 77.5% and
   * 97.1% surviving, so a survival ramp would stretch a 20-point difference
   * across the whole colour range and imply drama the numbers do not contain.
   * Dose is what the model integrates, runs 0 to 726 Gy, and rises
   * monotonically, so the scene changes visibly as the run advances.
   *
   * The scale is fixed at 0-1000 Gy in doseColor.js, never derived from what
   * happens to be on screen, so a colour means the same thing in any two
   * screenshots. */
  let doseShown = true;
  function paintDose(frame) {
    const doses = dosesAtFrame(frame);
    for (const [id, mesh] of meshById) {
      const u = mesh?.material?.uniforms;
      if (!u?.uDoseIntensity) continue;
      const gy = doses.get(id);
      if (!doseShown || !Number.isFinite(gy)) { u.uDoseIntensity.value = 0; continue; }
      const c = doseColor(gy);
      u.uDoseColor.value.setRGB(c.r, c.g, c.b);
      u.uDoseIntensity.value = 1;
    }
  }
  applyReplayFrame(ctrl, meshById);   // apply frame 0 immediately
  syncSceneSunLighting(meshById);
  paintDose(ctrl.frames[0]);          // and colour it, so nothing loads blank

  /* Fill the colour bar from the same function that colours the fragments.
   *
   * Writing the stops into the stylesheet would let the legend drift away from
   * the colours it claims to describe - the failure mode where a figure's key
   * is quietly wrong. Generated here, the two cannot disagree. */
  (() => {
    const bar = document.querySelector('#dose-legend .dl-bar');
    if (!bar) return;
    const stops = doseLegendStops(9).map(({ gy, color }) => {
      const c = [color.r, color.g, color.b].map(v => Math.round(v * 255)).join(',');
      return `rgb(${c}) ${((gy / DOSE_MAX_GY) * 100).toFixed(0)}%`;
    });
    bar.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
    const last = document.querySelector('#dose-legend .dl-scale span:last-child');
    if (last) last.textContent = `${DOSE_MAX_GY} Gy`;
  })();
  frameCameraOnSwarm();


  // Lookup: id → full simData object (for info panel)
  const objById  = new Map((simData.objects ?? []).map(o => [o.id, o]));
  const posUnit  = simData.meta?.positionUnit ?? '';
  const infoPanel = createInfoPanel();

  // Charts that draw themselves alongside the animation, from this replay.
  // Clicking a trace focuses that fragment in the 3D scene; `selectNodeById` is
  // assigned once the scene's selection machinery exists, further down.
  let selectNodeById = () => {};
  const liveCharts = createLiveCharts(simData, {
    onSelectFragment: (id) => selectNodeById(id),
  }).mount();

  // The run console: pick parameters, launch the solver, come back with a run.
  createControlPanel({
    onFinished: (runId) => {
      const url = new URL(location.href);
      url.searchParams.set('run', runId);
      url.searchParams.delete('replay');
      location.assign(url.toString());
    },
  }).mount();

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
    if (simObj?.id) liveCharts.select(simObj.id);
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

  // Same selection path the object list uses, exposed by id so the charts can
  // drive it too.
  selectNodeById = (id) => {
    const node = nodes.find(n => n.body?.id === id);
    if (!node) return;
    objectSearch.selectById?.(id);
    setFocusTarget(focusCtrl, node.mesh);
    activateOrbit(focusCtrl);
    selectionGlow.attach(node.mesh);
    setFocusLabel(node.body?.name ?? id);
    applyFollowTrailColor(node.body.id);
    const simObj = objById.get(id);
    if (simObj) {
      const { positions, velocities, properties } = curFrame();
      infoPanel.show(simObj, positions, velocities, properties, posUnit);
    }
  };

  registerClickHandler(
    renderer.domElement,
    camera,
    () => nodes.map(n => n.mesh),
    (mesh) => {
      const body = bodyByMesh.get(mesh);
      // Linking was one-way: clicking a chart line focused the 3D object, but
      // clicking the object left the charts untouched. Connected views are only
      // useful if the connection runs both ways.
      if (body?.id) liveCharts.select(body.id);
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

  const { refreshUI, setToggle: setReplayToggle } = initReplayUI(ctrl, (c) => {
    applyReplayFrame(c, meshById);
    /* Every transport move lands here - the scrubber, the step buttons, Home
     * and End, the arrow keys. The orbital clock has to be told, because its
     * cached elements belong to the frame it was last reset at: without this
     * a scrub left every body propagated along the PREVIOUS frame's orbits
     * while the scrubber, the info panel, the charts and the dose colour all
     * showed the new one. */
    resetOrbitalClock(orbitalClock, c.currentFrame);
    rebuildReplayTrails();   // scrubbing: rebuild trail from data, not live positions
    const { positions, velocities, properties } = curFrame();
    infoPanel.updateFrame(positions, velocities, properties, posUnit);
    // Dose changes with the frame, so the colours have to follow a scrub too.
    paintDose(curFrame());
    liveCharts.update(ctrl.currentFrame);
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

  /* Presentation mode: P toggles it, 1-5 jump to a chapter.
   *
   * The research layout is untouched and one keystroke away. Chapters exist
   * so a talk moves in known steps rather than by dragging a camera live in
   * front of a room. */
  initPresentation({
    controller: ctrl,
    setFrame: (index) => {
      setReplayFrame(ctrl, index);
      applyReplayFrame(ctrl, meshById);
      resetOrbitalClock(orbitalClock, ctrl.currentFrame);
      paintDose(curFrame());
      refreshUI(ctrl);
      rebuildReplayTrails();
      liveCharts.update(ctrl.currentFrame);
    },
    frameCamera: (zoom) => frameCameraOnSwarm(zoom),
    setConsoleVisible: (on) => {
      const panel = document.getElementById('run-console');
      const collapsed = panel?.classList.contains('collapsed');
      if (panel && collapsed === on) document.getElementById('btn-run-console')?.click();
    },
    setDockVisible: (on) => {
      if (liveCharts.isVisible?.() !== on) liveCharts.setVisible?.(on);
    },
  });

  // ── Workspace menu ──────────────────────────────────────────────────────
  //
  // The scene layers used to live as unlabelled checkboxes in the bottom rail,
  // beside the transport controls they have nothing to do with, and the only
  // way to learn what any of them did was to click it. They are listed here by
  // name with a line saying what they show. The checkboxes below remain and
  // stay in step, so nothing that worked before stops working.
  const sceneLayer = (label, note, get, set) => ({ label, note, get, set });

  // Restore the presenter's chosen scale before anything measures itself, so
  // the headline band publishes a height that already accounts for it.
  applyScale(currentScale());

  menuBar(document.body, {
    charts: liveCharts,
    scene: {
      layers: [
        sceneLayer(
          'Fragment trails',
          'the recent path of each fragment, see the caveat below',
          () => trailsEnabled,
          (on) => { setReplayToggle('trails', on); },
        ),
        sceneLayer(
          'Selected fragment only',
          'draw a trail for the followed fragment and nothing else',
          () => onlyFollowTrail,
          (on) => { setReplayToggle('onlyFollowed', on); },
        ),
        sceneLayer(
          'Planet trails',
          'the same for the planets, as a reference for scale',
          () => planetTrailsEnabled,
          (on) => { setReplayToggle('planetTrails', on); },
        ),
        sceneLayer(
          'Stellar UV shells',
          'a glow around each star. Decorative: photons stop within 3 cm of '
          + 'rock, so this is not the channel that matters',
          () => uvEnabled,
          (on) => { setReplayToggle('uv', on); },
        ),
        sceneLayer(
          'Gaia stars',
          'the fifty catalogued stars. The nearest is 268,551 AU away - nine '
          + 'thousand times Neptune - so showing them makes everything else a point',
          () => gaiaVisible,
          (on) => {
            gaiaVisible = on;
            for (const mesh of gaiaMeshes) mesh.visible = on;
          },
        ),
        sceneLayer(
          'Starfield',
          'background stars',
          () => starfieldMesh.visible,
          (on) => { setReplayToggle('starfield', on); },
        ),
      ],
    },
    panels: [
      {
        label: 'Run console',
        note: 'every model parameter, editable, and the button that launches a run',
        get: () => !document.getElementById('run-console')?.classList.contains('collapsed'),
        set: () => document.getElementById('btn-run-console')?.click(),
      },
      {
        label: 'Object inspector',
        note: 'the record of whichever body is selected, frame by frame',
        get: () => Boolean(document.getElementById('info-panel')?.classList.contains('visible')),
        set: (on) => { if (!on) infoPanel.hide(); },
      },
      {
        label: 'Object search',
        note: 'find and jump to any of the 73 bodies in the replay',
        get: () => !document.getElementById('obj-search-panel')?.hidden,
        set: () => document.getElementById('obj-search-toggle')?.click(),
      },
    ],
    /* The runs a reader can switch between.
     *
     * Two questions rather than two lengths: 3000 years asks what a transfer
     * costs while everything is still intact, and 100,000 years asks what is
     * left, where erosion has destroyed half the swarm and the survival
     * boundary becomes visible. */
    runs: [
      {
        file: '',
        label: 'Solar System transit, 3000 yr',
        note: 'the bundled run every figure is calibrated against; nothing is lost',
      },
      {
        file: 'data/run_100kyr.json',
        label: 'Extended transit, 100 kyr',
        note: 'dust erosion destroys seven of fourteen fragments; the phase '
            + 'diagram gains a boundary',
      },
      {
        file: 'data/run_1myr.json',
        label: 'Full transit, 1 Myr',
        note: 'thirteen of fourteen are ground away, and the survivor is '
            + 'biologically finished at 1e-10',
      },
    ],
    links: [
      {
        label: 'Sensitivity screening',
        href: './sensitivity.html',
        note: 'Morris elementary effects: which parameters actually move the result',
      },
      {
        label: 'Survival heatmap',
        href: './grid.html',
        note: 'ejection speed against fragment radius',
      },
      {
        label: 'Research background',
        href: './research.html',
        note: 'the full write-up, assumptions and limitations',
      },
    ],
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

      // The orbital clock owns the geometry while it is running: it places
      // every body on its own ellipse at its own rate, so an orbit is legible
      // instead of being eight revolutions wide. The transport still owns the
      // frame index, the dose, the charts and every number on screen.
      tickOrbitalClock(orbitalClock, scaledDeltaSec, ctrl.playing);
      if (frameChanged) {
        resetOrbitalClock(orbitalClock, ctrl.currentFrame);
        // Dose only changes when the transport moves, so it is repainted
        // there rather than every animation tick.
        paintDose(curFrame());
      }

      const linearScale = ctrl.meta?.positionScale ?? 60;
      const mult = ctrl.scaleMultiplier ?? 1;
      /* The clock only owns the geometry while the replay is actually running.
       *
       * It was applied every animation tick regardless, so a paused scene kept
       * whatever `years` the clock had reached and drew every body propagated
       * forward from the sampled frame - up to a full orbit away from it.
       * Pausing to point at a fragment then pointed at a position that the
       * info panel, the charts and the dose colour all disagreed with.
       *
       * Paused, the sampled positions are the honest thing to show: they are
       * the ones the integration actually produced. */
      orbitalClock.enabled = ctrl.smooth !== false && ctrl.playing === true;
      const orbitalDrove = orbitalClock.enabled
        && applyOrbitalClock(
          orbitalClock, curFrame(), meshById, linearScale, simData.objects, mult,
        );
      // Coming out of playback, put the bodies back where the frame says they
      // are rather than leaving the last propagated pose on screen.
      if (!orbitalClock.enabled && orbitalClock.years !== 0) {
        resetOrbitalClock(orbitalClock, ctrl.currentFrame);
        applyReplayFrame(ctrl, meshById);
      }

      if (ctrl.smooth && !orbitalDrove) {
        applyReplayFrameLerp(ctrl, meshById);
      }
      syncSceneSunLighting(meshById);
      if (ctrl.smooth) {
        if (frameChanged) {
          refreshUI(ctrl);
          const { positions, velocities, properties } = curFrame();
          infoPanel.updateFrame(positions, velocities, properties, posUnit);
          liveCharts.update(ctrl.currentFrame);
          rebuildReplayTrails();
        }
      } else if (frameChanged) {
        if (!orbitalDrove) applyReplayFrame(ctrl, meshById);
        refreshUI(ctrl);
        const { positions, velocities, properties } = curFrame();
        infoPanel.updateFrame(positions, velocities, properties, posUnit);
        liveCharts.update(ctrl.currentFrame);
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
  // ?root=N → 1/N compression for sizes and distances (?ratioExp=0.25 too)
  const params     = new URLSearchParams(location.search);
  const { applyRatioExpFromSearch, formatRatioExponent } = await import('./sceneScale.js');
  applyRatioExpFromSearch(params);
  if (import.meta.env?.DEV) {
    console.info(`[scene] ratio exponent ${formatRatioExponent()} (?root=N to compare)`);
  }
  const customFile = params.get('replay');
  const runId      = params.get('run');
  const liveMode   = params.has('live');

  if (!liveMode) {
    // ?run=<id> loads a simulation the local solver just produced. Handing the
    // id over and reloading is cleaner than tearing down a live three.js world
    // and rebuilding it in place.
    if (runId) {
      try {
        const simData = await runReplay(runId);
        await mainReplay(simData);
        return;
      } catch (error) {
        console.warn(`Could not load run ${runId}: ${error.message}. `
                   + 'Falling back to the bundled replay.');
      }
    }
    /* The 100,000 year run is the default, not the 3000 year one.
     *
     * Both are real output from the same model and the same seed; they differ
     * only in how long they were integrated. But almost nothing happens in
     * three thousand years. No fragment is lost, so the phase diagram has no
     * boundary to draw and does not render at all; surviving fraction moves
     * from 1.000 to 0.775, a span of 1.29x, which is a horizontal line; and
     * "same dose, different fate" is suppressed because survival has not yet
     * separated enough for the comparison to mean anything.
     *
     * Over 100,000 years seven of the fourteen fragments are destroyed, the
     * lifetime law has fourteen fates to predict, and the two strongest
     * figures in the project appear. Ten figures render with structure
     * instead of eight with one flat.
     *
     * The shorter run is still one menu click away under Analysis, and every
     * test still reads it directly by path. */
    const replayUrl = customFile
      ? (/^https?:\/\//i.test(customFile) ? customFile : withBase(customFile))
      : withBase('data/run_100kyr.json');
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
  // ── Workspace menu ──────────────────────────────────────────────────────
  //
  // The scene layers used to live as unlabelled checkboxes in the bottom rail,
  // beside the transport controls they have nothing to do with, and the only
  // way to learn what any of them did was to click it. They are listed here by
  // name with a line saying what they show. The checkboxes below remain and
  // stay in step, so nothing that worked before stops working.
  const sceneLayer = (label, note, get, set) => ({ label, note, get, set });

  // Restore the presenter's chosen scale before anything measures itself, so
  // the headline band publishes a height that already accounts for it.
  applyScale(currentScale());

  menuBar(document.body, {
    charts: liveCharts,
    scene: {
      layers: [
        sceneLayer(
          'Fragment trails',
          'the recent path of each fragment, see the caveat below',
          () => trailsEnabled,
          (on) => { setReplayToggle('trails', on); },
        ),
        sceneLayer(
          'Selected fragment only',
          'draw a trail for the followed fragment and nothing else',
          () => onlyFollowTrail,
          (on) => { setReplayToggle('onlyFollowed', on); },
        ),
        sceneLayer(
          'Planet trails',
          'the same for the planets, as a reference for scale',
          () => planetTrailsEnabled,
          (on) => { setReplayToggle('planetTrails', on); },
        ),
        sceneLayer(
          'Stellar UV shells',
          'a glow around each star. Decorative: photons stop within 3 cm of '
          + 'rock, so this is not the channel that matters',
          () => uvEnabled,
          (on) => { setReplayToggle('uv', on); },
        ),
        sceneLayer(
          'Gaia stars',
          'the fifty catalogued stars. The nearest is 268,551 AU away - nine '
          + 'thousand times Neptune - so showing them makes everything else a point',
          () => gaiaVisible,
          (on) => {
            gaiaVisible = on;
            for (const mesh of gaiaMeshes) mesh.visible = on;
          },
        ),
        sceneLayer(
          'Starfield',
          'background stars',
          () => starfieldMesh.visible,
          (on) => { setReplayToggle('starfield', on); },
        ),
      ],
    },
    panels: [
      {
        label: 'Run console',
        note: 'every model parameter, editable, and the button that launches a run',
        get: () => !document.getElementById('run-console')?.classList.contains('collapsed'),
        set: () => document.getElementById('btn-run-console')?.click(),
      },
      {
        label: 'Object inspector',
        note: 'the record of whichever body is selected, frame by frame',
        get: () => Boolean(document.getElementById('info-panel')?.classList.contains('visible')),
        set: (on) => { if (!on) infoPanel.hide(); },
      },
      {
        label: 'Object search',
        note: 'find and jump to any of the 73 bodies in the replay',
        get: () => !document.getElementById('obj-search-panel')?.hidden,
        set: () => document.getElementById('obj-search-toggle')?.click(),
      },
    ],
    links: [
      {
        label: 'Sensitivity screening',
        href: './sensitivity.html',
        note: 'Morris elementary effects: which parameters actually move the result',
      },
      {
        label: 'Survival heatmap',
        href: './grid.html',
        note: 'ejection speed against fragment radius',
      },
      {
        label: 'Research background',
        href: './research.html',
        note: 'the full write-up, assumptions and limitations',
      },
    ],
  });

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
      syncSceneSunLighting(new Map(nodes.map(n => [n.body.id, n.mesh])));

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
  // Show a visible error overlay so problems are visible even without DevTools.
  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed', inset: '0', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', background: '#0a0a14',
    color: '#f55', fontFamily: 'monospace', fontSize: '14px', padding: '24px',
    zIndex: '9999', textAlign: 'center',
  });
  box.innerHTML = `<div style="font-size: 1.25rem;margin-bottom:12px">⚠ Failed to load simulation</div>
<div style="color:var(--ink-dim);margin-bottom:16px;max-width:600px;word-break:break-all">${String(err)}</div>
<div style="color:#666;font-size: 0.6875rem">BASE_URL: ${import.meta.env.BASE_URL}</div>`;
  document.body.appendChild(box);
});
