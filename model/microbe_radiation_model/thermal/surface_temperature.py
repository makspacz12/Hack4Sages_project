"""
Rock surface temperature models.

First step: radiative equilibrium temperature from external stellar radiation
(UV / total flux), with no atmosphere and no internal heating.
ogrzewania.

Formula:

    T = ((1 - A) * L_star / (16 * pi * sigma * d^2))^(1/4)

but in practice we use the fact that:

    F_star = L_star / (4 * pi * d^2)

so:

    T = ((1 - A) * F_star / (4 * sigma))^(1/4)

which lets us reuse an already computed surface flux without duplicating the
bez duplikowania logiki z modulu `radiation.stellar`.
"""

from __future__ import annotations

from typing import Optional

from ..physics.stellar_physics import stellar_luminosity_from_solar_mass
from ..radiation import stellar_flux_at_au


# Stefan-Boltzmann constant [W*m^-2*K^-4]
STEFAN_BOLTZMANN_W_M2_K4: float = 5.670374419e-8


def equilibrium_temperature_from_flux(
    surface_flux_w_m2: float,
    albedo: float = 0.0,
) -> float:
    """
    Radiative equilibrium temperature of the rock surface for a given flux.

    Parametry
    ----------
    surface_flux_w_m2 : float
        Radiation flux reaching the rock surface [W/m^2].
        This can be either:
        - the total stellar flux (from `stellar_flux` / `stellar_flux_at_au`), or
        - only the UV component, if modelled separately.
    albedo : float, default 0.0
        Rock albedo (0..1). 0 means a perfect absorber,
        1 means total reflection.

    Returns
    -------
    float
        Equilibrium temperature of the rock surface in kelvin [K].
    """
    if surface_flux_w_m2 < 0.0:
        raise ValueError("surface_flux_w_m2 must be >= 0.")
    if not (0.0 <= albedo <= 1.0):
        raise ValueError("albedo must be between 0 and 1.")

    if surface_flux_w_m2 == 0.0:
        return 0.0

    absorbed_flux = (1.0 - albedo) * surface_flux_w_m2

    # T = ((absorbed_flux) / (4 * sigma))^(1/4)
    return (absorbed_flux / (4.0 * STEFAN_BOLTZMANN_W_M2_K4)) ** 0.25


def equilibrium_temperature_from_star(
    mass_solar: float,
    distance_au: float,
    albedo: float = 0.0,
    surface_flux_override_w_m2: Optional[float] = None,
) -> float:
    """
    Radiative equilibrium temperature for a star of given mass at a given distance.

    This function is just a convenience wrapper:
    - korzysta z fizyki gwiazdy (`stellar_luminosity_from_solar_mass`)
    - reuses the existing flux model (`stellar_flux_at_au`)
    - NIE duplikuje logiki promieniowania.

    If `surface_flux_override_w_m2` is given, the function skips computing the
    flux from mass/distance and uses that flux directly.
    """
    if surface_flux_override_w_m2 is not None:
        return equilibrium_temperature_from_flux(
            surface_flux_w_m2=surface_flux_override_w_m2,
            albedo=albedo,
        )

    if mass_solar <= 0.0:
        raise ValueError("mass_solar must be positive.")
    if distance_au <= 0.0:
        raise ValueError("distance_au must be positive.")

    luminosity_w = stellar_luminosity_from_solar_mass(mass_solar)
    surface_flux_w_m2 = stellar_flux_at_au(luminosity_w, distance_au)

    return equilibrium_temperature_from_flux(
        surface_flux_w_m2=surface_flux_w_m2,
        albedo=albedo,
    )


