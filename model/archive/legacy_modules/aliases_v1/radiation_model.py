"""
Compatibility access to the radiation flux model in ``radiation``.
"""

from .radiation.radiation_model import relative_flux, stellar_flux, stellar_flux_at_au

__all__ = ["relative_flux", "stellar_flux", "stellar_flux_at_au"]
