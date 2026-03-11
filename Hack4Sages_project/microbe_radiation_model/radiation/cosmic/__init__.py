"""
Models for galactic cosmic radiation (GCR).
"""

from .cosmic_radiation_model import (
    COSMIC_BACKGROUND_FLUX,
    COSMIC_DEEP_SPACE_MULTIPLIER,
    DEFAULT_HELIOSPHERE_RADIUS_AU,
    cosmic_background_flux,
    cosmic_flux_by_region,
)
from .cosmic_spectrum import (
    ALPHA_FRACTION,
    HZE_FRACTION,
    PROTON_FRACTION,
    CosmicRaySpectrum,
    split_cosmic_flux,
)

__all__ = [
    "ALPHA_FRACTION",
    "COSMIC_BACKGROUND_FLUX",
    "COSMIC_DEEP_SPACE_MULTIPLIER",
    "DEFAULT_HELIOSPHERE_RADIUS_AU",
    "HZE_FRACTION",
    "PROTON_FRACTION",
    "CosmicRaySpectrum",
    "cosmic_background_flux",
    "cosmic_flux_by_region",
    "split_cosmic_flux",
]
