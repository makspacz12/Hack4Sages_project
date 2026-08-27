"""
The provenance contract: given only a result file, you can rebuild the run.

Each test here checks one clause of that promise.
"""

import json
import unittest
from dataclasses import replace

from microbe_radiation_model.provenance import (
    SCHEMA_VERSION,
    audit_coefficients,
    build_provenance,
    capture_parameters,
    collect_environment,
    collect_source_version,
    package_versions,
    parameters_digest,
    reproduce_command,
    resolve_seed,
)
from microbe_radiation_model.simulation.config import default_material_config
from microbe_radiation_model.simulation.scenarios import (
    _default_mars_pipeline_run_config,
)


def seeded_configs(seed=42):
    material = default_material_config()
    run = _default_mars_pipeline_run_config()
    run = replace(run, impact=replace(run.impact, seed=seed))
    return material, run


class TestSeedResolution(unittest.TestCase):
    """There is no such thing as an unseeded run."""

    def test_an_explicit_seed_is_kept(self):
        self.assertEqual(resolve_seed(1234), 1234)

    def test_a_missing_seed_is_drawn_rather_than_left_none(self):
        got = resolve_seed(None)
        self.assertIsInstance(got, int)
        self.assertGreaterEqual(got, 0)

    def test_drawn_seeds_vary(self):
        seeds = {resolve_seed(None) for _ in range(20)}
        self.assertGreater(len(seeds), 1)

    def test_zero_is_a_valid_seed_and_is_not_treated_as_missing(self):
        self.assertEqual(resolve_seed(0), 0)


class TestParameterCapture(unittest.TestCase):

    def test_both_configs_are_captured(self):
        material, run = seeded_configs()
        params = capture_parameters(material, run)
        self.assertIn("material", params)
        self.assertIn("run", params)

    def test_capture_is_json_serialisable(self):
        material, run = seeded_configs()
        json.dumps(capture_parameters(material, run))  # must not raise

    def test_nested_configs_survive_the_capture(self):
        material, run = seeded_configs()
        params = capture_parameters(material, run)
        self.assertEqual(params["run"]["impact"]["seed"], 42)
        self.assertIn("dust_erosion", params["run"])

    def test_material_values_are_captured_faithfully(self):
        material, run = seeded_configs()
        params = capture_parameters(material, run)
        self.assertAlmostEqual(params["material"]["rock_radius"], material.rock_radius)


class TestDigest(unittest.TestCase):
    """Equal digests mean identical inputs."""

    def test_digest_is_a_sha256_hex_string(self):
        material, run = seeded_configs()
        digest = parameters_digest(capture_parameters(material, run))
        self.assertEqual(len(digest), 64)
        int(digest, 16)  # must be hexadecimal

    def test_same_configuration_gives_the_same_digest(self):
        a = parameters_digest(capture_parameters(*seeded_configs()))
        b = parameters_digest(capture_parameters(*seeded_configs()))
        self.assertEqual(a, b)

    def test_a_different_seed_changes_the_digest(self):
        a = parameters_digest(capture_parameters(*seeded_configs(1)))
        b = parameters_digest(capture_parameters(*seeded_configs(2)))
        self.assertNotEqual(a, b)

    def test_a_different_fragment_radius_changes_the_digest(self):
        material, run = seeded_configs()
        a = parameters_digest(capture_parameters(material, run))
        b = parameters_digest(
            capture_parameters(replace(material, rock_radius=1.5), run)
        )
        self.assertNotEqual(a, b)

    def test_key_order_does_not_affect_the_digest(self):
        params = capture_parameters(*seeded_configs())
        reordered = {k: params[k] for k in reversed(list(params))}
        self.assertEqual(parameters_digest(params), parameters_digest(reordered))


class TestEnvironment(unittest.TestCase):

    def test_python_version_is_recorded(self):
        self.assertRegex(collect_environment()["python"], r"^\d+\.\d+")

    def test_every_tracked_package_appears_present_or_absent(self):
        versions = package_versions()
        for name in ("rebound", "reboundx", "numpy"):
            self.assertIn(name, versions)

    def test_an_absent_package_is_recorded_as_none_not_omitted(self):
        """Knowing reboundx was missing is part of knowing what produced the run."""
        versions = package_versions()
        self.assertTrue(all(v is None or isinstance(v, str) for v in versions.values()))

    def test_source_version_reports_availability_either_way(self):
        source = collect_source_version()
        self.assertIn("available", source)
        if source["available"]:
            self.assertEqual(len(source["commit"]), 40)
            self.assertIn("dirty", source)


