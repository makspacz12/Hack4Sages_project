"""
Prosty magazyn danych czasowych i podsumowań (UV / GCR / gamma, skały, gwiazdy).

Ten moduł jest centralnym miejscem zapisu danych w formacie JSON, tak aby
różne podmoduły (radiation, chemistry, simulation) mogły z niego korzystać,
nie mieszając logiki IO z fizyką.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from .materials.rocks import Rock
from .physics.stellar_physics import stellar_luminosity_from_solar_mass
from .radiation.stellar import stellar_flux_at_au


@dataclass
class RadiationRecord:
    """
    Jeden punkt czasowy dla pól promieniowania.
    Wszystkie komponenty poza czasem i kontekstem są opcjonalne, żeby można było
    stopniowo uzupełniać model.
    """

    time_seconds: float

    # UV
    uv_surface_flux: Optional[float] = None
    uv_local_flux: Optional[float] = None
    uv_cumulative_exposure: Optional[float] = None

    # GCR (promieniowanie kosmiczne)
    gcr_total_flux: Optional[float] = None
    gcr_proton_flux: Optional[float] = None
    gcr_alpha_flux: Optional[float] = None
    gcr_hze_flux: Optional[float] = None
    gcr_surface_flux: Optional[float] = None
    gcr_local_flux: Optional[float] = None

    # Gamma
    gamma_surface_flux: Optional[float] = None
    gamma_local_flux: Optional[float] = None

    # Ogólny opis kontekstu / scenariusza
    context: Optional[str] = None


def _root_dir() -> Path:
    """
    Katalog główny pakietu microbe_radiation_model.
    """
    return Path(__file__).resolve().parent


def _ensure_data_dir() -> Path:
    data_dir = _root_dir() / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def _data_file_path() -> Path:
    """
    Ścieżka do pliku JSON z globalnymi rekordami promieniowania.
    """
    return _ensure_data_dir() / "gamma_radiation_timeseries.json"


def _rock_data_file_path() -> Path:
    """
    Ścieżka do pliku JSON z podsumowaniami promieniowania dla typów skał.
    """
    return _ensure_data_dir() / "rock_radiation_summary.json"


def _star_uv_file_path() -> Path:
    """
    Ścieżka do pliku z profilami UV dla gwiazd.
    """
    return _ensure_data_dir() / "star_uv_profile.json"


def _initial_payload() -> Dict[str, Any]:
    """
    Domyślna struktura pliku JSON przy pierwszym zapisie.
    """
    return {
        "__description__": {
            # UV
            "uv_surface_flux": (
                "Strumień UV na powierzchni skały, zanim przejdzie przez materiał [W/m^2]."
            ),
            "uv_local_flux": (
                "Strumień UV w miejscu, gdzie znajduje się mikroorganizm "
                "(po przejściu przez skałę) [W/m^2]."
            ),
            "uv_cumulative_exposure": (
                "Całkowita energia UV otrzymana w czasie [J/m^2] (flux * time)."
            ),
            # GCR
            "gcr_total_flux": (
                "Całkowity strumień promieniowania kosmicznego (GCR/SEP) w jednostkach modelowych."
            ),
            "gcr_proton_flux": "Składowa strumienia GCR przypisana protonom.",
            "gcr_alpha_flux": "Składowa strumienia GCR przypisana jądrom helu.",
            "gcr_hze_flux": "Składowa strumienia GCR przypisana ciężkim jonom (HZE).",
            "gcr_surface_flux": (
                "Strumień promieniowania kosmicznego na powierzchni skały."
            ),
            "gcr_local_flux": (
                "Strumień promieniowania kosmicznego po przejściu przez skałę "
                "(w miejscu mikroorganizmu)."
            ),
            # Gamma
            "gamma_surface_flux": (
                "Strumień promieniowania gamma na powierzchni skały [W/m^2]."
            ),
            "gamma_local_flux": (
                "Strumień promieniowania gamma w miejscu mikroorganizmu po "
                "przejściu przez skałę [W/m^2]."
            ),
        },
        "records": [],
    }


def _load_payload(path: Path) -> Dict[str, Any]:
    """
    Wczytuje istniejący plik JSON lub tworzy pustą strukturę.
    """
    if not path.exists():
        return _initial_payload()

    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        return _initial_payload()

    if "records" not in data or not isinstance(data["records"], list):
        data["records"] = []

    if "__description__" not in data:
        data["__description__"] = _initial_payload()["__description__"]

    return data


def _initial_rock_payload() -> Dict[str, Any]:
    """
    Domyślna struktura pliku JSON dla podsumowań promieniowania dla skał.
    """
    return {
        "__description__": {
            "metadata": (
                "Parametry skały (promień, gęstość, albedo, frakcja wody, porowatość, "
                "zawartość U/Th/K, itp.)."
            ),
            "records": (
                "Lista rekordów promieniowania dla danej skały, zorganizowana według "
                "przebiegu symulacji i kroku czasowego."
            ),
            "record_fields": {
                "run_id": "Identyfikator przebiegu symulacji.",
                "step_index": "Numer kroku czasowego w danym przebiegu.",
                "time_seconds": "Czas symulacji [s] w tym kroku.",
                "uv_local_flux": "Strumień UV w miejscu mikroorganizmu [W/m^2].",
                "gcr_local_flux": (
                    "Strumień promieniowania kosmicznego w miejscu mikroorganizmu."
                ),
                "gamma_local_flux": (
                    "Strumień promieniowania gamma w miejscu mikroorganizmu [W/m^2]."
                ),
                "cumulative_exposure": (
                    "Skumulowana ekspozycja w centrum skały [J/m^2] (wszystkie komponenty)."
                ),
                "T_surface_K": "Temperatura równowagi na powierzchni skały [K].",
                "T_mid_radius_K": "Temperatura w połowie promienia skały [K].",
                "T_center_K": "Temperatura w centrum skały (gdzie jest materiał genetyczny) [K].",
            },
        },
        "rocks": {},
    }


def _load_rock_payload(path: Path) -> Dict[str, Any]:
    """
    Wczytuje istniejący plik z podsumowaniami skał lub tworzy nową strukturę.
    """
    if not path.exists():
        return _initial_rock_payload()

    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        return _initial_rock_payload()

    if "rocks" not in data or not isinstance(data["rocks"], dict):
        data["rocks"] = {}

    if "__description__" not in data:
        data["__description__"] = _initial_rock_payload()["__description__"]

    return data


def _initial_star_uv_payload() -> Dict[str, Any]:
    """
    Domyślna struktura pliku JSON dla profili UV gwiazd.
    """
    return {
        "__description__": {
            "stars": (
                "Słownik gwiazd; klucz to nazwa, wartość zawiera metadane i profil UV."
            ),
            "star_fields": {
                "name": "Nazwa gwiazdy (np. 'Sun').",
                "mass_solar": "Masa gwiazdy w jednostkach masy Słońca [M_sun].",
                "luminosity_W": "Jasność gwiazdy [W].",
                "uv_profile": (
                    "Lista punktów (distance_au, uv_surface_flux) opisujących "
                    "strumień UV na różnych odległościach od gwiazdy."
                ),
            },
            "profile_fields": {
                "distance_au": "Odległość od gwiazdy [AU].",
                "uv_surface_flux": "Strumień UV na tej odległości [W/m^2].",
            },
        },
        "stars": {},
    }


def _load_star_uv_payload(path: Path) -> Dict[str, Any]:
    """
    Wczytuje plik z profilami UV gwiazd lub tworzy nową strukturę.
    """
    if not path.exists():
        return _initial_star_uv_payload()

    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        return _initial_star_uv_payload()

    if "stars" not in data or not isinstance(data["stars"], dict):
        data["stars"] = {}

    if "__description__" not in data:
        data["__description__"] = _initial_star_uv_payload()["__description__"]

    return data


def append_radiation_record(
    *,
    time_seconds: float,
    uv_surface_flux: Optional[float] = None,
    uv_local_flux: Optional[float] = None,
    uv_cumulative_exposure: Optional[float] = None,
    gcr_total_flux: Optional[float] = None,
    gcr_proton_flux: Optional[float] = None,
    gcr_alpha_flux: Optional[float] = None,
    gcr_hze_flux: Optional[float] = None,
    gcr_surface_flux: Optional[float] = None,
    gcr_local_flux: Optional[float] = None,
    gamma_surface_flux: Optional[float] = None,
    gamma_local_flux: Optional[float] = None,
    context: Optional[str] = None,
) -> None:
    """
    Dodaje nowy rekord promieniowania (UV / GCR / gamma) do globalnego pliku JSON.
    """
    record = RadiationRecord(
        time_seconds=time_seconds,
        uv_surface_flux=uv_surface_flux,
        uv_local_flux=uv_local_flux,
        uv_cumulative_exposure=uv_cumulative_exposure,
        gcr_total_flux=gcr_total_flux,
        gcr_proton_flux=gcr_proton_flux,
        gcr_alpha_flux=gcr_alpha_flux,
        gcr_hze_flux=gcr_hze_flux,
        gcr_surface_flux=gcr_surface_flux,
        gcr_local_flux=gcr_local_flux,
        gamma_surface_flux=gamma_surface_flux,
        gamma_local_flux=gamma_local_flux,
        context=context,
    )

    path = _data_file_path()
    payload = _load_payload(path)

    records: List[Dict[str, Any]] = payload.setdefault("records", [])
    records.append(asdict(record))

    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def append_rock_radiation_record(
    *,
    rock: Rock,
    run_id: str,
    step_index: int,
    time_seconds: float,
    uv_local_flux: Optional[float] = None,
    gcr_local_flux: Optional[float] = None,
    gamma_local_flux: Optional[float] = None,
    cumulative_exposure: Optional[float] = None,
    T_surface_K: Optional[float] = None,
    T_mid_radius_K: Optional[float] = None,
    T_center_K: Optional[float] = None,
) -> None:
    """
    Dodaje rekord promieniowania dla konkretnej skały do osobnego pliku JSON.
    """
    path = _rock_data_file_path()
    payload = _load_rock_payload(path)

    rocks_dict: Dict[str, Any] = payload.setdefault("rocks", {})
    rock_key = rock.name

    if rock_key not in rocks_dict:
        rocks_dict[rock_key] = {
            "metadata": {
                "name": rock.name,
                "radius_m": rock.radius_m,
                "density_kg_m3": rock.density_kg_m3,
                "albedo": rock.albedo,
                "water_mass_fraction": rock.water_mass_fraction,
                "porosity": rock.porosity,
                "probability": rock.probability,
                "uranium238_ppm": rock.uranium238_ppm,
                "thorium232_ppm": rock.thorium232_ppm,
                "potassium_percent": rock.potassium_percent,
                "extra": rock.extra,
                "notes": rock.notes,
            },
            "records": [],
        }

    rock_entry = rocks_dict[rock_key]
    records: List[Dict[str, Any]] = rock_entry.setdefault("records", [])

    records.append(
        {
            "run_id": run_id,
            "step_index": step_index,
            "time_seconds": time_seconds,
            "uv_local_flux": uv_local_flux,
            "gcr_local_flux": gcr_local_flux,
            "gamma_local_flux": gamma_local_flux,
            "cumulative_exposure": cumulative_exposure,
            "T_surface_K": T_surface_K,
            "T_mid_radius_K": T_mid_radius_K,
            "T_center_K": T_center_K,
        }
    )

    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def load_rock_radiation_summary() -> Dict[str, Any]:
    """
    Wczytuje cały plik z podsumowaniami promieniowania dla skał.
    """
    path = _rock_data_file_path()
    return _load_rock_payload(path)


def write_star_uv_profile(
    *,
    name: str,
    mass_solar: float,
    distances_au: Sequence[float],
) -> None:
    """
    Zapisuje (lub aktualizuje) profil UV dla podanej gwiazdy.

    Dla każdej odległości z ``distances_au`` liczy strumień UV na powierzchni
    i zapisuje jako listę punktów (distance_au, uv_surface_flux).
    """
    if mass_solar <= 0.0:
        raise ValueError("mass_solar must be positive.")

    luminosity = stellar_luminosity_from_solar_mass(mass_solar)

    path = _star_uv_file_path()
    payload = _load_star_uv_payload(path)

    stars_dict: Dict[str, Any] = payload.setdefault("stars", {})

    profile: List[Dict[str, float]] = []
    for d in distances_au:
        if d <= 0.0:
            continue
        flux = stellar_flux_at_au(luminosity, d)
        profile.append(
            {
                "distance_au": float(d),
                "uv_surface_flux": float(flux),
            }
        )

    stars_dict[name] = {
        "name": name,
        "mass_solar": float(mass_solar),
        "luminosity_W": float(luminosity),
        "uv_profile": profile,
    }

    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


__all__ = [
    "RadiationRecord",
    "append_radiation_record",
    "append_rock_radiation_record",
    "load_rock_radiation_summary",
    "write_star_uv_profile",
]

