"""
Equilibrium temperature, the internal profile, radiogenic heat, hydrolysis.

The hydrolysis test at the end deliberately fails against the literature. That
is not a broken test - it is the coefficient audit expressed as code, and it
should stay red until `chemistry/constants.py` is resolved.
"""

import math
import unittest

from microbe_radiation_model.chemistry import constants as chem
from microbe_radiation_model.chemistry.hydrolysis_model import (
    compute_hydrolysis_rate,
    water_activity,
)
from microbe_radiation_model.internal_heat.model import (
    DEFAULT_HEAT_COEFFICIENTS,
    heat_production_from_rock,
)
from microbe_radiation_model.materials.rocks import Rock
from microbe_radiation_model.thermal import (
    equilibrium_temperature_from_flux,
    temperature_profile_surface_mid_center,
)
from microbe_radiation_model.thermal.internal_profile import temperature_inside_sphere

SOLAR_CONSTANT = 1361.0


class TestEquilibriumTemperature(unittest.TestCase):
    """T = ((1-A) F / 4 sigma)^(1/4)."""

    def test_earth_effective_temperature_without_albedo(self):
        # Textbook value for a perfectly absorbing body at 1 AU: 278.6 K.
        got = equilibrium_temperature_from_flux(SOLAR_CONSTANT, 0.0)
        self.assertAlmostEqual(got, 278.6, delta=0.5)

    def test_earth_effective_temperature_with_albedo(self):
        # With the Earth's 0.3 albedo the textbook value is 254.9 K.
        got = equilibrium_temperature_from_flux(SOLAR_CONSTANT, 0.3)
        self.assertAlmostEqual(got, 254.9, delta=0.5)

    def test_scales_as_the_fourth_root_of_flux(self):
        base = equilibrium_temperature_from_flux(SOLAR_CONSTANT, 0.0)
        quadrupled = equilibrium_temperature_from_flux(SOLAR_CONSTANT * 16, 0.0)
        self.assertAlmostEqual(quadrupled, 2.0 * base, places=6)

    def test_a_perfect_reflector_reaches_absolute_zero(self):
        self.assertAlmostEqual(
            equilibrium_temperature_from_flux(SOLAR_CONSTANT, 1.0), 0.0, places=9
        )

    def test_zero_flux_gives_zero(self):
        self.assertEqual(equilibrium_temperature_from_flux(0.0, 0.0), 0.0)

    def test_invalid_inputs_are_rejected(self):
        with self.assertRaises(ValueError):
            equilibrium_temperature_from_flux(-1.0, 0.0)
        with self.assertRaises(ValueError):
            equilibrium_temperature_from_flux(SOLAR_CONSTANT, 1.5)


class TestInternalProfile(unittest.TestCase):
    """T(r) = T_s + Q/(6 k) (R^2 - r^2)."""

    def setUp(self):
        self.surface = 250.0
        self.q = 1.0e-7
        self.radius = 1000.0
        self.k = 2.0

    def test_centre_matches_the_closed_form(self):
        got = temperature_inside_sphere(0.0, self.surface, self.q, self.radius, self.k)
        expected = self.surface + self.q * self.radius**2 / (6.0 * self.k)
        self.assertAlmostEqual(got, expected, places=9)

    def test_surface_is_the_boundary_condition(self):
        got = temperature_inside_sphere(
            self.radius, self.surface, self.q, self.radius, self.k
        )
        self.assertAlmostEqual(got, self.surface, places=9)

    def test_temperature_falls_monotonically_outward(self):
        values = [
            temperature_inside_sphere(r, self.surface, self.q, self.radius, self.k)
            for r in (0.0, 250.0, 500.0, 750.0, 1000.0)
        ]
        self.assertEqual(values, sorted(values, reverse=True))

    def test_no_heat_source_means_isothermal(self):
        got = temperature_inside_sphere(0.0, self.surface, 0.0, self.radius, self.k)
        self.assertEqual(got, self.surface)

    def test_the_rise_scales_with_the_square_of_the_radius(self):
        small = temperature_inside_sphere(0.0, 0.0, self.q, 100.0, self.k)
        large = temperature_inside_sphere(0.0, 0.0, self.q, 200.0, self.k)
        self.assertAlmostEqual(large / small, 4.0, places=9)

    def test_profile_helper_returns_surface_mid_centre_in_order(self):
        surface, mid, centre = temperature_profile_surface_mid_center(
            self.surface, self.q, self.radius, self.k
        )
        self.assertAlmostEqual(surface, self.surface, places=9)
        self.assertGreater(mid, surface)
        self.assertGreater(centre, mid)

    def test_a_point_outside_the_sphere_is_rejected(self):
        with self.assertRaises(ValueError):
            temperature_inside_sphere(
                self.radius * 2, self.surface, self.q, self.radius, self.k
            )


