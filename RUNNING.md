# Running the project

Three parts, three toolchains. Nothing here depends on the others being installed —
you can run the visualizer without Python, and the model without Node.

| Part | Needs | Directory |
|---|---|---|
| Simulation | Python 3.12+ | `model/` |
| Visualizer | Node 20+ | `web/` |
| Analysis | R (tidyverse) | `analysis/` |

---

## 1. The simulation (`model/`)

### Install

```bash
cd model
python3 -m venv .venv
source .venv/bin/activate          # Linux / macOS / WSL
.\.venv\Scripts\Activate.ps1       # Windows PowerShell
python -m pip install -r requirements.txt
```

If `venv` is missing on Debian/Ubuntu: `sudo apt install python3-venv`.

> `rebound` ships prebuilt wheels for Windows, macOS and Linux, so
> `pip install rebound astropy` is enough to run the orbital pipeline anywhere.
>
> `reboundx` (radiation pressure) and `spiceypy` (full ephemeris) build from C sources.
> `reboundx` does not compile under MSVC — its C uses variable-length arrays, which
> Microsoft's compiler rejects — so on Windows use WSL if you need it. Without them the
> run still completes and those two features are skipped.
>
> Without `rebound` at all the package falls back to a **static radiation mode** with no
> orbital dynamics. See "Degraded mode" below.

### Run

| Command | What it does |
|---|---|
| `python run.py` | Runtime report for the static and the connected pipeline |
| `python -m microbe_radiation_model.demos.demo` | Quick physics check (`mass → luminosity → flux`) plus a full scenario report |
| `python -m microbe_radiation_model.demos.run_radiation_demo` | Static radiation pipeline only, no REBOUND |
| `python -m microbe_radiation_model.demos.run_simulation` | Connected pipeline (REBOUND + radiation) |
| `python -m microbe_radiation_model.demos.run_mars_impact_demo` | Mars impact ejecta generation |
| `python -m microbe_radiation_model.demos.run_mars_pipeline` | **Full pipeline**: impact + dynamics + erosion + radiation + JSON export |
| `python -m microbe_radiation_model.demos.run_dust_erosion_demo` | Dust erosion model in isolation |
| `python -m microbe_radiation_model.demos.run_radiation_pressure_demo` | REBOUNDx radiation pressure forces |
| `python -m microbe_radiation_model.demos.fetch_gaia_catalog` | Refresh `nearest_50_gaia.csv` from the Gaia archive |
| `python -m microbe_radiation_model.simulation` | Package-level entry point for the default scenario |

### Output

JSON lands in `model/microbe_radiation_model/data/`:

- `cosmos_visualizer_simulation.json` — replay file for the 3D viewer
- `gamma_radiation_timeseries.json` — internal gamma field over time
- `rock_radiation_summary.json` — per-rock dose / temperature summary
- `star_uv_profile.json` — stellar UV flux versus distance
- `solar_system_horizons_cache.json` — cached JPL Horizons state vectors (committed, so runs work offline)

The first three are gitignored; the committed copies the site serves live in
`web/public/data/`. Move a fresh run across with the bridge script in step 3.

### Degraded mode

If `rebound` is not importable, `run.py` and `run_simulation` print:

```
REBOUND is not available; showing the full radiation pipeline without orbital dynamics.
```

and the "static" and "connected" reports become identical. That is expected, not a
failure — but it also means the orbital transport layer is not being exercised.

### SPICE kernels

Full-ephemeris mode downloads `de440.bsp`, `naif0012.tls`, `gm_de431.tpc` and
`pck00010.tpc` from `naif.jpl.nasa.gov` into a local `kernels/` directory on first use.
They are gitignored. Set `download_kernels=False` in `SolarSystemBuildConfig` to require
them to be present locally instead.

---

## 2. The visualizer (`web/`)

```bash
cd web
npm install
npm run dev        # http://localhost:3000
npm test           # 264 Vitest tests
npm run build      # production build into dist/
npm run preview    # serve the built output
```

Pushes to `main` trigger `.github/workflows/deploy-pages.yml`, which runs the tests,
builds with Vite from `web/` and deploys `web/dist/` to GitHub Pages.

To load a different replay without rebuilding:

```
index.html?replay=data/test_replay.json
```

---

## 2b. Running simulations from the browser

Start the local solver, then use the **Run console** in the visualizer to choose
parameters and launch a run without touching Python:

```bash
cd model && source .venv/bin/activate
python -m microbe_radiation_model.server        # http://127.0.0.1:8000
```

