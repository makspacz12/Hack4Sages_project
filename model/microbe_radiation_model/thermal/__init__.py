"""
Modules dealing with the temperature of rocks and bodies.

The `thermal` layer does NOT compute radiation from scratch - it reuses the
funkcji z `physics` i `radiation` i na ich podstawie szacuje temperatury
existing flux models to derive equilibrium temperatures and related quantities.
"""

from .surface_temperature import (
    STEFAN_BOLTZMANN_W_M2_K4,
    equilibrium_temperature_from_flux,
    equilibrium_temperature_from_star,
)
from .internal_profile import (
    temperature_inside_sphere,
    temperature_profile_surface_mid_center,
)

__all__ = [
    "STEFAN_BOLTZMANN_W_M2_K4",
    "equilibrium_temperature_from_flux",
    "equilibrium_temperature_from_star",
    "temperature_inside_sphere",
    "temperature_profile_surface_mid_center",
]

