# Technical documentation

Full reference for `microbe_radiation_model`: what each layer computes, which physics
it implements, where its data comes from, and how to run it.

---

## 1. What this model is

`microbe_radiation_model` combines:

- stellar physics (mass → luminosity),
- radiation transport (flux and attenuation in rock),
- dose accumulation over time,
- optional orbital dynamics (REBOUND),
- internal rock radioactivity (U/Th/K → activity → gamma field),
- thermal and chemical state (surface and centre temperature, hydrolysis),
- a microbial survival function,
- ready-to-run entry points and reports.

**Goal:** estimate what radiation reaches the centre of a rocky object carrying a
biological core, what dose accumulates over time, and what fraction of the microbial
population survives.

---

## 2. Logical structure and responsibilities

### 2.1 Package level

`microbe_radiation_model/__init__.py` exports a short public API:

- `build_simulation`, `run_simulation`
- `run_static_radiation_demo`, `run_connected_demo`, `run_mars_ejecta_pipeline_demo`
- `format_demo_report`
- `compute_hydrolysis_rate`, `heat_production_from_rock`
- `equilibrium_temperature_from_flux`, `temperature_profile_surface_mid_center`
- `AsteroidState`, `AsteroidStateStore`, `DustErosionConfig`, `create_mars_impact`
- `fetch_gaia_table`, `load_or_fetch_gaia_table`

Every optional group is wrapped in `try/except ImportError`, so the package imports
cleanly even when `rebound`, `reboundx`, `spiceypy` or `astroquery` are missing.

### 2.2 `physics/` — the foundation

**`physics/constants.py`** holds the constants used everywhere, so units never drift
between modules:

| Constant | Value |
|---|---|
| `SOLAR_LUMINOSITY` | 3.828 × 10²⁶ W |
| `SOLAR_MASS` | 1.989 × 10³⁰ kg |
| `AU` | 1.496 × 10¹¹ m |
| `SECONDS_PER_YEAR` | 365.25 × 24 × 3600 s |

**`physics/stellar_physics.py`** — main-sequence mass–luminosity relation:

```
L = L_sun · (M / M_sun)^3.5
```

Functions: `stellar_luminosity_from_mass(mass_kg)`,
`stellar_luminosity_from_solar_mass(mass_solar)`.

**`physics/materials.py`** — `Material(name, density, k)` where `density` is kg/m³ and
`k` is the attenuation coefficient used by Beer-Lambert.

**`physics/geometry.py`** — sphere volume, mass from radius and density, radius from mass
and density, and `biological_core_radius(...)`:

```
V = 4/3 · π · R³
m = ρ · V
m_core = bio_mass_fraction · m_rock       →  R_core recovered from m_core and ρ_bio
```

### 2.3 `materials/rocks/` — the canonical rock model

Single source of truth for rock definitions.

**`types.py`** — the `Rock` dataclass:

| Group | Fields |
|---|---|
| Geometry | `radius_m` |
| Material | `density_kg_m3`, `albedo`, `porosity`, `thermal_conductivity_w_mk`, `water_mass_fraction` |
| Population | `probability` |
| Radiogenic composition | `uranium238_ppm`, `thorium232_ppm`, `potassium_percent` |
| Extensions | `extra`, `notes` |

**`variants.py`** — `BASALT`, `CHONDRITE`, `ICE_RICH`, and the `DEFAULT_ROCK_VARIANTS` list.

**`rock_variants_from_sources.py`** — variants derived from published measurements. Each
`Rock.notes` field carries the citation for every value, for example density from
NASA/JPL SBDB (Park et al. 2025, *Nat Astron*, DOI 10.1038/s41550-025-02533-7), porosity
from Macke et al. 2011 (*MAPS* 46(3):311-326), and U/Th from Schmitt et al. 1963
(*GCA* 27:577-622).

> **Caveat.** For variants derived from a reference asteroid, `radius_m` is the radius of
> that reference body — for `basalt_vtype` this is 4 Vesta at 261 385 m. It is not an
> intrinsic material constant and it is not the size of an ejecta fragment. See §9.

**`params.py`** — `get_rock_param(...)` resolves a parameter by priority:

1. explicit argument value
2. hook value
3. field on the `Rock` object
4. `rock.extra[field_name]`
5. `default`