Then open the visualizer (`cd web && npm run dev`). The console reads its parameter
list from the server, so the controls can never offer something the model rejects.
A finished run reloads the page with `?run=<id>` and the scene plays it.

The server is standard-library only — no new dependencies — and job-based, because a
run takes seconds to minutes and a blocking request would simply time out.

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | is the solver up, and is REBOUND importable |
| `GET /api/parameters` | parameter schema and defaults for the UI |
| `POST /api/runs` | start a run |
| `GET /api/runs/<id>` | status and progress |
| `GET /api/runs/<id>/replay` | the finished replay |

`--host` and `--port` change the bind address; the page reaches a non-default one via
`?api=http://host:port`. Without the server the visualizer simply plays the bundled
replay and the console explains how to start it.

---

## 2c. Running a long simulation

Three numbers control a run, and they do different jobs:

| Setting | Controls | Formula |
|---|---|---|
| Output step (`dt`) | replay file size | frames = years / dt |
| Substeps per frame | accuracy | internal step = dt / substeps |
| Simulated time (`years`) | how far the fragments get | — |

**Accuracy depends on `dt / substeps`, not on `dt` alone.** Raising the output step
to shrink the file costs nothing as long as you raise substeps by the same factor.
Measured on a 10-year, 8-fragment run with the internal step held at 0.0025 yr:

| Run | Frames | Wall time | Replay | Max position difference |
|---|---|---|---|---|
| `dt=0.025 substeps=10` | 400 | 11.1 s | 9.79 MB | — |
| `dt=0.25 substeps=100` | 40 | 7.0 s | 1.00 MB | **0.000 AU** |

Identical trajectories at every shared instant, in a tenth of the space.

### The recipe

1. Keep the internal step at 0.0025 yr (about a day) unless you have a reason not to.
2. Decide how many frames you want to watch — 300 to 600 is comfortable.
3. Then `dt = years / frames`, and `substeps = dt / 0.0025`.

Worked examples:

| Goal | years | dt | substeps | Frames | Wall time | Replay |
|---|---|---|---|---|---|---|
| Quick look | 2.5 | 0.025 | 10 | 100 | ~3 s | 2.6 MB |
| Medium | 10 | 0.025 | 10 | 400 | ~11 s | 9.8 MB |
| **Long, 100 yr** | 100 | 0.25 | 100 | 400 | **~60 s** | 13 MB |
| Very long, 1000 yr | 1000 | 2.0 | 800 | 500 | ~30 min | ~18 MB |

Cost scales with the total number of integrator steps, `years × substeps / dt`, so a
thousand-year run at full fidelity really is a hundred times the work of a ten-year one.
There is no shortcut around that — but there is a shortcut around the file size, and
that is the substeps trick above.

### What to watch out for

- **Fragments cost time too.** Roughly 0.0017 s per fragment per frame on top of a
  0.013 s fixed cost. Forty fragments is about 2.7x the wall time of ten.
- **Keep the replay under about 30 MB.** Past that the browser struggles. The size is
  roughly `frames × (19 + 0.7 × fragments)` kilobytes.
- **Turn off radiation pressure on Windows.** `reboundx` cannot be built there, and the
  run is faster without it.

---

## 3. Connecting the two

The model writes JSON; the site serves JSON; this script moves it across.

```bash
# from the repository root
python tools/export_simulation_to_web.py            # copy whatever the model has produced
python tools/export_simulation_to_web.py --run      # run the Mars pipeline first, then copy
python tools/export_simulation_to_web.py --check    # report only, write nothing
```

It copies only model-produced files and leaves the hand-authored scene data
(`solar_system.json` and friends) alone. It exits non-zero if the file the visualizer
requires — `cosmos_visualizer_simulation.json` — has not been generated.

---

## 4. The analysis (`analysis/`)

```bash
Rscript analysis/radiation_to_survival.R
```

Needs the `tidyverse` package. Produces the regression of cell kill frequency against
radiation dose rate that yields `radiation_surv_coeff`; the fitted values are tabulated
in [analysis/README.md](analysis/README.md).

`analysis/survival_function.py` is the reference implementation of the survival function.
The version the simulation actually runs is
`model/microbe_radiation_model/biology/survival.py`.

---

## Typical full loop

```bash
cd model && source .venv/bin/activate
python -m microbe_radiation_model.demos.run_mars_pipeline
cd .. && python tools/export_simulation_to_web.py
cd web && npm run dev
```
