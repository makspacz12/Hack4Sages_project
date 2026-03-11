"""
Gotowe scenariusze demo i formatowanie wyników do konsoli.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from importlib.util import find_spec
from math import sqrt
from typing import List, Optional

from ..chemistry.hydrolysis_model import compute_hydrolysis_rate
from ..data_store import (
    append_radiation_record,
    append_rock_radiation_record,
    extend_radiation_records,
    extend_rock_radiation_records,
    write_star_uv_profile,
    write_visualizer_simulation,
)
from ..internal_heat.model import heat_production_from_rock
from ..materials.rocks import BASALT, DEFAULT_ROCK_VARIANTS, Rock, get_rock_by_name, with_rock_overrides
from ..physics.constants import AU, SECONDS_PER_YEAR
from ..physics.geometry import biological_core_radius
from ..physics.materials import Material
from ..physics.stellar_physics import stellar_luminosity_from_solar_mass
from ..radiation import cosmic_flux_by_region, split_cosmic_flux, stellar_flux
from ..radiation.exposure_model import ExposureState, update_exposure
from ..radiation.shielding_model import radiation_at_point_in_rock_with_bio_core
from ..thermal import equilibrium_temperature_from_flux, temperature_profile_surface_mid_center
from .config import SimulationMaterialConfig, SimulationRunConfig, default_material_config


@dataclass(frozen=True)
class BodyExposureReport:
    """
    Zwięzły raport ekspozycji i środowiska dla jednego śledzonego ciała.
    """

    body_index: int
    cumulative_exposure: float
    nearest_star_index: int | None = None
    distance_au: float | None = None
    surface_flux: float | None = None
    local_flux: float | None = None
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
        thermal_conductivity_w_mk=material_config.rock_material.k,
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
) -> tuple[BodyExposureReport, float, object]:
    thermal_state = _estimate_thermal_state(rock=rock, surface_flux=surface_flux, run_config=run_config)
    gcr_total_flux = cosmic_flux_by_region(distance_au=distance_au)

    return (
        BodyExposureReport(
            body_index=body_index,
            cumulative_exposure=cumulative_exposure,
            nearest_star_index=nearest_index,
            distance_au=distance_au,
            surface_flux=surface_flux,
            local_flux=local_flux,
            surface_temperature_k=thermal_state[0],
            mid_temperature_k=thermal_state[1],
            center_temperature_k=thermal_state[2],
            hydrolysis_rate_s_inv=thermal_state[3],
        ),
        gcr_total_flux,
        split_cosmic_flux(gcr_total_flux),
    )


def _write_json_outputs(
    *,
    rock: Rock,
    run_id: str,
    step_index: int,
    time_seconds: float,
    body_report: BodyExposureReport,
    gcr_total_flux: float,
    gcr_spectrum: object,
) -> None:
    append_radiation_record(
        time_seconds=time_seconds,
        uv_surface_flux=body_report.surface_flux,
        uv_local_flux=body_report.local_flux,
        uv_cumulative_exposure=body_report.cumulative_exposure,
        gcr_total_flux=gcr_total_flux,
        gcr_proton_flux=getattr(gcr_spectrum, "proton_flux", None),
        gcr_alpha_flux=getattr(gcr_spectrum, "alpha_flux", None),
        gcr_hze_flux=getattr(gcr_spectrum, "hze_flux", None),
        gcr_surface_flux=gcr_total_flux,
        context=f"{run_id}_body_{body_report.body_index}",
    )
    append_rock_radiation_record(
        rock=rock,
        run_id=run_id,
        step_index=step_index,
        time_seconds=time_seconds,
        uv_local_flux=body_report.local_flux,
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
    time_seconds: float,
    body_report: BodyExposureReport,
    gcr_total_flux: float,
    gcr_spectrum: object,
) -> tuple[dict[str, object], dict[str, object]]:
    radiation_record = {
        "time_seconds": time_seconds,
        "uv_surface_flux": body_report.surface_flux,
        "uv_local_flux": body_report.local_flux,
        "uv_cumulative_exposure": body_report.cumulative_exposure,
        "gcr_total_flux": gcr_total_flux,
        "gcr_proton_flux": getattr(gcr_spectrum, "proton_flux", None),
        "gcr_alpha_flux": getattr(gcr_spectrum, "alpha_flux", None),
        "gcr_hze_flux": getattr(gcr_spectrum, "hze_flux", None),
        "gcr_surface_flux": gcr_total_flux,
        "context": f"{run_id}_body_{body_report.body_index}",
    }
    rock_record = {
        "rock": rock,
        "run_id": run_id,
        "step_index": step_index,
        "time_seconds": time_seconds,
        "uv_local_flux": body_report.local_flux,
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
        },
        "objects": objects,
        "frames": frames,
    }


def _default_mars_pipeline_run_config() -> SimulationRunConfig:
    from ..erosion import DustErosionConfig
    from .config import ImpactSimulationConfig, OutputConfig, RadiationPressureConfig

    return SimulationRunConfig(
        dt_yr=0.1,
        n_steps=1000,
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


def run_mars_ejecta_pipeline_demo(
    material_config: Optional[SimulationMaterialConfig] = None,
    run_config: Optional[SimulationRunConfig] = None,
) -> SimulationReport:
    """
    Run a visualization-oriented Mars ejecta pipeline with impact, erosion and dynamic beta refresh.
    """

    if find_spec("rebound") is None:
        return SimulationReport(
            mode="mars_ejecta_pipeline",
            used_rebound=False,
            message="REBOUND nie jest dostępny, więc scenariusz marsjański nie może zostać uruchomiony.",
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
        mars_index=impact_defaults.mars_index,
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
            pressure_note = "REBOUNDx nie jest dostępny, więc ciśnienie promieniowania nie zostało podpięte."

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

    for step_index in range(1, run_config.n_steps):
        for _ in range(integration_substeps):
            sim.integrate(sim.t + integration_dt_yr)

        if run_config.dust_erosion.enabled:
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

        if pressure_active and run_config.radiation_pressure.dynamic_refresh:
            refresh_dynamic_beta(
                sim=sim,
                star_indices=star_indices,
                asteroid_state_store=asteroid_state_store,
                metadata_store=metadata_store,
            )

        current_body_reports: list[BodyExposureReport] = []
        for body_index in body_indices:
            asteroid_state = asteroid_state_store.get(body_index)
            nearest_index = nearest_star_index(sim, body_index, star_indices or [])
            if nearest_index is None:
                continue

            rock = asteroid_state.to_rock()
            rock_material = Material(
                name=rock.name,
                density=asteroid_state.density_kg_m3,
                k=(
                    asteroid_state.thermal_conductivity_w_mk
                    if asteroid_state.thermal_conductivity_w_mk is not None
                    else material_config.rock_material.k
                ),
            )
            bio_material = material_config.bio_material
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
                    time_seconds=sim.t * SECONDS_PER_YEAR,
                    body_report=body_report,
                    gcr_total_flux=gcr_total_flux,
                    gcr_spectrum=gcr_spectrum,
                )
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
            visualizer_frames.append(
                build_frame_payload(
                    sim,
                    step_index=step_index,
                    time_years=sim.t,
                    object_ids=object_ids,
                    asteroid_state_store=asteroid_state_store,
                )
            )

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
            run_config=run_config,
            frames=visualizer_frames,
        )
        visualizer_export_path = str(
            write_visualizer_simulation(
                visualizer_payload,
                filename=run_config.output.visualizer_output_path,
            )
        )
    message = (
        f"Uruchomiono scenariusz marsjański dla {len(body_indices)} asteroid i "
        f"wyeksportowano {run_config.n_steps} stanów co {run_config.dt_yr:.3f} roku "
        f"(krok wewnętrzny {integration_dt_yr:.3f} roku)."
    )
    if pressure_note:
        message = f"{message} {pressure_note}"
    elif pressure_active:
        message = f"{message} Ciśnienie promieniowania przez REBOUNDx było aktywne."

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
    )


def run_static_radiation_demo(
    material_config: Optional[SimulationMaterialConfig] = None,
    mass_solar: float = 1.0,
    distance_au: float = 1.0,
    dt_seconds: float = 3600.0,
    run_config: Optional[SimulationRunConfig] = None,
) -> SimulationReport:
    """
    Uruchamia statyczne demo całego łańcucha promieniowania bez REBOUND.
    """

    material_config = material_config or default_material_config()
    run_config = run_config or SimulationRunConfig()
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

    body_report, gcr_total_flux, gcr_spectrum = _build_body_report(
        body_index=0,
        cumulative_exposure=state.cumulative_exposure,
        nearest_index=0,
        distance_au=distance_au,
        surface_flux=surface_flux,
        local_flux=result.local_flux,
        rock=report_rock,
        run_config=run_config,
    )

    if run_config.output.export_json:
        _write_json_outputs(
            rock=report_rock,
            run_id="static_radiation_demo",
            step_index=0,
            time_seconds=dt_seconds,
            body_report=body_report,
            gcr_total_flux=gcr_total_flux,
            gcr_spectrum=gcr_spectrum,
        )

    _maybe_write_star_profile(
        name="Sun",
        mass_solar=mass_solar,
        run_config=run_config,
    )

    return SimulationReport(
        mode="static_radiation",
        used_rebound=False,
        message="REBOUND nie jest dostępny, więc pokazuję kompletny pipeline promieniowania bez dynamiki orbitalnej.",
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
    Uruchamia pełne demo; jeśli REBOUND nie jest zainstalowany, przechodzi na tryb statyczny.
    """

    run_config = run_config or SimulationRunConfig()
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

        body_report, gcr_total_flux, gcr_spectrum = _build_body_report(
            body_index=body_index,
            cumulative_exposure=state.cumulative_exposure,
            nearest_index=nearest_index,
            distance_au=distance_au,
            surface_flux=surface_flux,
            local_flux=shielding_result.local_flux,
            rock=report_rock,
            run_config=run_config,
        )
        body_reports.append(body_report)

        if run_config.output.export_json:
            _write_json_outputs(
                rock=report_rock,
                run_id="connected_demo",
                step_index=run_config.n_steps,
                time_seconds=total_time_seconds,
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

    first_body = body_reports[0] if body_reports else None
    return SimulationReport(
        mode="rebound_pipeline",
        used_rebound=True,
        message="Uruchomiono połączony pipeline REBOUND, promieniowania, temperatury i hydrolyzy.",
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
    Zamienia raport scenariusza na czytelny tekst do konsoli.
    """

    lines = [
        "=== Raport demo ===",
        f"Tryb: {report.mode}",
        report.message,
    ]

    if report.distance_au is not None:
        lines.append(f"Odległość od gwiazdy: {report.distance_au:.3f} AU")
    if report.surface_flux is not None:
        lines.append(f"Strumień na powierzchni skały: {report.surface_flux:.3e} W/m^2")
    if report.local_flux is not None:
        lines.append(f"Strumień w centrum biologicznym: {report.local_flux:.3e} W/m^2")
    if report.dt_seconds is not None:
        lines.append(f"Krok czasu ekspozycji: {report.dt_seconds:.1f} s")
    if report.total_time_years is not None:
        lines.append(f"Czas końcowy symulacji: {report.total_time_years:.6f} roku")
    if report.permanent_bodies is not None:
        lines.append(f"Liczba ciał stałych w symulacji: {report.permanent_bodies}")
    if report.json_exported:
        lines.append("Eksport JSON: włączony")
    if report.visualizer_export_path is not None:
        lines.append(f"Eksport wizualizacji: {report.visualizer_export_path}")

    if report.body_reports:
        for body_report in report.body_reports:
            lines.append(
                f"Ciało {body_report.body_index}: ekspozycja skumulowana = "
                f"{body_report.cumulative_exposure:.3e} J/m^2"
            )
            if body_report.nearest_star_index is not None:
                lines.append(f"  Najbliższa gwiazda: {body_report.nearest_star_index}")
            if body_report.distance_au is not None:
                lines.append(f"  Odległość: {body_report.distance_au:.3f} AU")
            if body_report.center_temperature_k is not None:
                lines.append(f"  Temperatura centrum: {body_report.center_temperature_k:.2f} K")
            if body_report.hydrolysis_rate_s_inv is not None:
                lines.append(f"  Hydroliza: {body_report.hydrolysis_rate_s_inv:.3e} 1/s")
    else:
        lines.append("Brak ciał śledzonych w tym scenariuszu.")

    return "\n".join(lines)
