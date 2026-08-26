# simulation

The execution core of the project. It ties the physics to the orbital dynamics.

## What this layer does

- builds the `rebound.Simulation` object
- integrates body motion over time
- determines distances between bodies and stars
- runs the radiation calculation and updates exposure
- applies impact ejecta and dust erosion along the way
- returns reports ready to print from the demos

## Modules

- `builder.py`
  - creates the simulation with optional planets and Gaia stars
  - handles loading `nearest_50_gaia.csv`
  - returns `sim`, `star_indices`, the permanent-body list and `n_permanent`
- `config.py`
  - dataclasses for material and run parameters, plus sensible defaults
  - sub-configs for Gaia, the Solar System, barycentre, radiation pressure, dust
    erosion, impacts, thermal, hydrolysis and output
- `coupling.py`
  - converts REBOUND positions into a local radiation step
  - calls the `radiation/` layer and writes the result into the exposure state
- `engine.py`
  - runs the main loop `integrate → nearest star → radiation step`
  - manages which bodies are tracked
- `scenarios.py`
  - builds the run scenarios (with and without REBOUND)
  - evaluates thermal, hydrolysis and survival state
  - formats the text report for the console
- `solar_system.py`
  - full-ephemeris construction via JPL Horizons plus SPICE kernels
  - downloads `de440.bsp`, `naif0012.tls`, `gm_de431.tpc`, `pck00010.tpc` on first use
- `solar_system_cache.py`
  - caches Horizons state vectors to JSON so later runs work offline
- `gaia_catalog.py`
  - queries the Gaia archive, writes and loads the star CSV, estimates star mass and radius
- `barycenter.py`
  - centre-of-mass frame shift, barycentre and momentum diagnostics
- `particle_ops.py`
  - `ParticleMetadataStore` and helpers for removing generated bodies
- `reboundx_forces.py`
  - loads REBOUNDx radiation forces and refreshes β per particle
- `visualizer_export.py`
  - builds the object catalog and per-frame payload for the 3D viewer
- `__main__.py`
  - allows `python -m microbe_radiation_model.simulation`
- `__init__.py`
  - re-exports the layer API, with `ImportError` fallbacks for optional dependencies

## Inputs and dependencies

- star data: `../../nearest_50_gaia.csv`
- optional dependency: `rebound` — without it a static fallback runs instead
- optional dependencies: `reboundx` (radiation pressure), `spiceypy` (full ephemeris),
  `astroquery` (Gaia)
- material data: pulled from `catalogs/` through `config.py`

## Known issue

`default_material_config()` derives the simulated fragment radius from the rock catalog
entry. For reference-body variants that radius is the reference asteroid's, not the
fragment's. See §9 of [../TECHNICAL_DOCUMENTATION.md](../TECHNICAL_DOCUMENTATION.md).