**`utils.py`** — `get_rock_by_name`, `normalize_probabilities`.

### 2.4 `catalogs/` — historical compatibility

A thin compatibility layer for older import paths. `asteroid_properties.py` re-exports
`DEFAULT_ROCK_VARIANTS` and aliases `RockVariant = Rock`; `rock_material.py` aliases the
type only. Add new rock profiles in `materials/rocks/variants.py`, not here.

### 2.5 `radiation/` — external radiation and dose

**`radiation_model.py`** — stellar flux:

```
F = L / (4 · π · r²)
relative_flux = (r_ref / r)²
```

Functions: `stellar_flux(luminosity_w, distance_m)`,
`stellar_flux_at_au(luminosity_w, distance_au)`, `relative_flux(...)`.

**`shielding_model.py`** — attenuation through the outer rock shell and the central
biological core, using Beer-Lambert:

```
I = I₀ · exp(−k · ρ · x)

att_rock  = exp(−k_rock · ρ_rock · path_rock)
att_bio   = exp(−k_bio  · ρ_bio  · path_bio)
F_local   = F_surface · att_rock · att_bio
```

Functions: `attenuation_factor`, `radiation_at_point_in_rock_with_bio_core`,
`radiation_at_points_in_rock_with_bio_core`. Returns `RadiationPointResult` with path
lengths, attenuation factors and `local_flux`.

**`exposure_model.py`** — dose accumulation:

```
E += F_local · dt          [W/m²] · [s] = [J/m²]
```

Types: `ExposureState(cumulative_exposure)`, `update_exposure(state, local_flux, dt)`.

**`pressure.py`** — radiation-pressure helpers for the dynamical layer:
`q_pr_from_albedo`, `compute_beta_single_star`, `nearest_star_for_position`,
`nearest_star_for_particle`, `radiation_pressure_accel_nearest_star`,
`beta_for_particles`.

### 2.6 `radiation/cosmic/` — galactic cosmic rays

`cosmic_radiation_model.py` provides `cosmic_background_flux`, `cosmic_flux_by_region`
and `cosmic_flux_by_star`; `cosmic_spectrum.py` splits a total flux into components via
`CosmicRaySpectrum` and `split_cosmic_flux`. This is the interstellar dose contribution
that does not vanish when the fragment is far from any star.

### 2.7 `radiation/radionuclide_model/` — internal sources

Radiation produced by the rock itself.

**`constants.py`** — composition-to-activity conversion:

| Constant | Value |
|---|---|
| `U238_BQ_PER_KG_PER_PPM` | 12.4 |
| `TH232_BQ_PER_KG_PER_PPM` | 4.1 |
| `K40_BQ_PER_KG_PER_PERCENT_K` | 313.0 |

**`activity.py`** — `activity_from_rock(...)` → `RadionuclideActivity` (specific activity
in Bq/kg); `volumetric_activity_bq_m3(...)` gives `A_v = A_m · ρ`.

**`geometry.py`** — `V = m/ρ`, `R = ((3V)/(4π))^(1/3)`.

**`gamma.py`** — simplified gamma field at the centre of a uniform sphere:

```
gamma_rate ≈ A_v · (1 − exp(−µ · R)) / µ
```

This is an approximation, not full Monte Carlo transport.

### 2.8 `thermal/`, `internal_heat/`, `chemistry/`

**`thermal/surface_temperature.py`** — radiative equilibrium:

```
T = ((1 − A) · F_surface / (4 · σ))^(1/4)          σ = 5.670374419e-8 W·m⁻²·K⁻⁴
```

For `F = 1361 W/m²` and `A = 0` this gives 278.6 K, as expected at 1 AU.

**`thermal/internal_profile.py`** — uniformly heated sphere with a fixed surface
temperature:

```
T(r)      = T_surface + Q / (6 · k_th) · (R² − r²)
T_centre  = T_surface + Q · R² / (6 · k_th)
```

`temperature_profile_surface_mid_center(...)` returns `(T_surface, T(R/2), T(0))`.

**`internal_heat/model.py`** — `heat_production_from_rock(...)` → `RadiogenicHeatResult`:

