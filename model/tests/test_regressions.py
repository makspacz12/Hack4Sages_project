"""
Guards against defects that have already happened.

Both of the bugs below silently drove the entire radiation-to-biology chain to
exactly zero. Neither raised an exception, neither failed a build, and both
survived until someone read the demo report closely enough to notice that the
dose was 0.000e+00. These tests exist so that cannot happen a third time.
"""

import unittest

from microbe_radiation_model.catalogs.asteroid_properties import DEFAULT_ROCK_VARIANTS
from microbe_radiation_model.materials.rocks import Rock
from microbe_radiation_model.physics.geometry import biological_core_radius
from microbe_radiation_model.radiation.shielding_model import (
    radiation_at_point_in_rock_with_bio_core,
)
from microbe_radiation_model.simulation.config import (
    DEFAULT_FRAGMENT_RADIUS_M,
    DEFAULT_ROCK_ATTENUATION_K_M2_KG,
    default_material_config,
)


class TestFragmentRadiusIsNotTheReferenceBody(unittest.TestCase):
    """
    Defect 1: the simulated fragment took its radius from the rock catalog.

    Entries built by `rock_variants_from_sources` carry the radius of the body
    the material was measured on. For `basalt_vtype` that body is asteroid
    4 Vesta, so the "fragment" became 261 385 m across - five orders of
    magnitude larger than the 0.001-5 m the impact model samples. Beer-Lambert
    through 261 km of rock underflows to zero.
    """

    def test_default_fragment_is_metre_scale(self):
        config = default_material_config()
        self.assertLess(config.rock_radius, 100.0)
        self.assertGreater(config.rock_radius, 0.0)

    def test_default_fragment_radius_is_the_declared_constant(self):
        self.assertEqual(default_material_config().rock_radius, DEFAULT_FRAGMENT_RADIUS_M)

    def test_fragment_radius_is_not_taken_from_the_catalog(self):
        catalog_radii = [
            rock.radius_m for rock in DEFAULT_ROCK_VARIANTS
            if isinstance(rock, Rock) and rock.radius_m is not None
        ]
        self.assertTrue(catalog_radii, "expected the catalog to carry reference radii")
        self.assertNotIn(default_material_config().rock_radius, catalog_radii)

    def test_the_catalog_still_carries_large_reference_radii(self):
        """If this fails the trap is gone, and the guard above can be relaxed."""
        largest = max(
            rock.radius_m for rock in DEFAULT_ROCK_VARIANTS
            if isinstance(rock, Rock) and rock.radius_m is not None
        )
        self.assertGreater(largest, 1000.0)

    def test_an_explicit_radius_is_honoured(self):
        self.assertEqual(default_material_config(rock_radius_m=2.5).rock_radius, 2.5)

    def test_a_non_positive_radius_is_rejected(self):
        with self.assertRaises(ValueError):
            default_material_config(rock_radius_m=0.0)
        with self.assertRaises(ValueError):
            default_material_config(rock_radius_m=-1.0)


class TestAttenuationIsNotThermalConductivity(unittest.TestCase):
    """
    Defect 2: `Material.k` was filled from the rock's thermal conductivity.

    `Material.k` is a Beer-Lambert MASS ATTENUATION coefficient in m^2/kg,
    used as exp(-k rho x). Thermal conductivity is W/(m K) and for basalt is
    2.0 - two hundred times the attenuation coefficient. exp(-2.0 x 3460 x 0.5)
    is exp(-3460), which is exactly zero in floating point.
    """

    def test_material_k_is_an_attenuation_coefficient(self):
        config = default_material_config()
        self.assertEqual(config.rock_material.k, DEFAULT_ROCK_ATTENUATION_K_M2_KG)

    def test_material_k_is_not_the_rocks_thermal_conductivity(self):
        config = default_material_config()
        self.assertNotEqual(config.rock_material.k, config.rock_thermal_conductivity_w_mk)

    def test_thermal_conductivity_is_carried_separately_and_is_physical(self):
        config = default_material_config()
        # Silicate rock sits around 1-5 W/(m K).
        self.assertGreater(config.rock_thermal_conductivity_w_mk, 0.1)
        self.assertLess(config.rock_thermal_conductivity_w_mk, 50.0)

    def test_attenuation_coefficient_is_in_a_physical_range(self):
        # Mass attenuation for MeV photons in silicate: order 1e-3 to 1e-1 m^2/kg.
        k = default_material_config().rock_material.k
        self.assertGreater(k, 1e-4)
        self.assertLess(k, 1.0)


class TestTheChainDeliversDose(unittest.TestCase):
    """
    The end-to-end guard: with the shipped defaults, radiation must reach the
    biological core and the dose must be non-zero.

    This single assertion would have caught both defects above.
    """

    def setUp(self):
        self.config = default_material_config()
        self.rock_radius = self.config.rock_radius
        self.bio_radius = biological_core_radius(
            rock_radius=self.rock_radius,
            rock_density=self.config.rock_material.density,
            bio_density=self.config.bio_material.density,
            bio_mass_fraction=self.config.bio_mass_fraction,
        )

    def centre_flux(self, surface_flux=1361.0):
        return radiation_at_point_in_rock_with_bio_core(
            point=(0.0, 0.0, 0.0),
            rock_radius=self.rock_radius,
            bio_radius=self.bio_radius,
            rock_material=self.config.rock_material,
            bio_material=self.config.bio_material,
            surface_flux=surface_flux,
        ).local_flux

    def test_flux_reaching_the_core_is_strictly_positive(self):
        self.assertGreater(self.centre_flux(), 0.0)

    def test_flux_reaching_the_core_is_not_absurdly_small(self):
        """
        A defensive floor. Both known defects produced values that underflowed
        to exactly zero; anything below 1e-30 W/m^2 of a 1361 W/m^2 source means
        the shielding parameters have gone wrong again rather than that the rock
        is simply thick.
        """
        self.assertGreater(self.centre_flux(), 1e-30)

    def test_the_core_is_shielded_at_all(self):
        self.assertLess(self.centre_flux(), 1361.0)

    def test_the_biological_core_has_a_sensible_size(self):
        self.assertGreater(self.bio_radius, 0.0)
        self.assertLess(self.bio_radius, self.rock_radius)


if __name__ == "__main__":
    unittest.main()
