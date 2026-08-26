# Module catalog

One line per module in `microbe_radiation_model`, grouped by layer, from the
lowest-level physics up to the runnable scenarios.

## 1) Foundation: `physics/`

| Module | Responsibility |
|---|---|
| `constants.py` | Physical and astronomical constants (`AU`, `SOLAR_MASS`, `SOLAR_LUMINOSITY`, `SECONDS_PER_YEAR`) |
| `materials.py` | `Material` dataclass (`name`, `density`, `k`) — the data contract between layers |
| `geometry.py` | Sphere volume/mass helpers and `biological_core_radius` |
| `stellar_physics.py` | Stellar mass → luminosity relation |
| `__init__.py` | Re-exports the physics API |

## 2) Rock models: `materials/rocks/`

| Module | Responsibility |
|---|---|
| `types.py` | `Rock` dataclass — geometry, material, radiogenic composition, population weight |
| `variants.py` | Default variants (`BASALT`, `CHONDRITE`, `ICE_RICH`, `DEFAULT_ROCK_VARIANTS`) |
| `rock_variants_from_sources.py` | Variants built from published measurements, each field carrying its citation |
| `params.py` | `get_rock_param` — resolves a parameter by priority: explicit → hook → `Rock` field → `rock.extra` → default |
| `utils.py` | `get_rock_by_name`, `normalize_probabilities` |
| `__init__.py` | Canonical exports of the rock type and presets |

**Rule:** add new rock variants here, never in `catalogs/`.

## 3) Compatibility: `catalogs/`

| Module | Responsibility |
|---|---|
| `asteroid_properties.py` | Re-exports `DEFAULT_ROCK_VARIANTS`; alias `RockVariant = Rock` |
| `rock_material.py` | Type alias `RockVariant` for older import paths |
| `__init__.py` | Re-exports `DEFAULT_ROCK_VARIANTS` |

## 4) Radiation: `radiation/`

| Module | Responsibility |
|---|---|
| `radiation_model.py` | `stellar_flux`, `stellar_flux_at_au`, `relative_flux` — inverse-square law |
| `shielding_model.py` | Beer-Lambert attenuation through rock and biological core; returns `RadiationPointResult` |
| `exposure_model.py` | `ExposureState` and `update_exposure` — dose accumulation `E += F_local · dt` |
| `pressure.py` | Radiation-pressure helpers: `q_pr_from_albedo`, `compute_beta_single_star`, `nearest_star_for_particle`, `beta_for_particles` |
| `__init__.py` | Re-exports the radiation API |

### `radiation/stellar/`

| Module | Responsibility |
|---|---|
| `radiation_model.py` | Canonical stellar flux implementation |
| `stellar_radiation.py` | Backward-compatible facade over the above |

### `radiation/cosmic/`

| Module | Responsibility |
|---|---|
| `cosmic_radiation_model.py` | Galactic cosmic ray background: `cosmic_background_flux`, `cosmic_flux_by_region`, `cosmic_flux_by_star` |
| `cosmic_spectrum.py` | `CosmicRaySpectrum` and `split_cosmic_flux` — component breakdown of the total GCR flux |

### `radiation/radionuclide_model/`

| Module | Responsibility |
|---|---|
| `constants.py` | Composition → activity conversion constants (ppm/% → Bq/kg) |
| `activity.py` | `activity_from_rock` (Bq/kg), `volumetric_activity_bq_m3` (Bq/m³) |
| `geometry.py` | Rock geometry from mass and density |
| `gamma.py` | `internal_gamma_rate_from_rock` — simplified internal gamma field |
| `__init__.py` | Re-exports the radionuclide API |

## 5) Thermal and chemical: `thermal/`, `internal_heat/`, `chemistry/`

| Module | Responsibility |
|---|---|
| `thermal/surface_temperature.py` | Radiative equilibrium temperature from surface flux and albedo |
| `thermal/internal_profile.py` | `T(r) = T_surface + Q/(6k)·(R² − r²)` for a uniformly heated sphere |
| `internal_heat/constants.py` | Radiogenic heat coefficients for U / Th / K (µW·kg⁻¹ per mass fraction) |
| `internal_heat/model.py` | `heat_production_from_rock` → `RadiogenicHeatResult` (W/kg, W/m³, total W) |
| `chemistry/constants.py` | Hydrolysis model constants |
| `chemistry/hydrolysis_model.py` | `compute_hydrolysis_rate` from temperature and water mass fraction |

## 6) Biology: `biology/`

| Module | Responsibility |
|---|---|
| `survival.py` | `survival_function` — surviving population fraction as `exp(−(kill_radiation + kill_hydrolysis)·t)` |

