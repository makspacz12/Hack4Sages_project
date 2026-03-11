"""
Pomocnicze konfiguracje dla scenariuszy uruchomieniowych.
"""

from dataclasses import dataclass
from typing import Optional

from ..catalogs.asteroid_properties import DEFAULT_ROCK_VARIANTS
from ..materials.rocks import Rock
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

    # Backward compatibility: support legacy dict variants if present.
    if isinstance(domyslna_skala, dict):
        rock_name = str(domyslna_skala["name"])
        rock_density = float(domyslna_skala["density"])
        rock_radius = 0.5
    else:
        rock = domyslna_skala
        if not isinstance(rock, Rock):
            raise TypeError(
                "DEFAULT_ROCK_VARIANTS should contain Rock objects "
                "or legacy dict variants."
            )
        if rock.density_kg_m3 is None:
            raise ValueError(f"Rock '{rock.name}' is missing density_kg_m3.")
        rock_name = rock.name
        rock_density = rock.density_kg_m3
        rock_radius = rock.radius_m if rock.radius_m is not None else 0.5

    return SimulationMaterialConfig(
        rock_radius=rock_radius,
        bio_mass_fraction=0.01,
        rock_material=Material(name=rock_name, density=rock_density, k=0.01),
        bio_material=Material(name="bio", density=1100.0, k=0.02),
    )
