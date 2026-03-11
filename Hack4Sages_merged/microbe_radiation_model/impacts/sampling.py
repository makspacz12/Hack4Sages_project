"""
Sampling helpers used by impact generators.
"""

from __future__ import annotations

import numpy as np


def sample_truncated_power_law(
    x_min: float,
    x_max: float,
    alpha: float,
    n: int,
    rng: np.random.Generator,
) -> np.ndarray:
    """
    Sample from a truncated power-law distribution via inverse CDF.
    """

    u_rand = rng.uniform(0.0, 1.0, n)
    if abs(alpha - 1.0) < 1e-10:
        return x_min * (x_max / x_min) ** u_rand
    exponent = 1.0 - alpha
    return (u_rand * (x_max**exponent - x_min**exponent) + x_min**exponent) ** (1.0 / exponent)


def random_cone_directions(
    normal: tuple[float, float, float] | np.ndarray,
    half_angle_deg: float,
    n: int,
    rng: np.random.Generator,
) -> np.ndarray:
    """
    Generate unit vectors uniformly distributed over a cone.
    """

    half_angle_rad = np.radians(half_angle_deg)
    cos_theta = rng.uniform(np.cos(half_angle_rad), 1.0, n)
    sin_theta = np.sqrt(1.0 - cos_theta**2)
    phi = rng.uniform(0.0, 2.0 * np.pi, n)

    local = np.column_stack(
        [
            sin_theta * np.cos(phi),
            sin_theta * np.sin(phi),
            cos_theta,
        ]
    )

    normal_vec = np.asarray(normal, dtype=float)
    normal_vec /= np.linalg.norm(normal_vec)
    z_axis = np.array([0.0, 0.0, 1.0])

    if np.allclose(normal_vec, z_axis):
        return local
    if np.allclose(normal_vec, -z_axis):
        local[:, 2] *= -1
        return local

    v = np.cross(z_axis, normal_vec)
    s = np.linalg.norm(v)
    c_val = np.dot(z_axis, normal_vec)
    skew = np.array(
        [
            [0.0, -v[2], v[1]],
            [v[2], 0.0, -v[0]],
            [-v[1], v[0], 0.0],
        ]
    )
    rotation = np.eye(3) + skew + skew @ skew * (1.0 - c_val) / (s**2)
    return (rotation @ local.T).T
