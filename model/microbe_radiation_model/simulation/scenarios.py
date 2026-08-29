"""
Ready-made demo scenarios and console output formatting.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from importlib.util import find_spec
from math import pi, sqrt
from typing import Callable, List, Optional

from ..biology.survival import survival_function
from ..chemistry.hydrolysis_model import compute_hydrolysis_rate
from ..data_store import (
    append_radiation_record,
    append_rock_radiation_record,
    extend_radiation_records,
    extend_rock_radiation_records,
    write_star_uv_profile,
    reset_run_outputs,
    stamp_provenance,
    write_visualizer_simulation,
)
from ..internal_heat.model import heat_production_from_rock
from ..materials.rocks import BASALT, DEFAULT_ROCK_VARIANTS, Rock, get_rock_by_name, with_rock_overrides
from ..physics.constants import AU, SECONDS_PER_YEAR
from ..physics.geometry import biological_core_radius
from ..physics.materials import Material
from ..physics.stellar_physics import stellar_luminosity_from_solar_mass
from ..radiation import (
    COSMIC_DEEP_SPACE_MULTIPLIER,
    DEFAULT_HELIOSPHERE_RADIUS_AU,
    cosmic_flux_by_region,
    cosmic_flux_by_star,
    split_cosmic_flux,
    stellar_flux,
)
from ..provenance import build_provenance, resolve_seed
from ..run_overrides import effective_gcr_attenuation_k_m2_kg
from ..radiation.exposure_model import ExposureState, update_exposure
from ..radiation.radionuclide_model import radiation_decay_gy_per_year_from_rock
from ..radiation.shielding_model import radiation_at_point_in_rock_with_bio_core
from ..thermal import equilibrium_temperature_from_flux, temperature_profile_surface_mid_center
from .config import (
    SimulationMaterialConfig,
    SimulationRunConfig,
    default_material_config,
)
from .terminal_report import build_terminal_events_report

# Collision: stars (Sun + Gaia) = 2× radius, planets = 1× radius
STAR_COLLISION_RADIUS_MULTIPLIER = 2.0
PLANET_COLLISION_RADIUS_MULTIPLIER = 1.0


def _check_asteroid_collisions(
    sim: object,
    body_indices: list[int],
    n_permanent: int,
    asteroid_state_store: object,
    star_indices: list[int],
    time_years: float,
) -> None:
    """
    Mark asteroids as inactive (active=False) when they enter the collision radius
    of the Sun, any planet, or any Gaia star. Uses sim.particles[i].r (in AU).
    Stars (Sun + Gaia): 2× radius; planets: 1× radius.
    """
    for body_index in body_indices:
        state = asteroid_state_store.get(body_index)
        if not state.active:
            continue
        body = sim.particles[body_index]
        for target_index in range(n_permanent):
            target = sim.particles[target_index]
            radius_au = float(getattr(target, "r", 0.0))
            if radius_au <= 0.0:
                continue
            multiplier = (
                STAR_COLLISION_RADIUS_MULTIPLIER
                if target_index in star_indices
                else PLANET_COLLISION_RADIUS_MULTIPLIER
            )
            threshold_au = multiplier * radius_au
            dx = body.x - target.x
            dy = body.y - target.y
            dz = body.z - target.z
            distance_au = sqrt(dx * dx + dy * dy + dz * dz)
            if distance_au < threshold_au:
                # Recording the reason is what distinguishes hitting a star from
                # any other end. Without it the collided-with-a-star status in
                # visualizer_export was unreachable, and every collision looked
                # the same in the aggregate counts.
                asteroid_state_store.update(
                    body_index,
                    active=False,
                    termination_reason=(
                        "collided_with_star"
                        if target_index in star_indices
                        else "collided_with_planet"
                    ),
                    termination_time_years=time_years,
                    population_fraction_at_termination=state.population_fraction,
                )
                break


# Minimum v_inf (AU/yr) to avoid division by zero in R_eff formula
_V_INF_EPSILON_AU_YR = 1e-20


def _check_asteroid_effective_radii(
    sim: object,
    body_indices: list[int],
    asteroid_state_store: object,
    star_indices: list[int],
    sun_index: int = 0,
    time_years: float = 0.0,
) -> None:
    """
    For stars other than the Sun: set a distinct asteroid status flag when they
    enter the effective-radius zone of the star's Hill sphere (R_eff_hill).

    R_eff = R * sqrt(1 + (v_esc/v_inf)^2) with R = Hill radius of the star with
    respect to the Sun. REBOUND units: AU, yr, Msun.
    """
    non_sun_star_indices = [i for i in star_indices if i != sun_index]
    if not non_sun_star_indices:
        return

    sun = sim.particles[sun_index]
    for body_index in body_indices:
        state = asteroid_state_store.get(body_index)
        if not state.active:
            continue
        body = sim.particles[body_index]

        for star_index in non_sun_star_indices:
            star = sim.particles[star_index]
            dx = body.x - star.x
            dy = body.y - star.y
            dz = body.z - star.z
            distance_au = sqrt(dx * dx + dy * dy + dz * dz)

            m_star = float(star.m)
            if m_star <= 0.0:
                continue

            # Hill radius of this star relative to the Sun: a * (m/(3*M_sun))^(1/3)
            ax = star.x - sun.x
            ay = star.y - sun.y
            az = star.z - sun.z
            a_au = sqrt(ax * ax + ay * ay + az * az)
            if a_au <= 0.0:
                continue
            r_hill_au = a_au * (m_star / 3.0) ** (1.0 / 3.0)

            # v_inf: relative velocity (AU/yr). G = 4*pi^2 in REBOUND (AU, yr, Msun)
            vx = body.vx - star.vx
            vy = body.vy - star.vy
            vz = body.vz - star.vz
            v_inf = sqrt(vx * vx + vy * vy + vz * vz)
            if v_inf < _V_INF_EPSILON_AU_YR:
                v_inf = _V_INF_EPSILON_AU_YR

            # v_esc = sqrt(2*G*M/R) = 2*pi*sqrt(2*M/R) AU/yr with R = R_Hill
            v_esc_hill = 2.0 * pi * sqrt(2.0 * m_star / r_hill_au)
            r_eff_hill_au = r_hill_au * sqrt(1.0 + (v_esc_hill / v_inf) ** 2)

            if distance_au < r_eff_hill_au:
                asteroid_state_store.update(
                    body_index,
                    active=False,
                    termination_reason="entered_effective_hill",
                    termination_star_index=star_index,
                    termination_time_years=time_years,
                    population_fraction_at_termination=state.population_fraction,
                )
                break


@dataclass(frozen=True)
class BodyExposureReport:
    """
    Compact exposure and environment report for a single tracked body.
    """

    body_index: int
    cumulative_exposure: float
    nearest_star_index: int | None = None
    distance_au: float | None = None
    surface_flux: float | None = None
    local_flux: float | None = None
    gcr_local_flux: float | None = None
    surface_temperature_k: float | None = None
    mid_temperature_k: float | None = None
    center_temperature_k: float | None = None
    hydrolysis_rate_s_inv: float | None = None


@dataclass(frozen=True)
class SimulationReport:
    """
    Ustandaryzowany raport zwracany przez scenariusze demo.
    """

    mode: str
    used_rebound: bool
    message: str
    body_reports: List[BodyExposureReport] = field(default_factory=list)
    distance_au: Optional[float] = None
    surface_flux: Optional[float] = None
    local_flux: Optional[float] = None
    dt_seconds: Optional[float] = None
    total_time_years: Optional[float] = None
    permanent_bodies: Optional[int] = None
    json_exported: bool = False
    visualizer_export_path: Optional[str] = None
    # End-of-run microbial survival across fragments (Mars pipeline).
    survival_summary: Optional[dict] = None
    # Terminal outcome counts / medians (Mars pipeline only).
    terminal_events_report: Optional[dict] = None


def _survival_summary_from_store(asteroid_state_store) -> dict:
    """One-number-friendly survival stats for ensembles / reports."""
    fractions = [
        float(state.population_fraction)
        for state in asteroid_state_store.by_index.values()
    ]
    if not fractions:
        return {
            "n_fragments": 0,
            "mean_population_fraction": None,
            "median_population_fraction": None,
            "min_population_fraction": None,
            "max_population_fraction": None,
        }
    ordered = sorted(fractions)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        median = ordered[mid]
    else:
        median = 0.5 * (ordered[mid - 1] + ordered[mid])
    return {
        "n_fragments": len(fractions),
        "mean_population_fraction": sum(fractions) / len(fractions),
        "median_population_fraction": median,
        "min_population_fraction": ordered[0],
        "max_population_fraction": ordered[-1],
    }


def _resolve_report_rock(material_config: SimulationMaterialConfig) -> Rock:
    presets = [rock for rock in DEFAULT_ROCK_VARIANTS if isinstance(rock, Rock)]
    if not presets:
        base_rock = BASALT
    else:
        try:
            base_rock = get_rock_by_name(presets, material_config.rock_material.name)
        except ValueError:
            base_rock = BASALT if isinstance(BASALT, Rock) else presets[0]

    return with_rock_overrides(
        base_rock,
        name=material_config.rock_material.name,
        radius_m=material_config.rock_radius,
        density_kg_m3=material_config.rock_material.density,
        thermal_conductivity_w_mk=material_config.rock_thermal_conductivity_w_mk,
    )


def _estimate_thermal_state(
    rock: Rock,
    surface_flux: float,
    run_config: SimulationRunConfig,
) -> tuple[float | None, float | None, float | None, float | None]:
    surface_temperature_k = None
    mid_temperature_k = None
    center_temperature_k = None
    hydrolysis_rate_s_inv = None

    if run_config.thermal.enabled:
        surface_temperature_k = equilibrium_temperature_from_flux(
            surface_flux_w_m2=surface_flux,
            albedo=rock.albedo or 0.0,
        )
        mid_temperature_k = surface_temperature_k
        center_temperature_k = surface_temperature_k

        if run_config.thermal.compute_internal_profile:
            radius_m = rock.radius_m or 0.0
            thermal_conductivity = rock.thermal_conductivity_w_mk or 0.0
            if radius_m > 0.0 and thermal_conductivity > 0.0:
                heat_result = heat_production_from_rock(rock)
                (
                    surface_temperature_k,
                    mid_temperature_k,
                    center_temperature_k,
                ) = temperature_profile_surface_mid_center(
                    surface_temperature_k=surface_temperature_k,
                    heat_production_w_m3=heat_result.total_w_m3,
                    radius_m=radius_m,
                    thermal_conductivity_w_mk=thermal_conductivity,
                )

    if (
        run_config.hydrolysis.enabled
        and center_temperature_k is not None
        and rock.water_mass_fraction is not None
    ):
        hydrolysis_rate_s_inv = compute_hydrolysis_rate(
            temperature_k=center_temperature_k,
            water_mass_fraction=max(0.0, rock.water_mass_fraction),
        )

    return (
        surface_temperature_k,
        mid_temperature_k,
        center_temperature_k,
        hydrolysis_rate_s_inv,
    )


def _build_body_report(
    *,
    body_index: int,
    cumulative_exposure: float,
    nearest_index: int,
    distance_au: float,
    surface_flux: float,
    local_flux: float,
    rock: Rock,
    run_config: SimulationRunConfig,
    gcr_surface_flux: float,
    gcr_local_flux: float | None = None,
) -> tuple[BodyExposureReport, float, object]:
    thermal_state = _estimate_thermal_state(rock=rock, surface_flux=surface_flux, run_config=run_config)
    gcr_total_flux = gcr_surface_flux

    return (
        BodyExposureReport(
            body_index=body_index,
            cumulative_exposure=cumulative_exposure,
            nearest_star_index=nearest_index,
            distance_au=distance_au,
            surface_flux=surface_flux,
            local_flux=local_flux,
            gcr_local_flux=gcr_local_flux,
            surface_temperature_k=thermal_state[0],
            mid_temperature_k=thermal_state[1],
            center_temperature_k=thermal_state[2],
            hydrolysis_rate_s_inv=thermal_state[3],
        ),
        gcr_total_flux,
        split_cosmic_flux(gcr_total_flux),
    )


# Calibration of the model GCR unit to an absorbed dose rate.
#
# The cosmic-ray model works in a normalised unit where 1.0 is the flux inside
# the heliosphere; this converts that unit to Gy/year, after Mileikowsky et al.
# (2000). Named and shared because it was previously applied to the surface
# value and NOT to the shielded one, in one of the two writers - which made the
# dose after shielding exceed the dose before it in 88% of exported records.
GCR_MODEL_UNIT_TO_GY_PER_YEAR: float = 0.194


def _due(step_index: int, interval: int) -> bool:
    """
    Whether a periodic task should run on this step.

    An interval of 1 or less means every step, which keeps the previous
    behaviour as the default.
    """
    if interval is None or interval <= 1:
        return True
    return step_index % interval == 0


def _scaled(spectrum: object, field: str, total: float | None):
    """A spectrum share turned into the same dose unit as the total."""
    share = getattr(spectrum, field, None)
    if share is None or total is None:
        return None
    return share * total


def _write_json_outputs(
    *,
    rock: Rock,
    run_id: str,
    step_index: int,
    time_years: float,
    body_report: BodyExposureReport,
    gcr_total_flux: float,
    gcr_spectrum: object,
) -> None:
    # Same conversion as the pipeline writer. These two used to disagree, so a
    # single file could hold gcr_surface_flux in model units from one scenario
    # and in Gy/year from another, under one key.
    surface_dose = gcr_total_flux * GCR_MODEL_UNIT_TO_GY_PER_YEAR
    local_dose = (
        body_report.gcr_local_flux * GCR_MODEL_UNIT_TO_GY_PER_YEAR
        if body_report.gcr_local_flux is not None
        else None
    )
    append_radiation_record(
        time_years=time_years,
        step=step_index,
        uv_surface_flux=body_report.surface_flux,
        uv_local_flux=body_report.local_flux,
        uv_cumulative_exposure=body_report.cumulative_exposure,
        gcr_total_flux=surface_dose,
        gcr_proton_flux=_scaled(gcr_spectrum, "proton_flux", surface_dose),
        gcr_alpha_flux=_scaled(gcr_spectrum, "alpha_flux", surface_dose),
        gcr_hze_flux=_scaled(gcr_spectrum, "hze_flux", surface_dose),
        gcr_surface_flux=surface_dose,
        gcr_local_flux=local_dose,
        context=f"{run_id}_body_{body_report.body_index}",
    )
    append_rock_radiation_record(
        rock=rock,
        run_id=run_id,
        step_index=step_index,
        time_years=time_years,
        uv_local_flux=body_report.local_flux,
        gcr_local_flux=body_report.gcr_local_flux,
        cumulative_exposure=body_report.cumulative_exposure,
        distance_au=body_report.distance_au,
        nearest_star_index=body_report.nearest_star_index,
        T_surface_K=body_report.surface_temperature_k,
        T_mid_radius_K=body_report.mid_temperature_k,
        T_center_K=body_report.center_temperature_k,
        hydrolysis_rate_s_inv=body_report.hydrolysis_rate_s_inv,
    )


def _collect_json_output_payloads(
    *,
    rock: Rock,
    run_id: str,
    step_index: int,
    time_years: float,
    body_report: BodyExposureReport,
    gcr_total_flux: float,
    gcr_spectrum: object,
) -> tuple[dict[str, object], dict[str, object]]:
    # gcr_total_flux here is the model GCR value at the surface (1.0 inside heliosphere).
    # For analysis we export a surface dose rate in Gy/year using the 0.194 scaling.
    gcr_surface_model = gcr_total_flux
    gcr_surface_dose_gy_per_year = gcr_surface_model * GCR_MODEL_UNIT_TO_GY_PER_YEAR
    # The shielded value has to travel through the same conversion, or the
    # record claims more dose reaches the core than arrives at the surface.
    gcr_local_dose_gy_per_year = (
        body_report.gcr_local_flux * GCR_MODEL_UNIT_TO_GY_PER_YEAR
        if body_report.gcr_local_flux is not None
        else None
    )

    # Gamma: use radionuclide-based dose rate [Gy/year] as a simple gamma proxy.
    gamma_dose_gy_per_year = radiation_decay_gy_per_year_from_rock(rock)

    radiation_record = {
        "time_years": time_years,
        "step": step_index,
        "uv_surface_flux": body_report.surface_flux,
        "uv_local_flux": body_report.local_flux,
        "uv_cumulative_exposure": body_report.cumulative_exposure,
        "gcr_total_flux": gcr_surface_dose_gy_per_year,
        # split_cosmic_flux returns shares of the total, so these are scaled by
        # the surface dose to land in Gy/year like every other field here.
        "gcr_proton_flux": _scaled(gcr_spectrum, "proton_flux", gcr_surface_dose_gy_per_year),
        "gcr_alpha_flux": _scaled(gcr_spectrum, "alpha_flux", gcr_surface_dose_gy_per_year),
        "gcr_hze_flux": _scaled(gcr_spectrum, "hze_flux", gcr_surface_dose_gy_per_year),
        "gcr_surface_flux": gcr_surface_dose_gy_per_year,
        "gcr_local_flux": gcr_local_dose_gy_per_year,
        "gamma_surface_flux": gamma_dose_gy_per_year,
        "gamma_local_flux": gamma_dose_gy_per_year,
        # Friendlier English label for the body context, used in timeseries/analysis.
        "context": f"{run_id}_asteroid_{body_report.body_index}",
    }
    rock_record = {
        "rock": rock,
        "run_id": run_id,
        "step_index": step_index,
        "time_years": time_years,
        "uv_local_flux": body_report.local_flux,
        "gcr_local_flux": body_report.gcr_local_flux,
        "gamma_local_flux": gamma_dose_gy_per_year,
        "cumulative_exposure": body_report.cumulative_exposure,
        "distance_au": body_report.distance_au,
        "nearest_star_index": body_report.nearest_star_index,
        "T_surface_K": body_report.surface_temperature_k,
        "T_mid_radius_K": body_report.mid_temperature_k,
        "T_center_K": body_report.center_temperature_k,
        "hydrolysis_rate_s_inv": body_report.hydrolysis_rate_s_inv,
    }
    return radiation_record, rock_record


def _maybe_write_star_profile(
    *,
    name: str,
    mass_solar: float,
    run_config: SimulationRunConfig,
) -> None:
    if not run_config.output.export_star_uv_profile:
        return
    write_star_uv_profile(
        name=name,
        mass_solar=mass_solar,
        distances_au=run_config.output.star_profile_distances_au,
    )


def _build_visualizer_payload(
    *,
    sim: object,
    planet_names: list[str],
    n_permanent: int,
    asteroid_state_store: object | None,
    material_config: SimulationMaterialConfig,
    run_config: SimulationRunConfig,
    frames: list[dict[str, object]],
) -> dict[str, object]:
    from .visualizer_export import build_object_catalog

    objects, _object_ids = build_object_catalog(
        sim,
        n_permanent=n_permanent,
        planet_names=planet_names,
        asteroid_state_store=asteroid_state_store,
    )
    return {
        "provenance": build_provenance(
            material_config,
            run_config,
            scenario="mars_ejecta_pipeline",
            extra={"frames": len(frames), "objects": len(objects)},
        ),
        "meta": {
            "name": run_config.output.visualizer_name,
            "description": run_config.output.visualizer_description,
            "timeStep": run_config.dt_yr,
            "timeUnit": "yr",
            "positionUnit": "AU",
            "massUnit": "kg",
            "radiusUnit": "m",
            "velocityUnit": "AU/yr",
            "positionScale": run_config.output.visualizer_position_scale,
            "totalFrames": len(frames),
            "playbackFPS": run_config.output.visualizer_playback_fps,
            "fieldDescriptions": {
                # Objects
                "objects.id": "Stable identifier for a simulated object (sun, planet, star or asteroid).",
                "objects.name": "Human-readable name of the object.",
                "objects.type": "Object type: 'star', 'planet' or 'asteroid'.",
                "objects.status": "Object status for visualization: static, traveling, escaped_and_travelling, destroyed or arrived.",
                "objects.visual": "Default visual settings for the object (radius and color in the viewer).",
                "objects.info": "Additional information fields shown in the UI (mass, radius, rock type, etc.).",
                # Frames
                "frames.step": "Simulation step index for this frame.",
                "frames.time": "Simulation time for this frame [yr].",
                "frames.positions": "List of object positions in this frame.",
                "frames.positions.id": "Object identifier matching 'objects.id'.",
                "frames.positions.x": "X coordinate [AU] in the simulation frame.",
                "frames.positions.y": "Y coordinate [AU] in the simulation frame.",
                "frames.positions.z": "Z coordinate [AU] in the simulation frame.",
                "frames.velocities": "List of object velocities in this frame.",
                "frames.velocities.id": "Object identifier matching 'objects.id'.",
                "frames.velocities.vx": "Velocity component vx [AU/yr].",
                "frames.velocities.vy": "Velocity component vy [AU/yr].",
                "frames.velocities.vz": "Velocity component vz [AU/yr].",
                "frames.properties": "Per-object physical properties in this frame.",
                "frames.properties.id": "Object identifier matching 'objects.id'.",
                "frames.properties.mass": "Object mass [kg] (physical mass for stars/planets, asteroid mass from state).",
                "frames.properties.radius": "Object radius [m] (physical radius or asteroid radius).",
                "frames.properties.beta": "Radiation-pressure beta parameter for the body (dimensionless), if available.",
                "frames.properties.status": "Object status in this frame (static, traveling, escaped_and_travelling, destroyed, arrived).",
                "frames.properties.termination_reason": "Reason why an asteroid became inactive, if any.",
                "frames.properties.termination_star_index": "Index of the star that captured/destroyed the asteroid, if applicable.",
                # Frame-level aggregates (Mars ejecta pipeline)
                "frames.aggregates": "Frame-level global aggregates over all asteroids.",
                "frames.aggregates.asteroid_count": "Number of active asteroids in this frame.",
                "frames.aggregates.escaped_and_travelling_count": (
                    "Number of asteroids that have escaped the Solar System (escaped_and_travelling status)."
                ),
                "frames.aggregates.destroyed_count": (
                    "Number of asteroids that are inactive due to destruction, including collisions with stars."
                ),
                "frames.aggregates.arrived_count": (
                    "Number of asteroids that have arrived in the effective Hill sphere of a non-Sun star."
                ),
                "frames.aggregates.total_population_fraction": "Sum of surviving population fractions over all active asteroids.",
                "frames.aggregates.time_years": "Simulation time for this frame [yr] (duplicate of frames.time for convenience).",
                "frames.aggregates.uv_local_flux_sum": "Sum of UV flux at microbe locations over all reported bodies [W/m^2].",
                "frames.aggregates.gcr_local_flux_sum": "Sum of cosmic ray flux at microbe locations over all reported bodies (model units).",
                "frames.aggregates.gamma_local_flux_sum": "Sum over reported bodies of the internal gamma dose rate from the rock's own U/Th/K [Gy/year]. Previously labelled W/m^2, which it never was.",
                "frames.aggregates.T_surface_K_min": "Minimum surface temperature among reported bodies [K].",
                "frames.aggregates.T_surface_K_mean": "Mean surface temperature among reported bodies [K].",
                "frames.aggregates.T_surface_K_max": "Maximum surface temperature among reported bodies [K].",
                "frames.aggregates.T_center_K_min": "Minimum center temperature among reported bodies [K].",
                "frames.aggregates.T_center_K_mean": "Mean center temperature among reported bodies [K].",
                "frames.aggregates.T_center_K_max": "Maximum center temperature among reported bodies [K].",
                "frames.aggregates.total_erosion_mass_loss_kg": "Total cumulative mass lost to dust erosion across all active asteroids [kg].",
                "frames.aggregates.total_asteroid_mass_kg": "Total mass of all active asteroids in this frame [kg]."
            },
        },
        "objects": objects,
        "frames": frames,
        # Static for the run, so exported once rather than per frame. This is
        # the only output that shows the mechanism instead of the outcome:
        # everything else reports the dose at the centre, which is the most
        # shielded point in the rock.
        "dose_depth_profile": _dose_depth_section(material_config, asteroid_state_store),
    }


def _dose_depth_section(material_config, asteroid_state_store) -> dict:
    """
    Transmitted fraction against depth, for one representative fragment size.

    Uses the configured fragment radius rather than a sampled one so the curve
    is reproducible from the configuration alone, and states which radius it
    used so nobody reads it as applying to the whole swarm.
    """
    from ..physics.geometry import biological_core_radius
    from .dose_profile import profile_payload

    rock_radius = float(material_config.rock_radius)
    bio_radius = biological_core_radius(
        rock_radius=rock_radius,
        rock_density=material_config.rock_material.density,
        bio_density=material_config.bio_material.density,
        bio_mass_fraction=material_config.bio_mass_fraction,
    )
    payload = profile_payload(
        rock_radius_m=rock_radius,
        bio_radius_m=bio_radius,
        rock_material=material_config.rock_material,
        bio_material=material_config.bio_material,
        # material_config has no `rock_name`; the rock is named on the material
        # itself. The getattr default silently returned None every time, so the
        # depth-profile caption never said which rock it described.
        rock_type=getattr(material_config.rock_material, "name", None),
    )
    payload["note"] = (
        "Transmitted fraction of surface radiation against depth, for a "
        "fragment of the configured radius. Photons and cosmic rays are shown "
        "separately because they attenuate on scales that differ by a factor "
        "of about sixteen."
    )
    return payload


# Per-asteroid radiation sensitivity used when an asteroid carries no override.
#
# Named rather than inlined so `provenance.audit_coefficients` can read the
# live value instead of keeping a copy that could drift away from it.
# Fallback [1/Gy]; the Mars pipeline samples per fragment in impacts/mars_impact.py
# from biology.constants (Mileikowsky D10 → natural-exp 1/Gy conversion).
from ..biology.constants import DEFAULT_RADIATION_SURV_COEFF_PER_GY as DEFAULT_RADIATION_SURV_COEFF


def _default_mars_pipeline_run_config() -> SimulationRunConfig:
    from ..erosion import DustErosionConfig
    from .config import ImpactSimulationConfig, OutputConfig, RadiationPressureConfig

    return SimulationRunConfig(
        # Test configuration: moderate number of ejecta with long integration.
        #  - dt_yr: 0.025 years per output step (~9.1 days)
        #  - n_steps: 2000 (total ~50 years)
        #  - n_asteroids: 100
        dt_yr=0.025,
        n_steps=2000,
        integration_substeps=10,
        add_test_particle=False,
        radiation_pressure=RadiationPressureConfig(
            enabled=True,
            dynamic_refresh=True,
            refresh_interval_steps=1,
        ),
        dust_erosion=DustErosionConfig(
            enabled=True,
            dust_mass_flux_kg_m2_s=1.0e-12,
            excavation_yield=10.0,
            flux_definition="cross_section",
            refresh_interval_steps=1,
        ),
        impact=ImpactSimulationConfig(
            enabled=True,
            n_asteroids=100,
        ),
        output=OutputConfig(
            export_json=True,
            export_visualizer_json=True,
            export_star_uv_profile=True,
        ),
    )


def _resolve_mars_index(solar_system_bodies, configured_index: int) -> int:
    """
    Find Mars by name rather than trusting a fixed particle index.

    The index was hard-coded to 4, which is correct only when the planets are
    present. With --no-planets the simulation holds the Sun and then the Gaia
    stars, so particle 4 is a star several light years away: the ejecta were
    launched from the surface of a 0.28 solar-mass star at that star's velocity,
    and the resulting bound orbits made IAS15 take vanishingly small steps, so
    the run never terminated. A flag advertised in --help hung indefinitely.

    Raising here is the honest outcome. A Mars-ejecta scenario without Mars has
    no meaning, and failing in a second is better than appearing to work for
    five minutes and then being killed.
    """
    names = [str(name).lower() for name in (solar_system_bodies or [])]
    if "mars" in names:
        # Particle 0 is the Sun, so the planets start at index 1.
        return 1 + names.index("mars")
    raise ValueError(
        "Mars is not in the simulation, so Mars ejecta cannot be launched. "
        "This happens with --no-planets: the body at the configured index "
        f"({configured_index}) is a Gaia star, not a planet. Run with planets "
        "enabled, or use a scenario that does not start from a planetary "
        "surface."
    )


def run_mars_ejecta_pipeline_demo(
    material_config: Optional[SimulationMaterialConfig] = None,
    run_config: Optional[SimulationRunConfig] = None,
    progress: Optional[Callable[[int, int], None]] = None,
) -> SimulationReport:
    """
    Run a visualization-oriented Mars ejecta pipeline with impact, erosion and dynamic beta refresh.

    Parameters
    ----------
    progress : callable, optional
        Called as ``progress(step_index, total_steps)`` after each output frame.
        Used by the API server to report how far a run has got; a long run is
        otherwise completely opaque to the caller.
    """

    if find_spec("rebound") is None:
        return SimulationReport(
            mode="mars_ejecta_pipeline",
            used_rebound=False,
            message="REBOUND is not available, so the Mars scenario cannot be run.",
        )

    from ..erosion import apply_dust_erosion_step
    from ..impacts import ImpactEjectaConfig, create_mars_impact
    from .builder import build_simulation
    from .engine import nearest_star_index
    from .particle_ops import ParticleMetadataStore
    from .reboundx_forces import apply_radiation_pressure_forces, refresh_dynamic_beta
    from .visualizer_export import build_frame_payload, build_object_catalog

    material_config = material_config or default_material_config()
    run_config = run_config or _default_mars_pipeline_run_config()

    # Resolve the seed before anything samples from it. A run whose seed is
    # None cannot be repeated, and recording "seed: null" only documents that
    # fact; drawing one here makes every run reproducible by construction.
    run_config = _begin_run(run_config)

    build_result = build_simulation(
        gaia_csv_path=run_config.gaia_csv_path,
        use_planets=run_config.use_planets,
        gaia_config=run_config.gaia,
        solar_system_config=run_config.solar_system,
        barycenter_config=run_config.barycenter,
    )
    sim = build_result.sim
    star_indices = build_result.star_indices
    solar_system_bodies = build_result.solar_system_bodies
    n_permanent = build_result.n_permanent

    impact_defaults = run_config.impact
    impact_config = ImpactEjectaConfig(
        n_asteroids=impact_defaults.n_asteroids,
        impact_normal=None,
        cone_half_angle=impact_defaults.cone_half_angle,
        v_min_kms=impact_defaults.v_min_kms,
        v_max_kms=impact_defaults.v_max_kms,
        alpha_v=impact_defaults.alpha_v,
        radius_min_m=impact_defaults.radius_min_m,
        radius_max_m=impact_defaults.radius_max_m,
        q_size=impact_defaults.q_size,
        rock_variants=None,
        spin_period_range=impact_defaults.spin_period_range,
        obliquity_range=impact_defaults.obliquity_range,
        size_velocity_corr=impact_defaults.size_velocity_corr,
        star_indices=star_indices,
        mars_index=_resolve_mars_index(solar_system_bodies, impact_defaults.mars_index),
        seed=impact_defaults.seed,
    )
    impact_result = create_mars_impact(sim, impact_config)
    asteroid_state_store = impact_result.asteroid_state_store()
    body_indices = asteroid_state_store.asteroid_indices()

    metadata_store = ParticleMetadataStore()
    for particle_index, metadata in asteroid_state_store.metadata_by_particle().items():
        cleaned_metadata = dict(metadata)
        cleaned_metadata.pop("particle_index", None)
        metadata_store.set(particle_index, **cleaned_metadata)

    exposure_by_body: dict[int, ExposureState] = {
        body_index: ExposureState()
        for body_index in body_indices
    }

    pressure_active = False
    pressure_note = ""
    if run_config.radiation_pressure.enabled:
        beta_by_particle = {
            particle_index: float(asteroid_state_store.get(particle_index).current_beta or 0.0)
            for particle_index in body_indices
        }
        try:
            apply_radiation_pressure_forces(
                sim,
                beta_by_particle,
                run_config.radiation_pressure,
            )
            pressure_active = True
        except ImportError:
            pressure_note = "REBOUNDx is not available, so radiation pressure was not attached."

    output_dt_yr = run_config.dt_yr
    integration_substeps = max(1, run_config.integration_substeps)
    integration_dt_yr = output_dt_yr / integration_substeps
    dt_s = output_dt_yr * SECONDS_PER_YEAR
    if hasattr(sim, "dt"):
        sim.dt = integration_dt_yr
    written_profiles: set[int] = set()
    final_body_reports: list[BodyExposureReport] = []
    visualizer_frames: list[dict[str, object]] = []
    radiation_records_buffer: list[dict[str, object]] = []
    rock_records_buffer: list[dict[str, object]] = []
    _visualizer_objects, object_ids = build_object_catalog(
        sim,
        n_permanent=n_permanent,
        planet_names=solar_system_bodies,
        asteroid_state_store=asteroid_state_store,
    )
    if run_config.output.export_visualizer_json:
        visualizer_frames.append(
            build_frame_payload(
                sim,
                step_index=0,
                time_years=sim.t,
                object_ids=object_ids,
                asteroid_state_store=asteroid_state_store,
            )
        )

    # Escape threshold: distance beyond which we start treating asteroids with
    # positive orbital energy relative to the Sun as having escaped the Solar System.
    escape_distance_au = 2.0 * DEFAULT_HELIOSPHERE_RADIUS_AU

    if progress is not None:
        progress(0, run_config.n_steps)

    for step_index in range(1, run_config.n_steps):
        for _ in range(integration_substeps):
            sim.integrate(sim.t + integration_dt_yr)

        if progress is not None:
            progress(step_index, run_config.n_steps)

        _check_asteroid_effective_radii(
            sim,
            body_indices,
            asteroid_state_store,
            star_indices or [0],
            time_years=float(sim.t),
        )
        _check_asteroid_collisions(
            sim,
            body_indices,
            n_permanent,
            asteroid_state_store,
            star_indices or [0],
            time_years=float(sim.t),
        )

        # Both configs expose refresh_interval_steps and neither was consulted:
        # the work ran every step regardless, so setting it to 10 changed the
        # digest and nothing else.
        if run_config.dust_erosion.enabled and _due(
            step_index, run_config.dust_erosion.refresh_interval_steps
        ):
            apply_dust_erosion_step(
                sim=sim,
                asteroid_state_store=asteroid_state_store,
                dt_s=dt_s,
                dust_mass_flux_kg_m2_s=run_config.dust_erosion.dust_mass_flux_kg_m2_s,
                excavation_yield=run_config.dust_erosion.excavation_yield,
                flux_definition=run_config.dust_erosion.flux_definition,
                metadata_store=metadata_store,
                star_indices=star_indices,
                erosion_config=run_config.dust_erosion,
            )

        if (
            pressure_active
            and run_config.radiation_pressure.dynamic_refresh
            and _due(step_index, run_config.radiation_pressure.refresh_interval_steps)
        ):
            refresh_dynamic_beta(
                sim=sim,
                star_indices=star_indices,
                asteroid_state_store=asteroid_state_store,
                metadata_store=metadata_store,
            )

        current_body_reports: list[BodyExposureReport] = []
        for body_index in body_indices:
            asteroid_state = asteroid_state_store.get(body_index)
            if not asteroid_state.active:
                continue

            body = sim.particles[body_index]
            sun = sim.particles[0]

            # Check escape relative to the Sun: positive orbital energy and
            # distance beyond twice the nominal heliosphere radius.
            dx_sun = body.x - sun.x
            dy_sun = body.y - sun.y
            dz_sun = body.z - sun.z
            r_sun_au = sqrt(dx_sun * dx_sun + dy_sun * dy_sun + dz_sun * dz_sun)

            vx_sun = body.vx - sun.vx
            vy_sun = body.vy - sun.vy
            vz_sun = body.vz - sun.vz
            v2_sun = vx_sun * vx_sun + vy_sun * vy_sun + vz_sun * vz_sun

            # In REBOUND units (AU, yr, Msun) G = 4*pi^2 and M_sun ~= 1.
            energy_sun = 0.5 * v2_sun - 4.0 * pi * pi / max(r_sun_au, 1e-8)
            if energy_sun > 0.0 and r_sun_au > escape_distance_au:
                if not asteroid_state.extra.get("escaped_sun"):
                    asteroid_state_store.update(
                        body_index,
                        escaped_sun=True,
                        escape_time_years=float(sim.t),
                        population_fraction_at_escape=asteroid_state.population_fraction,
                    )

            nearest_index = nearest_star_index(sim, body_index, star_indices or [])
            if nearest_index is None:
                continue

            rock = asteroid_state.to_rock()
            # `Material.k` is the Beer-Lambert mass attenuation coefficient
            # [m^2/kg]. It must not be filled from the asteroid's thermal
            # conductivity [W/(m*K)] - those are different quantities, and doing
            # so drives the shielded flux to exactly zero.
            rock_material = Material(
                name=rock.name,
                density=asteroid_state.density_kg_m3,
                k=material_config.rock_material.k,
            )
            bio_material = material_config.bio_material
            star = sim.particles[nearest_index]
            dx = body.x - star.x
            dy = body.y - star.y
            dz = body.z - star.z
            distance_au = sqrt(dx * dx + dy * dy + dz * dz)
            distance_m = distance_au * AU
            luminosity = stellar_luminosity_from_solar_mass(star.m)
            surface_flux = stellar_flux(luminosity, distance_m)
            shielding_result = radiation_at_point_in_rock_with_bio_core(
                point=(0.0, 0.0, 0.0),
                rock_radius=asteroid_state.radius_m,
                bio_radius=biological_core_radius(
                    rock_radius=asteroid_state.radius_m,
                    rock_density=rock_material.density,
                    bio_density=bio_material.density,
                    bio_mass_fraction=material_config.bio_mass_fraction,
                ),
                rock_material=rock_material,
                bio_material=bio_material,
                surface_flux=surface_flux,
            )
            gcr_surface_flux = cosmic_flux_by_star(distance_au=distance_au, luminosity_w=luminosity)
            gcr_shielding_result = radiation_at_point_in_rock_with_bio_core(
                point=(0.0, 0.0, 0.0),
                rock_radius=asteroid_state.radius_m,
                bio_radius=biological_core_radius(
                    rock_radius=asteroid_state.radius_m,
                    rock_density=rock_material.density,
                    bio_density=bio_material.density,
                    bio_mass_fraction=material_config.bio_mass_fraction,
                ),
                # Cosmic rays are charged particles and penetrate about
                # sixteen times deeper than photons of the same rock thickness,
                # so they need their own attenuation coefficient rather than the
                # photon one carried on the material.
                rock_material=replace(
                    rock_material, k=effective_gcr_attenuation_k_m2_kg()
                ),
                bio_material=replace(
                    bio_material, k=effective_gcr_attenuation_k_m2_kg()
                ),
                surface_flux=gcr_surface_flux,
            )
            gcr_local_flux = gcr_shielding_result.local_flux
            update_exposure(
                state=exposure_by_body[body_index],
                local_flux=shielding_result.local_flux,
                dt=dt_s,
            )

            body_report, gcr_total_flux, gcr_spectrum = _build_body_report(
                body_index=body_index,
                cumulative_exposure=exposure_by_body[body_index].cumulative_exposure,
                nearest_index=nearest_index,
                distance_au=distance_au,
                surface_flux=surface_flux,
                local_flux=shielding_result.local_flux,
                rock=rock,
                run_config=run_config,
                gcr_surface_flux=gcr_surface_flux,
                gcr_local_flux=gcr_local_flux,
            )

            # Update the surviving population fraction from the local conditions.
            #
            # Gated on the radiation channel, not on the thermal one. This used
            # to read `if body_report.hydrolysis_rate_s_inv is not None`, which
            # meant --no-thermal silently switched off the ENTIRE survival
            # model: hydrolysis returns None when the thermal stage is disabled,
            # so the cosmic-ray and decay channels stopped being applied too and
            # population_fraction stayed at 1.0 for the whole run without a
            # warning. Radiation dose has no physical reason to depend on
            # whether a temperature was computed.
            if gcr_local_flux is not None:
                # Hydrolysis contributes only when the thermal stage ran.
                hydrolysis_rate = body_report.hydrolysis_rate_s_inv or 0.0
                # Dose from radionuclide decay inside the rock [Gy/year].
                # This fragment's own radius, not the configuration default.
                # The GCR shielding path a few lines up already uses
                # asteroid_state.radius_m, so taking the internal dose from
                # material_config.rock_radius meant one fragment was modelled at
                # two different sizes at the same instant - a pebble for cosmic
                # rays and a half-metre boulder for its own radioactivity.
                radiation_decay_gy_per_year = radiation_decay_gy_per_year_from_rock(
                    rock,
                    radius_m=asteroid_state.radius_m,
                    density_kg_m3=material_config.rock_material.density,
                )
                # Cosmic ray dose after shielding.
                # Calibration: 1.0 model GCR unit = 0.194 Gy/year (Mileikowsky et al. 2000).
                radiation_space_gy_per_year = (
                    float(gcr_local_flux) * GCR_MODEL_UNIT_TO_GY_PER_YEAR
                )
                # Step duration in years.
                t_years = dt_s / SECONDS_PER_YEAR
                # Per-asteroid radiation sensitivity [1/Gy]; see biology.constants.
                radiation_surv_coeff = float(
                    asteroid_state.extra.get(
                        "radiation_surv_coeff", DEFAULT_RADIATION_SURV_COEFF
                    )
                )
                step_survival = survival_function(
                    radiation_space_gy_per_year=radiation_space_gy_per_year,
                    radiation_decay_gy_per_year=radiation_decay_gy_per_year,
                    radiation_surv_coeff=radiation_surv_coeff,
                    t_years=t_years,
                    hdna_rate_per_s=hydrolysis_rate,
                )
                new_population_fraction = asteroid_state.population_fraction * step_survival

                # Accumulate the dose separately from the survival it causes.
                #
                # Survival factorises exactly: multiplying step survivals gives
                # exp(-c_rad * D_cum - c_hyd * H_cum), because both coefficients
                # are constant per fragment. Carrying D_cum and H_cum in the
                # output therefore lets a reader recompute the whole survival
                # curve for any other coefficient without rerunning anything -
                # which is the only honest way to show a constant known to
                # within a factor of seventeen.
                dose_cumulative = float(
                    asteroid_state.extra.get("dose_cumulative_gy", 0.0) or 0.0
                ) + (radiation_space_gy_per_year + radiation_decay_gy_per_year) * t_years
                hydrolysis_cumulative = float(
                    asteroid_state.extra.get("hydrolysis_cumulative", 0.0) or 0.0
                ) + (hydrolysis_rate or 0.0) * dt_s

                # Passed as plain keyword arguments: the store routes unknown
                # names into `extra` one at a time, whereas handing it an
                # `extra=` dict would replace the whole mapping and drop
                # everything else the fragment carries.
                asteroid_state_store.update(
                    body_index,
                    population_fraction=new_population_fraction,
                    dose_cumulative_gy=dose_cumulative,
                    hydrolysis_cumulative=hydrolysis_cumulative,
                )

            # Cache latest per-asteroid environment and biology in the state
            # so that the visualizer can expose these per-object properties.
            env_updates: dict[str, object] = {}
            env_updates["T_surface_K"] = body_report.surface_temperature_k
            env_updates["T_center_K"] = body_report.center_temperature_k
            env_updates["uv_local_flux"] = body_report.local_flux
            env_updates["gcr_local_flux"] = gcr_local_flux
            # The internal gamma dose is produced by the rock itself, so there
            # is no separate surface and core value at this level of the model -
            # the same figure applies throughout the body. It used to be hard
            # coded to 0.0 here and summed as 0.0 in the aggregates, so the
            # visualizer always displayed no internal radiation at all while the
            # export carried a real number.
            # Passing the geometry applies the finite-size correction: a small
            # fragment loses gamma dose out through its own surface, and below
            # about 20 cm radius that is most of it.
            gamma_dose = radiation_decay_gy_per_year_from_rock(
                rock,
                radius_m=asteroid_state.radius_m,
                density_kg_m3=material_config.rock_material.density,
            )
            env_updates["gamma_local_flux"] = gamma_dose
            env_updates["hydrolysis_rate_s_inv"] = body_report.hydrolysis_rate_s_inv
            env_updates["radiation_decay_gy_per_year"] = gamma_dose
            asteroid_state_store.update(
                body_index,
                **env_updates,
            )

            current_body_reports.append(body_report)

            metadata_store.set(
                body_index,
                population_fraction=asteroid_state.population_fraction,
                cumulative_exposure=body_report.cumulative_exposure,
                nearest_star_index=body_report.nearest_star_index,
                distance_au=body_report.distance_au,
                surface_flux=body_report.surface_flux,
                local_flux=body_report.local_flux,
                gcr_local_flux=body_report.gcr_local_flux,
                surface_temperature_k=body_report.surface_temperature_k,
                mid_temperature_k=body_report.mid_temperature_k,
                center_temperature_k=body_report.center_temperature_k,
                hydrolysis_rate_s_inv=body_report.hydrolysis_rate_s_inv,
            )

            if run_config.output.export_json:
                radiation_record, rock_record = _collect_json_output_payloads(
                    rock=rock,
                    run_id="mars_ejecta_pipeline",
                    step_index=step_index,
                    # sim.t is in years: sim.units = (AU, yr, Msun).
                    time_years=sim.t,
                    body_report=body_report,
                    gcr_total_flux=gcr_total_flux,
                    gcr_spectrum=gcr_spectrum,
                )
                # Add the biological information to the records when available.
                radiation_record["population_fraction"] = asteroid_state.population_fraction
                rock_record["population_fraction"] = asteroid_state.population_fraction
                radiation_records_buffer.append(radiation_record)
                rock_records_buffer.append(rock_record)

            if nearest_index not in written_profiles:
                _maybe_write_star_profile(
                    name=f"star_{nearest_index}",
                    mass_solar=float(star.m),
                    run_config=run_config,
                )
                written_profiles.add(nearest_index)

        if current_body_reports:
            final_body_reports = current_body_reports
        if run_config.output.export_visualizer_json:
            frame = build_frame_payload(
                sim,
                step_index=step_index,
                time_years=sim.t,
                object_ids=object_ids,
                asteroid_state_store=asteroid_state_store,
            )

            # Per-frame global aggregates for visualization / analytics.
            # Work on the current body reports and asteroid state.
            aggregates: dict[str, float | int | None] = {}

            # All asteroid states for this scenario.
            all_states = [asteroid_state_store.get(idx) for idx in body_indices]

            # Active asteroids.
            active_states = [state for state in all_states if state.active]

            asteroid_count = len(active_states)
            aggregates["asteroid_count"] = asteroid_count

            # Counts by high-level status.
            escaped_and_travelling_count = 0
            destroyed_count = 0
            arrived_count = 0
            for state in all_states:
                # Terminal outcomes are checked FIRST. `escaped_sun` marks a
                # transient condition - unbound from the Sun but still in
                # flight - and is never cleared, while arrival and destruction
                # are final. Testing the flag first meant `continue` skipped the
                # terminal check entirely, and since any real interstellar
                # transfer must pass 240 AU to reach another star, every arrival
                # already carried the flag. arrived_count was therefore
                # structurally always zero: the measure the whole simulation
                # exists to produce could never be non-zero.
                if not state.active:
                    reason = getattr(state, "termination_reason", None)
                    if reason in ("entered_effective_hill", "entered_hill_sphere"):
                        arrived_count += 1
                    else:
                        destroyed_count += 1
                    continue
                if state.extra.get("escaped_sun", False):
                    escaped_and_travelling_count += 1

            aggregates["escaped_and_travelling_count"] = escaped_and_travelling_count
            aggregates["destroyed_count"] = destroyed_count
            aggregates["arrived_count"] = arrived_count

            # Population fraction (sum over active asteroids).
            total_population_fraction = sum(
                float(state.population_fraction) for state in active_states
            )
            aggregates["total_population_fraction"] = total_population_fraction

            # Time in years (duplicated from frame.time for convenience).
            aggregates["time_years"] = float(sim.t)

            # Sums of local fluxes over bodies that have reports this step.
            if current_body_reports:
                uv_local_sum = sum(
                    float(r.local_flux or 0.0) for r in current_body_reports
                )
                gcr_local_sum = sum(
                    float(r.gcr_local_flux or 0.0) for r in current_body_reports
                )
                gamma_local_sum = sum(
                    float(
                        asteroid_state_store.get(r.body_index).extra.get(
                            "gamma_local_flux", 0.0
                        )
                        or 0.0
                    )
                    for r in current_body_reports
                )

                aggregates["uv_local_flux_sum"] = uv_local_sum
                aggregates["gcr_local_flux_sum"] = gcr_local_sum
                aggregates["gamma_local_flux_sum"] = gamma_local_sum

                # Temperatures: min/mean/max for surface and center.
                surface_temps = [
                    float(r.surface_temperature_k)
                    for r in current_body_reports
                    if r.surface_temperature_k is not None
                ]
                center_temps = [
                    float(r.center_temperature_k)
                    for r in current_body_reports
                    if r.center_temperature_k is not None
                ]

                if surface_temps:
                    aggregates["T_surface_K_min"] = min(surface_temps)
                    aggregates["T_surface_K_mean"] = sum(surface_temps) / len(surface_temps)
                    aggregates["T_surface_K_max"] = max(surface_temps)
                if center_temps:
                    aggregates["T_center_K_min"] = min(center_temps)
                    aggregates["T_center_K_mean"] = sum(center_temps) / len(center_temps)
                    aggregates["T_center_K_max"] = max(center_temps)

            # Total erosion mass loss (if available) and total asteroid mass.
            total_erosion_mass_loss = 0.0
            for state in active_states:
                loss = state.extra.get("cumulative_mass_loss_kg")
                if loss is not None:
                    total_erosion_mass_loss += float(loss)
            aggregates["total_erosion_mass_loss_kg"] = total_erosion_mass_loss

            total_asteroid_mass = sum(float(state.mass_kg) for state in active_states)
            aggregates["total_asteroid_mass_kg"] = total_asteroid_mass

            frame["aggregates"] = aggregates
            visualizer_frames.append(frame)

    sampled_reports = final_body_reports[: min(5, len(final_body_reports))]
    first_body = sampled_reports[0] if sampled_reports else None
    visualizer_export_path = None
    if run_config.output.export_json:
        extend_radiation_records(radiation_records_buffer)
        extend_rock_radiation_records(rock_records_buffer)
    if run_config.output.export_visualizer_json:
        visualizer_payload = _build_visualizer_payload(
            sim=sim,
            planet_names=solar_system_bodies,
            n_permanent=n_permanent,
            asteroid_state_store=asteroid_state_store,
            material_config=material_config,
            run_config=run_config,
            frames=visualizer_frames,
        )
        # The record exports are appended to during the run, so they can only
        # be stamped here - at the end, when every record in them belongs to
        # this configuration.
        stamp_provenance(visualizer_payload["provenance"])
        visualizer_export_path = str(
            write_visualizer_simulation(
                visualizer_payload,
                filename=run_config.output.visualizer_output_path,
            )
        )
    message = (
        f"Ran the Mars scenario for {len(body_indices)} asteroids and exported "
        f"{run_config.n_steps} states every {run_config.dt_yr:.3f} yr "
        f"(inner step {integration_dt_yr:.3f} yr)."
    )
    if pressure_note:
        message = f"{message} {pressure_note}"
    elif pressure_active:
        message = f"{message} Radiation pressure via REBOUNDx was active."

    terminal_report = build_terminal_events_report(
        asteroid_state_store,
        body_indices,
        simulation_time_years=float(sim.t),
    )

    return SimulationReport(
        mode="mars_ejecta_pipeline",
        used_rebound=True,
        message=message,
        body_reports=sampled_reports,
        distance_au=first_body.distance_au if first_body is not None else None,
        surface_flux=first_body.surface_flux if first_body is not None else None,
        local_flux=first_body.local_flux if first_body is not None else None,
        total_time_years=sim.t,
        permanent_bodies=n_permanent,
        json_exported=run_config.output.export_json,
        visualizer_export_path=visualizer_export_path,
        survival_summary=_survival_summary_from_store(asteroid_state_store),
        terminal_events_report=terminal_report,
    )


def _begin_run(run_config: SimulationRunConfig) -> SimulationRunConfig:
    """
    Prepare a run: pin its seed and clear the record exports.

    Both halves of the reproducibility invariant start here. The seed has to be
    fixed before anything samples from it, and the record files have to be empty
    before anything is appended to them - otherwise the block stamped at the end
    describes a file that also contains other people's runs.
    """
    if run_config.output.export_json or run_config.output.export_star_uv_profile:
        reset_run_outputs()
    return _with_resolved_seed(run_config)


def _with_resolved_seed(run_config: SimulationRunConfig) -> SimulationRunConfig:
    """
    Pin the run's seed before anything samples from it.

    Every scenario goes through this, not just the one that launches ejecta.
    A run whose seed stays None cannot be repeated, and `build_provenance`
    refuses to describe one - so resolving here is what makes the guarantee
    structural rather than a property of a single call site.
    """
    return replace(
        run_config,
        impact=replace(run_config.impact, seed=resolve_seed(run_config.impact.seed)),
    )


def _stamp_run(material_config, run_config, scenario: str) -> None:
    """
    Stamp the record exports at the end of a scenario that wrote any.

    Every scenario that touches the data files has to do this, not just the
    Mars pipeline: the writers strip any previous block when they append, so a
    scenario that skipped stamping would leave files with no provenance at all.
    """
    if not run_config.output.export_json and not run_config.output.export_star_uv_profile:
        return
    stamp_provenance(build_provenance(material_config, run_config, scenario=scenario))


def run_static_radiation_demo(
    material_config: Optional[SimulationMaterialConfig] = None,
    mass_solar: float = 1.0,
    distance_au: float = 1.0,
    dt_seconds: float = 3600.0,
    run_config: Optional[SimulationRunConfig] = None,
) -> SimulationReport:
    """
    Run the static demo of the whole radiation chain without REBOUND.
    """

    material_config = material_config or default_material_config()
    run_config = _begin_run(run_config or SimulationRunConfig())
    report_rock = _resolve_report_rock(material_config)

    bio_radius = biological_core_radius(
        rock_radius=material_config.rock_radius,
        rock_density=material_config.rock_material.density,
        bio_density=material_config.bio_material.density,
        bio_mass_fraction=material_config.bio_mass_fraction,
    )

    luminosity = stellar_luminosity_from_solar_mass(mass_solar)
    distance_m = distance_au * AU
    surface_flux = stellar_flux(luminosity, distance_m)
    result = radiation_at_point_in_rock_with_bio_core(
        point=(0.0, 0.0, 0.0),
        rock_radius=material_config.rock_radius,
        bio_radius=bio_radius,
        rock_material=material_config.rock_material,
        bio_material=material_config.bio_material,
        surface_flux=surface_flux,
    )

    state = ExposureState()
    update_exposure(state=state, local_flux=result.local_flux, dt=dt_seconds)

    # GCR: surface level from star and distance, then Beer-Lambert attenuation
    # with the cosmic-ray coefficient. Charged particles penetrate about sixteen
    # times deeper than photons, so they need their own k - the same substitution
    # the Mars pipeline and the depth profile already make.
    gcr_surface_flux = cosmic_flux_by_star(distance_au=distance_au, luminosity_w=luminosity)
    gcr_result = radiation_at_point_in_rock_with_bio_core(
        point=(0.0, 0.0, 0.0),
        rock_radius=material_config.rock_radius,
        bio_radius=bio_radius,
        rock_material=replace(material_config.rock_material, k=effective_gcr_attenuation_k_m2_kg()),
        bio_material=replace(material_config.bio_material, k=effective_gcr_attenuation_k_m2_kg()),
        surface_flux=gcr_surface_flux,
    )

    body_report, gcr_total_flux, gcr_spectrum = _build_body_report(
        body_index=0,
        cumulative_exposure=state.cumulative_exposure,
        nearest_index=0,
        distance_au=distance_au,
        surface_flux=surface_flux,
        local_flux=result.local_flux,
        rock=report_rock,
        run_config=run_config,
        gcr_surface_flux=gcr_surface_flux,
        gcr_local_flux=gcr_result.local_flux,
    )

    if run_config.output.export_json:
        _write_json_outputs(
            rock=report_rock,
            run_id="static_radiation_demo",
            step_index=0,
            time_years=dt_seconds / SECONDS_PER_YEAR,
            body_report=body_report,
            gcr_total_flux=gcr_total_flux,
            gcr_spectrum=gcr_spectrum,
        )

    _maybe_write_star_profile(
        name="Sun",
        mass_solar=mass_solar,
        run_config=run_config,
    )
    _stamp_run(material_config, run_config, "static_radiation_demo")

    return SimulationReport(
        mode="static_radiation",
        used_rebound=False,
        message="REBOUND is not available; showing the full radiation pipeline without orbital dynamics.",
        body_reports=[body_report],
        distance_au=distance_au,
        surface_flux=surface_flux,
        local_flux=result.local_flux,
        dt_seconds=dt_seconds,
        json_exported=run_config.output.export_json,
    )


def run_connected_demo(
    material_config: Optional[SimulationMaterialConfig] = None,
    run_config: Optional[SimulationRunConfig] = None,
) -> SimulationReport:
    """
    Run the full demo; falls back to static mode when REBOUND is not installed.
    """

    run_config = _begin_run(run_config or SimulationRunConfig())
    if find_spec("rebound") is None:
        return run_static_radiation_demo(material_config=material_config, run_config=run_config)

    material_config = material_config or default_material_config()
    report_rock = _resolve_report_rock(material_config)
    from .engine import nearest_star_index, run_simulation

    sim, exposure_by_body, star_indices, _solar_system_bodies, n_permanent = run_simulation(
        sim=None,
        star_indices=None,
        body_indices=None,
        rock_radius=material_config.rock_radius,
        rock_material=material_config.rock_material,
        bio_material=material_config.bio_material,
        bio_mass_fraction=material_config.bio_mass_fraction,
        run_config=run_config,
    )

    body_reports: list[BodyExposureReport] = []
    written_profiles: set[int] = set()
    total_time_seconds = max(sim.t * SECONDS_PER_YEAR, run_config.dt_yr * run_config.n_steps * SECONDS_PER_YEAR)

    bio_radius = biological_core_radius(
        rock_radius=material_config.rock_radius,
        rock_density=material_config.rock_material.density,
        bio_density=material_config.bio_material.density,
        bio_mass_fraction=material_config.bio_mass_fraction,
    )

    for body_index, state in sorted(exposure_by_body.items()):
        nearest_index = nearest_star_index(sim, body_index, star_indices or [])
        if nearest_index is None:
            body_reports.append(
                BodyExposureReport(
                    body_index=body_index,
                    cumulative_exposure=state.cumulative_exposure,
                )
            )
            continue

        body = sim.particles[body_index]
        star = sim.particles[nearest_index]
        dx = body.x - star.x
        dy = body.y - star.y
        dz = body.z - star.z
        distance_au = sqrt(dx * dx + dy * dy + dz * dz)
        distance_m = distance_au * AU
        luminosity = stellar_luminosity_from_solar_mass(star.m)
        surface_flux = stellar_flux(luminosity, distance_m)
        shielding_result = radiation_at_point_in_rock_with_bio_core(
            point=(0.0, 0.0, 0.0),
            rock_radius=material_config.rock_radius,
            bio_radius=bio_radius,
            rock_material=material_config.rock_material,
            bio_material=material_config.bio_material,
            surface_flux=surface_flux,
        )

        # GCR: surface level from star and distance, then Beer-Lambert with the
        # cosmic-ray coefficient (its own k, not the photon one) - as the Mars
        # pipeline and the depth profile already do.
        gcr_surface_flux = cosmic_flux_by_star(distance_au=distance_au, luminosity_w=luminosity)
        gcr_shielding_result = radiation_at_point_in_rock_with_bio_core(
            point=(0.0, 0.0, 0.0),
            rock_radius=material_config.rock_radius,
            bio_radius=bio_radius,
            rock_material=replace(material_config.rock_material, k=effective_gcr_attenuation_k_m2_kg()),
            bio_material=replace(material_config.bio_material, k=effective_gcr_attenuation_k_m2_kg()),
            surface_flux=gcr_surface_flux,
        )

        body_report, gcr_total_flux, gcr_spectrum = _build_body_report(
            body_index=body_index,
            cumulative_exposure=state.cumulative_exposure,
            nearest_index=nearest_index,
            distance_au=distance_au,
            surface_flux=surface_flux,
            local_flux=shielding_result.local_flux,
            rock=report_rock,
            run_config=run_config,
            gcr_surface_flux=gcr_surface_flux,
            gcr_local_flux=gcr_shielding_result.local_flux,
        )
        body_reports.append(body_report)

        if run_config.output.export_json:
            _write_json_outputs(
                rock=report_rock,
                run_id="connected_demo",
                step_index=run_config.n_steps,
                # Years, like every other writer. This one passed seconds,
                # so a single file held two conventions under one key.
                time_years=total_time_seconds / SECONDS_PER_YEAR,
                body_report=body_report,
                gcr_total_flux=gcr_total_flux,
                gcr_spectrum=gcr_spectrum,
            )

        if nearest_index not in written_profiles:
            _maybe_write_star_profile(
                name=f"star_{nearest_index}",
                mass_solar=float(star.m),
                run_config=run_config,
            )
            written_profiles.add(nearest_index)

    _stamp_run(material_config, run_config, "connected_demo")

    first_body = body_reports[0] if body_reports else None
    return SimulationReport(
        mode="rebound_pipeline",
        used_rebound=True,
        message="Ran the connected REBOUND, radiation, temperature and hydrolysis pipeline.",
        body_reports=body_reports,
        distance_au=first_body.distance_au if first_body is not None else None,
        surface_flux=first_body.surface_flux if first_body is not None else None,
        local_flux=first_body.local_flux if first_body is not None else None,
        total_time_years=sim.t,
        permanent_bodies=n_permanent,
        json_exported=run_config.output.export_json,
    )


def format_demo_report(report: SimulationReport) -> str:
    """
    Render a scenario report as readable console text.
    """

    lines = [
        "=== Demo report ===",
        f"Mode: {report.mode}",
        report.message,
    ]

    if report.distance_au is not None:
        lines.append(f"Distance to star: {report.distance_au:.3f} AU")
    if report.surface_flux is not None:
        lines.append(f"Flux at rock surface: {report.surface_flux:.3e} W/m^2")
    if report.local_flux is not None:
        lines.append(f"Flux at biological core: {report.local_flux:.3e} W/m^2")
    if report.dt_seconds is not None:
        lines.append(f"Exposure time step: {report.dt_seconds:.1f} s")
    if report.total_time_years is not None:
        lines.append(f"Final simulation time: {report.total_time_years:.6f} yr")
    if report.permanent_bodies is not None:
        lines.append(f"Permanent bodies in simulation: {report.permanent_bodies}")
    if report.json_exported:
        lines.append("JSON export: enabled")
    if report.visualizer_export_path is not None:
        lines.append(f"Visualizer export: {report.visualizer_export_path}")

    if report.survival_summary is not None:
        s = report.survival_summary
        lines.append(
            f"Survival: median population fraction {s.get('median_population_fraction')}"
        )
    if report.terminal_events_report is not None:
        t = report.terminal_events_report
        c = t.get("counts", {})
        lines.append("Terminal outcomes:")
        lines.append(f"  arrived: {c.get('arrived', 0)}")
        lines.append(f"  collided (star): {c.get('collided_star', 0)}")
        lines.append(f"  collided (planet): {c.get('collided_planet', 0)}")
        lines.append(f"  escaped, still travelling: {c.get('escaped_travelling', 0)}")
        lines.append(f"  still in solar system: {c.get('travelling', 0)}")

    if report.body_reports:
        for body_report in report.body_reports:
            lines.append(
                f"Body {body_report.body_index}: cumulative exposure = "
                f"{body_report.cumulative_exposure:.3e} J/m^2"
            )
            if body_report.nearest_star_index is not None:
                lines.append(f"  Nearest star: {body_report.nearest_star_index}")
            if body_report.distance_au is not None:
                lines.append(f"  Distance: {body_report.distance_au:.3f} AU")
            if body_report.center_temperature_k is not None:
                lines.append(f"  Centre temperature: {body_report.center_temperature_k:.2f} K")
            if body_report.hydrolysis_rate_s_inv is not None:
                lines.append(f"  Hydrolysis rate: {body_report.hydrolysis_rate_s_inv:.3e} 1/s")
    else:
        lines.append("No bodies tracked in this scenario.")

    return "\n".join(lines)