1. convert ppm and % to mass fractions,
2. heat production per kg [W/kg] from the U/Th/K coefficients,
3. volumetric heat production [W/m³] by multiplying by density,
4. total power [W] when the mass is known.

**`chemistry/hydrolysis_model.py`** — `compute_hydrolysis_rate(temperature_k,
water_mass_fraction)` returns the DNA hydrolysis rate in 1/s. This is the second kill
channel alongside radiation.

### 2.9 `biology/survival.py`

`survival_function(...)` returns the surviving population fraction:

```
N/N₀ = exp( −(kill_radiation + kill_hydrolysis) · t )

kill_radiation  = radiation_surv_coeff · (dose_space + dose_decay)      [per year]
kill_hydrolysis = hydrolysis_rate · SECONDS_PER_YEAR · 1200            [per year]
```

`radiation_surv_coeff` is typically in the range **3.6e-4 – 1.0e-3 1/Gy**
(Mileikowsky D10 → natural-exp conversion; see `biology/constants.py`). The
hydrolysis coefficient `1.2 / 0.001 = 1200` is a hard-coded model constant with
**no cited source** (audit / sensitivity parameter).

### 2.10 `impacts/` and `erosion/`

**`impacts/types.py`** — `ImpactEjectaConfig`, `GeneratedAsteroid`, `ImpactResult`.

**`impacts/sampling.py`** — `sample_truncated_power_law` for size and velocity
distributions, `random_cone_directions` for the ejection cone.

**`impacts/mars_impact.py`** — `create_mars_impact(sim, config)` samples a swarm of
fragments (radius, mass, velocity, spin period, obliquity, rock variant) and injects them
into an existing REBOUND simulation around Mars.

Defaults from `ImpactSimulationConfig`: 10 asteroids, cone half-angle 60°, velocity
5.03–20 km/s with power-law index 2.5, radius **0.001–5 m** with size index 2.0,
spin period 2–20 h, obliquity 0–180°.

**`erosion/dust.py`** — `apply_dust_erosion_step` shrinks a fragment's radius from an
incident dust mass flux; `make_dust_erosion_step_hook` turns this into a REBOUND
per-step hook.

### 2.11 `simulation/` — time loop and REBOUND integration

**`builder.py`** builds a `rebound.Simulation`:

1. adds the Sun (`m = 1.0` in REBOUND units),
2. optionally adds planets from `_PLANET_DATA` (mass and semi-major axis),
3. optionally loads stars from `nearest_50_gaia.csv`,
4. returns `(sim, star_indices, solar_system_bodies, n_permanent)`.

Gaia conversion: input columns `ra` [deg], `dec` [deg], `distance_pc` [pc],
`mass_flame` [M_sun]; position converted to Cartesian AU via
`r_au = distance_pc · 206264.806…` and the standard spherical-to-Cartesian transform.

**`config.py`** holds the run configuration:

| Config | Notable defaults |
|---|---|
| `SimulationMaterialConfig` | `bio_mass_fraction = 0.01` |
| `SimulationRunConfig` | `dt_yr = 1/365.25`, `n_steps = 10`, `integration_substeps = 10`, `add_test_particle = True` |
| `SolarSystemBuildConfig` | `mode = "simple"`, `use_cache = True`, cache in `microbe_radiation_model/data/` |
| `GaiaCatalogConfig` | `csv_path = "nearest_50_gaia.csv"`, `top_n = 50` |
| `RadiationPressureConfig` | disabled by default |
| `ImpactSimulationConfig` | disabled by default; fragment radii 0.001–5 m |
| `ThermalModelConfig` | enabled, internal profile enabled |
| `HydrolysisModelConfig` | enabled |
| `OutputConfig` | JSON export on, visualizer export off, playback 30 fps |

**`coupling.py`** bridges orbits and radiation: read `star` and `body` positions from
REBOUND → distance in AU and m → surface flux → biological core radius → local flux at
the centre → update exposure.

**`engine.py`** runs the main loop: build (or accept) the simulation, optionally add a
test particle, create an `ExposureState` per tracked body, then for each step
`sim.integrate(sim.t + dt_yr)` → `nearest_star_index` → luminosity of that star →
`process_radiation_step`.

