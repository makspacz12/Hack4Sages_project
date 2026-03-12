"""
Zgodnościowy dostęp do fizyki gwiazd z katalogu ``physics``.
"""

from .physics.stellar_physics import stellar_luminosity_from_mass, stellar_luminosity_from_solar_mass

__all__ = ["stellar_luminosity_from_mass", "stellar_luminosity_from_solar_mass"]
