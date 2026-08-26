"""
Beer-Lambert shielding, dose accumulation, radionuclide activity, cosmic rays.

The shielding tests carry the most weight in this suite: two separate defects
have already made this layer return exactly zero at the biological core, and
both were invisible until someone read the report closely.
"""

import math
import unittest

from microbe_radiation_model.physics.materials import Material
from microbe_radiation_model.radiation.cosmic.cosmic_radiation_model import (
    COSMIC_BACKGROUND_FLUX,
    cosmic_flux_by_region,
    cosmic_flux_by_star,
)
from microbe_radiation_model.radiation.cosmic.cosmic_spectrum import split_cosmic_flux
from microbe_radiation_model.radiation.exposure_model import (
    ExposureState,
    update_exposure,
)
from microbe_radiation_model.radiation.radionuclide_model import constants as RC
from microbe_radiation_model.radiation.shielding_model import (
    attenuation_factor,
    radiation_at_point_in_rock_with_bio_core,
    radiation_at_points_in_rock_with_bio_core,
)

ROCK = Material("rock", 3460.0, 0.01)
BIO = Material("bio", 1100.0, 0.02)
SURFACE_FLUX = 1361.0


class TestAttenuationFactor(unittest.TestCase):
    """I = I0 exp(-k rho x)."""

    def test_zero_path_does_not_attenuate(self):
        self.assertEqual(attenuation_factor(0.0, 3000.0, 0.01), 1.0)

    def test_matches_the_closed_form(self):
        self.assertAlmostEqual(
            attenuation_factor(0.5, 3460.0, 0.01),
            math.exp(-0.01 * 3460.0 * 0.5),
            places=12,
        )

    def test_attenuation_is_monotonic_in_path_length(self):
        a = attenuation_factor(0.1, 3000.0, 0.01)
        b = attenuation_factor(0.2, 3000.0, 0.01)
        self.assertLess(b, a)

    def test_doubling_the_path_squares_the_factor(self):
        one = attenuation_factor(0.3, 3000.0, 0.01)
        two = attenuation_factor(0.6, 3000.0, 0.01)
        self.assertAlmostEqual(two, one * one, places=12)

    def test_invalid_inputs_are_rejected(self):
        with self.assertRaises(ValueError):
            attenuation_factor(-1.0, 3000.0, 0.01)
        with self.assertRaises(ValueError):
            attenuation_factor(1.0, 0.0, 0.01)
        with self.assertRaises(ValueError):
            attenuation_factor(1.0, 3000.0, 0.0)


class TestShieldedPoint(unittest.TestCase):

    def setUp(self):
        self.rock_radius = 0.5
        self.bio_radius = 0.1578

    def result(self, point):
        return radiation_at_point_in_rock_with_bio_core(
            point=point,
            rock_radius=self.rock_radius,
            bio_radius=self.bio_radius,
            rock_material=ROCK,
            bio_material=BIO,
            surface_flux=SURFACE_FLUX,
        )

    def test_surface_sees_the_incident_flux_unattenuated(self):
        res = self.result((self.rock_radius, 0.0, 0.0))
        self.assertAlmostEqual(res.local_flux, SURFACE_FLUX, places=9)

    def test_paths_sum_to_the_rock_radius_at_the_centre(self):
        res = self.result((0.0, 0.0, 0.0))
        self.assertAlmostEqual(
            res.path_in_rock + res.path_in_bio, self.rock_radius, places=12
        )

    def test_centre_matches_the_two_layer_closed_form(self):
        res = self.result((0.0, 0.0, 0.0))
        expected = (
            SURFACE_FLUX
            * math.exp(-ROCK.k * ROCK.density * (self.rock_radius - self.bio_radius))
            * math.exp(-BIO.k * BIO.density * self.bio_radius)
        )
        self.assertAlmostEqual(res.local_flux, expected, places=12)

    def test_flux_at_the_centre_is_not_zero(self):
        """
        The regression guard for this whole layer.

        Two defects have driven this to exactly zero: a fragment radius taken
        from a reference asteroid (261 km instead of 0.5 m), and the rock's
        thermal conductivity used in place of its mass attenuation coefficient.
        Either one makes the exponent so large that the flux underflows, and
        the pipeline then reports zero dose without failing.
        """
        res = self.result((0.0, 0.0, 0.0))
        self.assertGreater(res.local_flux, 0.0)
        self.assertLess(res.local_flux, SURFACE_FLUX)

    def test_deeper_points_receive_less(self):
        outer = self.result((0.4, 0.0, 0.0)).local_flux
        inner = self.result((0.2, 0.0, 0.0)).local_flux
        centre = self.result((0.0, 0.0, 0.0)).local_flux
        self.assertGreater(outer, inner)
        self.assertGreater(inner, centre)

    def test_a_point_outside_the_rock_is_rejected(self):
        with self.assertRaises(ValueError):
            self.result((self.rock_radius * 2, 0.0, 0.0))

    def test_a_core_larger_than_the_rock_is_rejected(self):
        with self.assertRaises(ValueError):
            radiation_at_point_in_rock_with_bio_core(
                point=(0.0, 0.0, 0.0),
                rock_radius=0.5,
                bio_radius=0.9,
                rock_material=ROCK,
                bio_material=BIO,
                surface_flux=SURFACE_FLUX,
            )

    def test_the_batch_helper_agrees_with_the_single_point_one(self):
        points = [(0.0, 0.0, 0.0), (0.25, 0.0, 0.0), (0.5, 0.0, 0.0)]
        batch = radiation_at_points_in_rock_with_bio_core(
            points=points,
            rock_radius=self.rock_radius,
            bio_radius=self.bio_radius,
            rock_material=ROCK,
            bio_material=BIO,
            surface_flux=SURFACE_FLUX,
        )
        for point, got in zip(points, batch):
            self.assertAlmostEqual(got.local_flux, self.result(point).local_flux, places=12)


