"""Tests for terminal outcome reporting (no REBOUND)."""

import unittest

from microbe_radiation_model.asteroid_state import AsteroidState, AsteroidStateStore
from microbe_radiation_model.simulation.terminal_report import build_terminal_events_report


def _minimal_state(
    particle_index: int,
    *,
    active: bool = True,
    termination_reason=None,
    population_fraction: float = 1.0,
    extra=None,
) -> AsteroidState:
    return AsteroidState(
        particle_index=particle_index,
        rock_type="basalt",
        population_fraction=population_fraction,
        radius_m=1.0,
        density_kg_m3=3000.0,
        albedo=0.1,
        water_mass_fraction=0.01,
        porosity=0.1,
        thermal_conductivity_w_mk=2.0,
        uranium238_ppm=1.0,
        thorium232_ppm=1.0,
        potassium_percent=0.1,
        initial_radius_m=1.0,
        mass_kg=1.0,
        mass_msun=1e-30,
        initial_mass_kg=1.0,
        initial_mass_msun=1e-30,
        q_pr=1.0,
        launch_x_au=1.0,
        launch_y_au=0.0,
        launch_z_au=0.0,
        spin_period_h=10.0,
        obliquity_deg=0.0,
        spin_axis_x=0.0,
        spin_axis_y=0.0,
        spin_axis_z=1.0,
        active=active,
        termination_reason=termination_reason,
        extra=extra or {},
    )


class TestTerminalEventsReport(unittest.TestCase):

    def test_counts_arrival_and_escape(self):
        store = AsteroidStateStore()
        store.add(
            _minimal_state(
                1,
                active=False,
                termination_reason="entered_effective_hill",
                population_fraction=0.5,
                extra={
                    "termination_time_years": 100.0,
                    "population_fraction_at_termination": 0.5,
                },
            )
        )
        store.add(
            _minimal_state(
                2,
                active=True,
                population_fraction=0.8,
                extra={
                    "escaped_sun": True,
                    "escape_time_years": 50.0,
                    "population_fraction_at_escape": 0.8,
                },
            )
        )
        store.add(_minimal_state(3, active=True, population_fraction=0.9))

        report = build_terminal_events_report(store, [1, 2, 3], simulation_time_years=10.0)
        self.assertEqual(report["n_fragments"], 3)
        self.assertEqual(report["counts"]["arrived"], 1)
        self.assertEqual(report["counts"]["escaped_travelling"], 1)
        self.assertEqual(report["counts"]["travelling"], 1)
        self.assertAlmostEqual(
            report["groups"]["arrived"]["median_time_years"],
            100.0,
        )
        self.assertAlmostEqual(
            report["groups"]["escaped_travelling"]["median_population_fraction"],
            0.8,
        )

    def test_collision_star_bucket(self):
        store = AsteroidStateStore()
        store.add(
            _minimal_state(
                4,
                active=False,
                termination_reason="collided_with_star",
                extra={"termination_time_years": 2.0, "population_fraction_at_termination": 0.1},
            )
        )
        report = build_terminal_events_report(store, [4])
        self.assertEqual(report["counts"]["collided_star"], 1)


if __name__ == "__main__":
    unittest.main()
