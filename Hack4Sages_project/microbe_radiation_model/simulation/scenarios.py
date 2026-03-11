"""
Gotowe scenariusze demo i formatowanie wyników do konsoli.
"""

from dataclasses import dataclass, field
from importlib.util import find_spec
from typing import List, Optional

from ..physics.constants import AU
from ..physics.geometry import biological_core_radius
from ..physics.stellar_physics import stellar_luminosity_from_solar_mass
from ..radiation.exposure_model import ExposureState, update_exposure
from ..radiation.radiation_model import stellar_flux
from ..radiation.shielding_model import radiation_at_point_in_rock_with_bio_core
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
