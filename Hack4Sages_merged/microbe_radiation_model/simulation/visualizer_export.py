"""
Helpers for exporting a single-file Cosmos 3D style simulation payload.
"""

from __future__ import annotations

from typing import Any

from ..asteroid_state import AsteroidState, AsteroidStateStore
from ..physics.constants import AU, SOLAR_MASS

# Status for visualizer: static (Sun/planets/stars – not traveling), traveling, destroyed, arrived (future)
STATUS_STATIC = "static"
STATUS_TRAVELING = "traveling"
STATUS_DESTROYED = "destroyed"
STATUS_DESTROYED_COLLIDED_STAR = "destroyed_collided_star"
STATUS_ARRIVED = "arrived"


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
        asteroid_state = (
            asteroid_state_store.get_optional(particle_index)
            if asteroid_state_store is not None
            else None
        )

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
                "status": _object_status(object_type, asteroid_state),
                "visual": _default_visual(
                    object_type=object_type,
                    name=name,
                    asteroid_state=asteroid_state,
                ),
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


def _object_status(object_type: str, asteroid_state: AsteroidState | None) -> str:
    """
    Status for visualizer: static (Sun/planets/stars), traveling | destroyed | arrived (asteroids).
    For inactive asteroids, returns distinct status when termination_reason is set.
    """
    if object_type in ("star", "planet"):
        return STATUS_STATIC
    if object_type == "asteroid" and asteroid_state is not None:
        if not asteroid_state.active:
            reason = getattr(asteroid_state, "termination_reason", None)
            if reason == "collided_with_star":
                return STATUS_DESTROYED_COLLIDED_STAR
            if reason in ("entered_effective_hill", "entered_hill_sphere"):
                return STATUS_ARRIVED
            return STATUS_DESTROYED
        # Future: if asteroid_state.arrived or getattr(asteroid_state, "arrived", False): return STATUS_ARRIVED
        return STATUS_TRAVELING
    return STATUS_TRAVELING


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
        is_asteroid = object_id.startswith("asteroid_") and asteroid_state is not None
        if is_asteroid:
            status = _object_status("asteroid", asteroid_state)
        else:
            status = STATUS_STATIC
        prop: dict[str, Any] = {
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
            "status": status,
        }
        if is_asteroid:
            reason = getattr(asteroid_state, "termination_reason", None)
            if reason is not None:
                prop["termination_reason"] = reason
                star_idx = asteroid_state.extra.get("termination_star_index")
                if star_idx is not None:
                    prop["termination_star_index"] = int(star_idx)

            # Asteroid-specific physical and radiation properties for visualization.
            prop["rock_type"] = asteroid_state.rock_type
            prop["population_fraction"] = float(asteroid_state.population_fraction)
            # Radioactive composition (from rock).
            if asteroid_state.uranium238_ppm is not None:
                prop["uranium238_ppm"] = float(asteroid_state.uranium238_ppm)
            if asteroid_state.thorium232_ppm is not None:
                prop["thorium232_ppm"] = float(asteroid_state.thorium232_ppm)
            if asteroid_state.potassium_percent is not None:
                prop["potassium_percent"] = float(asteroid_state.potassium_percent)

            # Latest cached environment and damage drivers from AsteroidState.extra.
            extra = asteroid_state.extra
            for key in (
                "T_surface_K",
                "T_center_K",
                "uv_local_flux",
                "gcr_local_flux",
                "gamma_local_flux",
                "hydrolysis_rate_s_inv",
                "radiation_decay_gy_per_year",
            ):
                val = extra.get(key)
                if val is not None:
                    prop[key] = float(val)
        properties.append(prop)

    return {
        "step": step_index,
        "time": float(time_years),
        "positions": positions,
        "velocities": velocities,
        "properties": properties,
    }


_STAR_COLOR = "#FFD580"

_PLANET_COLORS = {
    "mercury": "#B0B0B0",
    "venus": "#C9A96A",
    "earth": "#2E86DE",
    "mars": "#C1440E",
    "jupiter": "#D9A066",
    "saturn": "#DCC58F",
    "uranus": "#7FDBFF",
    "neptune": "#4169E1",
}

_ASTEROID_PALETTE = [
    "#A67C52",
    "#D35400",
    "#F1C40F",
    "#27AE60",
    "#2980B9",
    "#8E44AD",
    "#E67E22",
    "#16A085",
    "#C0392B",
    "#7F8C8D",
]


def _stable_palette_color(key: str, palette: list[str]) -> str:
    """
    Deterministic mapping from an arbitrary string to a color in the palette.
    Ensures that the same key always gets the same color.
    """
    h = 0
    for ch in key:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return palette[h % len(palette)]


def _default_visual(
    *,
    object_type: str,
    name: str,
    asteroid_state: AsteroidState | None,
) -> dict[str, Any]:
    if object_type == "star":
        return {"radius": 5.0, "color": _STAR_COLOR, "emissive": True}

    if object_type == "planet":
        color = _PLANET_COLORS.get(name.lower())
        if color is None:
            color = _stable_palette_color(name, list(_PLANET_COLORS.values()) or _ASTEROID_PALETTE)
        return {"radius": 0.9, "color": color, "emissive": False}

    # Asteroids: color is a stable function of rock type (or name),
    # so each physical body keeps its own distinct, repeatable color.
    key = asteroid_state.rock_type if asteroid_state is not None else name
    color = _stable_palette_color(key, _ASTEROID_PALETTE)
    return {"radius": 0.18, "color": color, "emissive": False}


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
