"""
Zgodnościowy dostęp do modelu ekranowania z katalogu ``radiation``.
"""

from .radiation.shielding_model import (
    RadiationPointResult,
    attenuation_factor,
    radiation_at_point_in_rock_with_bio_core,
    radiation_at_points_in_rock_with_bio_core,
)

__all__ = [
    "RadiationPointResult",
    "attenuation_factor",
    "radiation_at_point_in_rock_with_bio_core",
    "radiation_at_points_in_rock_with_bio_core",
]
