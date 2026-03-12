"""
Unified material models used across the project.

This package currently exposes rock presets and helpers from `materials.rocks`.
"""

from .rocks import (
    BASALT,
    CHONDRITE,
    DEFAULT_ROCK_VARIANTS,
    ICE_RICH,
    Rock,
    RockHook,
    get_rock_by_name,
    get_rock_param,
    normalize_probabilities,
    with_rock_overrides,
)

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
