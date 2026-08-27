"""
The survival function, and the statistics the impact sampler is supposed to obey.

The sampling tests are checked against analytic results for the distributions,
not against whatever the generator happens to produce, so a change in the
sampling method that alters the distribution will fail here.
"""

import math
import unittest

import numpy as np

from microbe_radiation_model.biology.survival import survival_function
from microbe_radiation_model.impacts.sampling import (
    random_cone_directions,
    sample_truncated_power_law,
)
from microbe_radiation_model.physics.constants import SECONDS_PER_YEAR


class TestSurvivalFunction(unittest.TestCase):
    """N/N0 = exp(-(kill_radiation + kill_hydrolysis) t)."""

    def test_no_dose_and_no_hydrolysis_leaves_the_population_intact(self):
        got = survival_function(0.0, 0.0, 0.3, 10.0, 0.0)
        self.assertAlmostEqual(got, 1.0, places=15)

    def test_radiation_term_matches_the_closed_form(self):
        got = survival_function(1.0, 0.0, 0.3, 1.0, 0.0)
        self.assertAlmostEqual(got, math.exp(-0.3), places=15)

    def test_space_and_decay_doses_add(self):
        both = survival_function(0.5, 0.5, 0.3, 1.0, 0.0)
        combined = survival_function(1.0, 0.0, 0.3, 1.0, 0.0)
        self.assertAlmostEqual(both, combined, places=15)

    def test_hydrolysis_rate_is_converted_from_per_second_to_per_year(self):
        from microbe_radiation_model.biology.constants import HYDROLYSIS_SURV_COEFF

        rate_per_second = 1e-11
        got = survival_function(0.0, 0.0, 0.3, 1.0, rate_per_second)
        expected = math.exp(-(rate_per_second * SECONDS_PER_YEAR * HYDROLYSIS_SURV_COEFF))
        self.assertAlmostEqual(got, expected, places=15)

    def test_survival_never_increases_with_time(self):
        previous = 1.0
        for years in range(0, 40, 4):
            value = survival_function(1.0, 0.0, 6e-4, float(years), 0.0)
            self.assertLessEqual(value, previous + 1e-15)
            previous = value

    def test_survival_stays_within_zero_and_one(self):
        for dose in (0.0, 1.0, 1e3, 1e6):
            value = survival_function(dose, 0.0, 6e-4, 100.0, 0.0)
            self.assertGreaterEqual(value, 0.0)
            self.assertLessEqual(value, 1.0)

    def test_a_more_sensitive_organism_dies_faster(self):
        # Converted Mileikowsky D10 band: lower c_rad = tougher organism.
        tough = survival_function(1.0, 0.0, 3.6e-4, 10.0, 0.0)
        fragile = survival_function(1.0, 0.0, 1.0e-3, 10.0, 0.0)
        self.assertGreater(tough, fragile)


class TestTruncatedPowerLaw(unittest.TestCase):
    """p(x) ~ x^-alpha on [x_min, x_max], by inverse-CDF sampling."""

    def setUp(self):
        self.rng = np.random.default_rng(20260826)

    def test_samples_stay_inside_the_requested_range(self):
        xs = sample_truncated_power_law(1.0, 100.0, 2.0, 50_000, self.rng)
        self.assertGreaterEqual(xs.min(), 1.0)
        self.assertLessEqual(xs.max(), 100.0)

    def test_mean_matches_the_analytic_value_for_alpha_two(self):
        # For alpha = 2 on [a, b]: E[x] = ln(b/a) / (1/a - 1/b).
        a, b = 1.0, 100.0
        xs = sample_truncated_power_law(a, b, 2.0, 400_000, self.rng)
        expected = math.log(b / a) / (1.0 / a - 1.0 / b)
        self.assertAlmostEqual(xs.mean(), expected, delta=expected * 0.02)

    def test_a_steeper_index_favours_small_values(self):
        shallow = sample_truncated_power_law(1.0, 100.0, 1.5, 100_000, self.rng).mean()
        steep = sample_truncated_power_law(1.0, 100.0, 3.5, 100_000, self.rng).mean()
        self.assertLess(steep, shallow)

    def test_alpha_one_is_handled_without_dividing_by_zero(self):
        xs = sample_truncated_power_law(1.0, 100.0, 1.0, 10_000, self.rng)
        self.assertTrue(np.all(np.isfinite(xs)))
        self.assertGreaterEqual(xs.min(), 1.0)
        self.assertLessEqual(xs.max(), 100.0)

    def test_the_sample_is_reproducible_from_a_seed(self):
        a = sample_truncated_power_law(1.0, 10.0, 2.0, 100, np.random.default_rng(7))
        b = sample_truncated_power_law(1.0, 10.0, 2.0, 100, np.random.default_rng(7))
        self.assertTrue(np.array_equal(a, b))


class TestConeDirections(unittest.TestCase):

    def setUp(self):
        self.rng = np.random.default_rng(20260826)

    def test_all_directions_are_unit_vectors(self):
        dirs = random_cone_directions((0, 0, 1), 45.0, 20_000, self.rng)
        norms = np.linalg.norm(dirs, axis=1)
        self.assertTrue(np.allclose(norms, 1.0, atol=1e-12))

    def test_every_direction_lies_inside_the_cone(self):
        half_angle = 30.0
        dirs = random_cone_directions((0, 0, 1), half_angle, 20_000, self.rng)
        self.assertGreaterEqual(
            dirs[:, 2].min(), math.cos(math.radians(half_angle)) - 1e-12
        )

    def test_the_distribution_is_uniform_over_the_spherical_cap(self):
        # For a uniform cap, E[cos theta] = (1 + cos(half_angle)) / 2.
        half_angle = 60.0
        dirs = random_cone_directions((0, 0, 1), half_angle, 200_000, self.rng)
        expected = (1 + math.cos(math.radians(half_angle))) / 2
        self.assertAlmostEqual(dirs[:, 2].mean(), expected, delta=0.005)

    def test_rotating_the_axis_preserves_the_opening_angle(self):
        axis = np.array([1.0, 1.0, 1.0]) / math.sqrt(3)
        half_angle = 25.0
        dirs = random_cone_directions(axis, half_angle, 50_000, self.rng)
        self.assertGreaterEqual(
            (dirs @ axis).min(), math.cos(math.radians(half_angle)) - 1e-9
        )

    def test_an_axis_pointing_down_still_works(self):
        dirs = random_cone_directions((0, 0, -1), 20.0, 5_000, self.rng)
        self.assertLessEqual(dirs[:, 2].max(), -math.cos(math.radians(20.0)) + 1e-9)

    def test_a_full_hemisphere_covers_the_hemisphere(self):
        dirs = random_cone_directions((0, 0, 1), 90.0, 50_000, self.rng)
        self.assertGreaterEqual(dirs[:, 2].min(), -1e-9)


if __name__ == "__main__":
    unittest.main()
