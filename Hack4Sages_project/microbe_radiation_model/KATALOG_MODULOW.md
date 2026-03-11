# Katalog modułów

Ten dokument opisuje szczegółowo odpowiedzialność każdego modułu w pakiecie `microbe_radiation_model`.

## 1) Warstwa fundamentu: `physics/`
- `physics/constants.py`
  - centralny zbiór stałych fizycznych i astronomicznych
  - źródło wartości `AU`, `SOLAR_MASS`, `SOLAR_LUMINOSITY`, `SECONDS_PER_YEAR`
- `physics/materials.py`
  - definicja dataclass `Material`
  - standard opisu materiałów używany przez wszystkie kolejne warstwy
- `physics/geometry.py`
  - narzędzia geometrii kuli (`sphere_volume`, `sphere_mass`, `radius_from_mass_and_density`)
  - funkcja `biological_core_radius` używana podczas ekranowania
- `physics/stellar_physics.py`
  - relacje masa gwiazdy -> jasność
  - przygotowuje wejście do modelu strumienia promieniowania
- `physics/__init__.py`
  - eksport publicznego API warstwy fizycznej

## 2) Warstwa promieniowania: `radiation/`
- `radiation/radiation_model.py`
  - oblicza strumień promieniowania gwiazdy dla danej odległości
  - wspiera metry i AU
- `radiation/shielding_model.py`
  - model tłumienia strumienia w skale i centralnym rdzeniu biologicznym
  - zwraca szczegółową strukturę `RadiationPointResult`
- `radiation/exposure_model.py`
  - przechowuje i aktualizuje ekspozycję skumulowaną
- `radiation/__init__.py`
  - eksport API warstwy promieniowania

## 3) Warstwa symulacji: `simulation/`
- `simulation/builder.py`
  - buduje układ REBOUND
  - potrafi dołączyć planety i gwiazdy z `nearest_50_gaia.csv`
- `simulation/config.py`
  - parametry materiałowe i czasowe uruchomień
  - używa presetów z `catalogs/asteroid_properties.py`
- `simulation/coupling.py`
  - łączy wynik REBOUND (pozycje) z obliczeniami warstwy promieniowania
- `simulation/engine.py`
  - główna pętla kroków czasowych
  - wybór najbliższej gwiazdy i aktualizacja ekspozycji dla śledzonych ciał
- `simulation/scenarios.py`
  - gotowe scenariusze uruchomieniowe i raport końcowy
  - fallback do trybu statycznego, gdy REBOUND nie jest dostępny
- `simulation/__main__.py`
  - wejście CLI dla `python -m microbe_radiation_model.simulation`
- `simulation/__init__.py`
  - eksport API warstwy symulacyjnej

## 4) Warstwa uruchomień: `demos/`
- `demos/console.py`
  - helper do konfiguracji UTF-8
- `demos/demo.py`
  - główne demo łączące szybki test fizyczny i pełny raport
- `demos/run_radiation_demo.py`
  - uruchomienie statycznego łańcucha promieniowania
- `demos/run_simulation.py`
  - uruchomienie scenariusza połączonego
- `demos/__init__.py`
  - eksport funkcji startowych

## 5) Warstwa presetów: `catalogs/`
- `catalogs/asteroid_properties.py`
  - podstawowe profile skał i asteroid (gęstość, albedo, udział)
- `catalogs/__init__.py`
  - eksport presetów

## 6) Warstwa pozostałości: `pozostalosci/`
- `pozostalosci/shielding_legacy.py`
  - starszy uproszczony model ekranowania
- `pozostalosci/obliczenia_k.py`
  - szkic pod przyszłe wyliczanie współczynnika `k`
- `pozostalosci/XCOM.exe`
  - zewnętrzne narzędzie pomocnicze zachowane w repo
- `pozostalosci/__init__.py`
  - minimalny eksport dla zgodności

## 7) Alias zgodności: `legacy/`
- `legacy/*` nie zawiera logiki biznesowej
- jest aliasem do `pozostalosci/*`, żeby stare importy działały bez zmian

## 8) Czysty poziom główny pakietu

Po twardym cięciu w runtime na poziomie `microbe_radiation_model/` został tylko:
- `__init__.py` (eksport uproszczonego API)
- dokumentacja (`README.md`, `KATALOG_MODULOW.md`)
- katalogi warstwowe

Nie ma już aliasowych modułów `.py` na górze pakietu.

## 9) Co zostało przeniesione do pozostałości

- notatki `amuse.txt` i `atm.txt` -> `pozostalosci/koncepcje/`
- historyczne narzędzie `XCOM.exe` -> `microbe_radiation_model/pozostalosci/`
- historyczne modele i szkice -> `microbe_radiation_model/pozostalosci/`
- dawne aliasy runtime -> `microbe_radiation_model/pozostalosci/aliasy_v1/`

## 10) Pełny przepływ danych
1. `physics/stellar_physics.py` liczy jasność gwiazdy.
2. `radiation/radiation_model.py` wyznacza strumień w odległości od gwiazdy.
3. `radiation/shielding_model.py` liczy tłumienie przez skałę i rdzeń bio.
4. `radiation/exposure_model.py` aktualizuje dawkę skumulowaną.
5. `simulation/engine.py` powtarza ten cykl dla kolejnych kroków czasu.
6. `demos/` uruchamia scenariusze i wypisuje raporty.
