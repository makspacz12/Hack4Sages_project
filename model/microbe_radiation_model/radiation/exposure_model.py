"""
Tracking of cumulative radiation exposure over time.
"""

from dataclasses import dataclass


@dataclass
class ExposureState:
    """
    Cumulative exposure state for a single tracked body.
    """

    cumulative_exposure: float = 0.0


def update_exposure(state: ExposureState, local_flux: float, dt: float) -> None:
    """
    Update the cumulative exposure from the local flux and the time step.
    """
    if dt < 0:
        raise ValueError("dt must be non-negative")
    if local_flux < 0:
        raise ValueError("local_flux must be non-negative")

    state.cumulative_exposure += local_flux * dt
