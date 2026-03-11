# radiation

Warstwa odpowiedzialna za modele promieniowania i ich skutki lokalne.

## Logika warstwy (high level)

1. `stellar/` wyznacza zewnetrzny strumien od gwiazdy.
2. `cosmic/` opisuje tlo promieniowania kosmicznego (GCR).
3. `shielding_model.py` liczy tlumienie strumienia w skale i rdzeniu bio.
4. `exposure_model.py` akumuluje ekspozycje w czasie (`exposure += flux * dt`).
5. `radionuclide_model/` modeluje wewnetrzne zrodla promieniowania w skale.

## Struktura katalogu

- `__init__.py`
  - publiczne API warstwy `radiation`
  - eksportuje funkcje stellar, cosmic, shielding i exposure

- `radiation_model.py`
  - wrapper kompatybilnosci (stary import)
  - przekierowuje do `stellar/radiation_model.py`

- `stellar/`
  - `radiation_model.py`: kanoniczny model strumienia gwiazdowego
  - `stellar_radiation.py`: wrapper kompatybilnosci
  - `__init__.py`: eksport `stellar_flux`, `stellar_flux_at_au`, `relative_flux`

- `cosmic/`
  - `cosmic_radiation_model.py`: bazowy flux GCR i podzial regionow (heliosfera / deep space)
  - `cosmic_spectrum.py`: podzial fluxu GCR na protony, hel i HZE
  - `__init__.py`: eksport publicznego API `cosmic`

- `shielding_model.py`
  - model Beer-Lamberta dla geometrii skala + centralny rdzen biologiczny
  - wynik: `RadiationPointResult` (sciezki, attenuation factors, local flux)

- `exposure_model.py`
  - `ExposureState` i aktualizacja dawki skumulowanej po kroku czasu

- `radionuclide_model/`
  - `activity.py`: sklad U/Th/K -> aktywnosc [Bq/kg]
  - `geometry.py`: geometria skaly (masa, objetosc, promien)
  - `gamma.py`: uproszczony model wewnetrznego pola gamma
  - `constants.py`: stale konwersji
  - `__init__.py`: eksport API podmodulu

## Granice odpowiedzialnosci

- Ta warstwa nie integruje orbit i nie steruje krokami REBOUND.
- Dostaje odleglosci i parametry materialowe, zwraca lokalne wyniki promieniowania.
- Integracja czasowa i dynamika orbitalna sa w `simulation/`.
- Zapisywanie danych wyjsciowych (JSON) jest poza ta warstwa i odbywa sie w
  `microbe_radiation_model/data_store.py` do katalogu `microbe_radiation_model/data/`.
