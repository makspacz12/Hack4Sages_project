# Katalog modulow

Ten dokument opisuje odpowiedzialnosc modulow w pakiecie
`microbe_radiation_model`.

## 1) Warstwa fundamentu: `physics/`
- `physics/constants.py`
  - stale fizyczne i astronomiczne (`AU`, `SOLAR_MASS`, `SOLAR_LUMINOSITY`, `SECONDS_PER_YEAR`)
- `physics/materials.py`
  - bazowy typ `Material` dla modelu ekranowania
- `physics/geometry.py`
  - geometria kuli i promien rdzenia biologicznego
- `physics/stellar_physics.py`
  - zaleznosci masa gwiazdy -> jasnosc
- `physics/__init__.py`
  - eksport API warstwy fizycznej

## 2) Warstwa modeli skal: `materials/rocks/`
- `materials/rocks/types.py`
  - dataclass `Rock` (parametry geometrii, skladu i materialu)
- `materials/rocks/variants.py`
  - domyslne warianty skal (`DEFAULT_ROCK_VARIANTS`)
- `materials/rocks/params.py`
  - helper `get_rock_param` do bezpiecznego pobierania parametrow
- `materials/rocks/utils.py`
  - narzedzia pomocnicze (`get_rock_by_name`, `normalize_probabilities`)
- `materials/rocks/__init__.py`
  - kanoniczne eksporty typu i presetow skal

## 3) Warstwa promieniowania: `radiation/`
- `radiation/radiation_model.py`
  - strumien promieniowania od gwiazdy
- `radiation/shielding_model.py`
  - tlumienie w skale i rdzeniu biologicznym (`RadiationPointResult`)
- `radiation/exposure_model.py`
  - skumulowana ekspozycja (`ExposureState`)
- `radiation/radionuclide_model/constants.py`
  - stale do konwersji skladu U/Th/K -> aktywnosc
- `radiation/radionuclide_model/activity.py`
  - aktywnosc izotopowa i objetosciowa aktywnosc skaly
- `radiation/radionuclide_model/geometry.py`
  - geometria skaly (masa, objetosc, promien)
- `radiation/radionuclide_model/gamma.py`
  - uproszczone wewnetrzne pole gamma
- `radiation/radionuclide_model/__init__.py`
  - eksport API radionuklidowego
- `radiation/__init__.py`
  - eksport API warstwy promieniowania

## 4) Warstwa symulacji: `simulation/`
- `simulation/builder.py`
  - buduje uklad REBOUND i opcjonalnie dodaje gwiazdy z `nearest_50_gaia.csv`
- `simulation/config.py`
  - konfiguracja uruchomienia i materialow
- `simulation/coupling.py`
  - laczy pozycje orbitalne z krokiem promieniowania
- `simulation/engine.py`
  - glowna petla czasowa (`integrate -> radiation -> exposure`)
- `simulation/scenarios.py`
  - scenariusze demo i raport tekstowy
- `simulation/__main__.py`
  - punkt wejscia `python -m microbe_radiation_model.simulation`

## 5) Warstwa uruchomien: `demos/`
- `demos/demo.py`
  - szybki test fizyczny + raport pelnego scenariusza
- `demos/run_radiation_demo.py`
  - demo statyczne bez REBOUND
- `demos/run_simulation.py`
  - demo polaczonego pipeline
- `demos/console.py`
  - konfiguracja UTF-8 dla konsoli

## 6) Presety kompatybilnosci: `catalogs/`
- `catalogs/asteroid_properties.py`
  - kompatybilnosciowy eksport `DEFAULT_ROCK_VARIANTS`
- `catalogs/rock_material.py`
  - alias typu `RockVariant` dla starszych importow
- `catalogs/__init__.py`
  - eksport `DEFAULT_ROCK_VARIANTS`

## 7) Pozostalosci i aliasy
- `legacy/`
  - alias zgodnosci do starszych modulow
- `pozostalosci/`
  - historyczne i nieaktywne artefakty

## 8) Przeplyw danych (high level)
1. `stellar_physics.py` liczy jasnosc gwiazdy.
2. `radiation_model.py` wyznacza strumien.
3. `shielding_model.py` liczy tlumienie przez skale.
4. `exposure_model.py` aktualizuje dawke skumulowana.
5. `engine.py` powtarza to dla kolejnych krokow czasu.
6. `demos/` formatuje i wypisuje raporty.
