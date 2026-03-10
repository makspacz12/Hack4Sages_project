"""
shielding_model.py

This module implements radiation attenuation inside solid materials.
It computes how incident radiation at the rock surface is reduced
as it travels through rock before reaching microbes located inside.

The attenuation model follows the Beer–Lambert law:

    I(x) = I0 * exp(-k * rho * x)

where:
    I0  : incident radiation flux at the rock surface
    k   : mass attenuation coefficient
    rho : bulk density of the rock
    x   : depth inside the rock

In this simplified model:
    depth = rock_radius - distance_from_center
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
    Compute radiation reaching points inside a spherical rock.

    Parameters
    ----------
    points : iterable of (x, y, z)
        Coordinates of microbes inside the rock [meters].
    rock_radius : float
        Radius of the spherical rock [meters].
    density : float
        Bulk density of the rock [kg/m^3].
    k : float
        Mass attenuation coefficient [m^2/kg].
    surface_flux : float
        Incident radiation flux at the rock surface (e.g. W/m^2).

    Returns
    -------
    List[float]
        Radiation flux reaching each point inside the rock.
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

        # distance from center of rock
        r = math.sqrt(x*x + y*y + z*z)

        if r > rock_radius:
            raise ValueError("Point lies outside the rock sphere")

        # depth below surface
        depth = rock_radius - r

        # Beer–Lambert attenuation
        local_flux = surface_flux * math.exp(-k * density * depth)

        local_fluxes.append(local_flux)

    return local_fluxes