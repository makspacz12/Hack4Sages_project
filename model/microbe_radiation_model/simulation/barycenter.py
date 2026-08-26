"""
Barycentric helpers for REBOUND simulations.
"""

from __future__ import annotations

from typing import Any


def move_simulation_to_center_of_mass(sim: Any) -> Any:
    """
    Move the simulation to the center-of-mass frame.
    """

    sim.move_to_com()
    return sim


def simulation_barycenter(sim: Any) -> tuple[float, float, float]:
    """
    Compute the current barycenter position of the system.
    """

    total_mass = 0.0
    x = 0.0
    y = 0.0
    z = 0.0
    for particle in sim.particles:
        total_mass += particle.m
        x += particle.m * particle.x
        y += particle.m * particle.y
        z += particle.m * particle.z
    if total_mass == 0.0:
        return (0.0, 0.0, 0.0)
    return (x / total_mass, y / total_mass, z / total_mass)


def simulation_momentum(sim: Any) -> tuple[float, float, float]:
    """
    Compute the current total momentum of the system.
    """

    px = 0.0
    py = 0.0
    pz = 0.0
    for particle in sim.particles:
        px += particle.m * particle.vx
        py += particle.m * particle.vy
        pz += particle.m * particle.vz
    return (px, py, pz)
