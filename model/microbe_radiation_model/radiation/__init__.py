"""
Public API for radiation models used across the merged project.
"""

from .cosmic import (
    COSMIC_DEEP_SPACE_MULTIPLIER,
    DEFAULT_HELIOSPHERE_RADIUS_AU,
    CosmicRaySpectrum,
    cosmic_background_flux,
    cosmic_flux_by_region,
    cosmic_flux_by_star,
    split_cosmic_flux,
)
from .exposure_model import ExposureState, update_exposure
from .shielding_model import (
    RadiationPointResult,
    attenuation_factor,
    radiation_at_point_in_rock_with_bio_core,
    radiation_at_points_in_rock_with_bio_core,
)
from .stellar import relative_flux, stellar_flux, stellar_flux_at_au

__all__ = [
    "COSMIC_DEEP_SPACE_MULTIPLIER",
    "DEFAULT_HELIOSPHERE_RADIUS_AU",
    "CosmicRaySpectrum",
    "ExposureState",
    "RadiationPointResult",
    "attenuation_factor",
    "cosmic_background_flux",
    "cosmic_flux_by_region",
    "cosmic_flux_by_star",
    "radiation_at_point_in_rock_with_bio_core",
    "radiation_at_points_in_rock_with_bio_core",
    "relative_flux",
    "split_cosmic_flux",
    "stellar_flux",
    "stellar_flux_at_au",
    "update_exposure",
]

try:
    from .pressure import (
        beta_for_particles,
        compute_beta_single_star,
        nearest_star_for_particle,
        nearest_star_for_position,
        q_pr_from_albedo,
        radiation_pressure_accel_nearest_star,
    )

    __all__.extend(
        [
            "beta_for_particles",
            "compute_beta_single_star",
            "nearest_star_for_particle",
            "nearest_star_for_position",
            "q_pr_from_albedo",
            "radiation_pressure_accel_nearest_star",
        ]
    )
except ImportError:
    pass
