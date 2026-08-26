"""
Radiation attenuation model for a rock with a central biological core.

The object has two regions:
- an outer rock shell,
- an inner biological core.
"""

import math
from dataclasses import dataclass
from typing import Iterable, List, Tuple

from ..physics.materials import Material


@dataclass(frozen=True)
class RadiationPointResult:
    """
    Radiation result for a single point inside the object.
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
    Compute the attenuation factor according to the Beer-Lambert law.
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
    Compute the local radiation flux at a point inside a rock with a biological core.
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

    # The point lies inside the biological core.
    if r <= bio_radius:
        path_in_rock = rock_radius - bio_radius
        path_in_bio = bio_radius - r
    # The point lies in the rock shell, outside the biological core.
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
    Compute radiation for many points inside the same object.
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
