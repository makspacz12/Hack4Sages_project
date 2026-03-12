import math

from ..physics.constants import SECONDS_PER_YEAR


def survival_function(
    radiation_space_gy_per_year: float,
    radiation_decay_gy_per_year: float,
    radiation_surv_coeff: float,
    t_years: float,
    hdna_rate_per_s: float,
) -> float:
    """
    Compute fraction of surviving microbes over a time interval.

    Model:
        N/N0 = exp(- (kill_radiation + kill_hydrolysis) * t)
        N/N0 = exp(- ((radiation_surv_coeff * dose_rate)
                      + reaction_rate_hydrolysis * hydrolysis_surv_coeff) * t)

    Parameters
    ----------
    radiation_space_gy_per_year : float
        Dose rate from external space radiation [Gy/year].
    radiation_decay_gy_per_year : float
        Dose rate from internal radionuclide decay [Gy/year].
    radiation_surv_coeff : float
        How much radiation affects the microbes [arbitrary]; typically in <0.15, 0.5>.
    t_years : float
        Time interval [years] over which survival is evaluated.
    hdna_rate_per_s : float
        Rate of DNA hydrolysis [1/s].

    Returns
    -------
    float
        Proportion of original microbe population surviving after time t_years.
    """

    hydrolysis_surv_coeff = 1.2 / 0.001
    dose_rate_gy_per_year = radiation_space_gy_per_year + radiation_decay_gy_per_year

    # Convert hydrolysis rate from 1/s to 1/year for consistent units.
    hdna_per_year = hdna_rate_per_s * SECONDS_PER_YEAR

    kill_radiation_per_year = radiation_surv_coeff * dose_rate_gy_per_year
    kill_hydrolysis_per_year = hdna_per_year * hydrolysis_surv_coeff
    total_kill_rate_per_year = kill_radiation_per_year + kill_hydrolysis_per_year

    return math.exp(-total_kill_rate_per_year * t_years)

