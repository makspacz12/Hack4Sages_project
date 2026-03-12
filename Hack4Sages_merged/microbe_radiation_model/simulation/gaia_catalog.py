"""
Gaia catalog loading, querying and conversion helpers.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

import numpy as np
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.table import Table
from astropy.time import Time


GAIA_MAIN_TABLE = "gaiadr3.gaia_source"


@dataclass(frozen=True)
class GaiaCatalogConfig:
    """
    Runtime configuration for obtaining the Gaia star catalog.
    """

    mode: str = "csv"
    csv_path: str = "nearest_50_gaia.csv"
    csv_cwd: str | None = None
    top_n: int = 50
    overwrite_csv: bool = True
    main_table: str = GAIA_MAIN_TABLE
    reference_time_utc: str = "2026-01-01T00:00:00"


@dataclass(frozen=True)
class GaiaStarParticle:
    """
    REBOUND-ready Gaia star state.
    """

    source_id: int | None
    mass_msun: float
    radius_au: float
    x_au: float
    y_au: float
    z_au: float
    vx_au_per_yr: float
    vy_au_per_yr: float
    vz_au_per_yr: float


RUNTIME_GAIA_COLUMNS = [
    "distance_pc",
    "x_au",
    "y_au",
    "z_au",
    "vx_au_per_yr",
    "vy_au_per_yr",
    "vz_au_per_yr",
    "mass_msun_resolved",
    "radius_rsun_resolved",
    "radius_au_resolved",
    "mass_source",
    "radius_source",
]


def default_gaia_query(top_n: int = 50) -> str:
    """
    Build the notebook-equivalent ADQL query for the nearest Gaia stars.
    """

    return f"""
SELECT
    TOP {top_n}
    g.source_id,
    g.ra, g.dec,
    g.parallax,
    g.pmra, g.pmdec,
    g.radial_velocity,
    g.phot_g_mean_mag,
    ap.mass_flame,
    ap.radius_flame
FROM gaiadr3.gaia_source AS g
LEFT JOIN gaiadr3.astrophysical_parameters AS ap
  ON g.source_id = ap.source_id