**`scenarios.py`** provides `run_static_radiation_demo`, `run_connected_demo`,
`run_mars_ejecta_pipeline_demo` and `format_demo_report`. The connected scenario falls
back to static mode automatically when `rebound` is unavailable. Output is a
`SimulationReport` (mode, fluxes, timing, body count, doses).

**`solar_system.py`** builds the full-ephemeris system from REBOUND Horizons plus SPICE
kernels, downloading `de440.bsp`, `naif0012.tls`, `gm_de431.tpc` and `pck00010.tpc` from
`naif.jpl.nasa.gov` into `kernels/` on first use. `solar_system_cache.py` caches the
resulting state vectors to JSON so later runs work offline.

**`gaia_catalog.py`** queries the Gaia archive through `astroquery`, writes and loads
`nearest_50_gaia.csv`, and estimates star mass and radius when FLAME values are missing.

**`barycenter.py`**, **`particle_ops.py`**, **`reboundx_forces.py`** and
**`visualizer_export.py`** handle the centre-of-mass frame, particle bookkeeping,
REBOUNDx radiation forces (including dynamic β refresh), and the JSON payload for the
3D viewer.

**`__main__.py`** — `python -m microbe_radiation_model.simulation`.

### 2.12 `demos/` — entry points

See the command table in [../../RUNNING.md](../../RUNNING.md). `console.py` provides
`configure_utf8_output()`, which forces UTF-8 on stdout.

---

## 3. Data sources

### 3.1 In-repository data

| File | Read by | Columns used |
|---|---|---|
| `nearest_50_gaia.csv` | `simulation/builder.py` | `ra`, `dec`, `distance_pc`, `mass_flame` (optional; falls back to 0.1 M_sun) |
| `data/solar_system_horizons_cache.json` | `simulation/solar_system_cache.py` | Cached Horizons state vectors |
| `data/star_uv_profile.json` | `data_store.py` | Stellar UV flux versus distance |

Rock presets come from `materials/rocks/variants.py` and
`materials/rocks/rock_variants_from_sources.py`. Planet parameters are hard-coded in
`simulation/builder.py` (`_PLANET_DATA`).

### 3.2 Remote data

| Source | Fetched by |
|---|---|
| Gaia archive | `simulation/gaia_catalog.py`, `demos/fetch_gaia_catalog.py` |
| JPL Horizons | `simulation/solar_system.py` (cached) |
| NAIF SPICE kernels | `simulation/solar_system.py` → `kernels/` |

### 3.3 Not a data source

`environment.ipynb` is a working / archival notebook. The current runtime does not depend
on it and does not read it.

---

## 4. Physics, step by step

| # | Step | Model | Units in → out |
|---|---|---|---|
| 1 | Star → luminosity | `L = L_sun · (M/M_sun)^3.5` | M_sun or kg → W |
| 2 | Luminosity → surface flux | `F = L / (4πr²)` | W, m → W/m² |
| 3 | Biological core geometry | `m_core = f · m_rock`, radius from mass and ρ_bio | kg/m³, m → m |
| 4 | Attenuation | `F_local = F · exp(−k_rock ρ_rock x_rock) · exp(−k_bio ρ_bio x_bio)` | W/m² → W/m² |
| 5 | Dose accumulation | `E += F_local · dt` | W/m², s → J/m² |
| 6 | Internal sources | U/Th/K → Bq/kg → Bq/m³ → approximate gamma field | ppm, % → Bq/m³ |
| 7 | Surface temperature | `T = ((1−A)F / 4σ)^(1/4)` | W/m² → K |
| 8 | Internal temperature | `T(0) = T_s + Q R² / (6 k_th)` | W/m³, m, W/(m·K) → K |
| 9 | Hydrolysis | `compute_hydrolysis_rate(T, water_fraction)` | K → 1/s |
| 10 | Survival | `N/N₀ = exp(−(kill_rad + kill_hyd)·t)` | Gy/yr, 1/s, yr → fraction |

---

## 5. What happens during a run

Sequence for `run_connected_demo()`:

1. Check whether `rebound` is importable.
2. If not, fall back immediately to `run_static_radiation_demo`.
3. If it is:
   - build the simulation (`build_simulation`),
   - add the Sun, planets and optionally Gaia stars,
   - optionally add a test particle,
   - initialise `ExposureState` for each tracked body.
