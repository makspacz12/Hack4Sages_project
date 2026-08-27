"""
Optional physics overrides for ensemble / sensitivity runs.

Thread-local so parallel workers do not clobber each other.
"""

from __future__ import annotations

import threading
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterator

from .biology.constants import (
    DEFAULT_RADIATION_SURV_COEFF_PER_GY,
    HYDROLYSIS_SURV_COEFF,
)
from .chemistry.constants import HYDROLYSIS_A_S_INV, HYDROLYSIS_EA_J_MOL
from .simulation.config import DEFAULT_GCR_ATTENUATION_K_M2_KG

_local = threading.local()


@dataclass(frozen=True)
class RunOverrides:
    hydrolysis_ea_j_mol: float | None = None
    hydrolysis_a_s_inv: float | None = None
    hydrolysis_surv_coeff: float | None = None
    radiation_surv_coeff: float | None = None
    gcr_attenuation_k_m2_kg: float | None = None


def active_overrides() -> RunOverrides | None:
    return getattr(_local, "overrides", None)


def effective_hydrolysis_ea_j_mol() -> float:
    ov = active_overrides()
    if ov and ov.hydrolysis_ea_j_mol is not None:
        return float(ov.hydrolysis_ea_j_mol)
    return HYDROLYSIS_EA_J_MOL


def effective_hydrolysis_a_s_inv() -> float:
    ov = active_overrides()
    if ov and ov.hydrolysis_a_s_inv is not None:
        return float(ov.hydrolysis_a_s_inv)
    return HYDROLYSIS_A_S_INV


def effective_hydrolysis_surv_coeff() -> float:
    ov = active_overrides()
    if ov and ov.hydrolysis_surv_coeff is not None:
        return float(ov.hydrolysis_surv_coeff)
    return HYDROLYSIS_SURV_COEFF


def effective_radiation_surv_coeff() -> float | None:
    ov = active_overrides()
    if ov and ov.radiation_surv_coeff is not None:
        return float(ov.radiation_surv_coeff)
    return None


def effective_gcr_attenuation_k_m2_kg() -> float:
    ov = active_overrides()
    if ov and ov.gcr_attenuation_k_m2_kg is not None:
        return float(ov.gcr_attenuation_k_m2_kg)
    return DEFAULT_GCR_ATTENUATION_K_M2_KG


def physics_baseline_values() -> dict[str, float]:
    return {
        "hydrolysis_ea": HYDROLYSIS_EA_J_MOL,
        "hydrolysis_a": HYDROLYSIS_A_S_INV,
        "hydrolysis_surv_coeff": HYDROLYSIS_SURV_COEFF,
        "radiation_surv_coeff": DEFAULT_RADIATION_SURV_COEFF_PER_GY,
        "gcr_attenuation_k": DEFAULT_GCR_ATTENUATION_K_M2_KG,
    }


@contextmanager
def apply_overrides(overrides: RunOverrides | None) -> Iterator[None]:
    prev = getattr(_local, "overrides", None)
    _local.overrides = overrides
    try:
        yield
    finally:
        _local.overrides = prev
