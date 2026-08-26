# model

The Python side of the lithopanspermia digital twin: orbital transport, radiation,
thermal and chemical state, and the microbial survival function.

It is the merged result of two branches that were developed in parallel:

- the `Hack4Sages_project` line contributed the orbital and dynamical layer —
  REBOUND, Mars ejecta, radiation pressure and dust erosion;
- the `Hack4Sages_maks` line contributed the temperature model, hydrolysis, the JSON
  data store and the structured documentation.

## What is canonical

- The active runtime is `microbe_radiation_model/`.
- The main entry point is `run.py`.
- The canonical data format for visualization is JSON in `microbe_radiation_model/data/`.
- JSON is the only active export path for the visualizer.

## Main directories

| Directory | Contents |
|---|---|
| `microbe_radiation_model/simulation/` | System construction, orbital stepping, demo scenarios |
| `microbe_radiation_model/impacts/` | Asteroid / ejecta generation after a Mars impact |
| `microbe_radiation_model/erosion/` | Simplified dust erosion model |
| `microbe_radiation_model/radiation/` | Stellar radiation, GCR, shielding, radiation-pressure helpers |
| `microbe_radiation_model/thermal/` | Surface temperature and internal temperature profile |
| `microbe_radiation_model/internal_heat/` | Radiogenic heat from U / Th / K |
| `microbe_radiation_model/chemistry/` | Temperature- and water-dependent hydrolysis |
| `microbe_radiation_model/biology/` | Microbial survival function |
| `microbe_radiation_model/materials/` | Canonical `Rock` type and rock variants |
| `microbe_radiation_model/data/` | JSON output for analysis and visualization |
| `archive/` | Archive — reference material, not the runtime |

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

Other entry points:

```bash
python -m microbe_radiation_model.demos.run_radiation_demo     # static, no REBOUND
python -m microbe_radiation_model.demos.run_simulation         # connected pipeline
python -m microbe_radiation_model.demos.run_mars_impact_demo   # Mars ejecta
python -m microbe_radiation_model.demos.run_mars_pipeline      # full pipeline + JSON export
```

The complete command table is in [../RUNNING.md](../RUNNING.md), and the script that
feeds the output into the 3D visualizer is `../tools/export_simulation_to_web.py`.

## Practical notes

- `run.py` also works in an environment without the full scientific stack. When
  `rebound` is not importable it falls back to a **static radiation mode** — the report
  then says so explicitly, and the "static" and "connected" outputs become identical.
- `environment.ipynb` and `archive/` are reference material, not the canonical
  runtime. Nothing in `microbe_radiation_model/` imports them.

## Documentation

- [REPOSITORY_MAP.md](REPOSITORY_MAP.md) — what each top-level item is for
- [microbe_radiation_model/MODULE_CATALOG.md](microbe_radiation_model/MODULE_CATALOG.md) — one line per module
- [microbe_radiation_model/TECHNICAL_DOCUMENTATION.md](microbe_radiation_model/TECHNICAL_DOCUMENTATION.md) — full physics and data-flow reference
