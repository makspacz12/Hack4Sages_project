"""
Dose against depth inside a fragment.

The function this wraps existed, was exported and was tested, and was never
called by the pipeline - so the one quantity that explains why fragment size
matters never reached any output.
"""

import math
import unittest

from microbe_radiation_model.physics.geometry import biological_core_radius
from microbe_radiation_model.simulation.config import (
    DEFAULT_GCR_ATTENUATION_K_M2_KG,
    DEFAULT_ROCK_ATTENUATION_K_M2_KG,
    default_material_config,
)
from microbe_radiation_model.simulation.dose_profile import (
    attenuation_depth_m,
    dose_depth_profile,
    profile_payload,
)


class TestAttenuationDepth(unittest.TestCase):

    def test_photons_are_stopped_within_centimetres(self):
        """Silicate is opaque to starlight on a scale of a few cm."""
        depth = attenuation_depth_m(DEFAULT_ROCK_ATTENUATION_K_M2_KG, 3460.0)
        self.assertGreater(depth, 0.01)
        self.assertLess(depth, 0.05)

    def test_cosmic_rays_penetrate_about_sixteen_times_deeper(self):
        """
        Charged particles are far more penetrating than photons. Using one
        coefficient for both - which this project did until recently - makes
        fragments look far more protective than they are.
        """
        photon = attenuation_depth_m(DEFAULT_ROCK_ATTENUATION_K_M2_KG, 3460.0)
        cosmic = attenuation_depth_m(DEFAULT_GCR_ATTENUATION_K_M2_KG, 3460.0)
        self.assertAlmostEqual(cosmic / photon, 16.0, delta=0.5)

    def test_denser_rock_shields_over_a_shorter_distance(self):
        light = attenuation_depth_m(DEFAULT_GCR_ATTENUATION_K_M2_KG, 2000.0)
        heavy = attenuation_depth_m(DEFAULT_GCR_ATTENUATION_K_M2_KG, 8000.0)
        self.assertLess(heavy, light)

    def test_non_physical_inputs_are_rejected(self):
        with self.assertRaises(ValueError):
            attenuation_depth_m(0.0, 3000.0)
        with self.assertRaises(ValueError):
            attenuation_depth_m(0.01, 0.0)


class TestProfile(unittest.TestCase):

    def setUp(self):
        self.config = default_material_config()
        self.rock_radius = 0.5
        self.bio_radius = biological_core_radius(
            rock_radius=self.rock_radius,
            rock_density=self.config.rock_material.density,
            bio_density=self.config.bio_material.density,
            bio_mass_fraction=self.config.bio_mass_fraction,
        )

    def profile(self, samples=20):
        return dose_depth_profile(
            self.rock_radius, self.bio_radius,
            self.config.rock_material, self.config.bio_material, samples=samples,
        )

    def test_the_surface_receives_the_full_flux(self):
        first = self.profile()[0]
        self.assertAlmostEqual(first.depth_m, 0.0, places=12)
        self.assertAlmostEqual(first.photon_fraction, 1.0, delta=1e-9)
        self.assertAlmostEqual(first.cosmic_ray_fraction, 1.0, delta=1e-9)

    def test_it_runs_from_the_surface_to_the_centre(self):
        profile = self.profile()
        self.assertAlmostEqual(profile[0].radius_fraction, 1.0, places=12)
        self.assertAlmostEqual(profile[-1].radius_fraction, 0.0, places=12)
        self.assertAlmostEqual(profile[-1].depth_m, self.rock_radius, places=12)

    def test_both_channels_fall_monotonically_inward(self):
        profile = self.profile()
        for a, b in zip(profile, profile[1:]):
            self.assertLessEqual(b.photon_fraction, a.photon_fraction + 1e-15)
            self.assertLessEqual(b.cosmic_ray_fraction, a.cosmic_ray_fraction + 1e-15)

    def test_cosmic_rays_always_penetrate_further_than_photons(self):
        """
        This is the whole point of plotting the two together: a half-metre rock
        is opaque to starlight and still transparent to cosmic rays.
        """
        for sample in self.profile()[1:]:
            self.assertGreater(sample.cosmic_ray_fraction, sample.photon_fraction)

    def test_a_half_metre_fragment_blocks_starlight_but_not_cosmic_rays(self):
        centre = self.profile()[-1]
        self.assertLess(centre.photon_fraction, 1e-5)
        self.assertGreater(centre.cosmic_ray_fraction, 0.2)

    def test_a_larger_fragment_shields_its_centre_better(self):
        def centre(radius):
            bio = biological_core_radius(
                rock_radius=radius,
                rock_density=self.config.rock_material.density,
                bio_density=self.config.bio_material.density,
                bio_mass_fraction=self.config.bio_mass_fraction,
            )
            return dose_depth_profile(
                radius, bio, self.config.rock_material, self.config.bio_material,
                samples=8,
            )[-1].cosmic_ray_fraction

        self.assertGreater(centre(0.05), centre(0.5))
        self.assertGreater(centre(0.5), centre(3.0))

    def test_invalid_geometry_is_rejected(self):
        with self.assertRaises(ValueError):
            dose_depth_profile(0.0, 0.0, self.config.rock_material,
                               self.config.bio_material)
        with self.assertRaises(ValueError):
            dose_depth_profile(0.5, self.bio_radius, self.config.rock_material,
                               self.config.bio_material, samples=1)


