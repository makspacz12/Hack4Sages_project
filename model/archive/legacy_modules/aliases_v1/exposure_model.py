"""
Compatibility access to the exposure model in ``radiation``.
"""

from .radiation.exposure_model import ExposureState, update_exposure

__all__ = ["ExposureState", "update_exposure"]
