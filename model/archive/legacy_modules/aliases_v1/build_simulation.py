"""
Compatibility entry point for building the REBOUND simulation.

The real implementation now lives in the ``simulation`` package.
"""

from .simulation.builder import _ra_dec_distance_to_xyz_au, build_simulation

__all__ = ["_ra_dec_distance_to_xyz_au", "build_simulation"]