class TestPayload(unittest.TestCase):

    def payload(self):
        config = default_material_config()
        bio = biological_core_radius(
            rock_radius=0.5, rock_density=config.rock_material.density,
            bio_density=config.bio_material.density,
            bio_mass_fraction=config.bio_mass_fraction,
        )
        return profile_payload(0.5, bio, config.rock_material, config.bio_material,
                               rock_type="basalt_vtype", samples=12)

    def test_it_carries_both_reference_depths(self):
        p = self.payload()
        self.assertGreater(p["cosmic_ray_attenuation_depth_m"],
                           p["photon_attenuation_depth_m"])

    def test_it_carries_the_core_material_too(self):
        """
        The curve is two materials, and a consumer needs both to reproduce it.

        This is not bookkeeping. The browser rebuilds this profile for whichever
        fragment the reader selects, and a first version of that code assumed a
        single exponential. It matched the exported curve to twelve digits near
        the surface and was wrong by a quarter at the centre - the half that
        decides whether anything inside survives. These three fields are what
        make the reconstruction exact rather than plausible.
        """
        p = self.payload()
        for key in (
            "bio_density_kg_m3",
            "bio_photon_attenuation_depth_m",
            "bio_cosmic_ray_attenuation_depth_m",
        ):
            self.assertIn(key, p)
            self.assertGreater(p[key], 0.0)

    def test_the_curve_is_not_a_single_exponential(self):
        """
        Guards the assumption the browser reconstruction is allowed to make.

        Outside the biological core the profile IS exp(-depth/Lambda_rock), and
        the reconstruction relies on that. Inside the core it is not, and the
        reconstruction relies on that too. If the geometry ever changes so that
        one exponential fits the whole radius, the reconstruction is still
        right but this test is the place that says so out loud.
        """
        import math

        p = self.payload()
        lam = p["cosmic_ray_attenuation_depth_m"]
        shell = p["rock_radius_m"] - p["bio_radius_m"]

        outside = [s for s in p["samples"] if s["depth_m"] <= shell]
        self.assertGreater(len(outside), 1)
        for s in outside:
            self.assertAlmostEqual(
                s["cosmic_ray_fraction"], math.exp(-s["depth_m"] / lam), places=12,
            )

        centre = p["samples"][-1]
        self.assertAlmostEqual(centre["depth_m"], p["rock_radius_m"], places=12)
        # The core is less dense than the rock, so it attenuates less and the
        # true centre value sits ABOVE the single-exponential extrapolation.
        self.assertGreater(
            centre["cosmic_ray_fraction"], math.exp(-centre["depth_m"] / lam),
        )

    def test_it_is_plain_json_types(self):
        import json

        json.dumps(self.payload())

    def test_it_names_the_radius_it_applies_to(self):
        """Without this a reader takes the curve for the whole swarm."""
        self.assertEqual(self.payload()["rock_radius_m"], 0.5)

    def test_the_pipeline_exports_it(self):
        import inspect

        from microbe_radiation_model.simulation import scenarios

        self.assertIn("dose_depth_profile", inspect.getsource(scenarios))


if __name__ == "__main__":
    unittest.main()
