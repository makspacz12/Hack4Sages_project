"""
The ICRS conversions that replaced astropy.coordinates.

Checked against published stellar astrometry rather than against the library
they replaced, since that library cannot be imported on the machine where this
was written - which is the whole reason these functions exist.
"""

import math
import unittest

import numpy as np

from microbe_radiation_model.simulation.icrs_transform import (
    AU_PER_PC,
    KM_S_PER_AU_YR,
    icrs_position_au,
    icrs_velocity_au_per_year,
)


class TestConstants(unittest.TestCase):

    def test_parsec_is_exact_by_definition(self):
        # 648000/pi AU, from the definition of the parsec.
        self.assertAlmostEqual(AU_PER_PC, 206264.80624709636, places=6)

    def test_one_au_per_year_in_km_per_second(self):
        self.assertAlmostEqual(KM_S_PER_AU_YR, 4.740570446, places=7)


class TestPosition(unittest.TestCase):

    def test_distance_is_preserved(self):
        x, y, z = icrs_position_au([10.0, 200.0], [-30.0, 60.0], [1.5, 8.0])
        got = np.sqrt(x**2 + y**2 + z**2)
        np.testing.assert_allclose(got, np.array([1.5, 8.0]) * AU_PER_PC, rtol=1e-12)

    def test_the_origin_of_right_ascension_lies_on_the_x_axis(self):
        x, y, z = icrs_position_au([0.0], [0.0], [1.0])
        self.assertAlmostEqual(float(x[0]), AU_PER_PC, places=6)
        self.assertAlmostEqual(float(y[0]), 0.0, places=6)
        self.assertAlmostEqual(float(z[0]), 0.0, places=6)

    def test_the_north_celestial_pole_lies_on_the_z_axis(self):
        x, y, z = icrs_position_au([123.0], [90.0], [2.0])
        self.assertAlmostEqual(float(z[0]), 2.0 * AU_PER_PC, places=6)
        self.assertAlmostEqual(float(x[0]), 0.0, places=6)
        self.assertAlmostEqual(float(y[0]), 0.0, places=6)

    def test_six_hours_of_right_ascension_lies_on_the_y_axis(self):
        x, y, _ = icrs_position_au([90.0], [0.0], [1.0])
        self.assertAlmostEqual(float(y[0]), AU_PER_PC, places=6)
        self.assertAlmostEqual(float(x[0]), 0.0, places=6)


class TestVelocity(unittest.TestCase):
    """
    Barnard's Star, the standard high-proper-motion test case.

    Gaia DR3 astrometry: RA 269.4521 deg, Dec 4.6933 deg, parallax 546.976 mas,
    pm_ra_cosdec -801.551 mas/yr, pm_dec 10362.394 mas/yr, radial velocity
    -110.51 km/s. Its published space velocity is about 142.7 km/s, of which
    roughly 90 km/s is tangential.
    """

    RA, DEC, PARALLAX_MAS = 269.4520769, 4.6933, 546.9759
    PM_RA, PM_DEC, RV = -801.551, 10362.394, -110.51

    def speed_km_s(self):
        d = 1000.0 / self.PARALLAX_MAS
        vx, vy, vz = icrs_velocity_au_per_year(
            self.RA, self.DEC, d, self.PM_RA, self.PM_DEC, self.RV
        )
        return math.sqrt(vx**2 + vy**2 + vz**2) * KM_S_PER_AU_YR

    def test_total_space_velocity_matches_the_published_value(self):
        self.assertAlmostEqual(self.speed_km_s(), 142.7, delta=0.5)

    def test_tangential_component_matches_the_published_value(self):
        d = 1000.0 / self.PARALLAX_MAS
        mu = math.hypot(self.PM_RA, self.PM_DEC) / 1000.0
        self.assertAlmostEqual(mu * d * KM_S_PER_AU_YR, 90.0, delta=0.5)

    def test_pure_radial_motion_is_parallel_to_the_position(self):
        pos = np.array(icrs_position_au(45.0, 20.0, 3.0)).ravel()
        vel = np.array(icrs_velocity_au_per_year(45.0, 20.0, 3.0, 0.0, 0.0, 10.0)).ravel()
        cross = np.cross(pos, vel)
        self.assertAlmostEqual(float(np.linalg.norm(cross)), 0.0, places=6)

    def test_pure_proper_motion_is_perpendicular_to_the_position(self):
        pos = np.array(icrs_position_au(45.0, 20.0, 3.0)).ravel()
        vel = np.array(
            icrs_velocity_au_per_year(45.0, 20.0, 3.0, 120.0, -80.0, 0.0)
        ).ravel()
        cos = float(pos @ vel) / (np.linalg.norm(pos) * np.linalg.norm(vel))
        self.assertAlmostEqual(cos, 0.0, places=9)

    def test_tangential_speed_scales_with_distance(self):
        """mu x d: the same proper motion is faster further away."""
        near = np.array(icrs_velocity_au_per_year(10.0, 10.0, 1.0, 100.0, 0.0, 0.0))
        far = np.array(icrs_velocity_au_per_year(10.0, 10.0, 4.0, 100.0, 0.0, 0.0))
        self.assertAlmostEqual(
            float(np.linalg.norm(far)) / float(np.linalg.norm(near)), 4.0, places=9
        )

    def test_a_stationary_star_has_no_velocity(self):
        vel = np.array(icrs_velocity_au_per_year(1.0, 2.0, 3.0, 0.0, 0.0, 0.0))
        self.assertAlmostEqual(float(np.linalg.norm(vel)), 0.0, places=12)

    def test_arrays_are_handled_elementwise(self):
        vx, vy, vz = icrs_velocity_au_per_year(
            [0.0, 90.0], [0.0, 0.0], [1.0, 1.0], [0.0, 0.0], [0.0, 0.0], [10.0, 10.0]
        )
        self.assertEqual(len(vx), 2)
        # Radial motion at RA 0 is along +x; at RA 90 it is along +y.
        self.assertGreater(float(vx[0]), 0.0)
        self.assertGreater(float(vy[1]), 0.0)


if __name__ == "__main__":
    unittest.main()
