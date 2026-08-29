"""
Solar modulation of the galactic cosmic-ray flux.

This is the function that connects the transport layer to the biology. Before
it, the cosmic-ray flux was a flat constant everywhere inside the heliosphere
and stepped up only beyond 120 AU, which no fragment reaches in a run of
reasonable length. Dose therefore depended only on fragment size, composition
and elapsed time, and ejection speeds of 8 and 40 km/s gave bit-identical
survival: the entire N-body integration could not reach the result.
"""

import unittest

from microbe_radiation_model.radiation.cosmic.cosmic_radiation_model import (
    COSMIC_DEEP_SPACE_MULTIPLIER,
    GCR_MODULATION_SCALE_AU,
    cosmic_flux_by_region,
    solar_modulation_factor,
)


class TestSolarModulation(unittest.TestCase):

    def test_it_is_unity_at_one_au(self):
        """The calibration point: everything else is relative to Earth orbit."""
        self.assertAlmostEqual(solar_modulation_factor(1.0), 1.0, places=12)

    def test_intensity_rises_with_distance(self):
        """
        Cosmic rays are swept outward by the solar wind, so there are more of
        them further out. A model where dose falls with distance would have the
        sign of solar modulation backwards.
        """
        values = [solar_modulation_factor(r) for r in (1, 2, 5, 10, 20, 50, 100)]
        self.assertEqual(values, sorted(values))
        self.assertGreater(values[-1], values[0])

    def test_the_gradient_at_one_au_matches_the_measured_scale(self):
        """
        Spacecraft in the outer heliosphere measure a positive radial gradient
        of a few percent per AU in the inner heliosphere.
        """
        gradient = (solar_modulation_factor(1.01) - solar_modulation_factor(1.0)) / 0.01
        self.assertAlmostEqual(gradient * 100, 3.0, delta=0.2)

    def test_it_saturates_at_the_interstellar_level(self):
        self.assertAlmostEqual(
            solar_modulation_factor(1e4), COSMIC_DEEP_SPACE_MULTIPLIER, places=6
        )
        self.assertLess(solar_modulation_factor(1e6), COSMIC_DEEP_SPACE_MULTIPLIER * 1.0001)

    def test_it_never_exceeds_the_interstellar_level(self):
        for r in (0, 1, 10, 100, 1000, 1e5):
            self.assertLessEqual(solar_modulation_factor(r), COSMIC_DEEP_SPACE_MULTIPLIER)

    def test_it_does_not_fall_towards_zero_near_the_sun(self):
        """
        Extrapolating the exponential inward would drive the flux to zero at the
        Sun, which is not what is observed; it saturates instead.
        """
        self.assertAlmostEqual(solar_modulation_factor(0.1), 1.0, places=12)
        self.assertAlmostEqual(solar_modulation_factor(0.0), 1.0, places=12)

    def test_the_transition_is_continuous_not_a_step(self):
        """
        The old model jumped from 1.0 to 1.3 at exactly 120 AU. A fragment
        crossing that boundary saw its dose rate change by 30% in one step.
        """
        a = cosmic_flux_by_region(119.9)
        b = cosmic_flux_by_region(120.1)
        self.assertLess(abs(b - a), 0.01)

    def test_a_wider_orbit_accumulates_more_dose(self):
        """The coupling, stated as a test: distance is what makes speed matter."""
        near = solar_modulation_factor(1.4)
        far = solar_modulation_factor(7.5)
        self.assertGreater(far, near)
        self.assertAlmostEqual((far / near - 1) * 100, 13.0, delta=1.0)

    def test_the_flat_model_would_fail_this(self):
        """
        Guards the regression directly: if the function ever returns a constant
        again, the transport layer is decoupled from the biology and this fails.
        """
        distinct = {round(solar_modulation_factor(r), 6) for r in (1, 2, 5, 10, 30)}
        self.assertEqual(len(distinct), 5)

    def test_the_scale_is_configurable(self):
        tight = solar_modulation_factor(10.0, scale_au=2.0)
        loose = solar_modulation_factor(10.0, scale_au=50.0)
        self.assertGreater(tight, loose)

    def test_invalid_inputs_are_rejected(self):
        with self.assertRaises(ValueError):
            solar_modulation_factor(-1.0)
        with self.assertRaises(ValueError):
            solar_modulation_factor(1.0, scale_au=0.0)

    def test_the_scale_constant_is_the_documented_one(self):
        self.assertEqual(GCR_MODULATION_SCALE_AU, 10.0)


if __name__ == "__main__":
    unittest.main()
