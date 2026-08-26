# web

The 3D visualizer: a Three.js scene that replays the ejecta swarm produced by the Python
model, plus two content pages that present the research.

Deployed to GitHub Pages from `main` by `.github/workflows/deploy-pages.yml`.

## Pages

| File | Title |
|---|---|
| `index.html` | Cosmos 3D — the interactive visualizer |
| `research.html` | Research — Could life travel between solar systems? |
| `further_details.html` | Further Details |

All three are declared as Vite build inputs in `vite.config.js`.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000, opens automatically
npm test           # 263 Vitest tests across 16 files
npm run build      # production build into dist/
npm run preview    # serve the built dist/
```

The dev server sets `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`
because the R console embedded in `research.html` runs WebR, which needs
`SharedArrayBuffer`.

## Data contract

Everything the site loads at runtime comes from `public/data/`:

| File | Role | Produced by |
|---|---|---|
| `solar_system.json` | Static scene: bodies, radii, orbital distances, colours | hand-authored, lives only here |
| `cosmos_visualizer_simulation.json` | **Replay of the ejecta swarm** — per-frame positions and per-object properties | the Python model |
| `gamma_radiation_timeseries.json` | Internal gamma field over time | the Python model |
| `rock_radiation_summary.json` | Per-rock dose and temperature summary | the Python model |
| `star_uv_profile.json` | Stellar UV flux versus distance | the Python model |
| `solar_simulation.json`, `simulation_template.json`, `test_replay.json` | Fixtures and templates | hand-authored |

To refresh the model-produced files after a simulation run, from the repository root:

```bash
python tools/export_simulation_to_web.py          # copy what the model has produced
python tools/export_simulation_to_web.py --run    # run the Mars pipeline first, then copy
python tools/export_simulation_to_web.py --check  # report only, write nothing
```

That script never touches the hand-authored files.

A different replay can be loaded without rebuilding, via the query string:

```
index.html?replay=data/test_replay.json
```

## Source layout

| Area | Modules |
|---|---|
| Scene and rendering | `scene.js`, `renderer.js`, `camera.js`, `cameraRoll.js`, `shaderMaterial.js`, `selectionGlow.js` |
| Object construction | `objectFactory.js`, `orbitLine.js`, `trailManager.js` |
| Simulation playback | `replayController.js`, `replayUI.js`, `animator.js`, `physics.js`, `physicsSync.js` |
| Asteroid swarm | `asteroidManager.js`, `asteroidUI.js` |
| Interaction | `picker.js`, `focusController.js`, `objectSearch.js`, `objectSearchLogic.js`, `infoPanel.js` |
| Science overlays | `uvRadiation.js`, `survivalChart.js` |
| Data | `dataLoader.js` |
| Entry point | `main.js` |

Paths are resolved through `import.meta.env.BASE_URL`, so the same build works at the
site root during development and under `/Hack4Sages_project/` on GitHub Pages.

## Tests

`tests/` holds one Vitest file per module for the logic that can be tested without a
browser — geometry construction, replay interpolation, search, camera roll, data loading,
UV shells, the info panel. `vitest.config.js` runs them in the `node` environment.

## The survival chart

The panel in the bottom-left corner is not decoration - it plots the simulation that is
on screen. `survivalChart.js` reads `population_fraction` (N/N0, the surviving microbial
fraction) out of each replay frame and grows the curve as the animation plays:

- one faint line per fragment, so you can see the swarm spread out,
- the swarm mean in orange, with a marker at the current frame,
- a y axis scaled to the data rather than a fixed 0-1, because survival typically stays
  within a fraction of a percent of 1.0 over a short run and a fixed axis would render
  that as a flat line,
- a readout of the current time, swarm mean, worst fragment and fragment count.

`population_fraction` is written by
`model/microbe_radiation_model/simulation/scenarios.py`, which evaluates the survival
function each step. A replay without that field shows an empty chart and says so.

The data preparation is a pure function, `buildSurvivalSeries()`, covered by
`tests/survivalChart.test.js`.

## Backlog

- Bottom-corner status bar showing the current radiation level for the focused object.
