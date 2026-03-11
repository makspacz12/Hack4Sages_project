"""
radiation_model.py

This file computes the radiation flux produced by a star at a given distance.
It converts stellar luminosity into local irradiance using the inverse-square law,
providing the bridge between stellar properties and particle radiation exposure.
"""

import math
from constants import AU


def stellar_flux(luminosity_w: float, distance_m: float) -> float:
    """
    Compute radiation flux at distance r from a star.

    Formula:
        F = L / (4 * pi * r^2)
    """
    if luminosity_w <= 0:
        raise ValueError("Luminosity must be positive.")
    if distance_m <= 0:
        raise ValueError("Distance must be positive.")

    return luminosity_w / (4.0 * math.pi * distance_m ** 2)


def stellar_flux_at_au(luminosity_w: float, distance_au: float) -> float:
    """
    Compute radiation flux at distance given in astronomical units.
    """
    if distance_au <= 0:
        raise ValueError("Distance in AU must be positive.")

    distance_m = distance_au * AU
    return stellar_flux(luminosity_w, distance_m)


def relative_flux(distance_au: float, reference_distance_au: float = 1.0) -> float:
    """
    Compute relative flux scaling using the inverse-square law.

    Formula:
        I(r) = (r_ref / r)^2
    """
    if distance_au <= 0:
        raise ValueError("Distance must be positive.")
    if reference_distance_au <= 0:
        raise ValueError("Reference distance must be positive.")

    return (reference_distance_au / distance_au) ** 2