| `__init__.py` | Re-exports `survival_function` |

## 7) Impacts and erosion: `impacts/`, `erosion/`

| Module | Responsibility |
|---|---|
| `impacts/types.py` | `ImpactEjectaConfig`, `GeneratedAsteroid`, `ImpactResult` |
| `impacts/sampling.py` | `sample_truncated_power_law` (size/velocity distributions), `random_cone_directions` |
| `impacts/mars_impact.py` | `create_mars_impact` — injects an ejecta swarm into a REBOUND simulation |
| `erosion/dust.py` | `DustErosionConfig`, `apply_dust_erosion_step`, `make_dust_erosion_step_hook` — radius loss from dust flux |

## 8) Simulation: `simulation/`

| Module | Responsibility |
|---|---|
| `builder.py` | Builds the `rebound.Simulation`: Sun, optional planets, optional Gaia stars |
| `config.py` | `SimulationMaterialConfig`, `SimulationRunConfig`, `default_material_config()` and all sub-configs |
| `coupling.py` | Turns REBOUND positions into a radiation step and updates exposure |
| `engine.py` | Main time loop: `integrate → nearest star → radiation step → exposure` |
| `scenarios.py` | Ready-made scenarios (`run_static_radiation_demo`, `run_connected_demo`, `run_mars_ejecta_pipeline_demo`) and `format_demo_report` |
| `solar_system.py` | Full-ephemeris construction via JPL Horizons plus SPICE kernels |
| `solar_system_cache.py` | Caches Horizons state vectors to JSON so runs work offline |
| `gaia_catalog.py` | Queries the Gaia archive, writes/loads `nearest_50_gaia.csv`, estimates star mass and radius |
| `barycenter.py` | Moves the simulation to the centre-of-mass frame; barycentre and momentum diagnostics |
| `particle_ops.py` | `ParticleMetadataStore` and helpers for removing generated bodies |
| `reboundx_forces.py` | Loads REBOUNDx radiation forces, assigns and dynamically refreshes β per particle |
| `visualizer_export.py` | Builds the object catalog and per-frame payload for the 3D viewer |
| `__main__.py` | `python -m microbe_radiation_model.simulation` |
| `__init__.py` | Re-exports the simulation API with `ImportError` fallbacks |

## 9) Entry points: `demos/`

| Module | Responsibility |
|---|---|
| `console.py` | `configure_utf8_output()` — forces UTF-8 on stdout |
| `demo.py` | Quick physics check (`mass → luminosity → flux`) plus a full scenario report |
| `run_radiation_demo.py` | Static radiation pipeline, no REBOUND |
| `run_simulation.py` | Connected pipeline with automatic static fallback |
| `run_mars_impact_demo.py` | Mars impact ejecta generation |
| `run_mars_pipeline.py` | Full pipeline: impact + dynamics + erosion + radiation + JSON export |
| `run_dust_erosion_demo.py` | Dust erosion model in isolation |
| `run_radiation_pressure_demo.py` | REBOUNDx radiation-pressure forces |
| `build_full_system.py` | Constructs the complete Solar System + Gaia environment |
| `fetch_gaia_catalog.py` | Refreshes `nearest_50_gaia.csv` from the Gaia archive |

## 10) Package level

| Module | Responsibility |
|---|---|
| `__init__.py` | Public API, wrapped in `try/except ImportError` so the package degrades gracefully without `rebound` / `astroquery` |
| `data_store.py` | JSON persistence: gamma timeseries, rock summary, star UV profile, visualizer replay |
| `asteroid_state.py` | `AsteroidState` and `AsteroidStateStore` — mutable per-asteroid state through the pipeline |

## 11) Archive

`../archive/` holds `legacy/` (compatibility aliases), `concepts/` (design notes) and
`legacy_modules/` including `aliases_v1/` (the first-generation flat module layout).
None of it is on the runtime path.

## Data flow, high level

1. `stellar_physics.py` computes stellar luminosity from mass.
2. `radiation_model.py` turns luminosity and distance into surface flux.
3. `shielding_model.py` attenuates that flux through rock and biological core.
4. `exposure_model.py` accumulates the dose.
5. `thermal/` + `internal_heat/` give surface and centre temperature; `chemistry/` gives the hydrolysis rate.
6. `biology/survival.py` converts dose and hydrolysis into a surviving population fraction.
7. `engine.py` repeats steps 2–6 for each time step; `impacts/` and `erosion/` mutate the swarm along the way.
8. `demos/` formats the report; `data_store.py` and `visualizer_export.py` write JSON.
