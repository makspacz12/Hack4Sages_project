"""
Cache helpers for solar-system states loaded from Horizons.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_cached_solar_system(
    *,
    sim: Any,
    observation_time_utc: str,
    use_planets: bool,
    cache_path: str | None,
) -> list[str] | None:
    path = _resolve_cache_path(cache_path)
    if path is None or not path.exists():
        return None

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None

    entry = payload.get(_cache_key(observation_time_utc, use_planets))
    if not isinstance(entry, dict):
        return None

    bodies = entry.get("bodies")
    planet_names = entry.get("planet_names")
    if not isinstance(bodies, list) or not isinstance(planet_names, list):
        return None

    for body in bodies:
        sim.add(
            m=float(body["m"]),
            r=float(body["r"]),
            x=float(body["x"]),
            y=float(body["y"]),
            z=float(body["z"]),
            vx=float(body["vx"]),
            vy=float(body["vy"]),
            vz=float(body["vz"]),
        )
    return [str(name) for name in planet_names]


def write_cached_solar_system(
    *,
    sim: Any,
    planet_names: list[str],
    observation_time_utc: str,
    use_planets: bool,
    cache_path: str | None,
) -> None:
    path = _resolve_cache_path(cache_path)
    if path is None:
        return

    if path.exists():
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            payload = {}
    else:
        payload = {}

    payload[_cache_key(observation_time_utc, use_planets)] = {
        "planet_names": list(planet_names),
        "bodies": [
            {
                "m": float(p.m),
                "r": float(getattr(p, "r", 0.0)),
                "x": float(p.x),
                "y": float(p.y),
                "z": float(p.z),
                "vx": float(p.vx),
                "vy": float(p.vy),
                "vz": float(p.vz),
            }
            for p in sim.particles
        ],
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _resolve_cache_path(cache_path: str | None) -> Path | None:
    if cache_path is None:
        return None
    path = Path(cache_path)
    if not path.is_absolute():
        path = Path.cwd() / path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _cache_key(observation_time_utc: str, use_planets: bool) -> str:
    return f"{observation_time_utc}|planets={int(use_planets)}"
