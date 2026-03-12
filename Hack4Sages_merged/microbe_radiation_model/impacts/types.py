"""
Types used by impact/ejecta models.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from ..asteroid_state import AsteroidStateStore
from ..materials.rocks import Rock


@dataclass(frozen=True)
class ImpactEjectaConfig:
    n_asteroids: int = 100
    impact_normal: tuple[float, float, float] | None = None
    cone_half_angle: float = 60.0
    v_min_kms: float = 5.03
    v_max_kms: float = 20.0
    alpha_v: float = 2.5
    radius_min_m: float = 0.001
    radius_max_m: float = 5.0
    q_size: float = 2.0
    rock_variants: list[Rock | dict] | None = None
    spin_period_range: tuple[float, float] = (2.0, 20.0)
    obliquity_range: tuple[float, float] = (0.0, 180.0)
    size_velocity_corr: bool = True
    star_indices: list[int] | None = None
    mars_index: int = 4
    seed: int | None = None


@dataclass(frozen=True)
class GeneratedAsteroid:
    sim_index: int
    rock: Rock
    population_fraction: float
    launch_x_au: float
    launch_y_au: float
    launch_z_au: float
    radius_m: float
    radius_au: float
    density_kg_m3: float
    rock_type: str
    albedo: float
    mass_kg: float
    mass_msun: float
    beta: float
    q_pr: float
    nearest_star: int
    v_ejecta_kms: float
    spin_period_h: float
    obliquity_deg: float
    spin_axis_x: float
    spin_axis_y: float
    spin_axis_z: float
    radiation_surv_coeff: float


@dataclass
class ImpactResult:
    first_index: int
    nearest_star_index: int
    asteroids: list[GeneratedAsteroid] = field(default_factory=list)

    def asteroid_indices(self) -> list[int]:
        return [asteroid.sim_index for asteroid in self.asteroids]

    def asteroid_state_store(self) -> AsteroidStateStore:
        return AsteroidStateStore.from_impact_result(self)

    def particle_property_map(self) -> dict[int, dict[str, float | str]]:
        return self.asteroid_state_store().particle_property_map()

    def to_dataframe(self) -> pd.DataFrame:
        return pd.DataFrame(
            [
                {
                    "sim_index": asteroid.sim_index,
                    "rock_name": asteroid.rock.name,
                    "population_fraction": asteroid.population_fraction,
                    "launch_x_au": asteroid.launch_x_au,
                    "launch_y_au": asteroid.launch_y_au,
                    "launch_z_au": asteroid.launch_z_au,
                    "radius_m": asteroid.radius_m,
                    "radius_AU": asteroid.radius_au,
                    "density_kg_m3": asteroid.density_kg_m3,
                    "rock_type": asteroid.rock_type,
                    "albedo": asteroid.albedo,
                    "water_mass_fraction": asteroid.rock.water_mass_fraction,
                    "porosity": asteroid.rock.porosity,
                    "thermal_conductivity_w_mk": asteroid.rock.thermal_conductivity_w_mk,
                    "uranium238_ppm": asteroid.rock.uranium238_ppm,
                    "thorium232_ppm": asteroid.rock.thorium232_ppm,
                    "potassium_percent": asteroid.rock.potassium_percent,
                    "mass_kg": asteroid.mass_kg,
                    "mass_Msun": asteroid.mass_msun,
                    "beta": asteroid.beta,
                    "Q_pr": asteroid.q_pr,
                    "nearest_star": asteroid.nearest_star,
                    "v_ejecta_kms": asteroid.v_ejecta_kms,
                    "spin_period_h": asteroid.spin_period_h,
                    "obliquity_deg": asteroid.obliquity_deg,
                    "spin_axis_x": asteroid.spin_axis_x,
                    "spin_axis_y": asteroid.spin_axis_y,
                    "spin_axis_z": asteroid.spin_axis_z,
                }
                for asteroid in self.asteroids
            ]
        )
