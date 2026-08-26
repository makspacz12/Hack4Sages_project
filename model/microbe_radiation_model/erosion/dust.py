"""
Dust-driven isotropic erosion for spherical asteroids.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from typing import TYPE_CHECKING, Any, Callable

from ..asteroid_state import AsteroidState, AsteroidStateStore
from ..chemistry.hydrolysis_model import compute_hydrolysis_rate
from ..physics.constants import AU, SECONDS_PER_YEAR, SOLAR_MASS
from ..physics.stellar_physics import stellar_luminosity_from_solar_mass
from ..radiation.radiation_model import stellar_flux
from ..thermal.surface_temperature import equilibrium_temperature_from_flux

if TYPE_CHECKING:
    from ..simulation.particle_ops import ParticleMetadataStore


@dataclass(frozen=True)
class DustErosionConfig:
    """
    Configuration for isotropic dust erosion of spherical bodies.
    """

    enabled: bool = False
    dust_mass_flux_kg_m2_s: float = 0.0
    excavation_yield: float = 1.0
    flux_definition: str = "cross_section"
    refresh_interval_steps: int = 1
    distance_flux_exponent: float = 0.0
    reference_distance_au: float = 1.0
    minimum_distance_au: float = 0.1
    porosity_yield_coeff: float = 1.0
    hydrolysis_yield_coeff: float = 0.25
    hydrolysis_reference_rate_s_inv: float = 1.0e-2
    hydrolysis_rate_cap: float = 2.0


def radius_change_rate_from_dust_mass_flux(
    dust_mass_flux_kg_m2_s: float,
    excavation_yield: float,
    density_kg_m3: float,
    flux_definition: str = "cross_section",
) -> float:
    """
    Compute dR/dt from a dust mass flux and excavation yield.

    ``flux_definition="cross_section"`` matches the geometric derivation
    where the incoming dust flux is defined on the exposed cross section.
    ``flux_definition="surface_average"`` assumes the flux is already
    averaged over the full surface area.
    """

    if density_kg_m3 <= 0.0:
        raise ValueError("density_kg_m3 must be positive.")
    if excavation_yield < 0.0:
        raise ValueError("excavation_yield must be non-negative.")
    if dust_mass_flux_kg_m2_s < 0.0:
        raise ValueError("dust_mass_flux_kg_m2_s must be non-negative.")

    if flux_definition == "cross_section":
        divisor = 4.0 * density_kg_m3
    elif flux_definition == "surface_average":
        divisor = density_kg_m3
    else:
        raise ValueError("flux_definition must be 'cross_section' or 'surface_average'.")

    return -(excavation_yield * dust_mass_flux_kg_m2_s) / divisor


def update_state_from_dust_erosion(
    state: AsteroidState,
    dt_s: float,
    dust_mass_flux_kg_m2_s: float,
    excavation_yield: float,
    flux_definition: str = "cross_section",
) -> AsteroidState:
    """
    Apply one isotropic dust-erosion step to an asteroid state.
    """

    if dt_s < 0.0:
        raise ValueError("dt_s must be non-negative.")

    d_radius_dt = radius_change_rate_from_dust_mass_flux(
        dust_mass_flux_kg_m2_s=dust_mass_flux_kg_m2_s,
        excavation_yield=excavation_yield,
        density_kg_m3=state.density_kg_m3,
        flux_definition=flux_definition,
    )
    old_radius_m = state.radius_m
    old_mass_kg = state.mass_kg
    new_radius_m = max(0.0, old_radius_m + d_radius_dt * dt_s)
    radius_loss_m = max(0.0, old_radius_m - new_radius_m)
    mass_loss_kg = max(0.0, old_mass_kg - sphere_mass_from_radius_and_density(new_radius_m, state.density_kg_m3))

    state.radius_m = new_radius_m
    state.mass_kg = sphere_mass_from_radius_and_density(new_radius_m, state.density_kg_m3)
    state.mass_msun = state.mass_kg / SOLAR_MASS
    state.extra["dust_mass_flux_kg_m2_s"] = dust_mass_flux_kg_m2_s
    state.extra["dust_excavation_yield"] = excavation_yield
    state.extra["dust_flux_definition"] = flux_definition
    state.extra["dust_radius_change_rate_m_per_s"] = d_radius_dt
    state.extra["cumulative_radius_loss_m"] = float(state.extra.get("cumulative_radius_loss_m", 0.0)) + radius_loss_m
    state.extra["cumulative_mass_loss_kg"] = float(state.extra.get("cumulative_mass_loss_kg", 0.0)) + mass_loss_kg
    return state


def resolve_dust_erosion_context(
    sim: Any,
    particle_index: int,
    state: AsteroidState,
    star_indices: list[int] | None = None,
    config: DustErosionConfig | None = None,
) -> dict[str, float | int | None]:
    """
    Resolve environment- and material-dependent erosion modifiers.

    Scientific intent:
    - porosity increases the susceptibility of the material to mechanical erosion
    - temperature and hydrolysis act as a proxy for chemical weakening
    - direct distance-based dust-flux scaling remains optional and conservative
    """

    config = config or DustErosionConfig()
    star_indices = star_indices or []

    nearest_star_index: int | None = None
    distance_au: float | None = None
    surface_flux_w_m2: float | None = None
    surface_temperature_k: float | None = None
    hydrolysis_rate_s_inv = 0.0

    if star_indices:
        particle = sim.particles[particle_index]
        min_distance_sq = float("inf")
        for star_index in star_indices:
            star = sim.particles[star_index]
            dx = particle.x - star.x
            dy = particle.y - star.y
            dz = particle.z - star.z
            distance_sq = dx * dx + dy * dy + dz * dz
            if distance_sq < min_distance_sq:
                min_distance_sq = distance_sq
                nearest_star_index = star_index

        if nearest_star_index is not None:
            distance_au = sqrt(min_distance_sq)
            clipped_distance_au = max(distance_au, config.minimum_distance_au)
            star_mass = float(sim.particles[nearest_star_index].m)
            luminosity_w = stellar_luminosity_from_solar_mass(star_mass)
            surface_flux_w_m2 = stellar_flux(luminosity_w, clipped_distance_au * AU)
            surface_temperature_k = equilibrium_temperature_from_flux(
                surface_flux_w_m2=surface_flux_w_m2,
                albedo=max(0.0, min(1.0, state.albedo)),
            )

    distance_flux_factor = 1.0
    if distance_au is not None and config.distance_flux_exponent != 0.0:
        clipped_distance_au = max(distance_au, config.minimum_distance_au)
        distance_flux_factor = (config.reference_distance_au / clipped_distance_au) ** config.distance_flux_exponent

    porosity_factor = 1.0
    if state.porosity is not None:
        porosity_factor += config.porosity_yield_coeff * max(0.0, state.porosity)

    hydrolysis_factor = 1.0
    if surface_temperature_k is not None and state.water_mass_fraction is not None:
        hydrolysis_rate_s_inv = compute_hydrolysis_rate(
            temperature_k=surface_temperature_k,
            water_mass_fraction=max(0.0, state.water_mass_fraction),
        )
        if config.hydrolysis_reference_rate_s_inv > 0.0:
            normalized_rate = min(
                hydrolysis_rate_s_inv / config.hydrolysis_reference_rate_s_inv,
                config.hydrolysis_rate_cap,
            )
            hydrolysis_factor += config.hydrolysis_yield_coeff * max(0.0, normalized_rate)

    effective_dust_mass_flux = config.dust_mass_flux_kg_m2_s * distance_flux_factor
    effective_excavation_yield = config.excavation_yield * porosity_factor * hydrolysis_factor

    return {
        "nearest_star_index": nearest_star_index,
        "distance_au": distance_au,
        "surface_flux_w_m2": surface_flux_w_m2,
        "surface_temperature_k": surface_temperature_k,
        "hydrolysis_rate_s_inv": hydrolysis_rate_s_inv,
        "distance_flux_factor": distance_flux_factor,
        "porosity_factor": porosity_factor,
        "hydrolysis_factor": hydrolysis_factor,
        "effective_dust_mass_flux_kg_m2_s": effective_dust_mass_flux,
        "effective_excavation_yield": effective_excavation_yield,
    }


def apply_dust_erosion_step(
    sim: Any,
    asteroid_state_store: AsteroidStateStore,
    dt_s: float,
    dust_mass_flux_kg_m2_s: float,
    excavation_yield: float,
    flux_definition: str = "cross_section",
    metadata_store: ParticleMetadataStore | None = None,
    star_indices: list[int] | None = None,
    erosion_config: DustErosionConfig | None = None,
) -> None:
    """
    Apply one erosion step to every active asteroid and sync REBOUND particles.
    """

    if erosion_config is None:
        erosion_config = DustErosionConfig(
            enabled=True,
            dust_mass_flux_kg_m2_s=dust_mass_flux_kg_m2_s,
            excavation_yield=excavation_yield,
            flux_definition=flux_definition,
        )
    else:
        dust_mass_flux_kg_m2_s = erosion_config.dust_mass_flux_kg_m2_s
        excavation_yield = erosion_config.excavation_yield
        flux_definition = erosion_config.flux_definition

    for particle_index in asteroid_state_store.asteroid_indices():
        state = asteroid_state_store.get(particle_index)
        if not state.active:
            continue

        erosion_context = resolve_dust_erosion_context(
            sim=sim,
            particle_index=particle_index,
            state=state,
            star_indices=star_indices,
            config=erosion_config,
        )

        updated_state = update_state_from_dust_erosion(
            state=state,
            dt_s=dt_s,
            dust_mass_flux_kg_m2_s=float(erosion_context["effective_dust_mass_flux_kg_m2_s"]),
            excavation_yield=float(erosion_context["effective_excavation_yield"]),
            flux_definition=flux_definition,
        )
        updated_state.extra.update(erosion_context)

        particle = sim.particles[particle_index]
        particle.r = updated_state.radius_au
        # Asteroids are propagated as test particles to avoid singular mutual interactions
        # right after the Mars ejecta event; their physical mass remains in AsteroidState.
        particle.m = 0.0

        if metadata_store is not None:
            metadata_store.set(
                particle_index,
                radius_m=updated_state.radius_m,
                radius_au=updated_state.radius_au,
                mass_kg=updated_state.mass_kg,
                mass_msun=updated_state.mass_msun,
                dust_mass_flux_kg_m2_s=float(erosion_context["effective_dust_mass_flux_kg_m2_s"]),
                dust_excavation_yield=float(erosion_context["effective_excavation_yield"]),
                dust_flux_definition=flux_definition,
                dust_radius_change_rate_m_per_s=updated_state.extra["dust_radius_change_rate_m_per_s"],
                cumulative_radius_loss_m=updated_state.extra["cumulative_radius_loss_m"],
                cumulative_mass_loss_kg=updated_state.extra["cumulative_mass_loss_kg"],
                erosion_nearest_star_index=erosion_context["nearest_star_index"],
                erosion_distance_au=erosion_context["distance_au"],
                erosion_surface_flux_w_m2=erosion_context["surface_flux_w_m2"],
                erosion_surface_temperature_k=erosion_context["surface_temperature_k"],
                erosion_hydrolysis_rate_s_inv=erosion_context["hydrolysis_rate_s_inv"],
                erosion_distance_flux_factor=erosion_context["distance_flux_factor"],
                erosion_porosity_factor=erosion_context["porosity_factor"],
                erosion_hydrolysis_factor=erosion_context["hydrolysis_factor"],
            )


def make_dust_erosion_step_hook(
    asteroid_state_store: AsteroidStateStore,
    dt_yr: float,
    dust_mass_flux_kg_m2_s: float,
    excavation_yield: float,
    flux_definition: str = "cross_section",
    refresh_interval_steps: int = 1,
    metadata_store: ParticleMetadataStore | None = None,
    erosion_config: DustErosionConfig | None = None,
) -> Callable[[Any, int, list[int], list[int], int], None]:
    """
    Create an engine ``step_hook`` that applies dust erosion every N steps.
    """

    if refresh_interval_steps <= 0:
        raise ValueError("refresh_interval_steps must be positive.")

    dt_s = dt_yr * SECONDS_PER_YEAR

    def _step_hook(
        sim: Any,
        step_index: int,
        _star_indices: list[int],
        _body_indices: list[int],
        _n_permanent: int,
    ) -> None:
        if step_index % refresh_interval_steps != 0:
            return
        apply_dust_erosion_step(
            sim=sim,
            asteroid_state_store=asteroid_state_store,
            dt_s=dt_s,
            dust_mass_flux_kg_m2_s=dust_mass_flux_kg_m2_s,
            excavation_yield=excavation_yield,
            flux_definition=flux_definition,
            metadata_store=metadata_store,
            star_indices=_star_indices,
            erosion_config=erosion_config,
        )

    return _step_hook


def sphere_mass_from_radius_and_density(radius_m: float, density_kg_m3: float) -> float:
    """
    Compute the mass of a sphere from radius and density.
    """

    return (4.0 / 3.0) * 3.141592653589793 * radius_m**3 * density_kg_m3
