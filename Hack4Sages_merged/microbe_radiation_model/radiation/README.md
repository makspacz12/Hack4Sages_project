# radiation

The layer responsible directly for radiation and its effects.

## Pipeline of this layer

1. `radiation_model.py` computes the stellar radiation flux.
2. `shielding_model.py` attenuates that flux through the rock and the biological core.
3. `exposure_model.py` accumulates the dose over time.

## Modules

- `radiation_model.py`
  - `stellar_flux` and `stellar_flux_at_au` implement the inverse-square law
  - `relative_flux` scales quickly against a reference distance
- `shielding_model.py`
  - describes how radiation penetrates the rock shell and the biological core
  - returns `RadiationPointResult` with path lengths and attenuation factors
  - uses `Material` from `physics/materials.py`
- `exposure_model.py`
  - holds `ExposureState`
  - updates the dose as `exposure += local_flux * dt`
- `pressure.py`
  - radiation-pressure helpers used by the dynamical layer
  - `q_pr_from_albedo`, `compute_beta_single_star`, `nearest_star_for_particle`, `beta_for_particles`
- `__init__.py`
  - re-exports the radiation API for `simulation/` and `demos/`

## Sub-packages

- `stellar/` — canonical stellar flux implementation plus a backward-compatible facade
- `cosmic/` — galactic cosmic ray background and its component spectrum
- `radionuclide_model/` — internal U/Th/K activity and a simplified gamma field

## Responsibility boundary

This layer knows nothing about orbits or REBOUND simulation time. It receives ready
distances and parameters and returns local radiation results.
