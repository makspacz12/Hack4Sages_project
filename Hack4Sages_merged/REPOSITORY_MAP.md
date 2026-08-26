# Repository map

What each top-level item in `Hack4Sages_merged/` is for, and which parts are the
canonical runtime versus reference material.

## Top level

| Item | Role |
|---|---|
| `microbe_radiation_model/` | **The canonical runtime package.** Orbital dynamics (REBOUND), radiation, thermal, chemistry and biology models. |
| `run.py` | Main entry point. Prints a runtime report for the static and the connected pipeline. |
| `requirements.txt` | Dependencies for the base runtime plus the optional extensions (`rebound`, `reboundx`, `spiceypy`). |
| `nearest_50_gaia.csv` | Gaia catalog of the 50 nearest stars, used to build the interstellar environment. |
| `environment.ipynb` | Historical working notebook. **Not** part of the runtime — nothing imports it. |
| `archive/` | Archive: legacy modules, design sketches and compatibility aliases. Not the runtime. |
| `REPOSITORY_MAP.md` | This file. |
| `README.md` | Package overview and quick start. |

## Inside `microbe_radiation_model/`

| Item | Role |
|---|---|
| `__init__.py` | Public API. Re-exports the most used functions with graceful `ImportError` fallbacks so the package works without `rebound`. |
| `data_store.py` | JSON persistence for analysis and visualization output. |
| `asteroid_state.py` | Mutable per-asteroid state carried through the pipeline (radius, mass, temperature, dose). |
| `physics/` | Constants, sphere geometry, material type, stellar mass→luminosity relation. |
| `materials/rocks/` | Canonical `Rock` type and rock variants sourced from published measurements. |
| `catalogs/` | Compatibility layer re-exporting rock presets for older import paths. |
| `radiation/` | Stellar flux, Beer-Lambert shielding, cumulative exposure, radiation pressure. |
| `radiation/stellar/` | Stellar radiation sub-model. |
| `radiation/cosmic/` | Galactic cosmic ray (GCR) sub-model. |
| `radiation/radionuclide_model/` | Internal U/Th/K activity and a simplified gamma field. |
| `thermal/` | Surface equilibrium temperature and internal temperature profile. |
| `internal_heat/` | Radiogenic heat production from U/Th/K decay. |
| `chemistry/` | Temperature- and water-dependent hydrolysis rate. |
| `biology/` | Microbial survival function. |
| `impacts/` | Mars impact ejecta generation and sampling. |
| `erosion/` | Dust erosion of ejecta in flight. |
| `simulation/` | System construction, time loop, scenarios, Gaia/Horizons ingestion, visualizer export. |
| `demos/` | Ten runnable entry-point scripts. |
| `data/` | JSON output consumed by analysis and by the 3D visualizer. |

## Actively exercised at runtime

```
physics/  materials/  radiation/  thermal/  chemistry/
internal_heat/  biology/  simulation/  impacts/  erosion/
```

Entry point: `python run.py`

## Not on the runtime path

- `environment.ipynb` — working / historical notebook
- `archive/*` — supporting material and older aliases

## Exports for visualization

Written into `microbe_radiation_model/data/`:

| File | Contents | Committed? |
|---|---|---|
| `star_uv_profile.json` | Stellar UV flux versus distance | yes |
| `solar_system_horizons_cache.json` | Cached JPL Horizons state vectors, so runs work offline | yes |
| `gamma_radiation_timeseries.json` | Internal gamma field over time | generated |
| `rock_radiation_summary.json` | Per-rock dose / temperature summary | generated |
| `cosmos_visualizer_simulation.json` | Replay file for the 3D viewer | generated |

## External data sources

| Source | Fetched by | Notes |
|---|---|---|
| Gaia archive | `simulation/gaia_catalog.py`, `demos/fetch_gaia_catalog.py` | Refreshes `nearest_50_gaia.csv`; requires `astroquery` |
| JPL Horizons | `simulation/solar_system.py` | Planetary state vectors; cached to JSON |
| NAIF SPICE kernels | `simulation/solar_system.py` | `de440.bsp`, `naif0012.tls`, `gm_de431.tpc`, `pck00010.tpc` downloaded into `kernels/` on first use (gitignored) |

## Two fixed pitfalls worth knowing about

Both of these used to silently zero out the radiation-to-biology chain. They are fixed,
but the underlying traps are easy to reintroduce:

1. **Fragment radius.** `simulation/config.py::default_material_config()` now uses
   `DEFAULT_FRAGMENT_RADIUS_M` (0.5 m). It must **not** read `rock.radius_m` from the
   catalog — for source-derived variants that field is the radius of the *reference
   body* (asteroid 4 Vesta, 261 385 m for `basalt_vtype`), five orders of magnitude
   larger than the 0.001-5 m fragments the impact model samples.
2. **`Material.k` is a mass attenuation coefficient [m²/kg]**, used as
   `exp(-k·ρ·x)`. It is not thermal conductivity [W/(m·K)]. The rock's thermal
   conductivity now lives in `SimulationMaterialConfig.rock_thermal_conductivity_w_mk`.
