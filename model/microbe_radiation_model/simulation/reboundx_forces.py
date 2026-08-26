"""
REBOUNDx force helpers for radiation pressure.
"""

from __future__ import annotations

from typing import Any, Callable

from astropy import units as u
from astropy.constants import c as c_light

from ..asteroid_state import AsteroidStateStore
from .config import RadiationPressureConfig
from ..radiation.pressure import compute_beta_single_star, nearest_star_for_particle, q_pr_from_albedo
from .particle_ops import ParticleMetadataStore


def load_radiation_forces(sim: Any) -> tuple[Any, Any]:
    """
    Create a REBOUNDx instance and load the ``radiation_forces`` plugin.
    """

    try:
        import reboundx
    except (ImportError, OSError) as error:
        raise ImportError(
            "reboundx is unavailable for radiation-pressure forces "
            "(missing package or shared library load failure)."
        ) from error

    rebx = reboundx.Extras(sim)
    radiation_forces = rebx.load_force("radiation_forces")
    rebx.add_force(radiation_forces)
    radiation_forces.params["c"] = c_light.to(u.AU / u.yr).value
    return rebx, radiation_forces


def assign_beta_to_particles(sim: Any, beta_by_particle: dict[int, float]) -> None:
    """
    Assign per-particle beta values required by REBOUNDx.
    """

    for particle_index, beta in beta_by_particle.items():
        sim.particles[particle_index].params["beta"] = beta


def refresh_dynamic_beta(
    sim: Any,
    star_indices: list[int],
    particle_properties: dict[int, dict[str, Any]] | None = None,
    asteroid_state_store: AsteroidStateStore | None = None,
    metadata_store: ParticleMetadataStore | None = None,
) -> dict[int, float]:
    """
    Recompute beta values from the current nearest star and current particle properties.
    """

    if asteroid_state_store is None and particle_properties is None:
        raise ValueError("Provide either asteroid_state_store or particle_properties.")

    resolved_properties = (
        asteroid_state_store.particle_property_map()
        if asteroid_state_store is not None
        else particle_properties or {}
    )

    beta_by_particle: dict[int, float] = {}
    for particle_index, properties in resolved_properties.items():
        nearest_star_index = nearest_star_for_particle(sim, particle_index, star_indices)
        if nearest_star_index is None:
            beta_by_particle[particle_index] = 0.0
            if asteroid_state_store is not None:
                asteroid_state_store.update(
                    particle_index,
                    current_beta=0.0,
                    current_nearest_star=None,
                )
            if metadata_store is not None:
                metadata_store.set(particle_index, current_beta=0.0, current_nearest_star=None)
            continue

        radius_m = float(properties["radius_m"])
        density_kg_m3 = float(properties["density_kg_m3"])
        q_pr = float(properties.get("q_pr", q_pr_from_albedo(float(properties.get("albedo", 0.0)))))
        star_mass = sim.particles[nearest_star_index].m
        beta = float(
            compute_beta_single_star(
                star_mass,
                radius_m,
                rho=density_kg_m3,
                q_pr=q_pr,
            )
        )
        beta_by_particle[particle_index] = beta
        if asteroid_state_store is not None:
            asteroid_state_store.update(
                particle_index,
                current_beta=beta,
                current_nearest_star=nearest_star_index,
            )
        if metadata_store is not None:
            metadata_store.set(
                particle_index,
                current_beta=beta,
                current_nearest_star=nearest_star_index,
            )

    assign_beta_to_particles(sim, beta_by_particle)
    return beta_by_particle


def make_dynamic_beta_step_hook(
    particle_properties: dict[int, dict[str, Any]] | None = None,
    asteroid_state_store: AsteroidStateStore | None = None,
    metadata_store: ParticleMetadataStore | None = None,
    refresh_interval_steps: int = 1,
) -> Callable[[Any, int, list[int], list[int], int], None]:
    """
    Create an engine ``step_hook`` that refreshes beta values every N steps.
    """

    if refresh_interval_steps <= 0:
        raise ValueError("refresh_interval_steps must be positive.")

    def _step_hook(
        sim: Any,
        step_index: int,
        star_indices: list[int],
        _body_indices: list[int],
        _n_permanent: int,
    ) -> None:
        if step_index % refresh_interval_steps != 0:
            return
        refresh_dynamic_beta(
            sim=sim,
            star_indices=star_indices,
            particle_properties=particle_properties,
            asteroid_state_store=asteroid_state_store,
            metadata_store=metadata_store,
        )

    return _step_hook


def apply_radiation_pressure_forces(
    sim: Any,
    beta_by_particle: dict[int, float],
    config: RadiationPressureConfig | None = None,
) -> tuple[Any, Any]:
    """
    Enable REBOUNDx radiation forces if the feature is enabled.
    """

    config = config or RadiationPressureConfig(enabled=True)
    if not config.enabled:
        raise ValueError("Radiation-pressure forces are disabled in the provided config.")

    rebx, radiation_forces = load_radiation_forces(sim)
    assign_beta_to_particles(sim, beta_by_particle)
    return rebx, radiation_forces