4. Loop `n_steps` times:
   - integrate orbits by `dt_yr`,
   - for each tracked body: select the nearest star → star mass to luminosity →
     distance to surface flux → attenuation through rock and bio core → update
     cumulative dose.
5. Assemble the `SimulationReport`.
6. Format it with `format_demo_report`.

The Mars pipeline (`run_mars_ejecta_pipeline_demo`) additionally injects the impact
swarm, applies dust erosion per step, tracks per-asteroid state in `AsteroidStateStore`,
evaluates the survival function each step, and exports the visualizer JSON.

---

## 6. Reading the report

| Field | Meaning |
|---|---|
| `Mode` | `static_radiation` or `rebound_pipeline` |
| `Distance to star` | Distance to the nearest star [AU] |
| `Flux at rock surface` | Flux at the rock surface [W/m²] |
| `Flux at biological core` | Flux reaching the shielded biological core [W/m²] |
| `Exposure time step` | Exposure time step [s] |
| `Final simulation time` | Final simulation time [years] |
| `Permanent bodies in simulation` | Number of permanent bodies |
| `Body N: cumulative exposure` | Cumulative dose after all steps [J/m²] |
| `Centre temperature` | Centre temperature [K] |
| `Hydrolysis rate` | DNA hydrolysis rate [1/s] |

`local_flux` shows how much radiation reaches the protected point;
`cumulative_exposure` shows the dose built up over many time steps.

> The labels are produced by `simulation/scenarios.py::format_demo_report`.

---

## 7. Assumptions and limitations

1. `L ∝ M^3.5` is a simplification valid for main-sequence stars.
2. Beer-Lambert attenuation is an effective model — there is no full particle transport.
3. The rock and its core are modelled as homogeneous spheres.
4. The radiation sampling point is the centre, `(0, 0, 0)`.
5. The internal gamma sub-model is an approximation, not Monte Carlo.
6. Gaia stars are added as points with zero velocity and are static after loading.
7. The hydrolysis survival coefficient (1200) is a hard-coded constant with no cited source (audit parameter in `biology/constants.py`).
8. Python unit tests live in `model/tests/` (wiring, biology, radiation, thermal, provenance, regressions). They do not yet cover every limiting case listed in §8.

---

## 8. Where to take this next

1. Reconcile the fragment-radius issue in §9 — without it the biological chain reports zeros. *(Server/UI now expose `radius_min`/`radius_max` for the Mars pipeline; catalog-radius inheritance in static demos may still bite — see §9.)*
2. Wire `internal_heat` and `radionuclide_model` fully into the main report.
3. Extend the attenuation model with an energy-dependent cross-section.
4. Add a CLI argument parser (time, step count, rock, composition).
5. Extend `model/tests/` for unit integrity, limiting behaviour (`distance → 0`,
   `bio_mass_fraction → 0/1`) and report regression where still missing.
6. Automate the handoff of `data/*.json` to the visualizer's `public/data/`.

---

## 9. Known issue: fragment radius

`simulation/config.py::default_material_config()` reads `rock.radius_m` from the catalog
and uses it as the radius of the simulated fragment. For catalog entries derived from a
reference body this is the radius of that body — `basalt_vtype` resolves to
**261 385 m** (asteroid 4 Vesta). The rock's own `notes` field warns about exactly this:

> *note: this is the radius of the reference body, not an intrinsic material constant*

Meanwhile `ImpactSimulationConfig` samples fragments between **0.001 m and 5 m** — five
orders of magnitude apart.

Observable consequences in the default `run.py` report:

| Reported value | Cause |
|---|---|
| `Flux at biological core: 0.000e+00 W/m^2` | Beer-Lambert through 261 km of rock underflows to zero |
| `Body 0: cumulative exposure = 0.000e+00 J/m^2` | Zero local flux integrates to zero dose |
| `Centre temperature: 875.84 K` | `Q R²/(6k)` with R = 261 km gives a 633 K rise |
| `Hydrolysis rate: 5.279e+04 1/s` | Computed from that centre temperature |

The physics is correct at every step; the input radius is not. A fix is to give
`SimulationMaterialConfig` its own fragment radius rather than inheriting the catalog
entry's reference-body radius — the `0.5 m` fallback already present in
`default_material_config()` for legacy dict variants is a reasonable starting value.