class TestRadiogenicHeat(unittest.TestCase):
    """
    U/Th/K heat production, against Turcotte & Schubert, Geodynamics.

    Natural uranium 98.5 uW/kg, thorium-232 26.4 uW/kg, natural potassium
    3.48e-3 uW/kg.
    """

    def test_uranium_coefficient(self):
        self.assertAlmostEqual(
            DEFAULT_HEAT_COEFFICIENTS.u238_micro_w_kg_per_mass_fraction, 98.5, delta=2.0
        )

    def test_thorium_coefficient(self):
        self.assertAlmostEqual(
            DEFAULT_HEAT_COEFFICIENTS.th232_micro_w_kg_per_mass_fraction, 26.4, delta=0.6
        )

    def test_potassium_coefficient(self):
        self.assertAlmostEqual(
            DEFAULT_HEAT_COEFFICIENTS.k_micro_w_kg_per_mass_fraction,
            3.48e-3,
            delta=2e-4,
        )

    def test_one_ppm_uranium_gives_the_expected_power_per_kilogram(self):
        rock = Rock(
            name="t", density_kg_m3=3000.0,
            uranium238_ppm=1.0, thorium232_ppm=0.0, potassium_percent=0.0,
        )
        result = heat_production_from_rock(rock)
        expected = DEFAULT_HEAT_COEFFICIENTS.u238_micro_w_kg_per_mass_fraction * 1e-6 * 1e-6
        self.assertAlmostEqual(result.total_w_kg, expected, places=18)

    def test_volumetric_heat_is_specific_heat_times_density(self):
        rock = Rock(
            name="t", density_kg_m3=3460.0,
            uranium238_ppm=0.15, thorium232_ppm=0.6, potassium_percent=0.05,
        )
        result = heat_production_from_rock(rock)
        self.assertAlmostEqual(
            result.total_w_m3, result.total_w_kg * 3460.0, places=18
        )

    def test_contributions_add_up(self):
        rock = Rock(
            name="t", density_kg_m3=3000.0,
            uranium238_ppm=1.0, thorium232_ppm=1.0, potassium_percent=1.0,
        )
        r = heat_production_from_rock(rock)
        self.assertAlmostEqual(
            r.total_w_kg, r.uranium_w_kg + r.thorium_w_kg + r.potassium_w_kg, places=20
        )

    def test_a_rock_with_no_radionuclides_produces_no_heat(self):
        rock = Rock(name="t", density_kg_m3=3000.0)
        self.assertEqual(heat_production_from_rock(rock).total_w_kg, 0.0)


