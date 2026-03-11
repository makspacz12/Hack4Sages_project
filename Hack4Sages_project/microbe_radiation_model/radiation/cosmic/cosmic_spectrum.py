"""
Uproszczony skład galaktycznego promieniowania kosmicznego (GCR).

GCR składa się głównie z:

- protonów
- jąder helu
- ciężkich jonów (HZE)

Ten moduł dostarcza prosty model podziału całkowitego fluxu GCR
na jego główne komponenty.
"""

from __future__ import annotations
from dataclasses import dataclass


@dataclass
class CosmicRaySpectrum:
    """
    Reprezentuje skład promieniowania kosmicznego.

    Attributes
    ----------
    proton_flux : float
        Flux protonów.
    alpha_flux : float
        Flux jąder helu.
    hze_flux : float
        Flux ciężkich jonów (HZE).
    """

    proton_flux: float
    alpha_flux: float
    hze_flux: float


PROTON_FRACTION = 0.90
ALPHA_FRACTION = 0.09
HZE_FRACTION = 0.01


def split_cosmic_flux(total_flux: float) -> CosmicRaySpectrum:
    """
    Rozdziela całkowity flux GCR na główne składniki.

    Parameters
    ----------
    total_flux : float
        Całkowity flux promieniowania kosmicznego.

    Returns
    -------
    CosmicRaySpectrum
        Podział fluxu na protony, jądra helu i ciężkie jony.
    """

    if total_flux < 0:
        raise ValueError("total_flux must be >= 0")

    proton_flux = total_flux * PROTON_FRACTION
    alpha_flux = total_flux * ALPHA_FRACTION
    hze_flux = total_flux * HZE_FRACTION

    return CosmicRaySpectrum(
        proton_flux=proton_flux,
        alpha_flux=alpha_flux,
        hze_flux=hze_flux,
    )