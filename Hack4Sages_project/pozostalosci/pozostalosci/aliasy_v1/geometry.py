"""
Zgodnościowy dostęp do geometrii z katalogu ``physics``.
"""

from .physics.geometry import (
    biological_core_radius,
    radius_from_mass_and_density,
    sphere_mass,
    sphere_volume,
)

__all__ = [
    "biological_core_radius",
    "radius_from_mass_and_density",
    "sphere_mass",
    "sphere_volume",
]
