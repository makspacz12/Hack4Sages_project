"""
Zgodnościowy punkt wejścia do budowy symulacji REBOUND.

Właściwa implementacja mieszka teraz w katalogu ``simulation``.
"""

from .simulation.builder import _ra_dec_distance_to_xyz_au, build_simulation

__all__ = ["_ra_dec_distance_to_xyz_au", "build_simulation"]
