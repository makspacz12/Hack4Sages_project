# Katalog repozytorium

Ten dokument opisuje role najwazniejszych elementow w `Hack4Sages_merged`.

## Glowne pliki i katalogi

- `microbe_radiation_model/`
  - glowny, scalony pakiet runtime
  - zawiera orbitale REBOUND, modele promieniowania, temperatury i hydrolyzy
- `microbe_radiation_model/data/`
  - kanoniczne dane wyjsciowe dla wizualizacji w formacie JSON
- `nearest_50_gaia.csv`
  - katalog gwiazd Gaia uzywany przy budowie srodowiska miedzygwiezdnego
- `run.py`
  - podstawowy runner raportujacy tryb statyczny i tryb polaczony
- `requirements.txt`
  - zaleznosci dla prostego runtime i rozszerzen typu `spiceypy`, `reboundx`
- `kernels/`
  - pliki SPICE potrzebne do pelniejszej budowy ukladu
- `pozostalosci/`
  - archiwum, szkice i warstwa zgodnosci; nie jest glownym runtime

## Co jest uruchamiane aktywnie

- `microbe_radiation_model/physics`
- `microbe_radiation_model/materials`
- `microbe_radiation_model/radiation`
- `microbe_radiation_model/thermal`
- `microbe_radiation_model/chemistry`
- `microbe_radiation_model/internal_heat`
- `microbe_radiation_model/simulation`
- `microbe_radiation_model/impacts`
- `microbe_radiation_model/erosion`
- `python3 run.py`

## Eksport dla wizualizacji

- kanoniczny eksport:
  `microbe_radiation_model/data/gamma_radiation_timeseries.json`
- kanoniczny eksport:
  `microbe_radiation_model/data/rock_radiation_summary.json`
- kanoniczny eksport:
  `microbe_radiation_model/data/star_uv_profile.json`

## Co nie jest glowna sciezka runtime

- `srodowisko.ipynb`
  - notebook roboczy / historyczny
- `pozostalosci/*`
  - materialy pomocnicze i starsze aliasy
