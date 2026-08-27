"""
Guards for defects in how the pieces are wired together.

The formulas in this project were sound; every defect found so far has been in
the wiring - a quantity used for the wrong role, a parameter accepted and then
ignored, a unit applied to one half of a pair. Unit tests of individual
functions cannot see any of that, so these tests check the joins.
"""

import unittest
from dataclasses import replace

import numpy as np

from microbe_radiation_model.impacts.mars_impact import _sample_rock_variants_with_sizes
from microbe_radiation_model.materials.rocks import Rock
from microbe_radiation_model.simulation.config import ImpactSimulationConfig
from microbe_radiation_model.simulation.scenarios import (
    GCR_MODEL_UNIT_TO_GY_PER_YEAR,
    _due,
    _scaled,
)


class TestFragmentRadiusBounds(unittest.TestCase):
    """
    `radius_min_m` / `radius_max_m` were accepted and then ignored.

    The sampler used a hard-coded [0.01, 100] m range, so a caller asking for
    metre-scale ejecta silently received hundred-metre boulders while the
    parameter still changed the provenance digest.
    """

    def variants(self):
        # _normalize_variant requires both density and albedo.
        return [
            Rock(name="a", density_kg_m3=3000.0, albedo=0.1, probability=0.5),
            Rock(name="b", density_kg_m3=2000.0, albedo=0.2, probability=0.5),
        ]

    def sample(self, lo, hi, n=4000):
        _rocks, radii = _sample_rock_variants_with_sizes(
            rock_variants=self.variants(),
            n_asteroids=n,
            radius_min_m=lo,
            radius_max_m=hi,
            q_size=2.0,
            rng=np.random.default_rng(4242),
        )
        return radii

    def test_samples_respect_the_requested_bounds(self):
        radii = self.sample(0.001, 5.0)
        self.assertGreaterEqual(radii.min(), 0.001)
        self.assertLessEqual(radii.max(), 5.0)

    def test_a_narrow_range_is_honoured_rather_than_widened(self):
        radii = self.sample(1.0, 2.0)
        self.assertGreaterEqual(radii.min(), 1.0)
        self.assertLessEqual(radii.max(), 2.0)

    def test_the_old_hard_coded_range_is_not_used(self):
        """The previous behaviour drew up to 100 m whatever was asked for."""
        radii = self.sample(0.001, 5.0)
        self.assertLess(radii.max(), 100.0)

    def test_changing_the_bounds_changes_the_sample(self):
        small = self.sample(0.01, 0.1).mean()
        large = self.sample(10.0, 100.0).mean()
        self.assertLess(small, large)

    def test_invalid_bounds_are_rejected(self):
        with self.assertRaises(ValueError):
            self.sample(0.0, 5.0)
        with self.assertRaises(ValueError):
            self.sample(5.0, 1.0)

    def test_the_config_defaults_are_metre_scale(self):
        config = ImpactSimulationConfig()
        self.assertLess(config.radius_max_m, 100.0)
        self.assertGreater(config.radius_min_m, 0.0)


class TestRefreshInterval(unittest.TestCase):
    """
    Both configs expose `refresh_interval_steps` and neither was consulted.

    The periodic work ran every step regardless, so raising the interval
    changed the provenance digest and nothing about the physics.
    """

    def test_an_interval_of_one_runs_every_step(self):
        self.assertTrue(all(_due(step, 1) for step in range(1, 20)))

    def test_zero_and_none_also_mean_every_step(self):
        self.assertTrue(_due(7, 0))
        self.assertTrue(_due(7, None))

    def test_an_interval_of_ten_runs_one_step_in_ten(self):
        due = [step for step in range(1, 41) if _due(step, 10)]
        self.assertEqual(due, [10, 20, 30, 40])

    def test_a_larger_interval_runs_strictly_less_often(self):
        every = sum(1 for s in range(1, 101) if _due(s, 1))
        sparse = sum(1 for s in range(1, 101) if _due(s, 5))
        self.assertLess(sparse, every)