WHERE g.parallax > 0
ORDER BY g.parallax DESC
""".strip()


def fetch_gaia_table(config: GaiaCatalogConfig) -> Table:
    """
    Query Gaia DR3 and return a table enriched with ``distance_pc``.
    """

    try:
        from astroquery.gaia import Gaia
    except ImportError as error:
        raise ImportError("astroquery is required to query Gaia catalogs.") from error

    Gaia.MAIN_GAIA_TABLE = config.main_table
    job = Gaia.launch_job_async(default_gaia_query(top_n=config.top_n))
    table = job.get_results()
    return prepare_gaia_table(table)


def ensure_distance_pc_column(table: Table) -> Table:
    """
    Add ``distance_pc`` if it is missing and parallax is available.
    """

    if "distance_pc" in table.colnames:
        return table
    if "parallax" not in table.colnames:
        raise ValueError("Gaia table must contain either 'distance_pc' or 'parallax'.")

    distance_pc = (1000.0 / table["parallax"]) * u.pc
    table = table.copy()
    table["distance_pc"] = distance_pc
    return table


def write_gaia_table(table: Table, path: str | Path, overwrite: bool = True) -> Path:
    """
    Persist a Gaia table to CSV.
    """

    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    table.write(output_path, format="csv", overwrite=overwrite)
    return output_path


def load_gaia_table(path: str | Path) -> Table:
    """
    Load the Gaia CSV and ensure the runtime columns are available.
    """

    table = Table.read(path, format="csv")
    return prepare_gaia_table(table)


def load_or_fetch_gaia_table(config: GaiaCatalogConfig) -> Table:
    """
    Resolve the configured Gaia source.
    """

    csv_path = resolve_gaia_csv_path(config.csv_path, config.csv_cwd)
    if config.mode == "query_and_save":
        table = prepare_gaia_table(fetch_gaia_table(config))
        write_gaia_table(table, csv_path, overwrite=config.overwrite_csv)
        return table
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Gaia CSV '{csv_path}' does not exist and mode is '{config.mode}'."
        )
    return load_gaia_table(csv_path)


def resolve_gaia_csv_path(csv_path: str, csv_cwd: str | None = None) -> Path:
    """
    Resolve the Gaia CSV against an optional working directory.
    """

    path = Path(csv_path)
    if path.is_absolute():
        return path
    if csv_cwd is not None:
        return Path(csv_cwd) / path
    return Path(".") / path


def estimate_star_mass_radius(
    table: Table,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Reproduce the notebook fallback for ``mass_flame`` and ``radius_flame``.
    """

    mass_flame = _column_to_float_array(table, "mass_flame", fill_value=np.nan)
    radius_flame = _column_to_float_array(table, "radius_flame", fill_value=np.nan)

    star_masses = np.full(len(table), np.nan, dtype=float)
    star_radii_rsun = np.full(len(table), np.nan, dtype=float)

    mask_mass = np.isfinite(mass_flame) & (mass_flame > 0)
    mask_radius = np.isfinite(radius_flame) & (radius_flame > 0)

    star_masses[mask_mass] = mass_flame[mask_mass]
    star_radii_rsun[mask_radius] = radius_flame[mask_radius]

    missing_mass = ~np.isfinite(star_masses)
    missing_radius = ~np.isfinite(star_radii_rsun)

    if missing_mass.any() or missing_radius.any():
        g_mag = _column_to_float_array(table, "phot_g_mean_mag", fill_value=np.nan)
        distance_pc = _column_to_float_array(table, "distance_pc", fill_value=np.nan)
        absolute_mag = g_mag - 5.0 * (np.log10(distance_pc) - 1.0)
        m_g_sun = 4.67
        luminosity_ratio = 10.0 ** (-0.4 * (absolute_mag - m_g_sun))
        mass_estimate = np.clip(luminosity_ratio ** (1.0 / 3.5), 0.08, 20.0)
        radius_estimate = np.clip(mass_estimate ** 0.8, 0.1, 20.0)

        star_masses[missing_mass] = mass_estimate[missing_mass]
        star_radii_rsun[missing_radius] = radius_estimate[missing_radius]

    star_masses = np.where(np.isfinite(star_masses), star_masses, 1.0)
    star_radii_rsun = np.where(np.isfinite(star_radii_rsun), star_radii_rsun, 1.0)
    mass_source = np.where(mask_mass, "gaia_flame", "photometric_estimate")
    radius_source = np.where(mask_radius, "gaia_flame", "mass_radius_estimate")
    return star_masses, star_radii_rsun, mask_mass, mask_radius, mass_source, radius_source


def prepare_gaia_table(table: Table) -> Table:
    """
    Build the canonical Gaia CSV/runtime representation with resolved columns.
    """

    prepared = ensure_distance_pc_column(table).copy()

    coords = SkyCoord(
        ra=_column_to_float_array(prepared, "ra") * u.deg,
        dec=_column_to_float_array(prepared, "dec") * u.deg,
        distance=_column_to_float_array(prepared, "distance_pc") * u.pc,
    )
    cart = coords.cartesian
    x_au = cart.x.to(u.au).value
    y_au = cart.y.to(u.au).value
    z_au = cart.z.to(u.au).value

    vx_auyr = np.zeros(len(prepared), dtype=float)
    vy_auyr = np.zeros(len(prepared), dtype=float)
    vz_auyr = np.zeros(len(prepared), dtype=float)

    pmra = _column_to_float_array(prepared, "pmra", fill_value=np.nan)
    pmdec = _column_to_float_array(prepared, "pmdec", fill_value=np.nan)
    radial_velocity = _column_to_float_array(prepared, "radial_velocity", fill_value=np.nan)
    mask_pm = (~np.isnan(pmra)) & (~np.isnan(pmdec))

    if mask_pm.any():
        rv_eff = np.where(np.isnan(radial_velocity), 0.0, radial_velocity)
        coords_vel = SkyCoord(
            ra=_column_to_float_array(prepared, "ra")[mask_pm] * u.deg,
            dec=_column_to_float_array(prepared, "dec")[mask_pm] * u.deg,
            distance=_column_to_float_array(prepared, "distance_pc")[mask_pm] * u.pc,
            pm_ra_cosdec=pmra[mask_pm] * u.mas / u.yr,
            pm_dec=pmdec[mask_pm] * u.mas / u.yr,
            radial_velocity=rv_eff[mask_pm] * u.km / u.s,
            obstime=Time("J2000"),
        )
        cart_vel = coords_vel.cartesian
        if "s" in cart_vel.differentials:
            diff = cart_vel.differentials["s"]
            vx_auyr[mask_pm] = diff.d_x.to(u.au / u.yr).value
            vy_auyr[mask_pm] = diff.d_y.to(u.au / u.yr).value
            vz_auyr[mask_pm] = diff.d_z.to(u.au / u.yr).value

    (
        star_masses,
        star_radii_rsun,
        _mask_mass,
        _mask_radius,
        mass_source,
        radius_source,
    ) = estimate_star_mass_radius(prepared)
    radius_au = star_radii_rsun * u.R_sun.to(u.au)

    _set_or_replace_column(prepared, "x_au", x_au)
    _set_or_replace_column(prepared, "y_au", y_au)
    _set_or_replace_column(prepared, "z_au", z_au)
    _set_or_replace_column(prepared, "vx_au_per_yr", vx_auyr)
    _set_or_replace_column(prepared, "vy_au_per_yr", vy_auyr)
    _set_or_replace_column(prepared, "vz_au_per_yr", vz_auyr)
    _set_or_replace_column(prepared, "mass_msun_resolved", star_masses)
    _set_or_replace_column(prepared, "radius_rsun_resolved", star_radii_rsun)
    _set_or_replace_column(prepared, "radius_au_resolved", radius_au)
    _set_or_replace_column(prepared, "mass_source", np.asarray(mass_source, dtype=str))
    _set_or_replace_column(prepared, "radius_source", np.asarray(radius_source, dtype=str))
    return prepared


