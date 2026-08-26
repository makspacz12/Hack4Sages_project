"""
Obliczenia strumienia promieniowania gwiazdowego.

This module converts stellar luminosity into a local radiation intensity using
the inverse-square law.
"""

import math

from ...physics.constants import AU


def stellar_flux(luminosity_w: float, distance_m: float) -> float:
    """
    Compute the radiation flux at distance ``distance_m`` from the star.
    """
    if luminosity_w <= 0:
        raise ValueError("Luminosity must be positive.")
    if distance_m <= 0:
        raise ValueError("Distance must be positive.")

    return luminosity_w / (4.0 * math.pi * distance_m ** 2)


def stellar_flux_at_au(luminosity_w: float, distance_au: float) -> float:
    """
    Compute the radiation flux for a distance given in AU.
    """
    if distance_au <= 0:
        raise ValueError("Distance in AU must be positive.")

    distance_m = distance_au * AU
    return stellar_flux(luminosity_w, distance_m)


def relative_flux(distance_au: float, reference_distance_au: float = 1.0) -> float:
    """
    Return the flux scaling relative to a reference distance.
    """
    if distance_au <= 0:
        raise ValueError("Distance must be positive.")
    if reference_distance_au <= 0:
        raise ValueError("Reference distance must be positive.")

    return (reference_distance_au / distance_au) ** 2
