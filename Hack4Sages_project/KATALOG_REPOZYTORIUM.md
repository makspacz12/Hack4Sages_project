# Katalog repozytorium

Ten dokument opisuje odpowiedzialnosc elementow na poziomie calego repo.

## Glowne pliki i katalogi
- `microbe_radiation_model/`
  - glowny pakiet kodu
  - opis modulow: `microbe_radiation_model/KATALOG_MODULOW.md`
  - pelny opis fizyki i runtime: `microbe_radiation_model/DOKUMENTACJA_TECHNICZNA_PELNA.md`
- `nearest_50_gaia.csv`
  - dane wejciowe dla `simulation/builder.py`
- `run.py`
  - uruchamia aktywny pipeline raportowania
- `requirements.txt`
  - zaleznosci potrzebne do uruchamiania pakietu
- `pozostalosci/`
  - materialy referencyjne i historyczne, niepodlaczone do aktywnego pipeline

## Co jest uruchamiane aktywnie
- `microbe_radiation_model/physics`
- `microbe_radiation_model/materials`
- `microbe_radiation_model/radiation`
- `microbe_radiation_model/simulation`
- `microbe_radiation_model/demos`
- `python -m microbe_radiation_model.simulation`
- `python run.py`

## Co nie jest juz sciezka runtime
- `srodowisko.ipynb`
  - plik roboczy/archiwalny
  - nie jest wymagany do dzialania aktualnego modelu
