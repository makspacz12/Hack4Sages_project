"""
Galactic cosmic radiation (GCR) model.

This module provides a simplified model of the cosmic ray background acting
on objects in space.

The model distinguishes two regions:

1. Inside the star's heliosphere
   - cosmic radiation is partly suppressed by the stellar wind

2. Interstellar space
   - no heliospheric shielding
   - higher GCR level
"""

from __future__ import annotations

import math

from ...physics.constants import SOLAR_LUMINOSITY

COSMIC_BACKGROUND_FLUX = 1.0
COSMIC_DEEP_SPACE_MULTIPLIER = 1.3

DEFAULT_HELIOSPHERE_RADIUS_AU = 120.0


def cosmic_background_flux(base_flux: float = COSMIC_BACKGROUND_FLUX) -> float:
    """
    Return the base galactic cosmic ray flux.

    Parameters
    ----------
    base_flux : float
        Base cosmic ray flux.

    Returns
    -------
    float
        Cosmic ray flux.
    """

    if base_flux < 0:
        raise ValueError("base_flux must be >= 0")

    return base_flux


def cosmic_flux_by_region(
    distance_au: float,
    base_flux: float = COSMIC_BACKGROUND_FLUX,
    heliosphere_radius_au: float = DEFAULT_HELIOSPHERE_RADIUS_AU,
    deep_space_multiplier: float = COSMIC_DEEP_SPACE_MULTIPLIER,
) -> float:
    """
    Return the cosmic ray flux as a function of the region of space.

    Parameters
    ----------
    distance_au : float
        Distance from the star [AU]
    base_flux : float
        Base GCR flux inside the heliosphere
    heliosphere_radius_au : float
        Heliosphere radius of the star
    deep_space_multiplier : float
        GCR increase outside the heliosphere

    Returns
    -------
    float
        Cosmic ray flux
    """

    if distance_au < 0:
        raise ValueError("distance_au must be >= 0")

    if distance_au <= heliosphere_radius_au:
        return base_flux

    return base_flux * deep_space_multiplier


def cosmic_flux_by_star(
    distance_au: float,
    luminosity_w: float,
    base_flux: float = COSMIC_BACKGROUND_FLUX,
    deep_space_multiplier: float = COSMIC_DEEP_SPACE_MULTIPLIER,
    transition_width_factor: float = 1.0,
) -> float:
    """
    Return the GCR flux accounting for the heliosphere size of a specific star.

    Assumptions:
    - the heliosphere radius scales with stellar luminosity as sqrt(L_star / L_sun),
      i.e. R_helio = 120 AU * sqrt(L_star / L_sun),
    - inside R_helio the flux equals base_flux,
    - far outside (>= R_helio * (1 + transition_width_factor)) the flux is base_flux * deep_space_multiplier,
    - a simple linear ramp is applied between those zones.
    """

    if distance_au < 0:
        raise ValueError("distance_au must be >= 0")
    if luminosity_w <= 0:
        raise ValueError("luminosity_w must be > 0")
    if transition_width_factor < 0:
        raise ValueError("transition_width_factor must be >= 0")

    # Luminosity in solar units - guarded against extremely small values.
    luminosity_ratio = max(luminosity_w / SOLAR_LUMINOSITY, 1e-3)

    # Scale the heliosphere radius with luminosity.
    r_helio_au = DEFAULT_HELIOSPHERE_RADIUS_AU * math.sqrt(luminosity_ratio)
    if r_helio_au <= 0.0:
        return base_flux

    # Width of the transition zone.
    r_transition_au = r_helio_au * (1.0 + transition_width_factor)

    if distance_au <= r_helio_au:
        return base_flux
    if distance_au >= r_transition_au:
        return base_flux * deep_space_multiplier

    # Linear transition from 1.0 to deep_space_multiplier across the zone.
    t = (distance_au - r_helio_au) / (r_transition_au - r_helio_au)
    factor = 1.0 + (deep_space_multiplier - 1.0) * t
    return base_flux * factor