# radiation

To jest warstwa modelu odpowiedzialna bezpośrednio za promieniowanie i jego skutki.

## Pipeline tej warstwy
1. `radiation_model.py` liczy strumień promieniowania od gwiazdy.
2. `shielding_model.py` tłumi ten strumień wewnątrz skały i rdzenia biologicznego.
3. `exposure_model.py` aktualizuje ekspozycję skumulowaną w czasie.

## Moduły
- `radiation_model.py`
  - `stellar_flux` i `stellar_flux_at_au` implementują prawo odwrotności kwadratu
  - `relative_flux` daje szybkie skalowanie względem odległości referencyjnej
- `shielding_model.py`
  - opisuje geometrię przenikania promieniowania przez skałę i rdzeń bio
  - zwraca `RadiationPointResult` ze szczegółami ścieżki i tłumienia
  - używa klasy `Material` z `physics/materials.py`
- `exposure_model.py`a
  - trzyma stan `ExposureState`
  - aktualizuje dawkę wzorem `exposure += local_flux * dt`
- `__init__.py`
  - eksportuje API warstwy promieniowania do wygodnego importu w `simulation/` i `demos/`

## Granice odpowiedzialności
- ta warstwa nie zna orbity i czasu symulacji REBOUND
- dostaje gotowe odległości/parametry i zwraca lokalne wyniki promieniowania
