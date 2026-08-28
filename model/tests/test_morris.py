"""
Elementary-effects screening.

Checked against functions whose sensitivities are known analytically, so the
tests can tell a correct implementation from one that merely runs.
"""

import math
import unittest

import numpy as np

from microbe_radiation_model.ensembles.morris import (
    MorrisFactor,
    elementary_effects,
    explored_fraction,
    run_morris,
    sample_trajectories,
    summarise,
)


class TestExploredFraction(unittest.TestCase):
    """The geometric argument against one-at-a-time designs."""

    def test_matches_the_published_values(self):
        # Saltelli & Annoni (2010) print r(2) and r(3) explicitly.
        self.assertAlmostEqual(explored_fraction(2), 0.785, places=3)
        self.assertAlmostEqual(explored_fraction(3), 0.524, places=3)

    def test_it_collapses_with_dimension(self):
        # The 2019 follow-up gives one quarter of one percent at k = 10.
        self.assertAlmostEqual(explored_fraction(10), 0.0025, places=4)

    def test_this_projects_knob_count_is_effectively_unexplored(self):
        self.assertLess(explored_fraction(18), 1e-6)

    def test_it_is_monotonically_decreasing(self):
        values = [explored_fraction(k) for k in range(2, 20)]
        self.assertEqual(values, sorted(values, reverse=True))


class TestFactor(unittest.TestCase):

    def test_linear_mapping_spans_the_range(self):
        f = MorrisFactor(id="a", label="a", low=10.0, high=20.0)
        self.assertEqual(f.to_value(0.0), 10.0)
        self.assertEqual(f.to_value(1.0), 20.0)
        self.assertEqual(f.to_value(0.5), 15.0)

    def test_log_mapping_is_geometric(self):
        f = MorrisFactor(id="c", label="c", low=1e-5, high=1e-3, log=True)
        self.assertAlmostEqual(f.to_value(0.5), 1e-4, places=12)

    def test_positions_outside_the_unit_interval_are_clamped(self):
        f = MorrisFactor(id="a", label="a", low=0.0, high=1.0)
        self.assertEqual(f.to_value(-3.0), 0.0)
        self.assertEqual(f.to_value(7.0), 1.0)

    def test_an_inverted_or_impossible_range_is_rejected(self):
        with self.assertRaises(ValueError):
            MorrisFactor(id="a", label="a", low=5.0, high=1.0)
        with self.assertRaises(ValueError):
            MorrisFactor(id="a", label="a", low=0.0, high=1.0, log=True)


class TestTrajectories(unittest.TestCase):

    def factors(self, n=4):
        return [MorrisFactor(id=f"x{i}", label=f"x{i}", low=0.0, high=1.0)
                for i in range(n)]

    def test_a_walk_has_one_step_per_factor(self):
        walks = sample_trajectories(self.factors(4), 3, 4, np.random.default_rng(0))
        self.assertEqual(len(walks), 3)
        for walk in walks:
            self.assertEqual(len(walk), 5)      # k + 1 points

    def test_exactly_one_factor_moves_per_step(self):
        """
        This is what makes each difference an ELEMENTARY effect. If two moved,
        the difference could not be attributed to either.
        """
        factors = self.factors(5)
        for walk in sample_trajectories(factors, 4, 4, np.random.default_rng(1)):
            for a, b in zip(walk, walk[1:]):
                moved = [f.id for f in factors if a[f.id] != b[f.id]]
                self.assertEqual(len(moved), 1)

    def test_every_factor_moves_once_in_each_walk(self):
        factors = self.factors(5)
        for walk in sample_trajectories(factors, 3, 4, np.random.default_rng(2)):
            moved = set()
            for a, b in zip(walk, walk[1:]):
                moved.update(f.id for f in factors if a[f.id] != b[f.id])
            self.assertEqual(moved, {f.id for f in factors})

    def test_the_walk_stays_inside_the_unit_cube(self):
        factors = self.factors(6)
        for walk in sample_trajectories(factors, 6, 4, np.random.default_rng(3)):
            for point in walk:
                for value in point.values():
                    self.assertGreaterEqual(value, 0.0)
                    self.assertLessEqual(value, 1.0)

    def test_trajectories_start_from_different_places(self):
        """Unlike OAT, which always starts from the same baseline."""
        walks = sample_trajectories(self.factors(4), 8, 4, np.random.default_rng(4))
        starts = {tuple(sorted(w[0].items())) for w in walks}
        self.assertGreater(len(starts), 1)

    def test_degenerate_settings_are_rejected(self):
        with self.assertRaises(ValueError):
            sample_trajectories(self.factors(2), 0, 4, np.random.default_rng(0))
        with self.assertRaises(ValueError):
            sample_trajectories(self.factors(2), 2, 1, np.random.default_rng(0))


