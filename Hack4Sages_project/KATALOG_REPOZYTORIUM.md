# Katalog repozytorium

Ten dokument opisuje odpowiedzialność elementów na poziomie całego repo.

## Główne pliki i katalogi
- `microbe_radiation_model/`
  - główny pakiet kodu
  - pełny opis modułów: `microbe_radiation_model/KATALOG_MODULOW.md`
- `srodowisko.ipynb`
  - notebook roboczy do budowy środowiska i eksperymentów
  - generuje i czyta `nearest_50_gaia.csv`
  - używa REBOUND/REBOUNDx po stronie notebooka
- `nearest_50_gaia.csv`
  - dane gwiazd Gaia
  - wejście zarówno dla notebooka, jak i dla `simulation/builder.py`
- `requirements.txt`
  - zależności potrzebne do uruchomienia pakietu i notebooka
- `pozostalosci/`
  - materiały referencyjne i koncepcyjne niepodłączone do aktywnego pipeline'u

## Co jest uruchamiane aktywnie
- moduły z `microbe_radiation_model/physics`, `radiation`, `simulation`, `demos`, `catalogs`
- notebook `srodowisko.ipynb` (jako środowisko eksperymentalne)
- dane `nearest_50_gaia.csv`
- canonical entrypoint: `python -m microbe_radiation_model.simulation`

## Co jest nieaktywne runtime
- notatki koncepcyjne z `pozostalosci/koncepcje/`
  - `amuse.txt`
  - `atm.txt`
- historyczne artefakty i modele uproszczone z `microbe_radiation_model/pozostalosci/`
- archiwum dawnych aliasów z poziomu głównego: `microbe_radiation_model/pozostalosci/aliasy_v1/`

## Powiązanie notebooka z pakietem
- notebook przygotowuje dane i eksperymenty orbitalne
- pakiet `microbe_radiation_model` dostarcza uporządkowaną logikę promieniowania i scenariuszy
- wspólnym punktem jest plik `nearest_50_gaia.csv`
- notebook nie importuje `amuse.txt` ani `atm.txt` jako danych wejściowych
