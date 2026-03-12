# materials/rocks

Kanoniczna warstwa definicji skal w projekcie.

## Co tu jest
- `types.py`
  - dataclass `Rock` z parametrami geometrii i skladu
- `variants.py`
  - domyslne warianty (`BASALT`, `CHONDRITE`, `ICE_RICH`, `DEFAULT_ROCK_VARIANTS`)
- `params.py`
  - helper do rozstrzygania parametrow (`get_rock_param`)
- `utils.py`
  - narzedzia (`get_rock_by_name`, `normalize_probabilities`)
- `__init__.py`
  - wspolne eksporty API

## Zasada
- Nowe warianty skal dodawaj tutaj, nie w `catalogs/`.
- `catalogs/` jest tylko warstwa kompatybilnosci dla starszych importow.
