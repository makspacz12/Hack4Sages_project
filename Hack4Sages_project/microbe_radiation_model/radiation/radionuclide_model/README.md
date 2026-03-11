# radionuclide_model

Model wewnetrznych zrodel promieniowania w skale.

## Cel
- Zamiana skladu skaly (U-238, Th-232, K) na aktywnosc promieniotworcza.
- Oszacowanie uproszczonego wewnetrznego pola gamma.

## Struktura
- `constants.py`
  - stale konwersji (ppm/% -> Bq/kg)
- `activity.py`
  - `activity_from_rock`: aktywnosc specyficzna [Bq/kg]
  - `volumetric_activity_bq_m3`: aktywnosc objetosciowa [Bq/m^3]
- `geometry.py`
  - geometria skaly z masy i gestosci (objetosc, promien)
- `gamma.py`
  - `internal_gamma_rate_from_rock`: uproszczony model pola gamma
- `__init__.py`
  - eksport publicznego API podmodulu

## Wejscie
- Typ skaly: `Rock` z `microbe_radiation_model.materials.rocks`
- Parametry opcjonalne:
  - `uranium238_ppm`
  - `thorium232_ppm`
  - `potassium_percent`
  - `mass_kg`, `radius_m`, `density_kg_m3`

## Wyjscie
- `RadionuclideActivity`:
  - `u238_bq_kg`, `th232_bq_kg`, `k40_bq_kg`, `total_bq_kg`
- `RockGeometry`:
  - `mass_kg`, `density_kg_m3`, `volume_m3`, `radius_m`
- `InternalGammaField`:
  - `specific_activity_bq_kg`, `volumetric_activity_bq_m3`, `radius_m`,
    `gamma_mu_inv_m`, `internal_gamma_rate`

## Pipeline obliczen
1. sklad U/Th/K -> aktywnosc [Bq/kg]
2. aktywnosc [Bq/kg] -> [Bq/m^3] przez gestosc
3. masa + gestosc -> promien skaly
4. `A_v * (1 - exp(-mu * R)) / mu` -> wewnetrzny wskaznik pola gamma

## Uwagi
- Model jest uproszczony i celowo lekki obliczeniowo.
- Przyjeto jednorodna skale i kulista geometrie.
