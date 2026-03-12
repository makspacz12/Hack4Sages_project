# physics

Ten katalog zawiera podstawowe cegielki obliczeniowe niezależne od konkretnej symulacji.

## Co jest tutaj trzymane
- stałe fizyczne i astronomiczne
- definicja materiałów używanych przez model ekranowania
- funkcje geometrii kulistej dla skały i rdzenia biologicznego
- relacja masa gwiazdy -> jasność gwiazdy

## Moduły
- `constants.py`
  - trzyma wspólne stałe: `SOLAR_LUMINOSITY`, `SOLAR_MASS`, `AU`, `SECONDS_PER_YEAR`
  - jest importowany przez `radiation/` i `simulation/`
- `materials.py`
  - definiuje klasę `Material` (`name`, `density`, `k`)
  - ta klasa jest używana jako kontrakt danych pomiędzy warstwami
- `geometry.py`
  - liczy objętość i masę kuli oraz promień rdzenia biologicznego
  - funkcja `biological_core_radius` jest używana przy obliczeniach ekranowania
- `stellar_physics.py`
  - liczy jasność gwiazdy na podstawie masy (`kg` lub `M_sun`)
  - dostarcza wejście do obliczeń strumienia promieniowania
- `__init__.py`
  - eksportuje najważniejsze symbole, żeby warstwa wyżej mogła importować je wygodnie

## Wejście i wyjście tej warstwy
- wejście: liczby skalarne (masa, gęstość, promień)
- wyjście: wartości fizyczne gotowe do wykorzystania przez `radiation/` i `simulation/`
