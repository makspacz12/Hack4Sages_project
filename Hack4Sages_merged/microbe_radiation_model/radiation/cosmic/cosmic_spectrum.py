"""
Simplified composition of galactic cosmic radiation (GCR).

GCR consists mainly of:

- protons
- helium nuclei
- heavy ions (HZE)

This module provides a simple model splitting the total GCR flux into its
main components.
"""

from __future__ import annotations
from dataclasses import dataclass


@dataclass
class CosmicRaySpectrum:
    """
    Represents the composition of cosmic radiation.

    Attributes
    ----------
    proton_flux : float
        Proton flux.
    alpha_flux : float
        Helium nuclei flux.
    hze_flux : float
        Heavy ion (HZE) flux.
    """

    proton_flux: float
    alpha_flux: float
    hze_flux: float


PROTON_FRACTION = 0.90
ALPHA_FRACTION = 0.09
HZE_FRACTION = 0.01


def split_cosmic_flux(total_flux: float) -> CosmicRaySpectrum:
    """
    Split the total GCR flux into its main components.

    Parameters
    ----------
    total_flux : float
        Total cosmic radiation flux.

    Returns
    -------
    CosmicRaySpectrum
        Flux split into protons, helium nuclei and heavy ions.
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