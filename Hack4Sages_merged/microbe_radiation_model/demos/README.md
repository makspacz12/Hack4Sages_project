# demos

Ten katalog zawiera skrypty, które uruchamiamy ręcznie podczas testowania i prezentacji.

## Moduły
- `console.py`
  - ustawia UTF-8 dla poprawnego wyświetlania polskich komunikatów
- `demo.py`
  - łączy szybki test fizyczny (`mass -> luminosity -> flux`) z pełnym raportem scenariusza
- `run_radiation_demo.py`
  - uruchamia statyczny pipeline promieniowania (bez REBOUND)
  - przydatny do szybkiej walidacji matematyki modelu
- `run_simulation.py`
  - uruchamia scenariusz połączony (z REBOUND, jeśli jest dostępny)
- `__init__.py`
  - eksponuje funkcje `main_*` i helper konsolowy

## Kiedy używać którego pliku
- szybkie sprawdzenie działania całego projektu: `demo.py`
- test samego łańcucha promieniowania: `run_radiation_demo.py`
- uruchomienie pełnego runnera: `run_simulation.py`
