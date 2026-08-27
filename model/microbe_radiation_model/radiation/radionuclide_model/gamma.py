from dataclasses import dataclass
import math

from ...materials.rocks import Rock, get_rock_param

from .activity import activity_from_rock, volumetric_activity_bq_m3
from .geometry import geometry_from_rock

# Dose-rate conversion factors for U, Th and K, from
#
#   Cresswell, Carter & Sanderson (2018), "Dose rate conversion parameters:
#   Assessment of nuclear data", Radiation Measurements 120:195-201,
#   doi:10.1016/j.radmeas.2018.02.007, Table 5.
#
# These replace an uncited "user table" that was flagged in this file's own audit
# note. Those coefficients overstated the dose by a factor of 4e4 to 6e5 across
# the rock catalog, with the potassium term alone supplying 99.8% of the inflated
# total. The published values below reproduce the independent first-principles
# estimate that the audit note computed, so the discrepancy is resolved rather
# than merely re-labelled.
#
# The factors are INFINITE-MATRIX values: they already give the dose absorbed
# inside the rock, which is the quantity this model wants. They are not "dose in
# air 1 m above the ground", which is the other convention in this literature and
# a common way to be wrong by a large factor.
#
# The uranium column covers natural uranium - 238U and 235U together at the
# natural isotopic ratio - so there is no separate 235U term to add. The old code
# had one, which would have double-counted had any catalog entry ever set it.
#
# Units: Gy/year per ppm for U and Th, Gy/year per weight-% for K.
GAMMA_DOSE_PER_PPM_U = 1.12e-4
GAMMA_DOSE_PER_PPM_TH = 4.89e-5
GAMMA_DOSE_PER_PERCENT_K = 2.48e-4

# Alpha and beta from the same table. They matter here because the microbes are
# embedded in the rock matrix rather than sitting in a cavity, so they absorb the
# short-range radiation too - and it dominates: alpha alone is roughly 25x the
# gamma contribution for uranium.
ALPHA_DOSE_PER_PPM_U = 2.79e-3
ALPHA_DOSE_PER_PPM_TH = 7.38e-4
BETA_DOSE_PER_PPM_U = 1.42e-4
BETA_DOSE_PER_PPM_TH = 2.80e-5
BETA_DOSE_PER_PERCENT_K = 8.54e-4

# Effective mass attenuation coefficient for the U/Th/K gamma spectrum in
# silicate rock, including build-up from Compton scattering [cm^2/g].
#
# Calibrated so that the saturation curve below reaches 99% of the infinite-
# matrix value at 60 g/cm^2, which is where Riedesel & Autzen (2020),
# Radiation Measurements 133:106295, place saturation in their Geant4
# simulations. This is the quantitative form of the "30 cm rule" from Aitken's
# luminescence-dating texts.
GAMMA_MASS_ATTENUATION_CM2_G = 0.077

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


def gamma_self_dose_fraction(radius_m: float, density_kg_m3: float) -> float:
    """
    Fraction of the infinite-matrix gamma dose actually reached at the centre of
    a sphere of this size.

    A small rock loses gamma dose out of its own surface. Integrating an
    unattenuated point-source kernel over a uniformly radioactive sphere gives
    the closed form exactly:

        D(R) / D_inf = 1 - exp(-(mu/rho) * rho * R)

    so the answer saturates rather than growing without bound. For basalt at
    3000 kg/m^3 that is 50% of the infinite-matrix dose at ~3 cm radius, 90% at
    ~10 cm and 99% at ~20 cm; above that the dose stops depending on size at all.

    This is the centre, which is the maximum. At the surface the fraction falls
    towards a half, because only a hemisphere of rock is contributing.
    """
    if radius_m <= 0.0:
        return 0.0
    if density_kg_m3 <= 0.0:
        raise ValueError("density_kg_m3 must be positive")
    # cm^2/g * g/cm^3 * cm, all three converted from SI at once.
    mass_depth_g_cm2 = (density_kg_m3 * 0.001) * (radius_m * 100.0)
    return 1.0 - math.exp(-GAMMA_MASS_ATTENUATION_CM2_G * mass_depth_g_cm2)


def radiation_decay_gy_per_year_from_rock(
    rock: Rock,
    radius_m: float | None = None,
    density_kg_m3: float | None = None,
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
    Internal dose rate absorbed inside the rock from its own U, Th and K
    [Gy/year].

    This is the total of alpha, beta and gamma, not gamma alone, because the
    microbes are embedded in the mineral matrix rather than sitting in a void.
    Alpha and beta are short-ranged and dominate: for uranium the alpha term is
    about twenty-five times the gamma term.

    Pass `radius_m` and `density_kg_m3` to apply the finite-size correction to
    the gamma component. Without them the infinite-matrix value is returned,
    which is an upper bound.

    Conversion factors: Cresswell, Carter & Sanderson (2018), Table 5.
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
    # Natural uranium is one column in the source table; adding a separate 235U
    # term on top of it would count the same decay chain twice.
    c_u = c_u238 + c_u235

    # Alpha and beta stop within millimetres of where they are emitted, so a
    # rock of any interesting size is already an infinite matrix for them and no
    # geometry correction applies. Gamma is the only component that leaks out.
    alpha = ALPHA_DOSE_PER_PPM_U * c_u + ALPHA_DOSE_PER_PPM_TH * c_th
    beta = (
        BETA_DOSE_PER_PPM_U * c_u
        + BETA_DOSE_PER_PPM_TH * c_th
        + BETA_DOSE_PER_PERCENT_K * k_pct
    )
    gamma_infinite = (
        GAMMA_DOSE_PER_PPM_U * c_u
        + GAMMA_DOSE_PER_PPM_TH * c_th
        + GAMMA_DOSE_PER_PERCENT_K * k_pct
    )

    if radius_m is None or density_kg_m3 is None:
        # No geometry supplied: report the infinite-matrix value, which is the
        # upper bound and the conventional figure to quote.
        return alpha + beta + gamma_infinite

    return alpha + beta + gamma_infinite * gamma_self_dose_fraction(
        radius_m, density_kg_m3
    )
