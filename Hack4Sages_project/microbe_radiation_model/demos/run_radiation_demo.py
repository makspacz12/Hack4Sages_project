"""
Prosty punkt wejścia uruchamiający statyczne demo promieniowania.
"""

import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from microbe_radiation_model.demos.console import configure_utf8_output
from microbe_radiation_model.simulation.scenarios import format_demo_report, run_static_radiation_demo


def main() -> None:
    """
    Uruchamia demo bez REBOUND i wypisuje wyniki w konsoli.
    """

    configure_utf8_output()
    print(format_demo_report(run_static_radiation_demo()))


if __name__ == "__main__":
    main()
