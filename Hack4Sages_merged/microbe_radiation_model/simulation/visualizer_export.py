"""
Helpers for exporting a single-file Cosmos 3D style simulation payload.
"""

from __future__ import annotations

from typing import Any

from ..asteroid_state import AsteroidStateStore
from ..physics.constants import AU, SOLAR_MASS


def build_object_catalog(
    sim: Any,
    *,
    n_permanent: int,
    planet_names: list[str],
    asteroid_state_store: AsteroidStateStore | None = None,
) -> tuple[list[dict[str, Any]], dict[int, str]]:
    """
    Build static object metadata and stable object ids for the visualizer export.
    """

    object_ids: dict[int, str] = {}
    objects: list[dict[str, Any]] = []

    gaia_start = 1 + len(planet_names)
    gaia_counter = 1
    asteroid_counter = 1

    for particle_index in range(sim.N):
        particle = sim.particles[particle_index]

        if particle_index == 0:
            object_id = "sun"
            name = "Sun"
            object_type = "star"
        elif particle_index <= len(planet_names):
            planet_name = planet_names[particle_index - 1]
            object_id = f"planet_{planet_name.lower()}"
            name = planet_name
            object_type = "planet"
        elif particle_index < n_permanent:
            object_id = f"gaia_star_{gaia_counter:03d}"
            name = f"Gaia Star {gaia_counter}"
            object_type = "star"
            gaia_counter += 1
        else:
            object_id = f"asteroid_{asteroid_counter:03d}"
            asteroid_state = (
                asteroid_state_store.get_optional(particle_index)
                if asteroid_state_store is not None
                else None
            )
            asteroid_name = asteroid_state.rock_type if asteroid_state is not None else "Asteroid"
            name = f"{asteroid_name} {asteroid_counter}"
            object_type = "asteroid"
            asteroid_counter += 1

        object_ids[particle_index] = object_id
        objects.append(
            {
                "id": object_id,
                "name": name,
                "type": object_type,
                "visual": _default_visual(object_type),
                "info": _default_info(
                    particle=particle,
                    object_type=object_type,
                    particle_index=particle_index,
                    gaia_start=gaia_start,
                    asteroid_state_store=asteroid_state_store,
                ),
            }
        )

    return objects, object_ids


def build_frame_payload(
    sim: Any,
    *,
    step_index: int,
    time_years: float,
    object_ids: dict[int, str],
    asteroid_state_store: AsteroidStateStore | None = None,
) -> dict[str, Any]:
    """
    Build one frame entry with positions and velocities for all particles.
    """

    positions: list[dict[str, float | str]] = []
    velocities: list[dict[str, float | str]] = []
    properties: list[dict[str, float | str | None]] = []

    for particle_index in range(sim.N):
        particle = sim.particles[particle_index]
        object_id = object_ids[particle_index]
        asteroid_state = (
            asteroid_state_store.get_optional(particle_index)
            if asteroid_state_store is not None
            else None
        )
        positions.append(
            {
                "id": object_id,
                "x": float(particle.x),
                "y": float(particle.y),
                "z": float(particle.z),
            }
        )
        velocities.append(
            {
                "id": object_id,
                "vx": float(particle.vx),
                "vy": float(particle.vy),
                "vz": float(particle.vz),
            }
        )
        properties.append(
            {
                "id": object_id,
                "mass": (
                    float(asteroid_state.mass_kg)
                    if asteroid_state is not None
                    else float(particle.m * SOLAR_MASS)
                ),
                "radius": (
                    float(asteroid_state.radius_m)
                    if asteroid_state is not None
                    else float(getattr(particle, "r", 0.0) * AU)
                ),
                "beta": (
                    float(asteroid_state.current_beta)
                    if asteroid_state is not None and asteroid_state.current_beta is not None
                    else None
                ),
            }
        )

    return {
        "step": step_index,
        "time": float(time_years),
        "positions": positions,
        "velocities": velocities,
        "properties": properties,
    }


def _default_visual(object_type: str) -> dict[str, Any]:
    if object_type == "star":
        return {"radius": 5.0, "color": "#FFD580", "emissive": True}
    if object_type == "planet":
        return {"radius": 0.9, "color": "#4A90E2", "emissive": False}
    return {"radius": 0.18, "color": "#999977", "emissive": False}


def _default_info(
    *,
    particle: Any,
    object_type: str,
    particle_index: int,
    gaia_start: int,
    asteroid_state_store: AsteroidStateStore | None,
) -> dict[str, dict[str, Any]]:
    info: dict[str, dict[str, Any]] = {
        "Mass": {"value": float(particle.m * SOLAR_MASS), "unit": "kg"},
        "Radius": {"value": float(getattr(particle, "r", 0.0) * AU), "unit": "m"},
    }

    if object_type == "star":
        info["Class"] = {
            "value": "Sun" if particle_index == 0 else "Gaia nearby star",
            "unit": "",
        }
        return info

    if object_type == "planet":
        info["Class"] = {"value": "Solar System planet", "unit": ""}
        return info

    asteroid_state = (
        asteroid_state_store.get_optional(particle_index)
        if asteroid_state_store is not None
        else None
    )
    if asteroid_state is None:
        info["Class"] = {"value": "Asteroid", "unit": ""}
        return info

    info["Mass"] = {"value": float(asteroid_state.initial_mass_kg), "unit": "kg"}
    info["Radius"] = {"value": float(asteroid_state.initial_radius_m), "unit": "m"}
    info.update(
        {
            "Rock type": {"value": asteroid_state.rock_type, "unit": ""},
            "Density": {"value": float(asteroid_state.density_kg_m3), "unit": "kg/m^3"},
            "Albedo": {"value": float(asteroid_state.albedo), "unit": ""},
            "Population fraction": {
                "value": float(asteroid_state.population_fraction),
                "unit": "",
            },
            "Initial beta": {
                "value": float(asteroid_state.initial_beta or 0.0),
                "unit": "",
            },
        }
    )
    return info
