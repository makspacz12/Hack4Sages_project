"""
Główny silnik uruchomieniowy łączący REBOUND z modelem promieniowania.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Tuple

from ..physics.constants import SECONDS_PER_YEAR
from ..physics.materials import Material
from ..physics.stellar_physics import stellar_luminosity_from_solar_mass
from ..radiation.exposure_model import ExposureState
from .builder import build_simulation
from .config import BarycenterConfig, GaiaCatalogConfig, SimulationRunConfig, SolarSystemBuildConfig, default_material_config
from .coupling import process_radiation_step

SimulationStepHook = Callable[[Any, int, List[int], List[int], int], None]


def nearest_star_index(sim: Any, body_index: int, star_indices: List[int]) -> Optional[int]:
    """
    Zwraca indeks najbliższej gwiazdy dla wskazanego ciała.
    """

    if not star_indices:
        return None

    body = sim.particles[body_index]
    nearest_index = None
    min_distance_squared = float("inf")

    for star_index in star_indices:
        star = sim.particles[star_index]
        dx = body.x - star.x
        dy = body.y - star.y
        dz = body.z - star.z
        distance_squared = dx * dx + dy * dy + dz * dz
        if distance_squared < min_distance_squared:
            min_distance_squared = distance_squared
            nearest_index = star_index

    return nearest_index


def run_simulation(
    sim: Optional[Any] = None,
    star_indices: Optional[List[int]] = None,
    body_indices: Optional[List[int]] = None,
    rock_radius: float = 0.5,
    rock_material: Optional[Material] = None,
    bio_material: Optional[Material] = None,
    bio_mass_fraction: float = 0.01,
    dt_yr: float = 1.0 / 365.25,
    n_steps: int = 10,
    add_test_particle: bool = False,
    gaia_csv_path: Optional[str] = None,
    use_planets: bool = True,
    gaia_config: GaiaCatalogConfig | None = None,
    solar_system_config: SolarSystemBuildConfig | None = None,
    barycenter_config: BarycenterConfig | None = None,
    run_config: SimulationRunConfig | None = None,
    step_hook: SimulationStepHook | None = None,
) -> Tuple[Any, Dict[int, ExposureState], List[int], List[str], int]:
    """
    Buduje i uruchamia pipeline REBOUND -> promieniowanie -> ekranowanie -> ekspozycja.
    """

    if run_config is not None:
        dt_yr = run_config.dt_yr
        n_steps = run_config.n_steps
        add_test_particle = run_config.add_test_particle
        gaia_config = gaia_config or run_config.gaia
        solar_system_config = solar_system_config or run_config.solar_system
        barycenter_config = barycenter_config or run_config.barycenter
        gaia_csv_path = gaia_csv_path or run_config.gaia_csv_path
        use_planets = run_config.use_planets

    if rock_material is None or bio_material is None:
        material_config = default_material_config()
        rock_material = rock_material or material_config.rock_material
        bio_material = bio_material or material_config.bio_material

    if sim is None:
        build_result = build_simulation(
            gaia_csv_path=gaia_csv_path,
            use_planets=use_planets,
            gaia_config=gaia_config,
            solar_system_config=solar_system_config,
            barycenter_config=barycenter_config,
        )
        sim = build_result.sim
        star_indices = build_result.star_indices
        solar_system_bodies = build_result.solar_system_bodies
        n_permanent = build_result.n_permanent
    else:
        if star_indices is None:
            star_indices = [0]
        solar_system_bodies = []
        n_permanent = sim.N

    if body_indices is None and add_test_particle:
        sim.add(m=0.0, a=1.0, e=0.0)
        body_indices = [sim.N - 1]

    if body_indices is None:
        body_indices = []

    dt_s = dt_yr * SECONDS_PER_YEAR
    exposure_by_body: Dict[int, ExposureState] = {body_index: ExposureState() for body_index in body_indices}

    for _step in range(n_steps):
        sim.integrate(sim.t + dt_yr)
        if step_hook is not None:
            step_hook(sim, _step, star_indices or [0], body_indices, n_permanent)
        for body_index in body_indices:
            nearest_index = nearest_star_index(sim, body_index, star_indices or [])
            if nearest_index is None:
                continue

            star = sim.particles[nearest_index]
            luminosity = stellar_luminosity_from_solar_mass(star.m)
            process_radiation_step(
                sim=sim,
                star_index=nearest_index,
                body_index=body_index,
                luminosity=luminosity,
                rock_radius=rock_radius,
                rock_material=rock_material,
                bio_material=bio_material,
                bio_mass_fraction=bio_mass_fraction,
                exposure_state=exposure_by_body[body_index],
                dt=dt_s,
            )

    return sim, exposure_by_body, star_indices or [0], solar_system_bodies, n_permanent
