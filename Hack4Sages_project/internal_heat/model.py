from dataclasses import dataclass
import math

from materials.rocks import Rock, get_rock_param

from .constants import (
    K_HEAT_COEFF_MICRO_W_PER_KG_PER_MASS_FRACTION,
    TH232_HEAT_COEFF_MICRO_W_PER_KG_PER_MASS_FRACTION,
    U238_HEAT_COEFF_MICRO_W_PER_KG_PER_MASS_FRACTION,
)


@dataclass(frozen=True)
class HeatProductionCoefficients:
    """
    Empirical radiogenic heat coefficients.

    Units:
        microW / kg / mass_fraction
    """

    u238_micro_w_kg_per_mass_fraction: float
    th232_micro_w_kg_per_mass_fraction: float
    k_micro_w_kg_per_mass_fraction: float


@dataclass(frozen=True)
class RadiogenicHeatResult:
    """
    Present-day radiogenic heat production result for a rock.

    All heat rates are computed from U, Th and K concentrations.
    """

    uranium_mass_fraction: float
    thorium_mass_fraction: float
    potassium_mass_fraction: float

    uranium_w_kg: float
    thorium_w_kg: float
    potassium_w_kg: float
    total_w_kg: float

    density_kg_m3: float
    total_w_m3: float

    mass_kg: float | None
    volume_m3: float | None
    radius_m: float | None
    total_power_w: float | None


DEFAULT_HEAT_COEFFICIENTS = HeatProductionCoefficients(
    u238_micro_w_kg_per_mass_fraction=(
        U238_HEAT_COEFF_MICRO_W_PER_KG_PER_MASS_FRACTION
    ),
    th232_micro_w_kg_per_mass_fraction=(
        TH232_HEAT_COEFF_MICRO_W_PER_KG_PER_MASS_FRACTION
    ),
    k_micro_w_kg_per_mass_fraction=(
        K_HEAT_COEFF_MICRO_W_PER_KG_PER_MASS_FRACTION
    ),
)


def ppm_to_mass_fraction(value_ppm: float) -> float:
    """
    Convert ppm to mass fraction.

    1 ppm = 1e-6 kg/kg
    """
    return value_ppm * 1e-6


def percent_to_mass_fraction(value_percent: float) -> float:
    """
    Convert percent to mass fraction.

    1 percent = 1e-2 kg/kg
    """
    return value_percent * 1e-2


def sphere_volume_from_radius(radius_m: float) -> float:
    """
    Compute sphere volume from radius.
    """
    if radius_m <= 0.0:
        raise ValueError("radius_m must be positive.")

    return (4.0 / 3.0) * math.pi * radius_m**3


def sphere_mass_from_radius_and_density(
    radius_m: float,
    density_kg_m3: float,
) -> float:
    """
    Compute sphere mass from radius and density.
    """
    if density_kg_m3 <= 0.0:
        raise ValueError("density_kg_m3 must be positive.")

    return sphere_volume_from_radius(radius_m) * density_kg_m3


def heat_production_from_rock(
    rock: Rock,
    mass_kg: float | None = None,
    radius_m: float | None = None,
    density_kg_m3: float | None = None,
    uranium238_ppm: float | None = None,
    thorium232_ppm: float | None = None,
    potassium_percent: float | None = None,
    mass_hook=None,
    radius_hook=None,
    density_hook=None,
    uranium_hook=None,
    thorium_hook=None,
    potassium_hook=None,
    coefficients: HeatProductionCoefficients = DEFAULT_HEAT_COEFFICIENTS,
) -> RadiogenicHeatResult:
    """
    Compute present-day radiogenic heat production from U, Th and K.

    Priority for each parameter:
        explicit value > hook value > rock default value
    """

    density = get_rock_param(
        rock,
        "density_kg_m3",
        value=density_kg_m3,
        hook=density_hook,
        required=True,
    )

    u_ppm = get_rock_param(
        rock,
        "uranium238_ppm",
        value=uranium238_ppm,
        hook=uranium_hook,
        default=0.0,
    )

    th_ppm = get_rock_param(
        rock,
        "thorium232_ppm",
        value=thorium232_ppm,
        hook=thorium_hook,
        default=0.0,
    )

    k_percent = get_rock_param(
        rock,
        "potassium_percent",
        value=potassium_percent,
        hook=potassium_hook,
        default=0.0,
    )

    u_mass_fraction = ppm_to_mass_fraction(u_ppm)
    th_mass_fraction = ppm_to_mass_fraction(th_ppm)
    k_mass_fraction = percent_to_mass_fraction(k_percent)

    # Compute heat production in microW/kg first.
    u_micro_w_kg = (
        coefficients.u238_micro_w_kg_per_mass_fraction
        * u_mass_fraction
    )
    th_micro_w_kg = (
        coefficients.th232_micro_w_kg_per_mass_fraction
        * th_mass_fraction
    )
    k_micro_w_kg = (
        coefficients.k_micro_w_kg_per_mass_fraction
        * k_mass_fraction
    )

    # Convert microW/kg -> W/kg.
    u_w_kg = u_micro_w_kg * 1e-6
    th_w_kg = th_micro_w_kg * 1e-6
    k_w_kg = k_micro_w_kg * 1e-6

    total_w_kg = u_w_kg + th_w_kg + k_w_kg
    total_w_m3 = total_w_kg * density

    resolved_mass = get_rock_param(
        rock,
        "mass_kg",
        value=mass_kg,
        hook=mass_hook,
        default=None,
    )

    resolved_radius = get_rock_param(
        rock,
        "radius_m",
        value=radius_m,
        hook=radius_hook,
        default=None,
    )

    volume_m3 = None
    total_power_w = None

    if resolved_mass is None and resolved_radius is not None:
        volume_m3 = sphere_volume_from_radius(resolved_radius)
        resolved_mass = volume_m3 * density
    elif resolved_mass is not None and resolved_radius is None:
        volume_m3 = resolved_mass / density
        resolved_radius = ((3.0 * volume_m3) / (4.0 * math.pi)) ** (1.0 / 3.0)
    elif resolved_mass is not None and resolved_radius is not None:
        volume_m3 = sphere_volume_from_radius(resolved_radius)
    else:
        volume_m3 = None

    if resolved_mass is not None:
        total_power_w = total_w_kg * resolved_mass

    return RadiogenicHeatResult(
        uranium_mass_fraction=u_mass_fraction,
        thorium_mass_fraction=th_mass_fraction,
        potassium_mass_fraction=k_mass_fraction,
        uranium_w_kg=u_w_kg,
        thorium_w_kg=th_w_kg,
        potassium_w_kg=k_w_kg,
        total_w_kg=total_w_kg,
        density_kg_m3=density,
        total_w_m3=total_w_m3,
        mass_kg=resolved_mass,
        volume_m3=volume_m3,
        radius_m=resolved_radius,
        total_power_w=total_power_w,
    )