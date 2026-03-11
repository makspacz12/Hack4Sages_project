# legacy

Ten katalog nie jest już miejscem aktywnego rozwoju. Służy wyłącznie zgodności wstecznej.

## Co jest tutaj
- `__init__.py` - alias eksportów do `microbe_radiation_model/pozostalosci/`
- `shielding_legacy.py` - alias do `pozostalosci/shielding_legacy.py`
- `obliczenia_k.py` - alias do `pozostalosci/obliczenia_k.py`

## Zasada użycia
- nowy kod powinien używać bezpośrednio `microbe_radiation_model/pozostalosci/`
- `legacy/` zostaje tylko po to, żeby stare importy nie przestały działać
