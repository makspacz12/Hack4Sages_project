"""
Podstawowe zależności fizyczne dla gwiazd ciągu głównego.

Na razie moduł przelicza masę gwiazdy na jasność, co stanowi pierwszy etap
budowy środowiska radiacyjnego.
"""

from .constants import SOLAR_LUMINOSITY, SOLAR_MASS


def stellar_luminosity_from_mass(mass_kg: float) -> float:
    """
    Oblicza jasność gwiazdy ciągu głównego na podstawie masy w kilogramach.
    """
    if mass_kg <= 0:
        raise ValueError("Stellar mass must be positive.")

    return SOLAR_LUMINOSITY * (mass_kg / SOLAR_MASS) ** 3.5


def stellar_luminosity_from_solar_mass(mass_solar: float) -> float:
    """
    Oblicza jasność gwiazdy ciągu głównego na podstawie masy w masach Słońca.
    """
    if mass_solar <= 0:
        raise ValueError("Stellar mass in solar units must be positive.")

    return SOLAR_LUMINOSITY * mass_solar ** 3.5
