"""
Canonical asteroid state models shared across impacts, simulation and exports.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from .materials.rocks import Rock
from .physics.constants import AU


@dataclass
class AsteroidState:
    """
    Mutable runtime state for a single asteroid/test particle.
    """

    particle_index: int
    rock_type: str
    population_fraction: float
    radius_m: float
    density_kg_m3: float
    albedo: float
    water_mass_fraction: float | None
    porosity: float | None
    thermal_conductivity_w_mk: float | None
    uranium238_ppm: float | None
    thorium232_ppm: float | None
    potassium_percent: float | None
    initial_radius_m: float
    mass_kg: float
    mass_msun: float
    initial_mass_kg: float
    initial_mass_msun: float
    q_pr: float
    launch_x_au: float
    launch_y_au: float
    launch_z_au: float
    spin_period_h: float
    obliquity_deg: float
    spin_axis_x: float
    spin_axis_y: float
    spin_axis_z: float
    current_beta: float | None = None
    initial_beta: float | None = None
    current_nearest_star: int | None = None
    initial_nearest_star: int | None = None
    active: bool = True
    termination_reason: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def radius_au(self) -> float:
        return float(self.radius_m / AU)

    def to_rock(self) -> Rock:
        return Rock(
            name=self.rock_type,
            radius_m=self.radius_m,
            density_kg_m3=self.density_kg_m3,
            albedo=self.albedo,
            water_mass_fraction=self.water_mass_fraction,
            porosity=self.porosity,
            thermal_conductivity_w_mk=self.thermal_conductivity_w_mk,
            uranium238_ppm=self.uranium238_ppm,
            thorium232_ppm=self.thorium232_ppm,
            potassium_percent=self.potassium_percent,
        )

    def to_metadata(self) -> dict[str, Any]:
        data = asdict(self)
        extra = data.pop("extra", {})
        data.update(extra)
        return data

    def to_particle_properties(self) -> dict[str, float | str]:
        return {
            "radius_m": self.radius_m,
            "density_kg_m3": self.density_kg_m3,
            "albedo": self.albedo,
            "population_fraction": self.population_fraction,
            "water_mass_fraction": self.water_mass_fraction,
            "porosity": self.porosity,
            "thermal_conductivity_w_mk": self.thermal_conductivity_w_mk,
            "uranium238_ppm": self.uranium238_ppm,
            "thorium232_ppm": self.thorium232_ppm,
            "potassium_percent": self.potassium_percent,
            "q_pr": self.q_pr,
            "rock_type": self.rock_type,
            "launch_x_au": self.launch_x_au,
            "launch_y_au": self.launch_y_au,
            "launch_z_au": self.launch_z_au,
            "initial_beta": self.initial_beta if self.initial_beta is not None else 0.0,
            "initial_nearest_star": self.initial_nearest_star,
            "mass_kg": self.mass_kg,
            "mass_msun": self.mass_msun,
            "initial_mass_kg": self.initial_mass_kg,
            "initial_mass_msun": self.initial_mass_msun,
            "initial_radius_m": self.initial_radius_m,
            "spin_period_h": self.spin_period_h,
            "obliquity_deg": self.obliquity_deg,
            "spin_axis_x": self.spin_axis_x,
            "spin_axis_y": self.spin_axis_y,
            "spin_axis_z": self.spin_axis_z,
        }


@dataclass
class AsteroidStateStore:
    """
    In-memory registry of asteroid states keyed by REBOUND particle index.
    """

    by_index: dict[int, AsteroidState] = field(default_factory=dict)

    def add(self, state: AsteroidState) -> None:
        self.by_index[state.particle_index] = state

    def get(self, particle_index: int) -> AsteroidState:
        return self.by_index[particle_index]

    def get_optional(self, particle_index: int) -> AsteroidState | None:
        return self.by_index.get(particle_index)

    def update(self, particle_index: int, **changes: Any) -> AsteroidState:
        state = self.by_index[particle_index]
        for key, value in changes.items():
            if hasattr(state, key):
                setattr(state, key, value)
            else:
                state.extra[key] = value
        return state

    def asteroid_indices(self) -> list[int]:
        return sorted(self.by_index.keys())

    def particle_property_map(self) -> dict[int, dict[str, float | str]]:
        return {
            particle_index: state.to_particle_properties()
            for particle_index, state in self.by_index.items()
            if state.active
        }

    def metadata_by_particle(self) -> dict[int, dict[str, Any]]:
        return {
            particle_index: state.to_metadata()
            for particle_index, state in self.by_index.items()
        }

    @classmethod
    def from_impact_result(cls, impact_result: Any) -> AsteroidStateStore:
        """
        Build the canonical runtime store from an ``ImpactResult``.
        """

        store = cls()
        for asteroid in impact_result.asteroids:
            store.add(
                AsteroidState(
                    particle_index=asteroid.sim_index,
                    rock_type=asteroid.rock_type,
                    population_fraction=asteroid.population_fraction,
                    radius_m=asteroid.radius_m,
                    density_kg_m3=asteroid.density_kg_m3,
                    albedo=asteroid.albedo,
                    water_mass_fraction=asteroid.rock.water_mass_fraction,
                    porosity=asteroid.rock.porosity,
                    thermal_conductivity_w_mk=asteroid.rock.thermal_conductivity_w_mk,
                    uranium238_ppm=asteroid.rock.uranium238_ppm,
                    thorium232_ppm=asteroid.rock.thorium232_ppm,
                    potassium_percent=asteroid.rock.potassium_percent,
                    initial_radius_m=asteroid.radius_m,
                    mass_kg=asteroid.mass_kg,
                    mass_msun=asteroid.mass_msun,
                    initial_mass_kg=asteroid.mass_kg,
                    initial_mass_msun=asteroid.mass_msun,
                    q_pr=asteroid.q_pr,
                    launch_x_au=asteroid.launch_x_au,
                    launch_y_au=asteroid.launch_y_au,
                    launch_z_au=asteroid.launch_z_au,
                    spin_period_h=asteroid.spin_period_h,
                    obliquity_deg=asteroid.obliquity_deg,
                    spin_axis_x=asteroid.spin_axis_x,
                    spin_axis_y=asteroid.spin_axis_y,
                    spin_axis_z=asteroid.spin_axis_z,
                    current_beta=asteroid.beta,
                    initial_beta=asteroid.beta,
                    current_nearest_star=asteroid.nearest_star,
                    initial_nearest_star=asteroid.nearest_star,
                    extra={
                        "radiation_surv_coeff": asteroid.radiation_surv_coeff,
                    },
                )
            )
        return store
