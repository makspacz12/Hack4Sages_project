"""
stellar_physics.py

This file implements basic stellar physics relations for main-sequence stars.
It computes stellar luminosity from stellar mass using the mass-luminosity
relation, and serves as the first step in building the radiation environment
for the simulation.
"""

from constants import SOLAR_LUMINOSITY, SOLAR_MASS


def stellar_luminosity_from_mass(mass_kg: float) -> float:
    """
    Compute the luminosity of a main-sequence star from its mass in kilograms.

    Formula:
        L = L_sun * (M / M_sun)^3.5
    """
    if mass_kg <= 0:
        raise ValueError("Stellar mass must be positive.")

    return SOLAR_LUMINOSITY * (mass_kg / SOLAR_MASS) ** 3.5


def stellar_luminosity_from_solar_mass(mass_solar: float) -> float:
    """
    Compute the luminosity of a main-sequence star from its mass in solar masses.

    Formula:
        L = L_sun * (M_star)^3.5
    """
    if mass_solar <= 0:
        raise ValueError("Stellar mass in solar units must be positive.")

    return SOLAR_LUMINOSITY * mass_solar ** 3.5