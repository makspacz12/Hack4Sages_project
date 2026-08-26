# Running the simulation

The Python model lives in `Hack4Sages_merged/`. Everything below assumes a
POSIX shell (Linux, macOS, or WSL on Windows); PowerShell equivalents are noted.

## 1. Create a virtual environment (once)

```bash
cd Hack4Sages_merged
python3 -m venv .venv
```

If `venv` is missing on Debian/Ubuntu:

```bash
sudo apt update
sudo apt install python3-venv
python3 -m venv .venv
```

## 2. Activate it

```bash
source .venv/bin/activate          # Linux / macOS / WSL
.\.venv\Scripts\Activate.ps1       # Windows PowerShell
```

## 3. Install dependencies (once)

```bash
python -m pip install -r requirements.txt
```

> `rebound`, `reboundx` and `spiceypy` build from C sources and are only reliably
> installable on Linux/macOS/WSL. Without them the package still runs — it falls back
> to a **static radiation mode** with no orbital dynamics. See "Degraded mode" below.

## 4. Run

| Command | What it does |
|---|---|
| `python run.py` | Runtime report for the static and the connected pipeline |
| `python -m microbe_radiation_model.demos.demo` | Quick physics check (`mass → luminosity → flux`) plus a full scenario report |
| `python -m microbe_radiation_model.demos.run_radiation_demo` | Static radiation pipeline only, no REBOUND |
| `python -m microbe_radiation_model.demos.run_simulation` | Connected pipeline (REBOUND + radiation) |
| `python -m microbe_radiation_model.demos.run_mars_impact_demo` | Mars impact ejecta generation |
| `python -m microbe_radiation_model.demos.run_mars_pipeline` | **Full Mars pipeline**: impact + dynamics + erosion + radiation + JSON export |
| `python -m microbe_radiation_model.demos.run_dust_erosion_demo` | Dust erosion model in isolation |
| `python -m microbe_radiation_model.demos.run_radiation_pressure_demo` | REBOUNDx radiation pressure forces |
| `python -m microbe_radiation_model.demos.fetch_gaia_catalog` | Refresh `nearest_50_gaia.csv` from the Gaia archive |
| `python -m microbe_radiation_model.simulation` | Package-level entry point for the default scenario |

## 5. Output

JSON files for analysis and for the 3D visualizer are written to:

```
Hack4Sages_merged/microbe_radiation_model/data/
```

- `gamma_radiation_timeseries.json` — internal gamma field over time
- `rock_radiation_summary.json` — per-rock dose / temperature summary
- `star_uv_profile.json` — stellar UV flux versus distance
- `cosmos_visualizer_simulation.json` — replay file for the 3D viewer
- `solar_system_horizons_cache.json` — cached JPL Horizons state vectors (committed, so runs work offline)

To feed the web visualizer, copy the generated JSON into `public/data/` on the
`kacper` branch. This step is currently **manual** — there is no automated link
between the Python model and the frontend.

## Degraded mode

If `rebound` is not importable, `run.py` and `run_simulation` print:

```
REBOUND is not available; showing the full radiation pipeline without orbital dynamics.
```

and both the "static" and "connected" reports become identical. That is expected,
not a failure — but it also means you are **not** exercising the orbital transport
layer. Install `rebound` to get real results.

## SPICE kernels

Full-ephemeris mode downloads these from `naif.jpl.nasa.gov` into a local `kernels/`
directory on first use:

`de440.bsp`, `naif0012.tls`, `gm_de431.tpc`, `pck00010.tpc`

They are gitignored. Set `download_kernels=False` in `SolarSystemBuildConfig` to
require them to be present locally instead.

## Frontend (branch `kacper`)

```bash
git checkout kacper
npm install
npm run dev      # local dev server
npm test         # Vitest suite
npm run build    # production build into dist/
```

Pushes to `kacper` trigger `.github/workflows/deploy-pages.yml`, which builds with
Vite and deploys `dist/` to GitHub Pages.
