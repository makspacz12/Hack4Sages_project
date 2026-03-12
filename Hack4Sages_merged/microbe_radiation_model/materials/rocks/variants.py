"""
Domyślne warianty skal używane w symulacjach.

Proste warianty z tego modułu zostały zastąpione bogatszym zestawem
skal bazujących na danych NASA/JPL i literaturze naukowej, zadeklarowanych
w pliku `rock_variants_from_sources.py`. Zachowujemy jednak krótkie aliasy
`BASALT`, `CHONDRITE`, `ICE_RICH` dla kompatybilności z istniejącym kodem
i dokumentacją.
"""

from .rock_variants_from_sources import (
    BASALT_VTYPE,
    CI_CHONDRITE,
    CM_CHONDRITE,
    ENSTATITE_CHONDRITE,
    HYDRATED_SILICATE,
    ICE_RICH as ICE_RICH_SOURCE,
    IRON_NICKEL,
    OLIVINE_DOMINATED,
    ORGANIC_RICH,
    ORDINARY_CHONDRITE,
    RUBBLE_PILE,
    STONY_IRON,
)

# Aliasowanie nazw historycznych na nowe, bogatsze warianty.
BASALT = BASALT_VTYPE
CHONDRITE = ORDINARY_CHONDRITE
ICE_RICH = ICE_RICH_SOURCE

# Kanoniczna lista wariantów skał używana przy generowaniu populacji asteroid
# (np. w module `impacts.mars_impact`). Wszystkie mają komplet parametrów
# fizycznych (bez wartości None), więc przechodzą walidację w `_normalize_variant`.
DEFAULT_ROCK_VARIANTS = [
    BASALT_VTYPE,
    CI_CHONDRITE,
    CM_CHONDRITE,
    ORDINARY_CHONDRITE,
    OLIVINE_DOMINATED,
    ENSTATITE_CHONDRITE,
    IRON_NICKEL,
    HYDRATED_SILICATE,
    ORGANIC_RICH,
    ICE_RICH_SOURCE,
    RUBBLE_PILE,
    STONY_IRON,
]

