"""
Hydrolysis model for microbe-carrying rock material.
"""

from __future__ import annotations

import math

from .constants import (
    GAS_CONSTANT_J_MOL_K,
    HYDROLYSIS_A_S_INV,
    HYDROLYSIS_EA_J_MOL,
    FREEZING_TEMPERATURE_K,
)


def compute_hydrolysis_rate(
    temperature_k: float,
    water_mass_fraction: float,
) -> float:
    """
    Compute effective hydrolysis rate.

    Parameters
    ----------
    temperature_k : float
        Rock temperature in Kelvin.
    water_mass_fraction : float
        Water mass fraction in the rock material (0..1).

    Returns
    -------
    float
        Hydrolysis rate in 1/s.
    """

    if temperature_k < FREEZING_TEMPERATURE_K:
        return 0.0

    k_hyd = (
        HYDROLYSIS_A_S_INV
        * math.exp(-HYDROLYSIS_EA_J_MOL / (GAS_CONSTANT_J_MOL_K * temperature_k))
        * water_mass_fraction
    )
    return k_hyd