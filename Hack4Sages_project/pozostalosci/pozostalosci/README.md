# pozostalosci

To jest właściwy katalog elementów nieaktywnych, historycznych lub eksperymentalnych.

## Moduły i artefakty
- `shielding_legacy.py`
  - starszy model tłumienia promieniowania dla jednorodnej skały
  - nie ma rdzenia biologicznego, więc działa jako prosty model referencyjny
- `obliczenia_k.py`
  - szkic miejsca pod późniejsze obliczenia współczynnika tłumienia `k`
  - obecnie nie jest podłączony do aktywnego pipeline'u
- `XCOM.exe`
  - zewnętrzne narzędzie pomocnicze, zostawione do potencjalnych badań materiałowych
- `__init__.py`
  - eksportuje wybrane elementy historyczne do importu zgodnościowego
- `aliasy_v1/`
  - archiwum usuniętych modułów aliasowych z poziomu głównego pakietu
  - referencja historyczna, nie element aktywnego runtime

## Status techniczny
- pliki tutaj nie biorą udziału w domyślnym uruchomieniu demo/symulacji
- są trzymane jako referencja i punkt startowy do dalszych eksperymentów
