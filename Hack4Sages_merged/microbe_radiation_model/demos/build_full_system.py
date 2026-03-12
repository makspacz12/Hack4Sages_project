"""
Build the notebook-faithful solar system plus Gaia stars.
"""

import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from microbe_radiation_model.demos.console import configure_utf8_output
from microbe_radiation_model.simulation.builder import build_simulation
from microbe_radiation_model.simulation.config import BarycenterConfig
from microbe_radiation_model.simulation.gaia_catalog import GaiaCatalogConfig
from microbe_radiation_model.simulation.solar_system import SolarSystemBuildConfig


def main() -> None:
    configure_utf8_output()
    result = build_simulation(
        gaia_config=GaiaCatalogConfig(mode="csv"),
        solar_system_config=SolarSystemBuildConfig(mode="full_ephemeris", use_planets=True),
        barycenter_config=BarycenterConfig(enabled=True),
    )
    print("=== Zbudowano pełny układ ===")
    print(f"Liczba cząstek: {result.sim.N}")
    print(f"Planety: {', '.join(result.solar_system_bodies) if result.solar_system_bodies else 'brak'}")
    print(f"Liczba źródeł gwiazdowych: {len(result.star_indices)}")
    print(f"Liczba ciał stałych: {result.n_permanent}")


if __name__ == "__main__":
    main()
