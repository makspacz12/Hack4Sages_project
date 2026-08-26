"""
Compatibility module redirecting to the ``legacy_modules`` package.
"""

from ..attenuation_k import *  # noqa: F401,F403  (historical alias)

__all__ = ["legacy_attenuation_k"]
