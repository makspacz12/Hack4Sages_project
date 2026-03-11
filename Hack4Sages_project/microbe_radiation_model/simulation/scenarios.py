"""
Gotowe scenariusze demo i formatowanie wyników do konsoli.
"""

from dataclasses import dataclass, field
from importlib.util import find_spec
from typing import List, Optional

from ..materials.rocks import Rock, BASALT
from ..physics.constants import AU, SECONDS_PER_YEAR
from ..physics.geometry import biological_core_radius
from ..physics.stellar_physics import stellar_luminosity_from_solar_mass
from ..radiation.exposure_model import ExposureState, update_exposure
from ..radiation import stellar_flux
from ..radiation.shielding_model import radiation_at_point_in_rock_with_bio_core
from ..data_store import (
    append_radiation_record,
    append_rock_radiation_record,
    write_star_uv_profile,
)
from ..internal_heat.model import heat_production_from_rock
from ..thermal import equilibrium_temperature_from_flux, temperature_profile_surface_mid_center
from .config import SimulationMaterialConfig, SimulationRunConfig, default_material_config
from .engine import run_simulation


@dataclass(frozen=True)
class BodyExposureReport:
    """
    Zwięzły raport ekspozycji dla jednego ciała śledzonego w symulacji.
    """

    body_index: int
    cumulative_exposure: float


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


def run_static_radiation_demo(
    material_config: Optional[SimulationMaterialConfig] = None,
    mass_solar: float = 1.0,
    distance_au: float = 1.0,
    dt_seconds: float = 3600.0,
) -> SimulationReport:
    """
    Uruchamia statyczne demo całego łańcucha promieniowania bez REBOUND.
    """

    material_config = material_config or default_material_config()

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

    # Zapisujemy dane promieniowania do pliku JSON.
    # W tym prostym demo traktujemy obliczony strumień jako komponent UV:
    # - uv_surface_flux: flux na powierzchni skały
    # - uv_local_flux: flux w centrum biologicznym
    # - uv_cumulative_exposure: skumulowana energia UV w czasie dt_seconds
    append_radiation_record(
        time_seconds=dt_seconds,
        uv_surface_flux=surface_flux,
        uv_local_flux=result.local_flux,
        uv_cumulative_exposure=state.cumulative_exposure,
        context="static_radiation_demo",
    )

    # Szacujemy prosty profil temperatury wewnątrz skały:
    # - T_surface z równowagi radiacyjnej (zewnętrzny flux),
    # - Q z modelu ciepła radiogenicznego,
    # - k_th z przewodnictwa cieplnego skały.
    rock_variant = BASALT  # dla demo statycznego używamy domyślnej skały bazaltowej
    albedo = rock_variant.albedo or 0.0
    k_th = rock_variant.thermal_conductivity_w_mk
    if k_th is not None and rock_variant.radius_m is not None:
        T_surface_K = equilibrium_temperature_from_flux(
            surface_flux_w_m2=surface_flux,
            albedo=albedo,
        )
        heat_result = heat_production_from_rock(rock_variant)
        Q_w_m3 = heat_result.total_w_m3
        T_surface_K, T_mid_K, T_center_K = temperature_profile_surface_mid_center(
            surface_temperature_k=T_surface_K,
            heat_production_w_m3=Q_w_m3,
            radius_m=rock_variant.radius_m,
            thermal_conductivity_w_mk=k_th,
        )

        append_rock_radiation_record(
            rock=rock_variant,
            run_id="static_radiation_demo",
            step_index=0,
            time_seconds=dt_seconds,
            uv_local_flux=result.local_flux,
            gcr_local_flux=None,
            gamma_local_flux=None,
            cumulative_exposure=state.cumulative_exposure,
            T_surface_K=T_surface_K,
            T_mid_radius_K=T_mid_K,
            T_center_K=T_center_K,
        )

    # Dodatkowo zapisujemy prosty profil UV dla gwiazdy (np. Słońca) w kilku odległościach,
    # żeby można go było łatwo zwizualizować w JS.
    write_star_uv_profile(
        name="Sun",
        mass_solar=mass_solar,
        distances_au=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
    )

    return SimulationReport(
        mode="static_radiation",
        used_rebound=False,
        message="REBOUND nie jest dostępny, więc pokazuję kompletny pipeline promieniowania bez dynamiki orbitalnej.",
        body_reports=[BodyExposureReport(body_index=0, cumulative_exposure=state.cumulative_exposure)],
        distance_au=distance_au,
        surface_flux=surface_flux,
        local_flux=result.local_flux,
        dt_seconds=dt_seconds,
    )


