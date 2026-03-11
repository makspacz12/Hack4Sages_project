# catalogs

Ten katalog przechowuje kompatybilnościowe eksporty presetów.

## Moduły
- `asteroid_properties.py`
  - eksportuje `DEFAULT_ROCK_VARIANTS`
  - warianty są utrzymywane kanonicznie w `microbe_radiation_model/materials/rocks/variants.py`
  - alias `RockVariant` wskazuje na `materials.rocks.Rock`
- `rock_material.py`
  - alias zgodności `RockVariant` dla starszych importów
- `__init__.py`
  - eksportuje `DEFAULT_ROCK_VARIANTS`

## Jak jest to używane
- `simulation/config.py` pobiera pierwszy wariant jako domyślną skałę dla uruchomień demo
- nowe profile skał dodawaj w `materials/rocks/variants.py`, nie w `catalogs/`
