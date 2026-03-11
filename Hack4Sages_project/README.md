# Hack4Sages_project

Repozytorium zawiera aktywny model promieniowania i symulacji orbitalnej
zorganizowany jako pakiet `microbe_radiation_model`.

## Najwazniejsze elementy
- `microbe_radiation_model/`
  - glowny, aktywny pakiet runtime
  - szczegolowy opis: `microbe_radiation_model/KATALOG_MODULOW.md`
  - pelna dokumentacja techniczna: `microbe_radiation_model/DOKUMENTACJA_TECHNICZNA_PELNA.md`
- `nearest_50_gaia.csv`
  - dane gwiazd Gaia wykorzystywane przez `simulation/builder.py`
- `run.py`
  - runner aktualnego pipeline (bez zaleznosci od notebooka)
- `pozostalosci/`
  - notatki i materialy historyczne, niepodlaczone do aktywnego runtime

## Co nie jest juz sciezka runtime
- `srodowisko.ipynb`
  - plik roboczy/archiwalny
  - nie jest wymagany do uruchamiania obecnego pipeline

## Szybkie uruchomienie
- `python -m microbe_radiation_model.demos.demo`
- `python -m microbe_radiation_model.demos.run_simulation`
- `python -m microbe_radiation_model.demos.run_radiation_demo`
- `python run.py`
