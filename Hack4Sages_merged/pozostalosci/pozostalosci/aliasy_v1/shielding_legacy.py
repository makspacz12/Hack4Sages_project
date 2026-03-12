"""
Zgodnościowy dostęp do starszego modelu ekranowania z katalogu ``pozostalosci``.
"""

from .pozostalosci.shielding_legacy import radiation_at_points_in_sphere

__all__ = ["radiation_at_points_in_sphere"]
