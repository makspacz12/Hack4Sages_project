# catalogs

Compatibility exports of the rock presets.

## Modules

- `asteroid_properties.py`
  - re-exports `DEFAULT_ROCK_VARIANTS`
  - the variants are maintained canonically in `microbe_radiation_model/materials/rocks/variants.py`
  - alias `RockVariant` points at `materials.rocks.Rock`
- `rock_material.py`
  - compatibility alias `RockVariant` for older import paths
- `__init__.py`
  - re-exports `DEFAULT_ROCK_VARIANTS`

## How this is used

`simulation/config.py` takes the first variant as the default rock for demo runs.

**Add new rock profiles in `materials/rocks/variants.py`, not here.**
