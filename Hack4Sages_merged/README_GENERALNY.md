# README GENERALNY

Ten dokument opisuje scalona wersje robocza `Hack4Sages_merged`.
Nie jest to pelny katalog kazdego pojedynczego pliku, ale mapa aktywnego runtime
i najwazniejszych danych wyjsciowych.

## Poziom repo

- `README.md` - szybki opis merged wersji i podstawowe uruchomienie.
- `README_GENERALNY.md` - ten dokument, zarys struktury i odpowiedzialnosci.
- `KATALOG_REPOZYTORIUM.md` - skrot odpowiedzialnosci na poziomie glownego repo.
- `requirements.txt` - lista zaleznosci, laczaca wymagania obu poprzednich wersji.
- `run.py` - uruchamia raport dla trybu statycznego i polaczonego.
- `nearest_50_gaia.csv` - wejciowy katalog gwiazd Gaia.
- `srodowisko.ipynb` - material historyczny / roboczy, nie jest glownym runtime.

## `microbe_radiation_model/`

To jest glowny pakiet runtime po scaleniu.

- `__init__.py` - publiczne API najwazniejszych funkcji.
- `data_store.py` - zapis JSON pod analize i wizualizacje.

### `microbe_radiation_model/materials/rocks/`

- kanoniczna definicja typu `Rock`
- predefiniowane warianty asteroid / skal
- pola potrzebne zarowno dla dynamiki, jak i temperatury / hydrolyzy:
  `density_kg_m3`, `albedo`, `water_mass_fraction`, `porosity`,
  `thermal_conductivity_w_mk`, `uranium238_ppm`, `thorium232_ppm`,
  `potassium_percent`

### `microbe_radiation_model/radiation/`

- `stellar/` - promieniowanie gwiazdowe
- `cosmic/` - uproszczony model GCR
- `shielding_model.py` - ekranowanie Beer-Lamberta w skale i rdzeniu bio
- `pressure.py` - helpery cisnienia promieniowania dla asteroid
- `radionuclide_model/` - wewnetrzna aktywnosc i uproszczone pole gamma

### `microbe_radiation_model/thermal/`

- temperatura rownowagi powierzchni
- prosty profil temperatury wewnatrz jednorodnej kuli

### `microbe_radiation_model/chemistry/`

- hydrolyza zaleznaz od temperatury i zawartosci wody

### `microbe_radiation_model/internal_heat/`

- cieplo radiogeniczne od U / Th / K
- wynik wspiera model temperatury i interpretacje warunkow w srodku skaly

### `microbe_radiation_model/simulation/`

- budowa ukladu z REBOUND
- integracja ruchu i wybor najblizszej gwiazdy
- scenariusze demo
- spinanie glownego pipeline'u symulacji

### `microbe_radiation_model/impacts/`

- generowanie populacji ejecta po impakcie marsjanskim
- eksport populacji do `DataFrame`

### `microbe_radiation_model/erosion/`

- prosty model erozji pylowej asteroid

### `microbe_radiation_model/data/`

To jest kanoniczne miejsce danych dla kolegi od wizualizacji.

- `gamma_radiation_timeseries.json`
  - globalne rekordy UV / GCR / gamma dla przebiegow
- `rock_radiation_summary.json`
  - rekordy per typ skaly, wraz z temperaturami i hydrolyza
- `star_uv_profile.json`
  - profil UV gwiazd w funkcji odleglosci

## Co jest teraz najwazniejsze praktycznie

- jesli potrzebny jest glowny pipeline: `python3 run.py`
- jesli potrzebny jest format dla wizualizacji: patrz `microbe_radiation_model/data/*.json`

## Uwaga

- `pozostalosci/` i `srodowisko.ipynb` zostaly zachowane jako zrodla referencyjne,
  ale nie powinny byc traktowane jako glowny stan projektu.
