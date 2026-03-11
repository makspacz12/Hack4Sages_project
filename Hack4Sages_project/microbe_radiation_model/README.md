# microbe_radiation_model

Ten katalog zawiera kompletny pipeline:
1. definicje fizyczne i materiałowe,
2. obliczenia promieniowania i ekranowania,
3. integracje czasowe z REBOUND,
4. dema uruchomieniowe i raporty.

## Struktura funkcjonalna
- `physics/` - fundament matematyczny i fizyczny (bez logiki symulacji)
- `materials/` - kanoniczne typy i presety skał (`materials/rocks/*`)
- `radiation/` - właściwy łańcuch promieniowania (flux -> shielding -> exposure)
- `simulation/` - warstwa łącząca `radiation/` z REBOUND
- `demos/` - gotowe skrypty uruchomieniowe i formatowanie wyjścia
- `data/` - dane wyjsciowe generowane przez uruchomienia (JSON pod analize i wizualizacje)
- `data_store.py` - centralny magazyn zapisu danych do `data/*.json` (IO/analityka, nie fizyka)
- `catalogs/` - warstwa kompatybilności dla starszych importów presetów
- `pozostalosci/` - nieaktywne i historyczne elementy robocze
- `legacy/` - alias zgodności dla starszych importów

## Czysty poziom główny pakietu
W runtime na poziomie `microbe_radiation_model/` zostaje tylko:
- `__init__.py`
- dokumentacja (`README.md`, `KATALOG_MODULOW.md`)
- katalogi warstwowe wymienione wyżej

Dawne aliasy z poziomu głównego zostały usunięte z runtime i zarchiwizowane w:
- `microbe_radiation_model/pozostalosci/aliasy_v1/`

## Główne punkty wejścia
- `python -m microbe_radiation_model.simulation` - uruchomienie scenariusza domyślnego
- `python -m microbe_radiation_model.demos.demo` - szybki przegląd obliczeń + pełny raport
- `python -m microbe_radiation_model.demos.run_simulation` - demo scenariusza połączonego
- `python -m microbe_radiation_model.demos.run_radiation_demo` - demo statyczne bez REBOUND

## Zależności danych
- `nearest_50_gaia.csv` - źródło dodatkowych gwiazd dla `simulation/builder.py`
- `srodowisko.ipynb` - plik roboczy/archiwalny; nie jest wymagany przez aktywny runtime

## Dane wyjsciowe (`data/`)
W demach i scenariuszach dane są zapisywane do JSON-ów w `microbe_radiation_model/data/`:
- `gamma_radiation_timeseries.json` - globalny log czasowy (UV/GCR/gamma) pod wykresy
- `rock_radiation_summary.json` - podsumowania i rekordy promieniowania per typ skały (`Rock`)
- `star_uv_profile.json` - profil UV gwiazd (masa, jasnosc, flux w funkcji odleglosci)

## Dokumentacja szczegolowa
- `DOKUMENTACJA_TECHNICZNA_PELNA.md` - pelny opis modulow, fizyki, danych i etapow uruchomienia
