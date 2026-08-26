"""
Entry point running the full pipeline with default settings.
"""

import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from microbe_radiation_model.demos.console import configure_utf8_output
from microbe_radiation_model.simulation.scenarios import format_demo_report, run_connected_demo


def main() -> None:
    """
    Run the default demo and print the results to the console.
    """

    configure_utf8_output()
    print(format_demo_report(run_connected_demo()))


if __name__ == "__main__":
    main()
