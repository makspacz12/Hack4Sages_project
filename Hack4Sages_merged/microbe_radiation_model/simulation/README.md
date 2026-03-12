# simulation

Ten katalog jest sercem uruchomieniowym projektu i spina fizykę z dynamiką orbitalną.

## Co robi ta warstwa
- buduje obiekt `rebound.Simulation`
- integruje ruch ciał w czasie
- wyznacza odległości ciał od gwiazd
- uruchamia obliczenia promieniowania i aktualizuje ekspozycję
- zwraca raporty gotowe do wypisania w demach

## Moduły
- `builder.py`
  - tworzy symulację z opcjonalnymi planetami i gwiazdami Gaia
  - obsługuje wczytanie `nearest_50_gaia.csv`
  - zwraca: `sim`, `star_indices`, listę ciał permanentnych
- `config.py`
  - trzyma dataclass z parametrami materiałów i biegu symulacji
  - ustawia domyślne wartości dla prostych uruchomień
- `coupling.py`
  - bierze pozycje z REBOUND i zamienia je na lokalny krok promieniowania
  - wywołuje warstwę `radiation/` i zapisuje wynik do stanu ekspozycji
- `engine.py`
  - prowadzi główną pętlę `integrate -> nearest star -> radiation step`
  - zarządza tym, które ciała są śledzone
- `scenarios.py`
  - buduje scenariusze uruchomieniowe (z REBOUND i bez REBOUND)
  - formatuje raport tekstowy do konsoli
- `__main__.py`
  - pozwala uruchomić warstwę komendą modułową
- `__init__.py`
  - eksportuje najważniejsze funkcje tej warstwy

## Dane wejściowe i zależności
- wejście danych gwiazd: `nearest_50_gaia.csv`
- zależność opcjonalna: `rebound` (bez niej działa fallback statyczny)
- dane materiałowe: pobierane z `catalogs/` przez `config.py`
