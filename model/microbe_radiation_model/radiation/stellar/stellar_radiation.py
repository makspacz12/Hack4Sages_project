"""
Backward-compatible facade for stellar radiation helpers.

Canonical implementation is in ``radiation/stellar/radiation_model.py``.
"""

from .radiation_model import relative_flux, stellar_flux, stellar_flux_at_au

__all__ = [
    "relative_flux",
    "stellar_flux",
    "stellar_flux_at_au",
]
