from dataclasses import dataclass
import math

from ...materials.rocks import Rock, get_rock_param

from .activity import activity_from_rock, volumetric_activity_bq_m3
from .geometry import geometry_from_rock

# Empirical coefficients: c(ppm) x f -> dose rate [Gy/year] (uncited "user table").
#
# AUDIT WARNING - these coefficients do not reproduce first-principles values.
# For basalt_vtype (U 0.15 ppm, Th 0.6 ppm, K 0.05%) they give 46.6 Gy/yr.
# Computing the same quantity from activity x decay-chain energy in an infinite
# medium (12.4 Bq/kg per ppm U x 51.7 MeV, 4.1 x 42.7 MeV, 313 Bq/kg per %K x
# 0.6 MeV) gives 1.07e-3 Gy/yr - a factor of ~4.4e4 lower. Across the rock
# catalog the discrepancy ranges from 4.4e4x to 6.2e5x, and the K-40 term alone
# supplies 99.8% of the inflated total.
#
# Do not treat the absolute Gy/year values as physical until these are re-derived
# or a source is attached. See the repository audit notes.
_GAMMA_DOSE_COEFF_K40_PPM = 0.093   # Potassium 40K, c(ppm) x 0.093
_GAMMA_DOSE_COEFF_TH232_PPM = 0.084  # Thorium 232Th, c(ppm) x 0.084
_GAMMA_DOSE_COEFF_U238_PPM = 0.300   # Uranium 238U, c(ppm) x 0.300
_GAMMA_DOSE_COEFF_U235_PPM = 1.81    # Uranium 235U, c(ppm) x 1.81
_POTASSIUM_PERCENT_TO_PPM = 10000.0  # 1% = 10^4 ppm by mass


@dataclass(frozen=True)
class InternalGammaField:
    """
    Simplified internal gamma field at the rock center.
    """

    specific_activity_bq_kg: float
    volumetric_activity_bq_m3: float
    radius_m: float
    gamma_mu_inv_m: float
    internal_gamma_rate: float


def internal_gamma_rate_from_rock(
    rock: Rock,
    mass_kg: float | None = None,
    radius_m: float | None = None,
    density_kg_m3: float | None = None,
    gamma_mu_inv_m: float = 1.0,
    mass_hook=None,
    radius_hook=None,
    density_hook=None,
) -> InternalGammaField:
    """
    Compute a simplified internal gamma field at the center of
    a homogeneous radioactive sphere.

    The model uses:
        gamma_rate ~ A_v * (1 - exp(-mu * R)) / mu
    """

    if gamma_mu_inv_m <= 0.0:
        raise ValueError("gamma_mu_inv_m must be positive.")

    resolved_density = get_rock_param(
        rock,
        "density_kg_m3",
        value=density_kg_m3,
        hook=density_hook,
        required=True,
    )

    if radius_m is None:
        resolved_radius = get_rock_param(
            rock,
            "radius_m",
            value=None,
            hook=radius_hook,
            default=None,
        )

        if resolved_radius is None:
            geometry = geometry_from_rock(
                rock,
                mass_kg=mass_kg,
                density_kg_m3=resolved_density,
                mass_hook=mass_hook,
                density_hook=density_hook,
            )
            resolved_radius = geometry.radius_m
    else:
        resolved_radius = radius_m

    activity = activity_from_rock(rock)

    activity_bq_m3 = volumetric_activity_bq_m3(
        rock,
        total_bq_kg=activity.total_bq_kg,
        density_kg_m3=resolved_density,
        density_hook=density_hook,
    )

    gamma_rate = (
        activity_bq_m3
        * (1.0 - math.exp(-gamma_mu_inv_m * resolved_radius))
        / gamma_mu_inv_m
    )

    return InternalGammaField(
        specific_activity_bq_kg=activity.total_bq_kg,
        volumetric_activity_bq_m3=activity_bq_m3,
        radius_m=resolved_radius,
        gamma_mu_inv_m=gamma_mu_inv_m,
        internal_gamma_rate=gamma_rate,
    )


def radiation_decay_gy_per_year_from_rock(
    rock: Rock,
    uranium238_ppm: float | None = None,
    uranium235_ppm: float | None = None,
    thorium232_ppm: float | None = None,
    potassium_percent: float | None = None,
    uranium238_hook=None,
    uranium235_hook=None,
    thorium_hook=None,
    potassium_hook=None,
) -> float:
    """
    Empirical gamma dose rate from U, Th, K in rock [Gy/year].

    Formula: sum of c(ppm)×f for each radionuclide:
      - 40K:   c(ppm)×0.093  (K from rock: potassium_percent converted to ppm)
      - 232Th: c(ppm)×0.084
      - 238U:  c(ppm)×0.300
      - 235U:  c(ppm)×1.81   (optional; if not on Rock, 0)
    """
    c_u238 = get_rock_param(
        rock, "uranium238_ppm",
        value=uranium238_ppm, hook=uranium238_hook, default=0.0,
    )
    c_u235 = get_rock_param(
        rock, "uranium235_ppm",
        value=uranium235_ppm, hook=uranium235_hook, default=0.0,
    )
    c_th = get_rock_param(
        rock, "thorium232_ppm",
        value=thorium232_ppm, hook=thorium_hook, default=0.0,
    )
    k_pct = get_rock_param(
        rock, "potassium_percent",
        value=potassium_percent, hook=potassium_hook, default=0.0,
    )
    k_ppm = k_pct * _POTASSIUM_PERCENT_TO_PPM
    return (
        (k_ppm * _GAMMA_DOSE_COEFF_K40_PPM)
        + (c_th * _GAMMA_DOSE_COEFF_TH232_PPM)
        + (c_u238 * _GAMMA_DOSE_COEFF_U238_PPM)
        + (c_u235 * _GAMMA_DOSE_COEFF_U235_PPM)
    )
