"""
Rock model primitives and presets.

This is the canonical place for rock definitions used by simulation,
radiation/radionuclide modules and internal heat calculations.
"""

from .params import RockHook, get_rock_param, with_rock_overrides
from .types import Rock
from .utils import get_rock_by_name, normalize_probabilities
from .variants import BASALT, CHONDRITE, DEFAULT_ROCK_VARIANTS, ICE_RICH

__all__ = [
    "BASALT",
    "CHONDRITE",
    "DEFAULT_ROCK_VARIANTS",
    "ICE_RICH",
    "Rock",
    "RockHook",
    "get_rock_by_name",
    "get_rock_param",
    "normalize_probabilities",
    "with_rock_overrides",
]
