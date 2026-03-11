"""
Backward-compatible alias for the canonical rock dataclass.

Canonical type is `microbe_radiation_model.materials.rocks.Rock`.
"""

from ..materials.rocks.types import Rock as RockVariant

__all__ = ["RockVariant"]
