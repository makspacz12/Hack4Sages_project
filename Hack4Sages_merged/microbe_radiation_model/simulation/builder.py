"""
Budowanie układu REBOUND zgodnego z resztą projektu.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterator

try:
    import rebound
except ImportError:
    rebound = None  # type: ignore

from .barycenter import move_simulation_to_center_of_mass
from .config import BarycenterConfig
from .gaia_catalog import GaiaCatalogConfig, gaia_table_to_particles, load_or_fetch_gaia_table
from .solar_system import PLANET_NAMES, SolarSystemBuildConfig, build_solar_system


@dataclass(frozen=True)
class SimulationBodyIndexMap:
    """
    Structured index metadata for the built simulation.
    """

    sun_index: int
    planet_indices: list[int]
    planet_names: list[str]
    star_indices: list[int]
    permanent_body_count: int


@dataclass
class BuildSimulationResult:
    """
    Rich builder result that remains backward compatible with the old tuple unpacking.
    """

    sim: Any
    star_indices: list[int]
    solar_system_bodies: list[str]
    n_permanent: int
    body_index_map: SimulationBodyIndexMap

    def __iter__(self) -> Iterator[Any]:
        yield self.sim
        yield self.star_indices
        yield self.solar_system_bodies
        yield self.n_permanent


def build_simulation(
    gaia_csv_path: str | None = None,
    use_planets: bool = True,
    gaia_csv_cwd: str | None = None,
    gaia_config: GaiaCatalogConfig | None = None,
    solar_system_config: SolarSystemBuildConfig | None = None,
    barycenter_config: BarycenterConfig | None = None,
) -> BuildSimulationResult:
    """
    Build a REBOUND simulation with the solar system and optional Gaia stars.
    """

    if rebound is None:
        raise ImportError("REBOUND jest wymagany do build_simulation. Zainstaluj pakiet 'rebound'.")

    sim = rebound.Simulation()

    solar_system_config = solar_system_config or SolarSystemBuildConfig(use_planets=use_planets)
    if use_planets != solar_system_config.use_planets:
        solar_system_config = SolarSystemBuildConfig(
            mode=solar_system_config.mode,
            observation_time_utc=solar_system_config.observation_time_utc,
            kernel_dir=solar_system_config.kernel_dir,
            download_kernels=solar_system_config.download_kernels,
            use_cache=solar_system_config.use_cache,
            cache_path=solar_system_config.cache_path,
            use_planets=use_planets,
        )
    solar_system_bodies = build_solar_system(sim, solar_system_config)

    star_indices = [0]
    gaia_config = gaia_config or GaiaCatalogConfig(
        csv_path=gaia_csv_path or "nearest_50_gaia.csv",
        csv_cwd=gaia_csv_cwd,
    )
    if gaia_csv_path is not None or gaia_csv_cwd is not None:
        gaia_config = GaiaCatalogConfig(
            mode=gaia_config.mode,
            csv_path=gaia_csv_path or gaia_config.csv_path,
            csv_cwd=gaia_csv_cwd if gaia_csv_cwd is not None else gaia_config.csv_cwd,
            top_n=gaia_config.top_n,
            overwrite_csv=gaia_config.overwrite_csv,
            main_table=gaia_config.main_table,
            reference_time_utc=gaia_config.reference_time_utc,
        )

    if gaia_config.csv_path:
        table = load_or_fetch_gaia_table(gaia_config)
        for particle in gaia_table_to_particles(table):
            sim.add(
                m=particle.mass_msun,
                r=particle.radius_au,
                x=particle.x_au,
                y=particle.y_au,
                z=particle.z_au,
                vx=particle.vx_au_per_yr,
                vy=particle.vy_au_per_yr,
                vz=particle.vz_au_per_yr,
            )
            star_indices.append(sim.N - 1)

    barycenter_config = barycenter_config or BarycenterConfig()
    if barycenter_config.enabled:
        move_simulation_to_center_of_mass(sim)

    planet_indices = list(range(1, 1 + len(solar_system_bodies)))
    n_permanent = sim.N
    body_index_map = SimulationBodyIndexMap(
        sun_index=0,
        planet_indices=planet_indices,
        planet_names=solar_system_bodies or PLANET_NAMES[: len(planet_indices)],
        star_indices=star_indices,
        permanent_body_count=n_permanent,
    )
    return BuildSimulationResult(
        sim=sim,
        star_indices=star_indices,
        solar_system_bodies=solar_system_bodies,
        n_permanent=n_permanent,
        body_index_map=body_index_map,
    )
