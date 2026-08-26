"""
Default entry point for the simulation package.
"""

from ..demos.console import configure_utf8_output
from .scenarios import format_demo_report, run_connected_demo


def main() -> None:
    """
    Run the default demo and print the results to the console.
    """

    configure_utf8_output()
    print(format_demo_report(run_connected_demo()))


if __name__ == "__main__":
    main()
