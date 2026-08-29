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

# Radial scale over which solar modulation relaxes towards the interstellar
# level [AU].
#
# Cosmic rays entering the heliosphere are swept outward and scattered by the
# magnetised solar wind, so their intensity RISES with heliocentric distance;
# this is solar modulation, described to first order by the force-field
# approximation of Gleeson & Axford (1968), ApJ 154:1011. Spacecraft in the
# outer heliosphere measure a positive radial intensity gradient of order a few
# percent per AU in the inner heliosphere, flattening further out.
#
# 10 AU reproduces roughly 3%/AU at 1 AU and saturates smoothly, which is the
# behaviour the measurements show. It is a shape parameter fitted to that
# behaviour, not a measured constant, and it is exposed so a run can vary it.
GCR_MODULATION_SCALE_AU = 10.0


def solar_modulation_factor(
    distance_au: float,
    deep_space_multiplier: float = COSMIC_DEEP_SPACE_MULTIPLIER,
    scale_au: float = GCR_MODULATION_SCALE_AU,
) -> float:
    """
    Cosmic-ray intensity relative to 1 AU, as a function of heliocentric distance.

    This function is why a fragment's trajectory matters at all.

    The model previously returned a flat constant everywhere inside the
    heliosphere and stepped up beyond it. Since no fragment in a run of
    reasonable length ever crosses 120 AU, the galactic cosmic-ray dose rate was
    the same number for every fragment at every instant, and accumulated dose
    depended only on fragment size, composition and elapsed time. The entire
    N-body integration - ejection speed, orbit, planetary encounters - could not
    reach the biology. Ejection speeds of 8 and 40 km/s produced bit-identical
    survival.

    The replacement is a monotonic rise towards the interstellar level:

        f(r) = M - (M - 1) * exp(-(r - 1) / L)

    which is 1 at 1 AU by construction, approaches the interstellar multiplier M
    asymptotically rather than by a discontinuity, and has a local gradient of
    (M - 1)/L per AU at 1 AU - about 3% per AU for the shipped values.

    Amplitude is inherited, shape is new. M keeps the project's existing
    calibration of the interstellar-to-1-AU ratio; what changes is that the
    transition is now radial and smooth instead of a step at 120 AU. So this
    couples transport to dose without silently restating the dose scale.
    """
    if distance_au < 0:
        raise ValueError("distance_au must be >= 0")
    if scale_au <= 0:
        raise ValueError("scale_au must be positive")

    # Inside 1 AU the modulation saturates rather than reversing: extrapolating
    # the exponential inward would drive the flux towards zero at the Sun,
    # which is not what the measurements show.
    reduced = max(0.0, distance_au - 1.0)
    return deep_space_multiplier - (deep_space_multiplier - 1.0) * math.exp(
        -reduced / scale_au
    )


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
        # Modulated, not flat: intensity rises with distance inside the
        # heliosphere. See solar_modulation_factor.
        return base_flux * solar_modulation_factor(
            distance_au, deep_space_multiplier=deep_space_multiplier,
        )

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
        # Scale the modulation length with the heliosphere, so a smaller star's
        # modulation region is correspondingly smaller.
        return base_flux * solar_modulation_factor(
            distance_au,
            deep_space_multiplier=deep_space_multiplier,
            scale_au=GCR_MODULATION_SCALE_AU
            * max(1e-3, r_helio_au / DEFAULT_HELIOSPHERE_RADIUS_AU),
        )
    if distance_au >= r_transition_au:
        return base_flux * deep_space_multiplier

    # Ramp from wherever the modulated interior actually ends, not from 1.0.
    #
    # This ramp was written against a flat interior. Once the interior became
    # modulated it already reached almost the interstellar value by the
    # heliopause, so restarting the ramp at 1.0 made the flux DROP by about 23%
    # exactly at the boundary - a fragment crossing outward would have seen its
    # dose rate fall on leaving the heliosphere, which is backwards.
    edge_factor = solar_modulation_factor(
        r_helio_au,
        deep_space_multiplier=deep_space_multiplier,
        scale_au=GCR_MODULATION_SCALE_AU
        * max(1e-3, r_helio_au / DEFAULT_HELIOSPHERE_RADIUS_AU),
    )
    t = (distance_au - r_helio_au) / (r_transition_au - r_helio_au)
    factor = edge_factor + (deep_space_multiplier - edge_factor) * t
    return base_flux * factor