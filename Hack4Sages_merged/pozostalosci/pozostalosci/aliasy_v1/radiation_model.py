"""
Zgodnościowy dostęp do modelu strumienia promieniowania z katalogu ``radiation``.
"""

from .radiation.radiation_model import relative_flux, stellar_flux, stellar_flux_at_au

__all__ = ["relative_flux", "stellar_flux", "stellar_flux_at_au"]
