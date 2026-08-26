"""
Compatibility entry point for the REBOUND-radiation coupling.
"""

from .simulation.coupling import process_radiation_step

__all__ = ["process_radiation_step"]
