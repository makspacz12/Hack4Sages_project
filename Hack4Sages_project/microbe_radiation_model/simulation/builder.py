"""
Budowanie układu REBOUND zgodnego z resztą projektu.
"""

import math
from pathlib import Path
from typing import Any, List, Optional, Tuple

try:
    import rebound
except ImportError:
    rebound = None  # type: ignore


_PLANET_DATA = [
    ("Mercury", 1.660e-7, 0.39),
    ("Venus", 2.448e-6, 0.72),
    ("Earth", 3.040e-6, 1.0),
    ("Mars", 3.227e-7, 1.52),
    ("Jupiter", 9.548e-4, 5.2),
    ("Saturn", 2.859e-4, 9.5),
    ("Uranus", 4.366e-5, 19.2),
    ("Neptune", 5.151e-5, 30.1),
]


def _ra_dec_distance_to_xyz_au(ra_deg: float, dec_deg: float, distance_pc: float) -> Tuple[float, float, float]:
    """
    Przelicza współrzędne RA/DEC i odległość w parsekach na położenie XYZ w AU.
    """

    pc_to_au = 206264.80624709636
    r_au = distance_pc * pc_to_au
    ra_rad = math.radians(ra_deg)
    dec_rad = math.radians(dec_deg)
    x = r_au * math.cos(dec_rad) * math.cos(ra_rad)
    y = r_au * math.cos(dec_rad) * math.sin(ra_rad)
    z = r_au * math.sin(dec_rad)
    return (x, y, z)


def build_simulation(
    gaia_csv_path: Optional[str] = None,
    use_planets: bool = True,
    gaia_csv_cwd: Optional[str] = None,
) -> Tuple[Any, List[int], List[str], int]:
    """
    Buduje symulację REBOUND: Słońce, opcjonalnie planety i opcjonalnie gwiazdy z Gaia.
    """

    if rebound is None:
        raise ImportError("REBOUND jest wymagany do build_simulation. Zainstaluj pakiet 'rebound'.")

    sim = rebound.Simulation()
    sim.add(m=1.0)

    solar_system_bodies: List[str] = []
    if use_planets:
        for name, m_msun, a_au in _PLANET_DATA:
            sim.add(m=m_msun, a=a_au, e=0.0)
            solar_system_bodies.append(name)

    star_indices: List[int] = [0]

    if gaia_csv_path:
        cwd = Path(gaia_csv_cwd or ".")
        path = cwd / gaia_csv_path
        if path.exists():
            try:
                import csv

                with open(path, newline="", encoding="utf-8") as file_handle:
                    reader = csv.DictReader(file_handle)
                    for row in reader:
                        ra = float(row.get("ra", 0))
                        dec = float(row.get("dec", 0))
                        distance_raw = row.get("distance_pc", "0")
                        if " " in distance_raw:
                            distance_raw = distance_raw.strip().split()[0]
                        distance_pc = float(distance_raw)
                        mass_flame = row.get("mass_flame", "")
                        m_msun = float(mass_flame) if mass_flame and mass_flame.strip() else 0.1
                        x, y, z = _ra_dec_distance_to_xyz_au(ra, dec, distance_pc)
                        sim.add(m=m_msun, x=x, y=y, z=z, vx=0.0, vy=0.0, vz=0.0)
                        star_indices.append(sim.N - 1)
            except Exception as error:
                raise RuntimeError(f"Nie udało się wczytać pliku Gaia {path}: {error}") from error

    n_permanent = sim.N
    return sim, star_indices, solar_system_bodies, n_permanent
