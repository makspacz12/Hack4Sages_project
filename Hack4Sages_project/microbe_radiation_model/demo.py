"""
demo.py

This file provides a simple demonstration of the current stellar physics
and radiation model. It is intended for quick manual testing and validation
during early development.
"""

from stellar_physics import stellar_luminosity_from_solar_mass
from radiation_model import stellar_flux_at_au


def main() -> None:
    star_mass_solar = 1.5
    luminosity = stellar_luminosity_from_solar_mass(star_mass_solar)

    flux_1au = stellar_flux_at_au(luminosity, 1.0)
    flux_2au = stellar_flux_at_au(luminosity, 2.0)

    print(f"Star mass: {star_mass_solar} M_sun")
    print(f"Luminosity: {luminosity:.3e} W")
    print(f"Flux at 1 AU: {flux_1au:.3e} W/m^2")
    print(f"Flux at 2 AU: {flux_2au:.3e} W/m^2")


if __name__ == "__main__":
    main()