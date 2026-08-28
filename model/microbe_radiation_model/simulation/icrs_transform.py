"""
ICRS spherical to Cartesian, without astropy.coordinates.

astropy.coordinates and astropy.time both fail to import on machines where
Windows Smart App Control blocks astropy's small `_parse_times` C extension.
That extension exists only to parse ISO time strings quickly, and nothing in
this project needs it: the two conversions we actually use are textbook, and
writing them out costs less than carrying a dependency that can be denied at
load time by a policy outside the repository.

Both functions below match `SkyCoord(...).cartesian` in the ICRS frame, and
`test_icrs_transform.py` pins them against published stellar velocities.
"""

from __future__ import annotations

import numpy as np

# Exact by the definition of the parsec: 648000/pi astronomical units.
AU_PER_PC = 648000.0 / np.pi

# 1 AU/yr in km/s. A star one parsec away with a proper motion of one arcsecond
# per year moves exactly one AU per year across the sky, which is what makes the
# tangential conversion below a pure multiplication.
KM_S_PER_AU_YR = 4.740570446


def _unit_vectors(ra_deg, dec_deg):
    """
    The local orthonormal triad at each sky position.

    Returns the radial direction and the two tangential directions, along
    increasing right ascension and increasing declination.
    """
    ra = np.radians(np.asarray(ra_deg, dtype=float))
    dec = np.radians(np.asarray(dec_deg, dtype=float))
    cos_ra, sin_ra = np.cos(ra), np.sin(ra)
    cos_dec, sin_dec = np.cos(dec), np.sin(dec)

    radial = np.stack([cos_dec * cos_ra, cos_dec * sin_ra, sin_dec], axis=-1)
    east = np.stack([-sin_ra, cos_ra, np.zeros_like(sin_ra)], axis=-1)
    north = np.stack([-sin_dec * cos_ra, -sin_dec * sin_ra, cos_dec], axis=-1)
    return radial, east, north


def icrs_position_au(ra_deg, dec_deg, distance_pc):
    """
    Position in AU. Equivalent to SkyCoord(ra, dec, distance).cartesian.
    """
    radial, _, _ = _unit_vectors(ra_deg, dec_deg)
    d_au = np.asarray(distance_pc, dtype=float) * AU_PER_PC
    xyz = radial * d_au[..., None]
    return xyz[..., 0], xyz[..., 1], xyz[..., 2]


def icrs_velocity_au_per_year(
    ra_deg, dec_deg, distance_pc, pm_ra_cosdec_mas_yr, pm_dec_mas_yr,
    radial_velocity_km_s,
):
    """
    Space velocity in AU/year from proper motion and radial velocity.

    The tangential terms need no trigonometric factor beyond the unit vectors:
    a proper motion in arcseconds per year, times a distance in parsecs, is a
    transverse speed in AU per year by construction. `pm_ra_cosdec` already
    carries the cos(dec) factor, so it multiplies the east vector directly.
    """
    radial, east, north = _unit_vectors(ra_deg, dec_deg)

    d_pc = np.asarray(distance_pc, dtype=float)
    # mas/yr -> arcsec/yr, then arcsec/yr * pc -> AU/yr.
    v_east = np.asarray(pm_ra_cosdec_mas_yr, dtype=float) * 1e-3 * d_pc
    v_north = np.asarray(pm_dec_mas_yr, dtype=float) * 1e-3 * d_pc
    v_radial = np.asarray(radial_velocity_km_s, dtype=float) / KM_S_PER_AU_YR

    vel = (
        radial * v_radial[..., None]
        + east * v_east[..., None]
        + north * v_north[..., None]
    )
    return vel[..., 0], vel[..., 1], vel[..., 2]
