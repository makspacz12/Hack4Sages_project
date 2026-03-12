"""
Compatibility exports for historical imports from `catalogs`.

Canonical rock definitions now live in `microbe_radiation_model.materials.rocks`.
"""

from ..materials.rocks import DEFAULT_ROCK_VARIANTS, Rock

# Backward-compatible alias used by older code/docs.
RockVariant = Rock

__all__ = ["DEFAULT_ROCK_VARIANTS", "RockVariant"]
