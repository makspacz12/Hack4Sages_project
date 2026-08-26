"""
Constants, the mass-luminosity relation, inverse-square flux, and geometry.

Every expected value here is either a published constant or a textbook figure,
never a number copied back out of this code. A test that asserts what the code
currently returns cannot fail when the code is wrong.
"""

import math
import unittest

from microbe_radiation_model.physics import constants as C
from microbe_radiation_model.physics.geometry import (
    biological_core_radius,
    radius_from_mass_and_density,
    sphere_mass,
    sphere_volume,
)
from microbe_radiation_model.physics.stellar_physics import (
    stellar_luminosity_from_mass,
    stellar_luminosity_from_solar_mass,
)
from microbe_radiation_model.radiation import (
    relative_flux,
    stellar_flux,
    stellar_flux_at_au,
)


class TestConstants(unittest.TestCase):
    """Against IAU / CODATA values, to 0.1% or better."""

    def test_astronomical_unit(self):
        # IAU 2012: exactly 149 597 870 700 m.
        self.assertAlmostEqual(C.AU / 1.495978707e11, 1.0, places=3)

    def test_solar_mass(self):
        # IAU nominal: 1.98892e30 kg.
        self.assertAlmostEqual(C.SOLAR_MASS / 1.98892e30, 1.0, places=3)

    def test_solar_luminosity(self):
        # IAU 2015 Resolution B3 nominal: 3.828e26 W.
        self.assertAlmostEqual(C.SOLAR_LUMINOSITY, 3.828e26, delta=1e23)

    def test_julian_year_in_seconds(self):
        self.assertAlmostEqual(C.SECONDS_PER_YEAR, 365.25 * 24 * 3600, places=6)


class TestStellarLuminosity(unittest.TestCase):
    """L = L_sun (M/M_sun)^3.5 for the main sequence."""

    def test_one_solar_mass_gives_one_solar_luminosity(self):
        self.assertAlmostEqual(
            stellar_luminosity_from_solar_mass(1.0), C.SOLAR_LUMINOSITY, delta=1e20
        )

    def test_exponent_is_three_and_a_half(self):
        ratio = stellar_luminosity_from_solar_mass(2.0) / C.SOLAR_LUMINOSITY
        self.assertAlmostEqual(ratio, 2.0**3.5, places=9)

    def test_kilograms_and_solar_masses_agree(self):
        # Checked away from 1 M_sun on purpose: at exactly one solar mass both
        # forms return L_sun for ANY exponent, so testing there cannot detect a
        # wrong power. A mutation of the kg branch slipped through until this
        # was widened.
        for mass_solar in (0.4, 1.0, 2.7):
            with self.subTest(mass_solar=mass_solar):
                from_kg = stellar_luminosity_from_mass(mass_solar * C.SOLAR_MASS)
                from_solar = stellar_luminosity_from_solar_mass(mass_solar)
                self.assertAlmostEqual(from_kg / from_solar, 1.0, places=9)

    def test_the_kilogram_form_also_uses_the_three_and_a_half_power(self):
        ratio = (
            stellar_luminosity_from_mass(2.0 * C.SOLAR_MASS)
            / stellar_luminosity_from_mass(C.SOLAR_MASS)
        )
        self.assertAlmostEqual(ratio, 2.0**3.5, places=9)

    def test_a_fainter_star_is_fainter(self):
        self.assertLess(
            stellar_luminosity_from_solar_mass(0.5),
            stellar_luminosity_from_solar_mass(1.0),
        )


class TestStellarFlux(unittest.TestCase):
    """F = L / (4 pi r^2)."""

    def test_solar_constant_at_one_au(self):
        # Measured total solar irradiance: 1361 W/m^2.
        self.assertAlmostEqual(
            stellar_flux_at_au(C.SOLAR_LUMINOSITY, 1.0), 1361.0, delta=5.0
        )

    def test_inverse_square(self):
        near = stellar_flux_at_au(C.SOLAR_LUMINOSITY, 1.0)
        far = stellar_flux_at_au(C.SOLAR_LUMINOSITY, 3.0)
        self.assertAlmostEqual(far, near / 9.0, delta=near * 1e-9)

    def test_metres_and_au_agree(self):
        self.assertAlmostEqual(
            stellar_flux(C.SOLAR_LUMINOSITY, C.AU),
            stellar_flux_at_au(C.SOLAR_LUMINOSITY, 1.0),
            places=6,
        )

    def test_relative_flux_is_the_square_of_the_distance_ratio(self):
        self.assertAlmostEqual(relative_flux(2.0, 1.0), 0.25, places=12)
        self.assertAlmostEqual(relative_flux(1.0, 2.0), 4.0, places=12)


class TestSphereGeometry(unittest.TestCase):

    def test_volume_formula(self):
        self.assertAlmostEqual(sphere_volume(1.0), 4.0 / 3.0 * math.pi, places=12)

    def test_volume_scales_as_the_cube(self):
        self.assertAlmostEqual(
            sphere_volume(2.0) / sphere_volume(1.0), 8.0, places=12
        )

    def test_mass_is_density_times_volume(self):
        self.assertAlmostEqual(
            sphere_mass(2.0, 3000.0), 3000.0 * sphere_volume(2.0), places=6
        )

    def test_radius_round_trips_through_mass(self):
        for radius in (0.01, 0.5, 7.25, 1000.0):
            mass = sphere_mass(radius, 3460.0)
            self.assertAlmostEqual(
                radius_from_mass_and_density(mass, 3460.0), radius, places=9
            )

    def test_non_positive_inputs_are_rejected(self):
        with self.assertRaises(ValueError):
            sphere_volume(0.0)
        with self.assertRaises(ValueError):
            sphere_mass(1.0, -1.0)
        with self.assertRaises(ValueError):
            radius_from_mass_and_density(0.0, 1.0)


class TestBiologicalCore(unittest.TestCase):

    def test_core_mass_is_the_requested_fraction_of_the_rock(self):
        rock_radius, rock_density, bio_density, fraction = 0.5, 3460.0, 1100.0, 0.01
        core = biological_core_radius(rock_radius, rock_density, bio_density, fraction)
        expected_core_mass = fraction * sphere_mass(rock_radius, rock_density)
        self.assertAlmostEqual(
            sphere_mass(core, bio_density), expected_core_mass, places=6
        )

    def test_core_fits_inside_the_rock(self):
        core = biological_core_radius(0.5, 3460.0, 1100.0, 0.01)
        self.assertGreater(core, 0.0)
        self.assertLess(core, 0.5)

    def test_zero_fraction_gives_no_core(self):
        self.assertEqual(biological_core_radius(0.5, 3460.0, 1100.0, 0.0), 0.0)

    def test_fraction_outside_zero_to_one_is_rejected(self):
        with self.assertRaises(ValueError):
            biological_core_radius(0.5, 3460.0, 1100.0, 1.5)
        with self.assertRaises(ValueError):
            biological_core_radius(0.5, 3460.0, 1100.0, -0.1)

    def test_a_denser_core_is_smaller(self):
        light = biological_core_radius(0.5, 3460.0, 500.0, 0.01)
        heavy = biological_core_radius(0.5, 3460.0, 2000.0, 0.01)
        self.assertGreater(light, heavy)


if __name__ == "__main__":
    unittest.main()
