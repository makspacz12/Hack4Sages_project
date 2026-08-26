"""
Radiation-pressure helpers migrated from the notebook.
"""

from __future__ import annotations

from typing import Any, Iterable

import numpy as np
from astropy.constants import G as G_SI
from astropy.constants import L_sun as L_SUN_SI
from astropy.constants import M_sun as M_SUN_SI
from astropy.constants import c as C_SI


def q_pr_from_albedo(albedo: float | np.ndarray) -> float | np.ndarray:
    """
    Notebook-equivalent conversion from albedo to ``Q_pr``.
    """

    return 1.0 + (2.0 / 3.0) * np.asarray(albedo)


def compute_beta_single_star(
    m_star_msun: float,
    r_body_m: float | np.ndarray,
    rho: float | np.ndarray = 2000.0,
    q_pr: float | np.ndarray = 1.0,
) -> float | np.ndarray:
    """
    Compute beta = Frad / Fgrav for a small body around one star.
    """

    l_star_lsun = m_star_msun ** 3.5
    l_star_si = l_star_lsun * L_SUN_SI.value
    m_star_si = m_star_msun * M_SUN_SI.value
    beta = (3.0 * l_star_si * q_pr) / (
        16.0 * np.pi * C_SI.value * G_SI.value * m_star_si * np.asarray(rho) * np.asarray(r_body_m)
    )
    return beta


def nearest_star_for_position(
    sim: Any,
    position_au: Iterable[float],
    star_indices: list[int],
) -> int | None:
    """
    Return the nearest star index for a position in AU.
    """

    if not star_indices:
        return None

    x, y, z = position_au
    nearest_index: int | None = None
    min_distance_sq = float("inf")
    for star_index in star_indices:
        particle = sim.particles[star_index]
        dx = x - particle.x
        dy = y - particle.y
        dz = z - particle.z
        distance_sq = dx * dx + dy * dy + dz * dz
        if distance_sq < min_distance_sq:
            min_distance_sq = distance_sq
            nearest_index = star_index
    return nearest_index


def nearest_star_for_particle(sim: Any, particle_index: int, star_indices: list[int]) -> int | None:
    """
    Return the nearest star index for an existing REBOUND particle.
    """

    particle = sim.particles[particle_index]
    return nearest_star_for_position(sim, (particle.x, particle.y, particle.z), star_indices)


def radiation_pressure_accel_nearest_star(
    sim: Any,
    i_ast: int,
    star_indices: list[int],
    r_body_m: float,
    rho: float = 2000.0,
    q_pr: float = 1.0,
) -> tuple[np.ndarray, float | np.ndarray, int | None]:
    """
    Compute the radiation-pressure acceleration vector from the nearest star.
    """

    p_ast = sim.particles[i_ast]
    nearest_index = nearest_star_for_particle(sim, i_ast, star_indices)
    if nearest_index is None:
        return np.zeros(3), 0.0, None

    p_star = sim.particles[nearest_index]
    r_vec_au = np.array([p_ast.x - p_star.x, p_ast.y - p_star.y, p_ast.z - p_star.z], dtype=float)
    r_au = np.linalg.norm(r_vec_au)
    beta = compute_beta_single_star(p_star.m, r_body_m, rho=rho, q_pr=q_pr)
    if r_au == 0.0:
        return np.zeros(3), beta, nearest_index

    a_grav_vec = -p_star.m * r_vec_au / (r_au ** 3)
    a_rad_vec = -np.asarray(beta) * a_grav_vec
    return a_rad_vec, beta, nearest_index


def beta_for_particles(
    sim: Any,
    particle_indices: list[int],
    star_indices: list[int],
    radii_m: np.ndarray,
    densities_kg_m3: np.ndarray,
    q_pr_values: np.ndarray,
) -> dict[int, float]:
    """
    Compute notebook-equivalent beta values for a population of particles.
    """

    beta_by_particle: dict[int, float] = {}
    for offset, particle_index in enumerate(particle_indices):
        nearest_index = nearest_star_for_particle(sim, particle_index, star_indices)
        if nearest_index is None:
            beta_by_particle[particle_index] = 0.0
            continue
        star_mass = sim.particles[nearest_index].m
        beta = compute_beta_single_star(
            star_mass,
            radii_m[offset],
            rho=densities_kg_m3[offset],
            q_pr=q_pr_values[offset],
        )
        beta_by_particle[particle_index] = float(beta)
    return beta_by_particle
