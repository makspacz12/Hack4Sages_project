from dataclasses import dataclass
import math

from materials.rocks import Rock, get_rock_param


@dataclass(frozen=True)
class RockGeometry:
    """
    Basic spherical geometry of a rock body.
    """

    mass_kg: float
    density_kg_m3: float
    volume_m3: float
    radius_m: float


def volume_from_mass_and_density(
    mass_kg: float,
    density_kg_m3: float,
) -> float:
    """
    Compute volume from mass and density.
    """

    if mass_kg <= 0.0:
        raise ValueError("mass_kg must be positive.")

    if density_kg_m3 <= 0.0:
        raise ValueError("density_kg_m3 must be positive.")

    return mass_kg / density_kg_m3


def radius_from_volume(
    volume_m3: float,
) -> float:
    """
    Compute sphere radius from volume.
    """

    if volume_m3 <= 0.0:
        raise ValueError("volume_m3 must be positive.")

    return ((3.0 * volume_m3) / (4.0 * math.pi)) ** (1.0 / 3.0)


def geometry_from_rock(
    rock: Rock,
    mass_kg: float | None = None,
    density_kg_m3: float | None = None,
    mass_hook=None,
    density_hook=None,
) -> RockGeometry:
    """
    Compute spherical rock geometry from mass and density.
    """

    resolved_mass = get_rock_param(
        rock,
        "mass_kg",
        value=mass_kg,
        hook=mass_hook,
        required=True,
    )

    resolved_density = get_rock_param(
        rock,
        "density_kg_m3",
        value=density_kg_m3,
        hook=density_hook,
        required=True,
    )

    volume_m3 = volume_from_mass_and_density(
        mass_kg=resolved_mass,
        density_kg_m3=resolved_density,
    )

    radius_m = radius_from_volume(volume_m3)

    return RockGeometry(
        mass_kg=resolved_mass,
        density_kg_m3=resolved_density,
        volume_m3=volume_m3,
        radius_m=radius_m,
    )
