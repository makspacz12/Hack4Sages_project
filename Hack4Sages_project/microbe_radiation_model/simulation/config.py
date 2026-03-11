"""
Pomocnicze konfiguracje dla scenariuszy uruchomieniowych.
"""

from dataclasses import dataclass
from typing import Optional

from ..catalogs.asteroid_properties import DEFAULT_ROCK_VARIANTS
from ..physics.materials import Material


@dataclass(frozen=True)
class SimulationMaterialConfig:
    """
    Zestaw parametrów materiałowych i geometrycznych dla śledzonego obiektu.
    """

    rock_radius: float
    bio_mass_fraction: float
    rock_material: Material
    bio_material: Material


@dataclass(frozen=True)
class SimulationRunConfig:
    """
    Parametry przebiegu czasowego i konfiguracji otoczenia REBOUND.
    """

    dt_yr: float = 1.0 / 365.25
    n_steps: int = 10
    add_test_particle: bool = True
    gaia_csv_path: Optional[str] = "nearest_50_gaia.csv"
    use_planets: bool = True


def default_material_config() -> SimulationMaterialConfig:
    """
    Zwraca domyślny zestaw materiałów używany w obecnych demach.
    """

    domyslna_skala = DEFAULT_ROCK_VARIANTS[0]

    return SimulationMaterialConfig(
        rock_radius=0.5,
        bio_mass_fraction=0.01,
        rock_material=Material(name=domyslna_skala["name"], density=domyslna_skala["density"], k=0.01),
        bio_material=Material(name="bio", density=1100.0, k=0.02),
    )
