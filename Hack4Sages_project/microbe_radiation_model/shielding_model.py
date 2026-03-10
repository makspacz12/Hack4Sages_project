"""
shielding_model.py

Radiation attenuation model for:

- one homogeneous spherical rock,
- one central spherical biological/genetic core inside the rock.

Model structure
---------------
1. Radiation reaches the outer surface of the rock.
2. Radiation is attenuated in the homogeneous rock shell.
3. Radiation reaches the biological core.
4. Radiation may be attenuated further inside the biological core.

This is a two-region model:
- outer region: rock
- inner region: biological material
"""

import math
from dataclasses import dataclass
from typing import Iterable, List, Tuple

from materials import Material


@dataclass(frozen=True)
class RadiationPointResult:
    """
    Radiation result for one point.

    Parameters
    ----------
    point : tuple[float, float, float]
        Point coordinates [m].
    distance_from_center : float
        Distance from sphere center [m].
    path_in_rock : float
        Radiation path length in rock [m].
    path_in_bio : float
        Radiation path length in biological core [m].
    rock_attenuation_factor : float
        Attenuation factor due to rock.
    bio_attenuation_factor : float
        Attenuation factor due to biological material.
    total_attenuation_factor : float
        Total attenuation factor.
    local_flux : float
        Flux at the point.
    """
    point: Tuple[float, float, float]
    distance_from_center: float
    path_in_rock: float
    path_in_bio: float
    rock_attenuation_factor: float
    bio_attenuation_factor: float
    total_attenuation_factor: float
    local_flux: float


def attenuation_factor(
    path_length: float,
    density: float,
    k: float,
) -> float:
    """
    Compute Beer-Lambert attenuation factor.

    Parameters
    ----------
    path_length : float
        Path length in material [m].
    density : float
        Density [kg/m^3].
    k : float
        Mass attenuation coefficient [m^2/kg].

    Returns
    -------
    float
        exp(-k * density * path_length)
    """
    if path_length < 0:
        raise ValueError("path_length cannot be negative")
    if density <= 0:
        raise ValueError("density must be positive")
    if k <= 0:
        raise ValueError("k must be positive")

    return math.exp(-k * density * path_length)


def radiation_at_point_in_rock_with_bio_core(
    point: Tuple[float, float, float],
    rock_radius: float,
    bio_radius: float,
    rock_material: Material,
    bio_material: Material,
    surface_flux: float,
) -> RadiationPointResult:
    """
    Compute radiation flux at a point inside a rock with a central biological core.

    Parameters
    ----------
    point : (x, y, z)
        Point coordinates [m].
    rock_radius : float
        Outer radius of the rock [m].
    bio_radius : float
        Radius of the central biological core [m].
    rock_material : Material
        Rock material properties.
    bio_material : Material
        Biological material properties.
    surface_flux : float
        Flux at the outer rock surface.

    Returns
    -------
    RadiationPointResult
        Full radiation result at the point.
    """
    if rock_radius <= 0:
        raise ValueError("rock_radius must be positive")
    if bio_radius < 0:
        raise ValueError("bio_radius cannot be negative")
    if bio_radius > rock_radius:
        raise ValueError("bio_radius cannot be larger than rock_radius")
    if surface_flux < 0:
        raise ValueError("surface_flux cannot be negative")

    x, y, z = point
    r = math.sqrt(x * x + y * y + z * z)

    if r > rock_radius:
        raise ValueError(f"Point {point} lies outside the rock")

    # Case 1: point is inside the biological core
    if r <= bio_radius:
        path_in_rock = rock_radius - bio_radius
        path_in_bio = bio_radius - r

    # Case 2: point is inside rock, but outside biological core
    else:
        path_in_rock = rock_radius - r
        path_in_bio = 0.0

    rock_att = attenuation_factor(
        path_length=path_in_rock,
        density=rock_material.density,
        k=rock_material.k,
    )

    bio_att = 1.0
    if path_in_bio > 0.0:
        bio_att = attenuation_factor(
            path_length=path_in_bio,
            density=bio_material.density,
            k=bio_material.k,
        )

    total_att = rock_att * bio_att
    local_flux = surface_flux * total_att

    return RadiationPointResult(
        point=point,
        distance_from_center=r,
        path_in_rock=path_in_rock,
        path_in_bio=path_in_bio,
        rock_attenuation_factor=rock_att,
        bio_attenuation_factor=bio_att,
        total_attenuation_factor=total_att,
        local_flux=local_flux,
    )


def radiation_at_points_in_rock_with_bio_core(
    points: Iterable[Tuple[float, float, float]],
    rock_radius: float,
    bio_radius: float,
    rock_material: Material,
    bio_material: Material,
    surface_flux: float,
) -> List[RadiationPointResult]:
    """
    Compute radiation flux for multiple points.
    """
    return [
        radiation_at_point_in_rock_with_bio_core(
            point=point,
            rock_radius=rock_radius,
            bio_radius=bio_radius,
            rock_material=rock_material,
            bio_material=bio_material,
            surface_flux=surface_flux,
        )
        for point in points
    ]