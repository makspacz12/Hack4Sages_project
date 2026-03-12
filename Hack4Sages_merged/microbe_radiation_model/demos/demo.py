"""
Główne demo projektu.

Najpierw pokazuje szybki test zależności gwiazda -> strumień, a następnie
uruchamia spójny scenariusz z katalogu ``simulation``.
"""

import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from microbe_radiation_model.demos.console import configure_utf8_output
from microbe_radiation_model.physics.stellar_physics import stellar_luminosity_from_solar_mass
from microbe_radiation_model.radiation.radiation_model import stellar_flux_at_au
from microbe_radiation_model.simulation.scenarios import format_demo_report, run_connected_demo


def main() -> None:
    """
    Uruchamia szybki przegląd podstawowych obliczeń i domyślny scenariusz demo.
    """

    configure_utf8_output()
    star_mass_solar = 1.5
    luminosity = stellar_luminosity_from_solar_mass(star_mass_solar)
    flux_1au = stellar_flux_at_au(luminosity, 1.0)
    flux_2au = stellar_flux_at_au(luminosity, 2.0)

    print("=== Szybki test promieniowania gwiazdy ===")
    print(f"Masa gwiazdy: {star_mass_solar} M_sun")
    print(f"Jasność: {luminosity:.3e} W")
    print(f"Strumień w 1 AU: {flux_1au:.3e} W/m^2")
    print(f"Strumień w 2 AU: {flux_2au:.3e} W/m^2")
    print()
    print(format_demo_report(run_connected_demo()))


if __name__ == "__main__":
    main()
