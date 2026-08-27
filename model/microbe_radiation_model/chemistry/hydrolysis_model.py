"""
Hydrolysis model for microbe-carrying rock material.
"""

from __future__ import annotations

import math

from .constants import (
    GAS_CONSTANT_J_MOL_K,
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

    from ..run_overrides import effective_hydrolysis_a_s_inv, effective_hydrolysis_ea_j_mol

    k_hyd = (
        effective_hydrolysis_a_s_inv()
        * math.exp(-effective_hydrolysis_ea_j_mol() / (GAS_CONSTANT_J_MOL_K * temperature_k))
        * water_mass_fraction
    )
    return k_hyd