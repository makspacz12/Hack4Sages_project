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

> `rebound`, `reboundx` and `spiceypy` build from C sources and install reliably only on
> Linux, macOS and WSL. Without them the package still runs — it falls back to a **static
> radiation mode** with no orbital dynamics. See "Degraded mode" below.

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