def gaia_table_to_particles(table: Table) -> list[GaiaStarParticle]:
    """
    Convert a Gaia table to REBOUND-ready star particles.
    """

    prepared = prepare_gaia_table(table)
    x_au = _column_to_float_array(prepared, "x_au")
    y_au = _column_to_float_array(prepared, "y_au")
    z_au = _column_to_float_array(prepared, "z_au")
    vx_auyr = _column_to_float_array(prepared, "vx_au_per_yr")
    vy_auyr = _column_to_float_array(prepared, "vy_au_per_yr")
    vz_auyr = _column_to_float_array(prepared, "vz_au_per_yr")
    star_masses = _column_to_float_array(prepared, "mass_msun_resolved")
    radius_au = _column_to_float_array(prepared, "radius_au_resolved")
    source_ids = _column_to_int_list(prepared, "source_id")

    particles: list[GaiaStarParticle] = []
    for idx in range(len(table)):
        particles.append(
            GaiaStarParticle(
                source_id=source_ids[idx],
                mass_msun=float(star_masses[idx]),
                radius_au=float(radius_au[idx]),
                x_au=float(x_au[idx]),
                y_au=float(y_au[idx]),
                z_au=float(z_au[idx]),
                vx_au_per_yr=float(vx_auyr[idx]),
                vy_au_per_yr=float(vy_auyr[idx]),
                vz_au_per_yr=float(vz_auyr[idx]),
            )
        )
    return particles


def gaia_table_has_runtime_columns(table: Table) -> bool:
    """
    Return whether the table already includes the canonical runtime columns.
    """

    return all(column in table.colnames for column in RUNTIME_GAIA_COLUMNS)


def _column_to_float_array(
    table: Table,
    name: str,
    fill_value: float = 0.0,
) -> np.ndarray:
    if name not in table.colnames:
        return np.full(len(table), fill_value, dtype=float)

    values: Sequence[Any] = table[name]
    result = np.empty(len(values), dtype=float)
    for idx, value in enumerate(values):
        try:
            if np.ma.is_masked(value) or value is None or value == "":
                result[idx] = fill_value
            else:
                result[idx] = float(value)
        except (TypeError, ValueError):
            result[idx] = fill_value
    return result


def _column_to_int_list(table: Table, name: str) -> list[int | None]:
    if name not in table.colnames:
        return [None] * len(table)

    values: Sequence[Any] = table[name]
    result: list[int | None] = []
    for value in values:
        try:
            if value is None or value == "":
                result.append(None)
            else:
                result.append(int(value))
        except (TypeError, ValueError):
            result.append(None)
    return result


def _set_or_replace_column(table: Table, name: str, values: np.ndarray) -> None:
    if name in table.colnames:
        table.replace_column(name, values)
    else:
        table[name] = values
