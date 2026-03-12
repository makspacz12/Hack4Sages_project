"""
Solar-system builders for the REBOUND runtime.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.request import urlretrieve

from astropy import units as u
from astropy.constants import R_earth, R_jup, R_sun
from astropy.time import Time

from .solar_system_cache import load_cached_solar_system, write_cached_solar_system


KERNEL_SPECS = {
    "de440.bsp": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440.bsp",
    "naif0012.tls": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
    "gm_de431.tpc": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/gm_de431.tpc",
    "pck00010.tpc": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc",
}

PLANET_NAMES = [
    "Mercury",
    "Venus",
    "Earth",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
]


@dataclass(frozen=True)
class SolarSystemBuildConfig:
    """
    Configuration for constructing the solar system in REBOUND.
    """

    mode: str = "simple_builtin"
    observation_time_utc: str = "2026-01-01T00:00:00"
    kernel_dir: str = "kernels"
    download_kernels: bool = True
    use_planets: bool = True
    use_cache: bool = True
    cache_path: str | None = "microbe_radiation_model/data/solar_system_horizons_cache.json"


def build_solar_system(sim: Any, config: SolarSystemBuildConfig) -> list[str]:
    """
    Build the solar system using the configured strategy.
    """

    sim.units = ("AU", "yr", "Msun")
    if config.mode == "simple_builtin":
        return build_simple_solar_system(
            sim,
            use_planets=config.use_planets,
            observation_time_utc=config.observation_time_utc,
            use_cache=config.use_cache,
            cache_path=config.cache_path,
        )
    if config.mode == "full_ephemeris":
        return build_full_ephemeris_solar_system(sim, config)
    raise ValueError(f"Unsupported solar-system build mode: {config.mode}")


def build_simple_solar_system(
    sim: Any,
    use_planets: bool = True,
    observation_time_utc: str = "2026-01-01T00:00:00",
    use_cache: bool = True,
    cache_path: str | None = "microbe_radiation_model/data/solar_system_horizons_cache.json",
) -> list[str]:
    """
    Lightweight Horizons-based solar-system builder.

    This mode keeps the setup simple, but masses still come from Horizons
    rather than a duplicated hardcoded table.
    """

    return _add_horizons_solar_system(
        sim=sim,
        observation_time_utc=observation_time_utc,
        use_planets=use_planets,
        use_cache=use_cache,
        cache_path=cache_path,
    )


def build_full_ephemeris_solar_system(sim: Any, config: SolarSystemBuildConfig) -> list[str]:
    """
    Notebook-faithful solar-system builder using REBOUND Horizons plus SPICE kernels.
    """

    try:
        import spiceypy as sp
    except ImportError as error:
        raise ImportError("spiceypy is required for full_ephemeris mode.") from error

    kernel_paths = ensure_spice_kernels(
        kernel_dir=config.kernel_dir,
        download_kernels=config.download_kernels,
    )
    for path in kernel_paths:
        sp.furnsh(str(path))

    obs_time = Time(config.observation_time_utc, scale="utc")
    _ = sp.utc2et(obs_time.utc.isot)
    return _add_horizons_solar_system(
        sim=sim,
        observation_time_utc=config.observation_time_utc,
        use_planets=config.use_planets,
    )


def ensure_spice_kernels(kernel_dir: str, download_kernels: bool = True) -> list[Path]:
    """
    Ensure the notebook-required SPICE kernels exist locally.
    """

    kernel_root = Path(kernel_dir)
    kernel_root.mkdir(parents=True, exist_ok=True)
    resolved_paths: list[Path] = []
    for filename, url in KERNEL_SPECS.items():
        path = kernel_root / filename
        if not path.exists():
            if not download_kernels:
                raise FileNotFoundError(
                    f"Missing SPICE kernel '{path}' and download_kernels is disabled."
                )
            urlretrieve(url, path)
        resolved_paths.append(path)
    return resolved_paths


def _add_horizons_solar_system(
    sim: Any,
    observation_time_utc: str,
    use_planets: bool,
    use_cache: bool = True,
    cache_path: str | None = "microbe_radiation_model/data/solar_system_horizons_cache.json",
) -> list[str]:
    """
    Add the Sun and planets through REBOUND Horizons.

    This keeps one authoritative source of planetary masses across modes.
    """

    if use_cache:
        cached_names = load_cached_solar_system(
            sim=sim,
            observation_time_utc=observation_time_utc,
            use_planets=use_planets,
            cache_path=cache_path,
        )
        if cached_names is not None:
            return cached_names

    obs_time = Time(observation_time_utc, scale="utc")
    date_str = obs_time.utc.datetime.strftime("%Y-%m-%d %H:%M")

    sim.add("Sun")
    planet_names: list[str] = []
    if use_planets:
        for body in PLANET_NAMES:
            sim.add(body, date=date_str)
            planet_names.append(body)
    _assign_solar_system_radii(sim, include_planets=use_planets)
    if use_cache:
        write_cached_solar_system(
            sim=sim,
            planet_names=planet_names,
            observation_time_utc=observation_time_utc,
            use_planets=use_planets,
            cache_path=cache_path,
        )
    return planet_names


def _assign_solar_system_radii(sim: Any, include_planets: bool) -> None:
    rsun_au = R_sun.to(u.au).value
    rearth_au = R_earth.to(u.au).value
    rjup_au = R_jup.to(u.au).value

    radii_planets_au = {
        "Sun": rsun_au,
        "Mercury": 0.383 * rearth_au,
        "Venus": 0.950 * rearth_au,
        "Earth": 1.000 * rearth_au,
        "Mars": 0.532 * rearth_au,
        "Jupiter": 1.000 * rjup_au,
        "Saturn": 0.843 * rjup_au,
        "Uranus": 0.358 * rjup_au,
        "Neptune": 0.346 * rjup_au,
    }

    if sim.N == 0:
        return
    sim.particles[0].r = radii_planets_au["Sun"]
    if not include_planets:
        return
    for index, body in enumerate(PLANET_NAMES, start=1):
        if index >= sim.N:
            break
        sim.particles[index].r = radii_planets_au[body]