class TestCosmicRayDoseUnits(unittest.TestCase):
    """
    The surface value was converted to Gy/yr and the shielded one was not.

    That made the dose after shielding exceed the dose before it in 88% of
    exported records - 23 336 of 26 525 - which is physically impossible.
    """

    def test_the_calibration_constant_is_the_published_one(self):
        # Mileikowsky et al. (2000): one model unit of GCR = 0.194 Gy/yr.
        self.assertAlmostEqual(GCR_MODEL_UNIT_TO_GY_PER_YEAR, 0.194, places=6)

    def test_converting_both_ends_preserves_the_ordering(self):
        surface_model, local_model = 1.0, 0.42        # shielded is always smaller
        surface = surface_model * GCR_MODEL_UNIT_TO_GY_PER_YEAR
        local = local_model * GCR_MODEL_UNIT_TO_GY_PER_YEAR
        self.assertLess(local, surface)

    def test_converting_only_one_end_inverts_it(self):
        """The defect, stated as a test: this is what used to be exported."""
        surface_model, local_model = 1.0, 0.42
        surface = surface_model * GCR_MODEL_UNIT_TO_GY_PER_YEAR
        local_unconverted = local_model                # the old behaviour
        self.assertGreater(local_unconverted, surface)

    def test_spectrum_shares_scale_into_the_same_unit_as_the_total(self):
        class Spectrum:
            proton_flux, alpha_flux, hze_flux = 0.90, 0.09, 0.01

        total = 0.194
        parts = [
            _scaled(Spectrum(), field, total)
            for field in ("proton_flux", "alpha_flux", "hze_flux")
        ]
        self.assertAlmostEqual(sum(parts), total, places=12)

    def test_scaling_a_missing_field_gives_none_rather_than_zero(self):
        class Empty:
            pass

        self.assertIsNone(_scaled(Empty(), "proton_flux", 1.0))

    def test_scaling_against_a_missing_total_gives_none(self):
        class Spectrum:
            proton_flux = 0.9

        self.assertIsNone(_scaled(Spectrum(), "proton_flux", None))


class TestSurvivalIsNotGatedOnTemperature(unittest.TestCase):
    """
    Survival used to be gated on the hydrolysis rate being non-None.

    Hydrolysis returns None whenever the thermal stage is disabled, so
    `--no-thermal` silently switched off the radiation kill channel too and the
    population stayed at 1.0 for the whole run without any warning. Radiation
    dose has no physical reason to depend on whether a temperature was computed.
    """

    def test_the_survival_function_accepts_a_zero_hydrolysis_rate(self):
        from microbe_radiation_model.biology.survival import survival_function

        with_hydrolysis = survival_function(1.0, 0.0, 0.3, 1.0, 1e-12)
        without = survival_function(1.0, 0.0, 0.3, 1.0, 0.0)
        self.assertLess(with_hydrolysis, without)
        self.assertLess(without, 1.0)

    def test_radiation_alone_still_kills(self):
        """The property --no-thermal used to break."""
        from microbe_radiation_model.biology.survival import survival_function

        self.assertLess(survival_function(1.0, 0.5, 0.3, 10.0, 0.0), 1.0)


class TestOutcomeClassification(unittest.TestCase):
    """
    `arrived` was structurally unreachable.

    `escaped_sun` marks a transient condition - unbound from the Sun but still
    in flight - and is never cleared. Both the aggregator and the exporter
    tested it BEFORE the terminal check, and any real interstellar transfer must
    pass the escape threshold on its way to another star. So every arrival
    already carried the flag and was counted as still travelling: the one number
    the whole simulation exists to produce could never be non-zero.
    """

    def status(self, *, active, reason=None, escaped=False):
        from microbe_radiation_model.simulation.visualizer_export import _object_status

        class State:
            pass

        state = State()
        state.active = active
        state.termination_reason = reason
        state.extra = {"escaped_sun": escaped}
        return _object_status("asteroid", state)

    def test_an_arrival_after_escaping_reads_as_arrived(self):
        """The exact case that used to be impossible."""
        self.assertEqual(
            self.status(active=False, reason="entered_effective_hill", escaped=True),
            "arrived",
        )

    def test_an_arrival_without_escaping_still_reads_as_arrived(self):
        self.assertEqual(
            self.status(active=False, reason="entered_effective_hill", escaped=False),
            "arrived",
        )

    def test_a_collision_after_escaping_is_not_reported_as_travelling(self):
        self.assertEqual(
            self.status(active=False, reason="collided_with_star", escaped=True),
            "destroyed_collided_star",
        )

    def test_still_flying_after_escape_reads_as_escaped(self):
        self.assertEqual(
            self.status(active=True, escaped=True), "escaped_and_travelling"
        )

    def test_still_flying_without_escape_reads_as_travelling(self):
        self.assertEqual(self.status(active=True, escaped=False), "traveling")

    def test_terminal_and_transient_are_mutually_exclusive_in_the_output(self):
        terminal = {"arrived", "destroyed", "destroyed_collided_star"}
        for escaped in (True, False):
            with self.subTest(escaped=escaped):
                self.assertIn(
                    self.status(active=False, reason="entered_effective_hill",
                                escaped=escaped),
                    terminal,
                )

    def test_the_collision_reason_the_exporter_expects_is_the_one_written(self):
        """These two strings live in different modules and must agree."""
        import inspect

        from microbe_radiation_model.simulation import scenarios

        source = inspect.getsource(scenarios._check_asteroid_collisions)
        self.assertIn("collided_with_star", source)



if __name__ == "__main__":
    unittest.main()