class TestElementaryEffects(unittest.TestCase):

    def test_a_linear_function_gives_its_own_coefficients(self):
        """
        For y = 3a + 7b on unit ranges, the elementary effects are exactly 3
        and 7 regardless of where the trajectory runs.
        """
        factors = [
            MorrisFactor(id="a", label="a", low=0.0, high=1.0),
            MorrisFactor(id="b", label="b", low=0.0, high=1.0),
        ]
        result = run_morris(
            factors, lambda v: 3 * v["a"] + 7 * v["b"],
            trajectories=6, levels=4, seed=11,
        )
        by_id = {r["id"]: r for r in result["factors"]}
        self.assertAlmostEqual(by_id["a"]["mu_star"], 3.0, places=9)
        self.assertAlmostEqual(by_id["b"]["mu_star"], 7.0, places=9)

    def test_a_linear_function_has_no_spread(self):
        """sigma = 0 is the signature of linearity, and that is the point."""
        factors = [
            MorrisFactor(id="a", label="a", low=0.0, high=1.0),
            MorrisFactor(id="b", label="b", low=0.0, high=1.0),
        ]
        result = run_morris(
            factors, lambda v: 3 * v["a"] + 7 * v["b"],
            trajectories=6, levels=4, seed=12,
        )
        for row in result["factors"]:
            self.assertAlmostEqual(row["sigma"], 0.0, places=9)

    def test_an_interaction_shows_up_as_spread(self):
        """
        y = a*b has an effect for a that depends entirely on b, so sigma must
        be non-zero. A tornado cannot represent this at all.
        """
        factors = [
            MorrisFactor(id="a", label="a", low=0.0, high=1.0),
            MorrisFactor(id="b", label="b", low=0.0, high=1.0),
        ]
        result = run_morris(
            factors, lambda v: v["a"] * v["b"], trajectories=12, levels=4, seed=13,
        )
        for row in result["factors"]:
            self.assertGreater(row["sigma"], 0.05)

    def test_mu_star_catches_a_factor_whose_sign_flips(self):
        """
        For y = (a - 0.5)^2 the influence of a is negative below the midpoint
        and positive above it, so the plain mean of effects largely cancels
        while the mean of ABSOLUTE effects does not. Ranking on mu rather than
        mu* would report this factor as irrelevant when it is not.

        A parabola rather than a sine: with one factor the Morris step is 0.571
        of the range, and a sine sampled that coarsely can put every effect on
        the same side by accident. The sign change here is a property of the
        function, not of where the grid happens to land.
        """
        factors = [MorrisFactor(id="a", label="a", low=0.0, high=1.0)]
        result = run_morris(
            factors, lambda v: (v["a"] - 0.5) ** 2,
            trajectories=24, levels=8, seed=14,
        )
        row = result["factors"][0]
        self.assertGreater(row["mu_star"], 0.1)
        self.assertGreater(row["mu_star"], 2 * abs(row["mu"]))
        self.assertGreater(row["sigma"], 0.1)

    def test_an_ignored_factor_ranks_at_zero(self):
        factors = [
            MorrisFactor(id="used", label="used", low=0.0, high=1.0),
            MorrisFactor(id="ignored", label="ignored", low=0.0, high=1.0),
        ]
        result = run_morris(
            factors, lambda v: 5 * v["used"], trajectories=5, levels=4, seed=15,
        )
        by_id = {r["id"]: r for r in result["factors"]}
        self.assertAlmostEqual(by_id["ignored"]["mu_star"], 0.0, places=12)
        self.assertGreater(by_id["used"]["mu_star"], 1.0)

    def test_results_are_ranked_by_influence(self):
        factors = [
            MorrisFactor(id="small", label="small", low=0.0, high=1.0),
            MorrisFactor(id="big", label="big", low=0.0, high=1.0),
        ]
        result = run_morris(
            factors, lambda v: 0.1 * v["small"] + 9 * v["big"],
            trajectories=4, levels=4, seed=16,
        )
        self.assertEqual(result["factors"][0]["id"], "big")

    def test_the_cost_is_trajectories_times_k_plus_one(self):
        factors = [MorrisFactor(id=f"x{i}", label="x", low=0.0, high=1.0)
                   for i in range(5)]
        result = run_morris(factors, lambda v: sum(v.values()),
                            trajectories=7, levels=4, seed=17)
        self.assertEqual(result["evaluations"], 7 * (5 + 1))

    def test_it_is_reproducible_from_a_seed(self):
        factors = [MorrisFactor(id="a", label="a", low=0.0, high=1.0),
                   MorrisFactor(id="b", label="b", low=0.0, high=1.0)]
        f = lambda v: v["a"] ** 2 + v["b"]
        a = run_morris(factors, f, trajectories=5, levels=4, seed=99)
        b = run_morris(factors, f, trajectories=5, levels=4, seed=99)
        self.assertEqual(a["factors"], b["factors"])

    def test_it_reports_how_little_oat_would_have_seen(self):
        factors = [MorrisFactor(id=f"x{i}", label="x", low=0.0, high=1.0)
                   for i in range(10)]
        result = run_morris(factors, lambda v: sum(v.values()),
                            trajectories=2, levels=4, seed=18)
        self.assertAlmostEqual(result["oat_explored_fraction"], 0.0025, places=4)

    def test_a_step_that_moves_nothing_is_skipped(self):
        factors = [MorrisFactor(id="a", label="a", low=0.0, high=1.0)]
        walk = [{"a": 0.5}, {"a": 0.5}]
        self.assertEqual(elementary_effects(factors, walk, [1.0, 1.0]), {})

    def test_mismatched_output_length_is_rejected(self):
        factors = [MorrisFactor(id="a", label="a", low=0.0, high=1.0)]
        with self.assertRaises(ValueError):
            elementary_effects(factors, [{"a": 0.0}, {"a": 0.5}], [1.0])

    def test_a_factor_with_no_samples_summarises_to_zero(self):
        factors = [MorrisFactor(id="a", label="a", low=0.0, high=1.0)]
        rows = summarise(factors, [])
        self.assertEqual(rows[0]["samples"], 0)
        self.assertEqual(rows[0]["mu_star"], 0.0)


if __name__ == "__main__":
    unittest.main()