def run_connected_demo(
    material_config: Optional[SimulationMaterialConfig] = None,
    run_config: Optional[SimulationRunConfig] = None,
) -> SimulationReport:
    """
    Uruchamia pełne demo; jeśli REBOUND nie jest zainstalowany, przechodzi na tryb statyczny.
    """

    if find_spec("rebound") is None:
        return run_static_radiation_demo(material_config=material_config)

    material_config = material_config or default_material_config()
    run_config = run_config or SimulationRunConfig()

    sim, exposure_by_body, _star_indices, _solar_system_bodies, n_permanent = run_simulation(
        sim=None,
        star_indices=None,
        body_indices=None,
        rock_radius=material_config.rock_radius,
        rock_material=material_config.rock_material,
        bio_material=material_config.bio_material,
        bio_mass_fraction=material_config.bio_mass_fraction,
        dt_yr=run_config.dt_yr,
        n_steps=run_config.n_steps,
        add_test_particle=run_config.add_test_particle,
        gaia_csv_path=run_config.gaia_csv_path,
        use_planets=run_config.use_planets,
    )

    body_reports = [
        BodyExposureReport(body_index=body_index, cumulative_exposure=state.cumulative_exposure)
        for body_index, state in sorted(exposure_by_body.items())
    ]

    # Zapisujemy podsumowanie promieniowania względem skały do osobnego JSON-a.
    rock_def = Rock(
        name=material_config.rock_material.name,
        radius_m=material_config.rock_radius,
        density_kg_m3=material_config.rock_material.density,
        albedo=None,
        water_mass_fraction=None,
        porosity=None,
        probability=1.0,
        uranium238_ppm=None,
        thorium232_ppm=None,
        potassium_percent=None,
        extra={},
        notes="Generated from SimulationMaterialConfig in run_connected_demo.",
    )

    total_time_seconds = sim.t * SECONDS_PER_YEAR
    if total_time_seconds <= 0.0:
        total_time_seconds = run_config.dt_yr * run_config.n_steps * SECONDS_PER_YEAR

    for body_index, state in exposure_by_body.items():
        # Średni lokalny strumień UV w centrum skały ~ ekspozycja / czas
        avg_uv_local_flux = (
            state.cumulative_exposure / total_time_seconds
            if total_time_seconds > 0.0
            else None
        )

        append_rock_radiation_record(
            rock=rock_def,
            run_id="connected_demo",
            step_index=run_config.n_steps,
            time_seconds=total_time_seconds,
            uv_local_flux=avg_uv_local_flux,
            gcr_local_flux=None,
            gamma_local_flux=None,
            cumulative_exposure=state.cumulative_exposure,
        )

    return SimulationReport(
        mode="rebound_pipeline",
        used_rebound=True,
        message="Uruchomiono połączony pipeline REBOUND oraz model promieniowania.",
        body_reports=body_reports,
        total_time_years=sim.t,
        permanent_bodies=n_permanent,
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

    if report.body_reports:
        for body_report in report.body_reports:
            lines.append(
                f"Ciało {body_report.body_index}: ekspozycja skumulowana = "
                f"{body_report.cumulative_exposure:.3e} J/m^2"
            )
    else:
        lines.append("Brak ciał śledzonych w tym scenariuszu.")

    return "\n".join(lines)
