# catalogs

Ten katalog przechowuje presety i słowniki parametrów wejściowych.

## Moduły
- `asteroid_properties.py`
  - trzyma listę `DEFAULT_ROCK_VARIANTS`
  - każdy wariant zawiera: nazwę, gęstość, albedo i udział prawdopodobieństwa
- `__init__.py`
  - eksportuje katalog wariantów do innych warstw

## Jak jest to używane
- `simulation/config.py` pobiera pierwszy wariant jako domyślną skałę dla uruchomień demo
- katalog jest miejscem, gdzie warto dodawać kolejne profile materiałowe
