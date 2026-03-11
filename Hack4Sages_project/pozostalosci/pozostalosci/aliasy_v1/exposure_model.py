"""
Zgodnościowy dostęp do modelu ekspozycji z katalogu ``radiation``.
"""

from .radiation.exposure_model import ExposureState, update_exposure

__all__ = ["ExposureState", "update_exposure"]
