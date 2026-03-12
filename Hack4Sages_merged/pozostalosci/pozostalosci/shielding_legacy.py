"""
Starszy model tłumienia promieniowania dla jednorodnej kulistej skały.

Nie uwzględnia rdzenia biologicznego. Zostaje w repo jako punkt odniesienia.
"""

import math
from typing import Iterable, List, Tuple


def radiation_at_points_in_sphere(
    points: Iterable[Tuple[float, float, float]],
    rock_radius: float,
    density: float,
    k: float,
    surface_flux: float,
) -> List[float]:
    """
    Oblicza promieniowanie docierające do punktów wewnątrz jednorodnej skały.
    """

    if rock_radius <= 0:
        raise ValueError("rock_radius must be positive")
    if density <= 0:
        raise ValueError("density must be positive")
    if k <= 0:
        raise ValueError("attenuation coefficient k must be positive")
    if surface_flux < 0:
        raise ValueError("surface_flux cannot be negative")

    local_fluxes: List[float] = []

    for x, y, z in points:
        r = math.sqrt(x * x + y * y + z * z)
        if r > rock_radius:
            raise ValueError("Point lies outside the rock sphere")

        depth = rock_radius - r
        local_flux = surface_flux * math.exp(-k * density * depth)
        local_fluxes.append(local_flux)

    return local_fluxes
