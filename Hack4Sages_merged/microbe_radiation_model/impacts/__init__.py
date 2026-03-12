"""
Impact and ejecta generation models.
"""

from .mars_impact import create_mars_impact
from .types import GeneratedAsteroid, ImpactEjectaConfig, ImpactResult

__all__ = [
    "GeneratedAsteroid",
    "ImpactEjectaConfig",
    "ImpactResult",
    "create_mars_impact",
]
