"""
Sprzężenie pomiędzy pozycjami z REBOUND a lokalnym modelem promieniowania.
"""

import math
from typing import Any

from ..physics.constants import AU
from ..physics.geometry import biological_core_radius
from ..radiation.exposure_model import update_exposure
from ..radiation import stellar_flux
from ..radiation.shielding_model import radiation_at_point_in_rock_with_bio_core


def process_radiation_step(
    sim: Any,
    star_index: int,
    body_index: int,
    luminosity: float,
    rock_radius: float,
    rock_material: Any,
    bio_material: Any,
    bio_mass_fraction: float,
    exposure_state: Any,
    dt: float,
) -> Any:
    """
    Wykonuje jeden krok promieniowania dla ciała w symulacji REBOUND.
    """

    star = sim.particles[star_index]
    body = sim.particles[body_index]

    dx = body.x - star.x
    dy = body.y - star.y
    dz = body.z - star.z

    distance_au = math.sqrt(dx * dx + dy * dy + dz * dz)
    distance_m = distance_au * AU
    surface_flux = stellar_flux(luminosity, distance_m)

    bio_radius = biological_core_radius(
        rock_radius=rock_radius,
        rock_density=rock_material.density,
        bio_density=bio_material.density,
        bio_mass_fraction=bio_mass_fraction,
    )

    result = radiation_at_point_in_rock_with_bio_core(
        point=(0.0, 0.0, 0.0),
        rock_radius=rock_radius,
        bio_radius=bio_radius,
        rock_material=rock_material,
        bio_material=bio_material,
        surface_flux=surface_flux,
    )

    update_exposure(
        state=exposure_state,
        local_flux=result.local_flux,
        dt=dt,
    )
    return result
