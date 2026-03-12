"""
Wejścia uruchomieniowe i skrypty demonstracyjne.
"""

from .console import configure_utf8_output


def main_demo() -> None:
    """Uruchamia główne demo."""

    from .demo import main

    main()


def main_radiation_demo() -> None:
    """Uruchamia demo statyczne bez REBOUND."""

    from .run_radiation_demo import main

    main()


def main_simulation_demo() -> None:
    """Uruchamia demo scenariusza połączonego."""

    from .run_simulation import main

    main()


def main_fetch_gaia_catalog() -> None:
    """Pobiera katalog Gaia."""

    from .fetch_gaia_catalog import main

    main()


def main_build_full_system() -> None:
    """Buduje pełny układ z kerneli SPICE/Horizons."""

    from .build_full_system import main

    main()


def main_mars_impact_demo() -> None:
    """Uruchamia demo impaktu marsjańskiego."""

    from .run_mars_impact_demo import main

    main()


def main_mars_pipeline_demo() -> None:
    """Uruchamia pełny pipeline marsjański."""

    from .run_mars_pipeline import main

    main()


def main_radiation_pressure_demo() -> None:
    """Uruchamia demo ciśnienia promieniowania."""

    from .run_radiation_pressure_demo import main

    main()


def main_dust_erosion_demo() -> None:
    """Uruchamia demo erozji pyłowej."""

    from .run_dust_erosion_demo import main

    main()

__all__ = [
    "configure_utf8_output",
    "main_build_full_system",
    "main_demo",
    "main_dust_erosion_demo",
    "main_fetch_gaia_catalog",
    "main_mars_impact_demo",
    "main_mars_pipeline_demo",
    "main_radiation_demo",
    "main_radiation_pressure_demo",
    "main_simulation_demo",
]
