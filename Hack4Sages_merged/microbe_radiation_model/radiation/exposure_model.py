"""
Śledzenie skumulowanej ekspozycji na promieniowanie w czasie.
"""

from dataclasses import dataclass


@dataclass
class ExposureState:
    """
    Stan skumulowanej ekspozycji dla jednego śledzonego ciała.
    """

    cumulative_exposure: float = 0.0


def update_exposure(state: ExposureState, local_flux: float, dt: float) -> None:
    """
    Aktualizuje skumulowaną ekspozycję na podstawie lokalnego strumienia i kroku czasu.
    """
    if dt < 0:
        raise ValueError("dt must be non-negative")
    if local_flux < 0:
        raise ValueError("local_flux must be non-negative")

    state.cumulative_exposure += local_flux * dt