class TestReproduceCommand(unittest.TestCase):

    def test_command_names_the_module_entry_point(self):
        material, run = seeded_configs()
        self.assertTrue(
            reproduce_command(material, run).startswith("python -m microbe_radiation_model")
        )

    def test_command_carries_the_seed(self):
        material, run = seeded_configs(seed=777)
        self.assertIn("--seed 777", reproduce_command(material, run))

    def test_command_states_the_simulated_span_not_the_frame_count(self):
        # A run of N frames spans (N-1)*dt, because frame 0 is the initial
        # state before any integration. This test previously asserted N*dt,
        # which is the arithmetic the CLI and the provenance record both got
        # wrong - it reported 0.3 yr for a run that actually covered 0.25.
        material, run = seeded_configs()
        years = run.dt_yr * (run.n_steps - 1)
        self.assertIn(f"--years {years:g}", reproduce_command(material, run))

    def test_the_span_is_one_step_shorter_than_the_frame_count_suggests(self):
        material, run = seeded_configs()
        naive = run.dt_yr * run.n_steps
        actual = run.dt_yr * (run.n_steps - 1)
        self.assertNotAlmostEqual(naive, actual)
        self.assertNotIn(f"--years {naive:g}", reproduce_command(material, run))

    def test_disabled_physics_is_reflected_as_a_flag(self):
        material, run = seeded_configs()
        run = replace(run, radiation_pressure=replace(run.radiation_pressure, enabled=False))
        self.assertIn("--no-radiation-pressure", reproduce_command(material, run))

    def test_erosion_flux_appears_when_erosion_is_on(self):
        material, run = seeded_configs()
        self.assertIn("--dust-flux", reproduce_command(material, run))


class TestAuditCoefficients(unittest.TestCase):
    """The record is generated from the constants, so it cannot drift."""

    def test_all_four_open_items_are_listed(self):
        entries = audit_coefficients()["entries"]
        for key in (
            "internal_dose_coefficients",
            "hydrolysis",
            "hydrolysis_survival_coefficient",
            "radiation_survival_coefficient",
            "cosmic_ray_attenuation",
        ):
            self.assertIn(key, entries)

    def test_the_count_matches_the_entries(self):
        block = audit_coefficients()
        unresolved = [e for e in block["entries"].values() if e.get("status") == "unresolved"]
        self.assertEqual(block["unresolved_count"], len(unresolved))

    def test_dose_values_are_read_from_the_module(self):
        from microbe_radiation_model.radiation.radionuclide_model import gamma

        recorded = audit_coefficients()["entries"]["internal_dose_coefficients"]
        self.assertEqual(
            recorded["values"]["gamma_gy_per_year_per_ppm_u"],
            gamma.GAMMA_DOSE_PER_PPM_U,
        )
        self.assertEqual(
            recorded["values"]["gamma_mass_attenuation_cm2_g"],
            gamma.GAMMA_MASS_ATTENUATION_CM2_G,
        )

    def test_the_dose_coefficients_now_carry_a_citation(self):
        """They were the largest unresolved item in the audit."""
        entry = audit_coefficients()["entries"]["internal_dose_coefficients"]
        self.assertEqual(entry["status"], "resolved")
        self.assertIn("Cresswell", entry["source"])

    def test_hydrolysis_values_are_read_from_the_module(self):
        from microbe_radiation_model.chemistry import constants as chem

        recorded = audit_coefficients()["entries"]["hydrolysis"]
        self.assertEqual(recorded["activation_energy_j_mol"], chem.HYDROLYSIS_EA_J_MOL)

    def test_every_entry_justifies_itself_one_way_or_the_other(self):
        """
        An open entry has to say what is wrong with it; a resolved one has to
        say where its number came from. Neither may be silent.
        """
        for name, entry in audit_coefficients()["entries"].items():
            with self.subTest(coefficient=name):
                if entry["status"] == "unresolved":
                    self.assertTrue(entry.get("issue"), f"{name}: no issue stated")
                else:
                    self.assertTrue(entry.get("source"), f"{name}: no source cited")


class TestProvenanceBlock(unittest.TestCase):

    def setUp(self):
        self.block = build_provenance(*seeded_configs(), scenario="unit-test")

    def test_carries_the_schema_version(self):
        self.assertEqual(self.block["schema_version"], SCHEMA_VERSION)

    def test_names_the_scenario(self):
        self.assertEqual(self.block["scenario"], "unit-test")

    def test_records_a_concrete_seed(self):
        self.assertIsNotNone(self.block["seed"])

    def test_is_json_serialisable(self):
        json.dumps(self.block)  # must not raise

    def test_contains_everything_needed_to_reproduce(self):
        for key in ("parameters", "parameters_sha256", "reproduce", "environment", "source"):
            self.assertIn(key, self.block)

    def test_the_digest_matches_the_captured_parameters(self):
        self.assertEqual(
            self.block["parameters_sha256"], parameters_digest(self.block["parameters"])
        )

    def test_carries_the_open_coefficient_warning(self):
        audit = self.block["coefficients_under_audit"]
        self.assertGreater(audit["unresolved_count"], 0)
        self.assertIn("provisional", audit["note"])

    def test_extra_details_are_attached_when_given(self):
        block = build_provenance(
            *seeded_configs(), scenario="unit-test", extra={"frames": 10}
        )
        self.assertEqual(block["scenario_details"]["frames"], 10)


if __name__ == "__main__":
    unittest.main()
