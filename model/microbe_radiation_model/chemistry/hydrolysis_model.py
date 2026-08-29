"""
Hydrolysis model for microbe-carrying rock material.
"""

from __future__ import annotations

import math

from .constants import (
    FREEZING_TEMPERATURE_K,
    GAS_CONSTANT_J_MOL_K,
)

# Enthalpy of fusion of water at the melting point [J/mol].
#
# Used to compute how much liquid-water activity survives below freezing. The
# standard value; CODATA and every physical-chemistry table agree on 6.01 kJ/mol.
ENTHALPY_OF_FUSION_J_MOL = 6008.0


def water_activity(temperature_k: float) -> float:
    """
    Activity of liquid water below freezing, relative to the pure liquid.

    Water in a frozen matrix is not simply absent. Unfrozen films persist on
    mineral surfaces, and their activity follows from equilibrium with ice:

        ln(a_w) = -(dH_fus / R) * (1/T - 1/T_melt)

    which gives 1.0 at the melting point and falls smoothly below it - about
    0.81 at 253 K, matching the measured freezing-point-depression curve.

    This replaces a hard cut to zero at 273.15 K. That cut was both redundant
    and wrong. Redundant because the Arrhenius factor already suppresses the
    rate by itself: at 200 K it is exp(-78), thirty-four orders of magnitude
    below the value at room temperature. Wrong because a step discontinuity in
    a rate is not physics, and because it made the whole hydrolysis channel
    identically zero everywhere in interplanetary space - so `--no-thermal`
    changed nothing, the sensitivity analysis reported a gradient of exactly
    zero for two knobs, and the one coefficient the audit still lists as
    uncited was multiplied by zero in every run.

    The channel is now real and continuous. It remains negligible at these
    temperatures, but that is a computed result rather than an assumption.
    """
    if temperature_k <= 0.0:
        return 0.0
    if temperature_k >= FREEZING_TEMPERATURE_K:
        return 1.0
    exponent = -(ENTHALPY_OF_FUSION_J_MOL / GAS_CONSTANT_J_MOL_K) * (
        1.0 / temperature_k - 1.0 / FREEZING_TEMPERATURE_K
    )
    return math.exp(exponent)


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

    if temperature_k <= 0.0:
        return 0.0

    from ..run_overrides import effective_hydrolysis_a_s_inv, effective_hydrolysis_ea_j_mol

    k_hyd = (
        effective_hydrolysis_a_s_inv()
        * math.exp(-effective_hydrolysis_ea_j_mol() / (GAS_CONSTANT_J_MOL_K * temperature_k))
        * water_activity(temperature_k)
        * water_mass_fraction
    )
    return k_hyd
