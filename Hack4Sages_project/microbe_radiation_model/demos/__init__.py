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

__all__ = [
    "configure_utf8_output",
    "main_demo",
    "main_radiation_demo",
    "main_simulation_demo",
]
