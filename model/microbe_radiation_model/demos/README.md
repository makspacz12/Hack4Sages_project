# demos

Scripts run by hand during testing and presentation.

## Modules

| Module | What it does |
|---|---|
| `console.py` | Sets UTF-8 on stdout so report characters display correctly |
| `demo.py` | Quick physics check (`mass → luminosity → flux`) plus a full scenario report |
| `run_radiation_demo.py` | Static radiation pipeline without REBOUND — useful for validating the model maths quickly |
| `run_simulation.py` | Connected scenario, with REBOUND when available |
| `run_mars_impact_demo.py` | Mars impact ejecta generation |
| `run_mars_pipeline.py` | Full pipeline: impact + dynamics + erosion + radiation + JSON export |
| `run_dust_erosion_demo.py` | Dust erosion model in isolation |
| `run_radiation_pressure_demo.py` | REBOUNDx radiation-pressure forces |
| `build_full_system.py` | Builds the complete Solar System plus Gaia environment |
| `fetch_gaia_catalog.py` | Refreshes `nearest_50_gaia.csv` from the Gaia archive |
| `__init__.py` | Exposes the `main_*` functions and the console helper |

## Which one to use

- fastest check that the project works at all → `demo.py`
- test the radiation chain alone → `run_radiation_demo.py`
- run the full runner → `run_simulation.py`
- produce data for the 3D visualizer → `run_mars_pipeline.py`
