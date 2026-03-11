"""
Modele rozkładu temperatury wewnątrz jednorodnej kuli z wewnętrznym źródłem ciepła.

Zakładamy:
- stałą produkcję ciepła Q [W/m^3] w całej objętości,
- przewodnictwo cieplne k_th [W/(m·K)],
- ustaloną temperaturę powierzchni T_surface [K].

Wzór:

    T(r) = T_surface + Q / (6 * k_th) * (R^2 - r^2)

gdzie:
- R  - promień kuli [m],
- r  - odległość od środka [m].

W centrum (r = 0):

    T_center = T_surface + Q * R^2 / (6 * k_th)
"""

from __future__ import annotations


def temperature_inside_sphere(
    r_m: float,
    surface_temperature_k: float,
    heat_production_w_m3: float,
    radius_m: float,
    thermal_conductivity_w_mk: float,
) -> float:
    """
    Temperatura w odległości r od środka kuli z jednorodnym źródłem ciepła.

    Wzór:
        T(r) = T_surface + Q / (6 * k_th) * (R^2 - r^2)
    """
    if radius_m <= 0.0:
        raise ValueError("radius_m must be positive.")
    if thermal_conductivity_w_mk <= 0.0:
        raise ValueError("thermal_conductivity_w_mk must be positive.")
    if heat_production_w_m3 < 0.0:
        raise ValueError("heat_production_w_m3 must be >= 0.")
    if not (0.0 <= r_m <= radius_m):
        raise ValueError("r_m must be in [0, radius_m].")

    if heat_production_w_m3 == 0.0:
        return surface_temperature_k

    coef = heat_production_w_m3 / (6.0 * thermal_conductivity_w_mk)
    return surface_temperature_k + coef * (radius_m * radius_m - r_m * r_m)


def temperature_profile_surface_mid_center(
    surface_temperature_k: float,
    heat_production_w_m3: float,
    radius_m: float,
    thermal_conductivity_w_mk: float,
) -> tuple[float, float, float]:
    """
    Zwraca (T_surface, T_mid_radius, T_center) dla kuli z jednorodnym źródłem ciepła.

    - T_surface = T_surface
    - T_mid_radius = T(R/2)
    - T_center = T(0)
    """
    if radius_m <= 0.0:
        raise ValueError("radius_m must be positive.")

    t_surface = surface_temperature_k
    t_center = temperature_inside_sphere(
        r_m=0.0,
        surface_temperature_k=surface_temperature_k,
        heat_production_w_m3=heat_production_w_m3,
        radius_m=radius_m,
        thermal_conductivity_w_mk=thermal_conductivity_w_mk,
    )
    t_mid = temperature_inside_sphere(
        r_m=0.5 * radius_m,
        surface_temperature_k=surface_temperature_k,
        heat_production_w_m3=heat_production_w_m3,
        radius_m=radius_m,
        thermal_conductivity_w_mk=thermal_conductivity_w_mk,
    )
    return t_surface, t_mid, t_center

