"""
Project runner for the active simulation pipeline.

This script does not depend on `srodowisko.ipynb`.
"""

from microbe_radiation_model.demos.console import configure_utf8_output
from microbe_radiation_model.simulation.scenarios import (
    format_demo_report,
    run_connected_demo,
    run_static_radiation_demo,
)


def print_runtime_reports() -> None:
    print("=== Runtime report: static pipeline ===")
    print(format_demo_report(run_static_radiation_demo()))
    print()
    print("=== Runtime report: connected pipeline ===")
    print(format_demo_report(run_connected_demo()))
    print()


def main() -> None:
    configure_utf8_output()
    print_runtime_reports()


if __name__ == "__main__":
    main()
