"""
Default rock variants used in the simulations.

The simple variants in this module were superseded by a richer set of rocks
based on NASA/JPL data and the scientific literature, declared in
`rock_variants_from_sources.py`. The short aliases `BASALT`, `CHONDRITE` and
`ICE_RICH` are kept for compatibility with existing code and documentation.

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

# Canonical list of rock variants used when generating asteroid populations
# (for example in `impacts.mars_impact`). All of them carry a complete set of
# physical parameters (no None values), so they pass `_normalize_variant`.
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

