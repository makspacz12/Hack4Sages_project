"""
Reference implementation of the microbial survival function.

This is the original working version from the analysis branch. The canonical
implementation used by the simulation lives in
``model/microbe_radiation_model/biology/survival.py``; keep that one in sync
with this file, not the other way round.

Two things were corrected when this file was merged into the main tree, both
recorded here so the change is not silently lost:

1. The original line was missing a closing parenthesis and had no ``import
   math``, so the module raised ``SyntaxError`` on import and had never been
   executed as written.
2. The misplaced parenthesis also multiplied only the hydrolysis term by ``t``.
   The docstring - and the package implementation - apply ``t`` to the sum of
   both kill channels. The docstring version is used below.

Note that this reference version takes ``hDNA`` in the same time unit as ``t``.
The package version takes it in 1/s and converts with ``SECONDS_PER_YEAR``,
which is the behaviour you want when feeding it from the chemistry module.
"""

import math


def survival_function(radiation_space, radiation_decay, radiation_surv_coeff, t, hDNA):
    """
    Compute the fraction of surviving microbes.

        N/N0 = exp(- (kill_radiation + kill_hydrolysis) * t)
             = exp(- (radiation_surv_coeff * dose_rate
                      + reaction_rate_hydrolysis * hydrolysis_surv_coeff) * t)

    Parameters
    ----------
    radiation_space : float
        Dose rate received from space [Gy/year].
    radiation_decay : float
        Dose rate received from internal radioactive decay [Gy/year].
    radiation_surv_coeff : float
        How strongly radiation affects the microbes [1/Gy]. Mileikowsky et al.
        (2000) D10 slopes converted via ``(a_per_kGy/1000)*ln(10)`` give roughly
        ``3.6e-4 … 1.0e-3``; see this directory's README.
    t : float
        Time since meteorite launch [years].
    hDNA : float
        Rate of DNA hydrolysis, in the same time unit as ``t``.

    Returns
    -------
    float
        N/N0 - the proportion of the original microbe population surviving.
    """
    # AUDIT: no cited source for 1.2/0.001 — keep in sync with biology.constants.
    hydrolysis_surv_coeff = 1.2 / 0.001
    dose_rate = radiation_space + radiation_decay

    kill_radiation = radiation_surv_coeff * dose_rate
    kill_hydrolysis = hDNA * hydrolysis_surv_coeff

    return math.exp(-(kill_radiation + kill_hydrolysis) * t)
