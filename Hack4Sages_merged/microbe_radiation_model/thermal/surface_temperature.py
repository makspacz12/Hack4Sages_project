"""
Modele temperatury powierzchni skały.

Pierwszy krok: temperatura równowagi radiacyjnej od zewnętrznego promieniowania
gwiazdowego (UV / całkowity strumień), bez atmosfery i bez wewnętrznego
ogrzewania.

Wzór:

    T = ((1 - A) * L_star / (16 * pi * sigma * d^2))^(1/4)

ale w praktyce korzystamy z faktu, że:

    F_star = L_star / (4 * pi * d^2)

więc:

    T = ((1 - A) * F_star / (4 * sigma))^(1/4)

co pozwala nam używać już policzonego strumienia powierzchniowego (flux),
bez duplikowania logiki z modulu `radiation.stellar`.
"""

from __future__ import annotations

from typing import Optional

from ..physics.stellar_physics import stellar_luminosity_from_solar_mass
from ..radiation import stellar_flux_at_au


# Stała Stefana–Boltzmanna [W·m^-2·K^-4]
STEFAN_BOLTZMANN_W_M2_K4: float = 5.670374419e-8


def equilibrium_temperature_from_flux(
    surface_flux_w_m2: float,
    albedo: float = 0.0,
) -> float:
    """
    Temperatura równowagi radiacyjnej powierzchni skały z danego strumienia.

    Parametry
    ----------
    surface_flux_w_m2 : float
        Strumień promieniowania docierający do powierzchni skały [W/m^2].
        Może to być:
        - całkowity strumień od gwiazdy (wynik `stellar_flux` / `stellar_flux_at_au`),
        - lub tylko komponent UV, jeśli modelujesz osobno.
    albedo : float, domyślnie 0.0
        Albedo skały (0..1). 0 oznacza idealnego pochłaniacza,
        1 oznacza całkowite odbicie.

    Zwraca
    -------
    float
        Temperatura równowagi powierzchni skały w Kelvinach [K].
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
    Temperatura równowagi radiacyjnej od gwiazdy o zadanej masie na zadanej odległości.

    Ta funkcja jest tylko wygodnym wrapperem:
    - korzysta z fizyki gwiazdy (`stellar_luminosity_from_solar_mass`)
    - korzysta z istniejącego modelu strumienia (`stellar_flux_at_au`)
    - NIE duplikuje logiki promieniowania.

    Jeśli podasz `surface_flux_override_w_m2`, funkcja pominie krok liczenia
    fluxu z masy/odległości i użyje tego fluxu bezpośrednio.
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


