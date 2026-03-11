"""
Zgodnościowy punkt wejścia do sprzężenia REBOUND z modelem promieniowania.
"""

from .simulation.coupling import process_radiation_step

__all__ = ["process_radiation_step"]
