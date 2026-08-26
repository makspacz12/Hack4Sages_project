"""
Basic physical relations for main-sequence stars.

For now the module converts stellar mass to luminosity, the first stage of
building the radiation environment.
"""

from .constants import SOLAR_LUMINOSITY, SOLAR_MASS


def stellar_luminosity_from_mass(mass_kg: float) -> float:
    """
    Compute main-sequence stellar luminosity from a mass given in kilograms.
    """
    if mass_kg <= 0:
        raise ValueError("Stellar mass must be positive.")

    return SOLAR_LUMINOSITY * (mass_kg / SOLAR_MASS) ** 3.5


def stellar_luminosity_from_solar_mass(mass_solar: float) -> float:
    """
    Compute main-sequence stellar luminosity from a mass given in solar masses.
    """
    if mass_solar <= 0:
        raise ValueError("Stellar mass in solar units must be positive.")

    return SOLAR_LUMINOSITY * mass_solar ** 3.5
