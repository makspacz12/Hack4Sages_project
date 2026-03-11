# README GENERALNY

Ten dokument zbiera opis kazdego istotnego pliku w repozytorium.
Lista obejmuje pliki z kodem, dokumentacja i dane, bez `__pycache__` i `.pyc`.

## Poziom repo (`Hack4Sages_project/`)

- `README.md` - glowny skrot projektu i szybkie uruchomienie.
- `README_GENERALNY.md` - ten plik, pelny opis wszystkich plikow.
- `KATALOG_REPOZYTORIUM.md` - opis odpowiedzialnosci na poziomie calego repo.
- `requirements.txt` - lista zaleznosci Pythona (m.in. `rebound`, `numpy`, `pandas`).
- `run.py` - prosty runner wypisujacy raporty dla trybu statycznego i polaczonego.
- `nearest_50_gaia.csv` - katalog gwiazd Gaia uzywany przy budowaniu symulacji.
- `srodowisko.ipynb` - notebook roboczy/archiwalny, nie jest wymagany przez runtime.

## `internal_heat/`

- `internal_heat/READ.ME` - krotki opis co liczy model ciepla radiogenicznego.
- `internal_heat/constants.py` - wspolczynniki empiryczne U/Th/K do mocy cieplnej.
- `internal_heat/model.py` - przeliczenie skladu skaly na `W/kg`, `W/m^3` i moc calkowita.

## `microbe_radiation_model/` (aktywny pakiet runtime)

- `microbe_radiation_model/README.md` - ogolny opis warstw pakietu.
- `microbe_radiation_model/KATALOG_MODULOW.md` - mapowanie modulow i przeplywu danych.
- `microbe_radiation_model/DOKUMENTACJA_TECHNICZNA_PELNA.md` - szeroka dokumentacja techniczna.
- `microbe_radiation_model/__init__.py` - eksport glownych funkcji runtime na poziom pakietu.
- `microbe_radiation_model/data_store.py` - centralny magazyn zapisu danych wyjsciowych (JSON) do `microbe_radiation_model/data/`.

## `microbe_radiation_model/data/` (dane wyjsciowe)

- `microbe_radiation_model/data/gamma_radiation_timeseries.json` - globalny log czasowy (UV/GCR/gamma) pod analize i wykresy.
- `microbe_radiation_model/data/rock_radiation_summary.json` - podsumowania promieniowania i rekordy per typ skaly (`Rock`).
- `microbe_radiation_model/data/star_uv_profile.json` - profil UV gwiazd (masa, jasnosc, strumien vs odleglosc).

## `microbe_radiation_model/physics/`

- `microbe_radiation_model/physics/README.md` - opis fundamentu fizycznego.
- `microbe_radiation_model/physics/__init__.py` - eksport stale/funkcje/typ `Material`.
- `microbe_radiation_model/physics/constants.py` - stale (`SOLAR_LUMINOSITY`, `SOLAR_MASS`, `AU`, `SECONDS_PER_YEAR`).
- `microbe_radiation_model/physics/materials.py` - dataclass `Material` (`name`, `density`, `k`).
- `microbe_radiation_model/physics/geometry.py` - geometria kuli i wyznaczanie promienia rdzenia bio.
- `microbe_radiation_model/physics/stellar_physics.py` - zaleznosc masa gwiazdy -> jasnosc.

## `microbe_radiation_model/materials/`

- `microbe_radiation_model/materials/__init__.py` - wspolne eksporty modelu skal.

### `microbe_radiation_model/materials/rocks/`

- `microbe_radiation_model/materials/rocks/README.md` - opis kanonicznej warstwy definicji skal.
- `microbe_radiation_model/materials/rocks/__init__.py` - eksport typow, helperow i presetow skal.
- `microbe_radiation_model/materials/rocks/types.py` - dataclass `Rock` (geometria, sklad, parametry materialu,
  m.in. `density_kg_m3`, `albedo`, `water_mass_fraction`, `porosity`, `thermal_conductivity_w_mk`).
- `microbe_radiation_model/materials/rocks/variants.py` - predefiniowane warianty (`BASALT`, `CHONDRITE`, `ICE_RICH`).
- `microbe_radiation_model/materials/rocks/params.py` - `get_rock_param` i `with_rock_overrides`.
- `microbe_radiation_model/materials/rocks/utils.py` - `get_rock_by_name` i normalizacja prawdopodobienstw.

## `microbe_radiation_model/catalogs/`

- `microbe_radiation_model/catalogs/README.md` - opis warstwy kompatybilnosci.
- `microbe_radiation_model/catalogs/__init__.py` - eksport `DEFAULT_ROCK_VARIANTS`.
- `microbe_radiation_model/catalogs/asteroid_properties.py` - alias zgodnosci do presetow skal.
- `microbe_radiation_model/catalogs/rock_material.py` - alias typu `RockVariant` dla starszych importow.

