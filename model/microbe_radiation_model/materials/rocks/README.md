# materials/rocks

The canonical rock definitions for the project.

## What is here

- `types.py`
  - the `Rock` dataclass: geometry, material properties and radiogenic composition
- `variants.py`
  - default variants (`BASALT`, `CHONDRITE`, `ICE_RICH`, `DEFAULT_ROCK_VARIANTS`)
- `rock_variants_from_sources.py`
  - variants built from published measurements; every value carries its citation in `Rock.notes`
- `params.py`
  - `get_rock_param` resolves a parameter by priority: explicit → hook → `Rock` field → `rock.extra` → default
- `utils.py`
  - `get_rock_by_name`, `normalize_probabilities`
- `__init__.py`
  - shared API exports

## Rules

- Add new rock variants **here**, not in `catalogs/`. `catalogs/` is only a compatibility
  layer for older imports.
- `radius_m` on a source-derived variant is the radius of the **reference body** (for
  `basalt_vtype`, asteroid 4 Vesta at 261 385 m). It is not an intrinsic material
  constant and must not be used as an ejecta fragment size.
