# physics

Basic computational building blocks that do not depend on any particular simulation.

## What lives here

- physical and astronomical constants
- the material definition used by the shielding model
- spherical geometry helpers for the rock and its biological core
- the stellar mass → luminosity relation

## Modules

- `constants.py`
  - holds the shared constants: `SOLAR_LUMINOSITY`, `SOLAR_MASS`, `AU`, `SECONDS_PER_YEAR`
  - imported by `radiation/`, `thermal/`, `biology/` and `simulation/`
- `materials.py`
  - defines `Material` (`name`, `density`, `k`)
  - this class is the data contract between layers
- `geometry.py`
  - sphere volume and mass, plus the biological core radius
  - `biological_core_radius` is used by the shielding calculation
- `stellar_physics.py`
  - stellar luminosity from mass (`kg` or `M_sun`)
  - feeds the radiation flux calculation
- `__init__.py`
  - re-exports the key symbols so higher layers can import them conveniently

## Input and output of this layer

- **in:** scalar values (mass, density, radius)
- **out:** physical quantities ready for `radiation/`, `thermal/` and `simulation/`
