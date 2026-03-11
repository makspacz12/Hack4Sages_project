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