## `microbe_radiation_model/chemistry/`

- `microbe_radiation_model/chemistry/constants.py` - stale kinetyki hydrolyzy (Arrhenius + temperatura zamarzania).
- `microbe_radiation_model/chemistry/hydrolysis_model.py` - `compute_hydrolysis_rate` (tempo hydrolyzy od temperatury i wody).

## `microbe_radiation_model/internal_heat/`

- `microbe_radiation_model/internal_heat/READ.ME` - krotki opis co liczy model ciepla radiogenicznego.
- `microbe_radiation_model/internal_heat/constants.py` - wspolczynniki empiryczne U/Th/K do mocy cieplnej.
- `microbe_radiation_model/internal_heat/model.py` - przeliczenie skladu skaly na `W/kg`, `W/m^3` i moc calkowita.

## `microbe_radiation_model/thermal/`

- `microbe_radiation_model/thermal/__init__.py` - eksport podstawowych funkcji modelu temperatury.
- `microbe_radiation_model/thermal/surface_temperature.py` - temperatura równowagi radiacyjnej powierzchni skały
  z zewnętrznego promieniowania gwiazdowego (używa istniejących modeli fluxu, nie duplikuje promieniowania).

## `microbe_radiation_model/radiation/`

- `microbe_radiation_model/radiation/README.md` - opis warstwy promieniowania.
- `microbe_radiation_model/radiation/__init__.py` - publiczne API warstwy (stellar, cosmic, shielding, exposure).
- `microbe_radiation_model/radiation/radiation_model.py` - wrapper kompatybilnosci do `radiation/stellar/radiation_model.py`.
- `microbe_radiation_model/radiation/shielding_model.py` - model tlumienia Beer-Lamberta w skale i rdzeniu bio.
- `microbe_radiation_model/radiation/exposure_model.py` - stan i aktualizacja ekspozycji skumulowanej.

### `microbe_radiation_model/radiation/stellar/`

- `microbe_radiation_model/radiation/stellar/__init__.py` - eksport API promieniowania gwiazdowego.
- `microbe_radiation_model/radiation/stellar/radiation_model.py` - kanoniczny model strumienia od gwiazdy.
- `microbe_radiation_model/radiation/stellar/stellar_radiation.py` - wrapper kompatybilnosci dla starszych importow.

### `microbe_radiation_model/radiation/cosmic/`

- `microbe_radiation_model/radiation/cosmic/__init__.py` - eksport API promieniowania kosmicznego.
- `microbe_radiation_model/radiation/cosmic/cosmic_radiation_model.py` - model tla GCR zalezny od regionu (heliosfera/deep space).
- `microbe_radiation_model/radiation/cosmic/cosmic_spectrum.py` - podzial calkowitego fluxu GCR na protony/alpha/HZE.

### `microbe_radiation_model/radiation/radionuclide_model/`

- `microbe_radiation_model/radiation/radionuclide_model/README.md` - opis podmodelu zrodel wewnetrznych.
- `microbe_radiation_model/radiation/radionuclide_model/__init__.py` - eksport API aktywnosc/geometria/gamma.
- `microbe_radiation_model/radiation/radionuclide_model/constants.py` - stale konwersji U/Th/K -> Bq/kg.
- `microbe_radiation_model/radiation/radionuclide_model/activity.py` - aktywnosc specyficzna i objetosciowa skaly.
- `microbe_radiation_model/radiation/radionuclide_model/geometry.py` - geometria skaly z masy i gestosci.
- `microbe_radiation_model/radiation/radionuclide_model/gamma.py` - uproszczone wewnetrzne pole gamma.

## `microbe_radiation_model/simulation/`

- `microbe_radiation_model/simulation/README.md` - opis warstwy laczacej REBOUND z promieniowaniem.
- `microbe_radiation_model/simulation/__init__.py` - eksport funkcji budowy i uruchamiania scenariuszy.
- `microbe_radiation_model/simulation/__main__.py` - punkt wejscia `python -m microbe_radiation_model.simulation`.
- `microbe_radiation_model/simulation/config.py` - dataclass konfiguracji materialowej i parametrow biegu.
- `microbe_radiation_model/simulation/builder.py` - budowa `rebound.Simulation` + opcjonalny import gwiazd z CSV.
- `microbe_radiation_model/simulation/coupling.py` - krok sprzegajacy orbite z lokalnym modelem promieniowania.
- `microbe_radiation_model/simulation/engine.py` - petla `integrate -> nearest star -> radiation step`.
- `microbe_radiation_model/simulation/scenarios.py` - gotowe scenariusze i formatter raportu tekstowego.

