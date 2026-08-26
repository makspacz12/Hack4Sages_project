# microbe_radiation_model

This package holds the complete pipeline:

1. physical and material definitions,
2. radiation and shielding calculations,
3. thermal, chemical and biological state,
4. time integration with REBOUND,
5. runnable demos and reports.

## Functional structure

| Directory | Role |
|---|---|
| `physics/` | Mathematical and physical foundation, no simulation logic |
| `materials/` | Canonical rock types and presets (`materials/rocks/*`) |
| `radiation/` | The radiation chain: flux → shielding → exposure |
| `radiation/stellar/`, `radiation/cosmic/` | Stellar and galactic-cosmic-ray sources |
| `radiation/radionuclide_model/` | Internal U/Th/K activity and gamma field |
| `thermal/` | Surface temperature and internal temperature profile |
| `internal_heat/` | Radiogenic heat production |
| `chemistry/` | Temperature- and water-dependent hydrolysis |
| `biology/` | Microbial survival function |
| `impacts/` | Mars impact ejecta generation |
| `erosion/` | Dust erosion in flight |
| `simulation/` | Layer connecting `radiation/` and the rest to REBOUND |
| `demos/` | Ready-made entry-point scripts and output formatting |
| `catalogs/` | Compatibility layer for older preset imports |
| `data/` | JSON output for analysis and visualization |

## Clean package root

At runtime only the following live directly under `microbe_radiation_model/`:

- `__init__.py` — the public API
- `data_store.py` — JSON persistence
- `asteroid_state.py` — per-asteroid mutable state
- documentation (`README.md`, `MODULE_CATALOG.md`, `TECHNICAL_DOCUMENTATION.md`)
- the layer directories listed above

The old flat aliases that used to sit at this level were removed from the runtime and
archived in `../archive/legacy_modules/aliases_v1/`.

## Main entry points

```bash
python -m microbe_radiation_model.simulation             # default scenario
python -m microbe_radiation_model.demos.demo             # quick check + full report
python -m microbe_radiation_model.demos.run_simulation   # connected scenario
python -m microbe_radiation_model.demos.run_radiation_demo   # static, no REBOUND
python -m microbe_radiation_model.demos.run_mars_pipeline    # full Mars pipeline
```

## Data dependencies

- `../nearest_50_gaia.csv` — extra stars for `simulation/builder.py`
- `../environment.ipynb` — working / archival file, not required by the runtime
- `data/solar_system_horizons_cache.json` — cached JPL Horizons state vectors

## Detailed documentation

- [MODULE_CATALOG.md](MODULE_CATALOG.md) — one line per module
- [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) — full description of modules, physics, data and run stages
