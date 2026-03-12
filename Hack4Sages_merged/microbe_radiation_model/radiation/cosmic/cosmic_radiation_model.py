"""
Model galaktycznego promieniowania kosmicznego (GCR).

Ten modul dostarcza uproszczony model tła promieniowania kosmicznego
działającego na obiekty w przestrzeni kosmicznej.

Model rozróżnia dwa regiony:

1. Wnętrze heliosfery gwiazdy
   - promieniowanie kosmiczne jest częściowo tłumione przez wiatr gwiazdowy

2. Przestrzeń międzygwiazdowa
   - brak osłony heliosfery
   - wyższy poziom GCR
"""

from __future__ import annotations

import math

from ...physics.constants import SOLAR_LUMINOSITY

COSMIC_BACKGROUND_FLUX = 1.0
COSMIC_DEEP_SPACE_MULTIPLIER = 1.3

DEFAULT_HELIOSPHERE_RADIUS_AU = 120.0


def cosmic_background_flux(base_flux: float = COSMIC_BACKGROUND_FLUX) -> float:
    """
    Zwraca bazowy flux galaktycznego promieniowania kosmicznego.

    Parameters
    ----------
    base_flux : float
        Bazowy flux promieniowania kosmicznego.

    Returns
    -------
    float
        Flux promieniowania kosmicznego.
    """

    if base_flux < 0:
        raise ValueError("base_flux must be >= 0")

    return base_flux


def cosmic_flux_by_region(
    distance_au: float,
    base_flux: float = COSMIC_BACKGROUND_FLUX,
    heliosphere_radius_au: float = DEFAULT_HELIOSPHERE_RADIUS_AU,
    deep_space_multiplier: float = COSMIC_DEEP_SPACE_MULTIPLIER,
) -> float:
    """
    Zwraca flux promieniowania kosmicznego w zależności od regionu kosmosu.

    Parameters
    ----------
    distance_au : float
        Odległość od gwiazdy [AU]
    base_flux : float
        Bazowy flux GCR wewnątrz heliosfery
    heliosphere_radius_au : float
        Promień heliosfery gwiazdy
    deep_space_multiplier : float
        Wzrost GCR poza heliosferą

    Returns
    -------
    float
        Flux promieniowania kosmicznego
    """

    if distance_au < 0:
        raise ValueError("distance_au must be >= 0")

    if distance_au <= heliosphere_radius_au:
        return base_flux

    return base_flux * deep_space_multiplier


def cosmic_flux_by_star(
    distance_au: float,
    luminosity_w: float,
    base_flux: float = COSMIC_BACKGROUND_FLUX,
    deep_space_multiplier: float = COSMIC_DEEP_SPACE_MULTIPLIER,
    transition_width_factor: float = 1.0,
) -> float:
    """
    Zwraca flux GCR z uwzględnieniem rozmiaru heliosfery konkretnej gwiazdy.

    Założenia:
    - promień heliosfery skaluje się z jasnością gwiazdy jak sqrt(L_star / L_sun),
      tzn. R_helio = 120 AU * sqrt(L_star / L_sun),
    - wewnątrz R_helio flux = base_flux,
    - daleko poza (>= R_helio * (1 + transition_width_factor)) flux = base_flux * deep_space_multiplier,
    - pomiędzy tymi strefami stosowany jest prosty liniowy ramp.
    """

    if distance_au < 0:
        raise ValueError("distance_au must be >= 0")
    if luminosity_w <= 0:
        raise ValueError("luminosity_w must be > 0")
    if transition_width_factor < 0:
        raise ValueError("transition_width_factor must be >= 0")

    # Jasność w jednostkach słonecznych – zabezpieczenie przed skrajnie małymi wartościami.
    luminosity_ratio = max(luminosity_w / SOLAR_LUMINOSITY, 1e-3)

    # Skalowanie promienia heliosfery z jasnością.
    r_helio_au = DEFAULT_HELIOSPHERE_RADIUS_AU * math.sqrt(luminosity_ratio)
    if r_helio_au <= 0.0:
        return base_flux

    # Szerokość strefy przejściowej.
    r_transition_au = r_helio_au * (1.0 + transition_width_factor)

    if distance_au <= r_helio_au:
        return base_flux
    if distance_au >= r_transition_au:
        return base_flux * deep_space_multiplier

    # Liniowe przejście 1.0 -> deep_space_multiplier w strefie przejściowej.
    t = (distance_au - r_helio_au) / (r_transition_au - r_helio_au)
    factor = 1.0 + (deep_space_multiplier - 1.0) * t
    return base_flux * factor