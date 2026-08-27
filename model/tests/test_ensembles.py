"""Unit tests for ensemble aggregation and grid layout (no REBOUND)."""

import unittest

from microbe_radiation_model.ensembles.aggregate import percentile_summary
from microbe_radiation_model.ensembles.grid import build_heatmap_p50, linspace_values


class TestPercentileSummary(unittest.TestCase):

    def test_empty(self):
        s = percentile_summary([])
        self.assertEqual(s["n"], 0)
        self.assertIsNone(s["mean"])
        self.assertIsNone(s["percentiles"]["p50"])

    def test_single_value(self):
        s = percentile_summary([0.4])
        self.assertEqual(s["n"], 1)
        self.assertAlmostEqual(s["mean"], 0.4)
        self.assertAlmostEqual(s["percentiles"]["p10"], 0.4)
        self.assertAlmostEqual(s["percentiles"]["p90"], 0.4)

    def test_median_of_odd_list(self):
        s = percentile_summary([0.1, 0.5, 0.9])
        self.assertAlmostEqual(s["percentiles"]["p50"], 0.5)
        self.assertAlmostEqual(s["mean"], 0.5)

    def test_percentiles_are_monotonic(self):
        s = percentile_summary([0.0, 0.25, 0.5, 0.75, 1.0])
        ps = s["percentiles"]
        self.assertLessEqual(ps["p10"], ps["p25"])
        self.assertLessEqual(ps["p25"], ps["p50"])
        self.assertLessEqual(ps["p50"], ps["p75"])
        self.assertLessEqual(ps["p75"], ps["p90"])


class TestGridHelpers(unittest.TestCase):

    def test_linspace_endpoints(self):
        self.assertEqual(linspace_values(0.0, 10.0, 3), [0.0, 5.0, 10.0])

    def test_heatmap_rows_follow_radius(self):
        cells = [
            {
                "velocity_kms": 5.0,
                "radius_m": 0.1,
                "aggregate": {"percentiles": {"p50": 0.9}},
            },
            {
                "velocity_kms": 10.0,
                "radius_m": 0.1,
                "aggregate": {"percentiles": {"p50": 0.8}},
            },
            {
                "velocity_kms": 5.0,
                "radius_m": 1.0,
                "aggregate": {"percentiles": {"p50": 0.5}},
            },
            {
                "velocity_kms": 10.0,
                "radius_m": 1.0,
                "aggregate": {"percentiles": {"p50": 0.4}},
            },
        ]
        table = build_heatmap_p50(cells, [5.0, 10.0], [0.1, 1.0])
        self.assertEqual(table[0], [0.9, 0.8])
        self.assertEqual(table[1], [0.5, 0.4])


if __name__ == "__main__":
    unittest.main()