class TestHydrolysis(unittest.TestCase):
    """k = A exp(-Ea / R T) x water fraction."""

    def test_matches_the_arrhenius_form(self):
        t_k = 298.15
        expected = chem.HYDROLYSIS_A_S_INV * math.exp(
            -chem.HYDROLYSIS_EA_J_MOL / (chem.GAS_CONSTANT_J_MOL_K * t_k)
        )
        self.assertAlmostEqual(compute_hydrolysis_rate(t_k, 1.0), expected, places=12)

    def test_frozen_material_hydrolyses_slowly_rather_than_not_at_all(self):
        """
        The rate used to be cut to exactly zero below 273.15 K. That made the
        whole channel identically zero everywhere in interplanetary space,
        where fragments run at 80-240 K: --no-thermal changed nothing, the
        sensitivity analysis reported a gradient of exactly zero for both
        hydrolysis knobs, and the one coefficient still listed as uncited was
        multiplied by zero in every run.

        Unfrozen water films persist on mineral surfaces below freezing, so the
        rate falls steeply but continuously. It is now negligible as a computed
        result rather than as an assumption.
        """
        just_frozen = compute_hydrolysis_rate(chem.FREEZING_TEMPERATURE_K - 1, 1.0)
        self.assertGreater(just_frozen, 0.0)
        self.assertLess(just_frozen, compute_hydrolysis_rate(chem.FREEZING_TEMPERATURE_K, 1.0))

    def test_the_rate_is_continuous_through_the_melting_point(self):
        """A step discontinuity in a rate is not physics."""
        above = compute_hydrolysis_rate(chem.FREEZING_TEMPERATURE_K + 0.01, 1.0)
        below = compute_hydrolysis_rate(chem.FREEZING_TEMPERATURE_K - 0.01, 1.0)
        self.assertLess(abs(above - below) / above, 0.01)

    def test_water_activity_matches_the_freezing_point_depression_curve(self):
        """
        Liquid water in equilibrium with ice has activity
        ln(a_w) = -(dH_fus/R)(1/T - 1/T_melt), which is 0.81 at 253 K.
        """
        from microbe_radiation_model.chemistry.hydrolysis_model import water_activity

        self.assertAlmostEqual(water_activity(chem.FREEZING_TEMPERATURE_K), 1.0, places=12)
        self.assertAlmostEqual(water_activity(253.0), 0.81, delta=0.01)
        self.assertAlmostEqual(water_activity(240.0), 0.694, delta=0.01)

    def test_water_activity_is_capped_at_one_above_freezing(self):
        """Above the melting point the water is simply liquid."""
        for t in (280.0, 300.0, 400.0):
            self.assertEqual(water_activity(t), 1.0)

    def test_deep_cold_gives_a_vanishing_but_positive_rate(self):
        """
        At 200 K the Arrhenius factor alone is exp(-78). The hard cut-off was
        redundant as well as wrong.
        """
        rate = compute_hydrolysis_rate(200.0, 1.0)
        self.assertGreater(rate, 0.0)
        self.assertLess(rate, 1e-20)

    def test_absolute_zero_is_still_zero(self):
        self.assertEqual(compute_hydrolysis_rate(0.0, 1.0), 0.0)
        self.assertEqual(compute_hydrolysis_rate(-5.0, 1.0), 0.0)

    def test_rate_is_linear_in_water_content(self):
        full = compute_hydrolysis_rate(300.0, 1.0)
        half = compute_hydrolysis_rate(300.0, 0.5)
        self.assertAlmostEqual(half, full / 2.0, places=15)

    def test_rate_increases_with_temperature(self):
        self.assertLess(
            compute_hydrolysis_rate(280.0, 1.0), compute_hydrolysis_rate(320.0, 1.0)
        )

    def test_dry_material_does_not_hydrolyse(self):
        self.assertEqual(compute_hydrolysis_rate(300.0, 0.0), 0.0)

    def test_reproduces_the_measured_dna_depurination_rate(self):
        """
        Lindahl & Nyberg (1972) scale: ~1e-11 1/s order at 298 K after fixing Ea.
        """
        rate = compute_hydrolysis_rate(298.15, 1.0)
        self.assertAlmostEqual(math.log10(rate), math.log10(3e-11), delta=1.0)


if __name__ == "__main__":
    unittest.main()
