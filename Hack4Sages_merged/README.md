# Hack4Sages_merged

To jest scalona wersja robocza laczaca dwie rownolegle rozwijane galezie projektu:

- wariant z `Hack4Sages_project` wnosi rozbudowana warstwe orbitalna i dynamiczna:
  `REBOUND`, ejecta z Marsa, cisnienie promieniowania i erozje pyłowa;
- wariant z `Hack4Sages_maks` wnosi model temperatury, hydrolyzy, magazyn danych JSON
  oraz bardziej uporzadkowana dokumentacje.

## Co jest teraz kanoniczne

- aktywny runtime siedzi w `microbe_radiation_model/`
- glowny punkt wejscia to `run.py`
- kanoniczny format danych dla wizualizacji to JSON w `microbe_radiation_model/data/`
- JSON jest jedynym aktywnym eksportem dla wizualizacji

## Najwazniejsze katalogi

- `microbe_radiation_model/simulation/`
  - budowa ukladu, krok orbitalny i scenariusze demo
- `microbe_radiation_model/impacts/`
  - generowanie asteroid/ejecta po impakcie marsjanskim
- `microbe_radiation_model/erosion/`
  - uproszczony model erozji pylowej asteroid
- `microbe_radiation_model/radiation/`
  - promieniowanie gwiazdowe, GCR, ekranowanie i helpery cisnienia promieniowania
- `microbe_radiation_model/thermal/`
  - temperatura powierzchni i prosty profil temperatury wnetrza
- `microbe_radiation_model/chemistry/`
  - hydrolyza zaleznaz od temperatury i zawartosci wody
- `microbe_radiation_model/data/`
  - JSON-y dla dalszej analizy i wizualizacji

## Szybkie uruchomienie

- `python3 run.py`
- `python3 -m microbe_radiation_model.demos.run_radiation_demo`
- `python3 -m microbe_radiation_model.demos.run_simulation`
- `python3 -m microbe_radiation_model.demos.run_mars_impact_demo`

## Uwagi praktyczne

- `run.py` dziala tez w srodowisku bez pelnego stacku naukowego i wtedy przechodzi na bezpieczniejszy tryb statyczny.
- `srodowisko.ipynb` i `pozostalosci/` zostaja jako material referencyjny, a nie kanoniczny runtime.