class TestExposure(unittest.TestCase):
    """E += F dt, in J/m^2."""

    def test_dose_accumulates_linearly(self):
        state = ExposureState()
        for _ in range(3):
            update_exposure(state, 2.0, 10.0)
        self.assertAlmostEqual(state.cumulative_exposure, 60.0, places=12)

    def test_starts_at_zero(self):
        self.assertEqual(ExposureState().cumulative_exposure, 0.0)

    def test_zero_flux_adds_nothing(self):
        state = ExposureState()
        update_exposure(state, 0.0, 1000.0)
        self.assertEqual(state.cumulative_exposure, 0.0)

    def test_negative_inputs_are_rejected(self):
        state = ExposureState()
        with self.assertRaises(ValueError):
            update_exposure(state, -1.0, 1.0)
        with self.assertRaises(ValueError):
            update_exposure(state, 1.0, -1.0)


class TestRadionuclideConstants(unittest.TestCase):
    """
    ppm -> Bq/kg, against specific activities from the nuclear data.

    U-238: 1.244e7 Bq/kg, so 1 ppm of a rock gives 12.44 Bq/kg.
    Th-232: 4.07e6 Bq/kg  -> 4.07 Bq/kg per ppm.
    K-40 in natural K: 31.3 Bq per gram of K -> 313 Bq/kg per 1% K.
    """

    def test_uranium_238(self):
        self.assertAlmostEqual(RC.U238_BQ_PER_KG_PER_PPM, 12.44, delta=0.3)

    def test_thorium_232(self):
        self.assertAlmostEqual(RC.TH232_BQ_PER_KG_PER_PPM, 4.07, delta=0.1)

    def test_potassium_40(self):
        self.assertAlmostEqual(RC.K40_BQ_PER_KG_PER_PERCENT_K, 313.0, delta=6.0)


class TestCosmicRays(unittest.TestCase):

    def test_deep_space_is_not_shielded_less_than_the_heliosphere(self):
        inside = cosmic_flux_by_region(distance_au=1.0)
        outside = cosmic_flux_by_region(distance_au=1e6)
        self.assertGreaterEqual(outside, inside)

    def test_inside_the_heliosphere_the_flux_is_the_base_level(self):
        self.assertAlmostEqual(
            cosmic_flux_by_region(distance_au=1.0), COSMIC_BACKGROUND_FLUX, places=12
        )

    def test_a_negative_distance_is_rejected(self):
        with self.assertRaises(ValueError):
            cosmic_flux_by_region(distance_au=-1.0)

    def test_flux_by_star_never_decreases_with_distance(self):
        from microbe_radiation_model.physics.constants import SOLAR_LUMINOSITY

        previous = 0.0
        for au in (1.0, 50.0, 120.0, 200.0, 400.0, 1e4):
            value = cosmic_flux_by_star(distance_au=au, luminosity_w=SOLAR_LUMINOSITY)
            self.assertGreaterEqual(value, previous - 1e-12)
            previous = value

    def test_spectrum_components_sum_to_the_total(self):
        spectrum = split_cosmic_flux(100.0)
        total = spectrum.proton_flux + spectrum.alpha_flux + spectrum.hze_flux
        self.assertAlmostEqual(total, 100.0, places=9)

    def test_protons_dominate_the_spectrum(self):
        spectrum = split_cosmic_flux(1.0)
        self.assertGreater(spectrum.proton_flux, spectrum.alpha_flux)
        self.assertGreater(spectrum.alpha_flux, spectrum.hze_flux)


if __name__ == "__main__":
    unittest.main()
