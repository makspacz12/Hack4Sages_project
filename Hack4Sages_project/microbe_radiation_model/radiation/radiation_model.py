"""
Backward-compatible access to stellar radiation flux helpers.

Canonical implementation now lives in ``radiation/stellar/radiation_model.py``.
"""

from .stellar.radiation_model import relative_flux, stellar_flux, stellar_flux_at_au

__all__ = [
    "relative_flux",
    "stellar_flux",
    "stellar_flux_at_au",
]