## `microbe_radiation_model/demos/`

- `microbe_radiation_model/demos/README.md` - opis skryptow demonstracyjnych.
- `microbe_radiation_model/demos/__init__.py` - helpery `main_*` i eksport konfiguracji konsoli.
- `microbe_radiation_model/demos/console.py` - ustawienie UTF-8 dla `stdout`.
- `microbe_radiation_model/demos/demo.py` - glowne demo: szybki test + raport scenariusza.
- `microbe_radiation_model/demos/run_radiation_demo.py` - uruchomienie statycznego pipeline bez REBOUND.
- `microbe_radiation_model/demos/run_simulation.py` - uruchomienie pelnego demo runtime.

## `pozostalosci/` (materialy historyczne i koncepcyjne)

- `pozostalosci/README.md` - opis roli katalogu historycznego.

### `pozostalosci/koncepcje/`

- `pozostalosci/koncepcje/README.md` - indeks notatek architektonicznych.
- `pozostalosci/koncepcje/amuse.txt` - koncepcja integracji AMUSE (multi-solver).
- `pozostalosci/koncepcje/atm.txt` - koncepcja integracji ATM (model temperatury asteroid).

### `pozostalosci/legacy/`

- `pozostalosci/legacy/README.md` - opis warstwy zgodnosci wstecznej.
- `pozostalosci/legacy/__init__.py` - alias eksportu historycznego API.
- `pozostalosci/legacy/shielding_legacy.py` - alias do starego modelu ekranowania.
- `pozostalosci/legacy/obliczenia_k.py` - alias do historycznego szkicu obliczen `k`.

### `pozostalosci/pozostalosci/`

- `pozostalosci/pozostalosci/README.md` - opis nieaktywnych artefaktow i eksperymentow.
- `pozostalosci/pozostalosci/__init__.py` - eksport historycznego `radiation_at_points_in_sphere`.
- `pozostalosci/pozostalosci/shielding_legacy.py` - stary model ekranowania jednorodnej skaly.
- `pozostalosci/pozostalosci/obliczenia_k.py` - szkic miejsca pod obliczenia wspolczynnika tlumienia.
- `pozostalosci/pozostalosci/XCOM.exe` - zewnetrzne narzedzie pomocnicze do badan materialowych.

#### `pozostalosci/pozostalosci/aliasy_v1/`

- `pozostalosci/pozostalosci/aliasy_v1/README.md` - opis archiwum dawnych aliasow.
- `pozostalosci/pozostalosci/aliasy_v1/asteroid_properties.py` - alias do dawnych presetow asteroid.
- `pozostalosci/pozostalosci/aliasy_v1/build_simulation.py` - alias do dawnego wejscia budowy symulacji.
- `pozostalosci/pozostalosci/aliasy_v1/console.py` - alias do helpera UTF-8.
- `pozostalosci/pozostalosci/aliasy_v1/constants.py` - alias do stalych fizycznych.
- `pozostalosci/pozostalosci/aliasy_v1/demo.py` - historyczny wrapper uruchamiajacy demo.
- `pozostalosci/pozostalosci/aliasy_v1/exposure_model.py` - alias do modelu ekspozycji.
- `pozostalosci/pozostalosci/aliasy_v1/geometry.py` - alias do helperow geometrii.
- `pozostalosci/pozostalosci/aliasy_v1/materials.py` - alias do typu `Material`.
- `pozostalosci/pozostalosci/aliasy_v1/obliczenia_k.py` - alias do historycznego modulu `obliczenia_k`.
- `pozostalosci/pozostalosci/aliasy_v1/radiation_model.py` - alias do modelu strumienia promieniowania.
- `pozostalosci/pozostalosci/aliasy_v1/rebound_coupling.py` - alias do sprzezenia REBOUND-promieniowanie.
- `pozostalosci/pozostalosci/aliasy_v1/run_radiation_demo.py` - historyczny wrapper demo statycznego.
- `pozostalosci/pozostalosci/aliasy_v1/run_simulation.py` - historyczny wrapper pelnego uruchomienia.
- `pozostalosci/pozostalosci/aliasy_v1/shielding_legacy.py` - alias do starego modelu ekranowania.
- `pozostalosci/pozostalosci/aliasy_v1/shielding_model.py` - alias do aktualnego modelu ekranowania.
- `pozostalosci/pozostalosci/aliasy_v1/stellar_physics.py` - alias do fizyki gwiazd.

## Uwaga praktyczna

- Aktywny runtime projektu to glownie: `microbe_radiation_model/*`, `run.py`, `nearest_50_gaia.csv`.
- Katalog `pozostalosci/*` zostaje jako archiwum i warstwa zgodnosci.
