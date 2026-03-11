"""
Domyślny punkt wejścia dla katalogu simulation.
"""

from ..demos.console import configure_utf8_output
from .scenarios import format_demo_report, run_connected_demo


def main() -> None:
    """
    Uruchamia domyślne demo i wypisuje wyniki w konsoli.
    """

    configure_utf8_output()
    print(format_demo_report(run_connected_demo()))


if __name__ == "__main__":
    main()
