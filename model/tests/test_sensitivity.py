"""Unit tests for OAT sensitivity helpers (no REBOUND)."""

import unittest

from microbe_radiation_model.ensembles.sensitivity import (
    build_tornado_rows,
    perturb_physics_overrides,
    perturb_server_value,
    select_knob_specs,
)
from microbe_radiation_model.server import _DEFAULTS


class TestPerturbServerValue(unittest.TestCase):

    def setUp(self):
        self.values = dict(_DEFAULTS)

    def test_numeric_low_high(self):
        low = perturb_server_value(self.values, "years", fraction=0.1, side="low")
        high = perturb_server_value(self.values, "years", fraction=0.1, side="high")
        self.assertAlmostEqual(low["years"], self.values["years"] * 0.9)
        self.assertAlmostEqual(high["years"], self.values["years"] * 1.1)

    def test_bool_uses_false_and_true(self):
        low = perturb_server_value(self.values, "erosion", fraction=0.1, side="low")
        high = perturb_server_value(self.values, "erosion", fraction=0.1, side="high")
        self.assertFalse(low["erosion"])
        self.assertTrue(high["erosion"])


class TestTornadoRows(unittest.TestCase):

    def test_sorts_by_span_descending(self):
        baseline = 0.5
        knobs = [
            {
                "id": "a",
                "label": "A",
                "unit": "",
                "baseline_value": 1,
                "low_value": 0.9,
                "high_value": 1.1,
                "low_aggregate": {"percentiles": {"p50": 0.48}},
                "high_aggregate": {"percentiles": {"p50": 0.52}},
            },
            {
                "id": "b",
                "label": "B",
                "unit": "",
                "baseline_value": 1,
                "low_value": 0.9,
                "high_value": 1.1,
                "low_aggregate": {"percentiles": {"p50": 0.1}},
                "high_aggregate": {"percentiles": {"p50": 0.9}},
            },
        ]
        rows = build_tornado_rows(baseline, knobs)
        self.assertEqual(rows[0]["id"], "b")
        self.assertGreater(rows[0]["span"], rows[1]["span"])


class TestKnobSelection(unittest.TestCase):

    def test_quick_subset(self):
        specs = select_knob_specs(None, quick=True)
        ids = {s.id for s in specs}
        self.assertIn("hydrolysis_ea", ids)
        self.assertIn("years", ids)
        self.assertNotIn("seed", ids)

    def test_physics_override_values(self):
        from microbe_radiation_model.ensembles.sensitivity import all_knob_specs
        from microbe_radiation_model.run_overrides import physics_baseline_values

        spec = next(s for s in all_knob_specs() if s.id == "hydrolysis_ea")
        low = perturb_physics_overrides(
            physics_baseline_values(), spec, fraction=0.1, side="low"
        )
        self.assertAlmostEqual(
            low.hydrolysis_ea_j_mol,
            physics_baseline_values()["hydrolysis_ea"] * 0.9,
        )


if __name__ == "__main__":
    unittest.main()
