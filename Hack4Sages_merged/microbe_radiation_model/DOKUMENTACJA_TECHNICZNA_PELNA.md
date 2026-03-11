# Dokumentacja Techniczna Pelna

## 1. Co to jest ten projekt

`microbe_radiation_model` to model, ktory laczy:
- fizyke gwiazd (masa -> jasnosc),
- transport promieniowania (strumien i tlumienie w skale),
- akumulacje dawki w czasie,
- opcjonalna dynamike orbitalna (REBOUND),
- modele wewnetrznej radioaktywnosci skaly (U/Th/K -> aktywnosc -> gamma),
- gotowe entrypointy do uruchamiania i raportowania.

Glowny cel: oszacowac, jakie promieniowanie dociera do centrum obiektu skalnego
z rdzeniem biologicznym i jaka dawka skumulowana narasta w czasie.

---

## 2. Struktura logiczna i odpowiedzialnosci

## 2.1 Poziom pakietu

Plik: `microbe_radiation_model/__init__.py`

Eksportuje skrocone API:
- `build_simulation`
- `run_simulation`
- `run_static_radiation_demo`
- `run_connected_demo`
- `format_demo_report`

To jest warstwa "publiczna", zeby szybko odpalic pipeline bez chodzenia po
kazdym podkatalogu.

## 2.2 `physics/` - podstawy fizyczne

### `physics/constants.py`

Trzyma stale uzywane przez caly model:
- `SOLAR_LUMINOSITY = 3.828e26 W`
- `SOLAR_MASS = 1.989e30 kg`
- `AU = 1.496e11 m`
- `SECONDS_PER_YEAR = 365.25 * 24 * 3600 s`

Dlaczego to wazne: ten sam zestaw stalych jest uzywany wszedzie, wiec nie ma
rozjazdow jednostek miedzy modulami.

### `physics/stellar_physics.py`

Liczy jasnosc gwiazdy ciagu glownego:
- `stellar_luminosity_from_mass(mass_kg)`
- `stellar_luminosity_from_solar_mass(mass_solar)`

Model:
- `L = L_sun * (M/M_sun)^3.5`

To jest empiryczna relacja masa-jasnosc dla gwiazd ciagu glownego.

### `physics/materials.py`

Definiuje material:
- `Material(name, density, k)`

Interpretacja:
- `density` [kg/m^3]
- `k` - wspolczynnik tlumienia uzywany przez prawo Beer-Lamberta.

### `physics/geometry.py`

Narzedia geometrii:
- objetosc kuli,
- masa z promienia i gestosci,
- promien z masy i gestosci,
- promien rdzenia biologicznego `biological_core_radius(...)`.

Fizyka:
- `V = 4/3 * pi * R^3`
- `m = rho * V`

Rdzen bio:
- masa rdzenia = `bio_mass_fraction * masa_skaly`
- promien rdzenia odtwarzany z jego masy i gestosci.

## 2.3 `materials/rocks/` - kanoniczny model skaly

To jest jedno zrodlo prawdy dla definicji skał.

### `materials/rocks/types.py`

`Rock` zawiera parametry domyslne:
- geometria (`radius_m`)
- material (`density_kg_m3`, `albedo`)
- populacja (`probability`)
- sklad radiogeniczny (`uranium238_ppm`, `thorium232_ppm`, `potassium_percent`)
- `extra` na rozszerzenia.

### `materials/rocks/variants.py`

Domyslne warianty:
- `BASALT`
- `CHONDRITE`
- `ICE_RICH`
- lista `DEFAULT_ROCK_VARIANTS`

### `materials/rocks/params.py`

`get_rock_param(...)` rozstrzyga wartosc parametru wg priorytetu:
1. jawna wartosc argumentu,
2. wartosc z hooka,
3. pole z obiektu `Rock`,
4. `rock.extra[field_name]`,
5. `default`.

To jest centralna logika "skad brac parametr".

### `materials/rocks/utils.py`

Narzedia:
- `get_rock_by_name`
- `normalize_probabilities`

## 2.4 `catalogs/` - kompatybilnosc historyczna

Warstwa zgodnosci dla starszych importow.

### `catalogs/asteroid_properties.py`

Eksportuje:
- `DEFAULT_ROCK_VARIANTS` (z `materials/rocks`)
- alias `RockVariant = Rock`

### `catalogs/rock_material.py`

Alias typu:
- `RockVariant` wskazuje na `materials.rocks.types.Rock`

## 2.5 `radiation/` - promieniowanie zewnetrzne i dawka

### `radiation/radiation_model.py`

Model strumienia gwiazdowego:
- `stellar_flux(luminosity_w, distance_m)`
- `stellar_flux_at_au(luminosity_w, distance_au)`
- `relative_flux(distance_au, reference_distance_au)`

Fizyka:
- `F = L / (4 * pi * r^2)`
- `relative_flux = (r_ref / r)^2`

### `radiation/shielding_model.py`

Model tlumienia promieniowania w obiekcie:
- zewnetrzna warstwa skalna,
- centralny rdzen biologiczny.

Kluczowe funkcje:
- `attenuation_factor(path_length, density, k)`
- `radiation_at_point_in_rock_with_bio_core(...)`
- `radiation_at_points_in_rock_with_bio_core(...)`

Fizyka:
- Beer-Lambert: `I = I0 * exp(-k * rho * x)`

Wyjscie:
- `RadiationPointResult` (drogi w skale i bio, wspolczynniki tlumienia,
  lokalny strumien `local_flux`).

### `radiation/exposure_model.py`

Akumulacja dawki:
- `ExposureState(cumulative_exposure)`
- `update_exposure(state, local_flux, dt)`

Fizyka:
- `E += F_local * dt`
- jednostki: `[W/m^2] * [s] = [J/m^2]`.

## 2.6 `radiation/radionuclide_model/` - zrodla wewnetrzne

To osobny podmodel: promieniowanie produkowane przez sama skale.

### `constants.py`

Stale konwersji skladu na aktywnosc:
- `U238_BQ_PER_KG_PER_PPM = 12.4`
- `TH232_BQ_PER_KG_PER_PPM = 4.1`
- `K40_BQ_PER_KG_PER_PERCENT_K = 313.0`

### `activity.py`

Liczy aktywnosc:
- `activity_from_rock(...)` -> `RadionuclideActivity`
- `volumetric_activity_bq_m3(...)`

Fizyka:
- aktywnosc specyficzna [Bq/kg] z koncentracji U/Th/K,
- aktywnosc objetosciowa: `A_v = A_m * rho`.

### `geometry.py`

Geometria kuli z masy i gestosci:
- `V = m/rho`
- `R = ((3V)/(4pi))^(1/3)`

### `gamma.py`

Uproszczone pole gamma w centrum jednorodnej kuli:
- `internal_gamma_rate_from_rock(...)` -> `InternalGammaField`

Model:
- `gamma_rate ~ A_v * (1 - exp(-mu * R)) / mu`

To jest model przyblizony (nie pelny transport Monte Carlo).

## 2.7 `simulation/` - petla czasowa i integracja z REBOUND

### `simulation/builder.py`

Buduje `rebound.Simulation`:
1. dodaje Slonce (`m=1.0` w jednostkach REBOUND),
2. opcjonalnie dodaje planety z `_PLANET_DATA` (masa i polos wielka),
3. opcjonalnie wczytuje gwiazdy z `nearest_50_gaia.csv`,
4. zwraca `(sim, star_indices, solar_system_bodies, n_permanent)`.

Konwersja danych Gaia:
- wejscie: `ra` [deg], `dec` [deg], `distance_pc` [pc], `mass_flame`,
- konwersja pozycji do XYZ [AU]:
  - `r_au = distance_pc * 206264.806...`
  - klasyczna transformacja sferyczna na kartezjanska.

### `simulation/config.py`

Konfiguracja uruchomienia:
- `SimulationMaterialConfig`
- `SimulationRunConfig`
- `default_material_config()`

Domyslnie:
- skala: pierwszy element `DEFAULT_ROCK_VARIANTS`
- promien skaly: z wariantu albo fallback `0.5 m`
- `bio_mass_fraction = 0.01`
- `dt_yr = 1/365.25`, `n_steps = 10`, `add_test_particle = True`
- domyslny plik danych: `nearest_50_gaia.csv`

### `simulation/coupling.py`

Most miedzy orbitami i promieniowaniem:
1. bierze pozycje `star` i `body` z REBOUND,
2. liczy odleglosc [AU] i [m],
3. liczy `surface_flux`,
4. liczy promien rdzenia bio,
5. liczy lokalny strumien w centrum skaly,
6. aktualizuje ekspozycje.

### `simulation/engine.py`

Glowna petla:
1. buduje symulacje (lub bierze podana),
2. opcjonalnie dodaje test particle,
3. tworzy `ExposureState` dla sledzonych cial,
4. dla kazdego kroku:
   - `sim.integrate(sim.t + dt_yr)`
   - wybiera najblizsza gwiazde (`nearest_star_index`)
   - liczy jasnosc tej gwiazdy
   - wykonuje krok promieniowania (`process_radiation_step`)
5. zwraca stan koncowy i ekspozycje.

### `simulation/scenarios.py`

Gotowe scenariusze:
- `run_static_radiation_demo(...)`
- `run_connected_demo(...)`
- `format_demo_report(...)`

Scenariusz connected:
- jezeli `rebound` nie jest dostepny, automatycznie fallback do trybu statycznego.

Wyjscie:
- `SimulationReport` (tryb, fluxy, czas, liczba cial, dawki).

### `simulation/__main__.py`

CLI:
- `python -m microbe_radiation_model.simulation`

## 2.8 `demos/` - entrypointy uruchomieniowe

### `demos/console.py`

`configure_utf8_output()` ustawia UTF-8 na `stdout`.

### `demos/demo.py`

Pokazuje:
1. szybki test `M -> L -> F(1AU), F(2AU)`,
2. pelny raport scenariusza (`run_connected_demo`).

### `demos/run_radiation_demo.py`

Uruchamia tylko demo statyczne (bez REBOUND).

### `demos/run_simulation.py`

Uruchamia scenariusz connected (z fallbackiem).

---

## 3. Dodatkowy modul: `internal_heat/`

To osobny podmodel produkcji ciepla radiogenicznego.

### `internal_heat/constants.py`

Wspolczynniki ciepla dla U/Th/K w jednostkach:
- `microW / kg / mass_fraction`

### `internal_heat/model.py`

Glowna funkcja:
- `heat_production_from_rock(...)` -> `RadiogenicHeatResult`

Liczy:
1. konwersje ppm i % do ulamka masowego,
2. moc cieplna na kg [W/kg],
3. moc cieplna objetosciowa [W/m^3],
4. opcjonalnie moc calkowita [W] jesli znana masa.

To nie jest domyslnie podpiete do glownej petli `simulation/`, ale korzysta z
tego samego modelu `Rock`.

---

## 4. Jakie dane sa pobierane i skad

## 4.1 Dane lokalne w repo

### `nearest_50_gaia.csv`

Wczytywany przez `simulation/builder.py` (jesli podany `gaia_csv_path`).

Wykorzystane kolumny:
- `ra`
- `dec`
- `distance_pc`
- `mass_flame` (opcjonalnie; fallback na `0.1` masy Slonca)

Pozostale kolumny w pliku nie sa wymagane przez runtime symulacji.

### Presety skal

Wczytywane z:
- `microbe_radiation_model/materials/rocks/variants.py`

### Parametry planet

Zaszyte w kodzie:
- `simulation/builder.py` (`_PLANET_DATA`)

## 4.2 Dane z notebooka

`srodowisko.ipynb` jest plikiem roboczym/archiwalnym.
Aktualny runtime nie zalezy od notebooka i nie wykonuje jego audytu.

## 4.3 Zaleznosci zewntrzne

Z `requirements.txt` najwazniejsze runtime:
- `rebound` (dla dynamiki orbitalnej)
- `numpy/pandas/...` (narzedzia ogolne)

Jesli `rebound` nie jest zainstalowany:
- dziala tryb statyczny (bez integracji orbitalnej).

---

## 5. Fizyka krok po kroku (pelny pipeline)

## 5.1 Gwiazda -> jasnosc

Wejscie:
- masa gwiazdy [M_sun] lub [kg]

Model:
- `L = L_sun * (M/M_sun)^3.5`

Wyjscie:
- `L` [W]

## 5.2 Jasnosc -> strumien na powierzchni skaly

Wejscie:
- `L` [W]
- odleglosc `r` [m]

Model:
- `F_surface = L / (4*pi*r^2)`

Wyjscie:
- `F_surface` [W/m^2]

## 5.3 Geometria rdzenia bio

Wejscie:
- promien skaly,
- gestosc skaly i bio,
- udzial masowy bio.

Model:
- masa skaly z geometrii kuli,
- masa bio = frakcja * masa skaly,
- promien bio odtworzony z masy i gestosci.

Wyjscie:
- `bio_radius` [m]

## 5.4 Tlumienie w skale i rdzeniu

Wejscie:
- `F_surface`
- `path_in_rock`, `path_in_bio`
- parametry materialow (`rho`, `k`)

Model:
- `att_rock = exp(-k_rock * rho_rock * path_rock)`
- `att_bio = exp(-k_bio * rho_bio * path_bio)`
- `F_local = F_surface * att_rock * att_bio`

Wyjscie:
- `F_local` [W/m^2]

## 5.5 Akumulacja dawki

Wejscie:
- `F_local` [W/m^2]
- `dt` [s]

Model:
- `E += F_local * dt`

Wyjscie:
- `E` [J/m^2]

## 5.6 (Opcjonalnie) zrodla wewnetrzne

Z podmodulu radionuklidowego:
- sklad U/Th/K -> aktywnosc [Bq/kg]
- aktywnosc * gestosc -> [Bq/m^3]
- model przyblizony pola gamma.

---

## 6. Co dzieje sie podczas uruchomienia symulacji

Poniżej realna sekwencja dla `run_connected_demo()`:

1. Sprawdzenie dostepnosci `rebound`.
2. Jesli brak `rebound` -> natychmiastowy fallback do `run_static_radiation_demo`.
3. Jesli `rebound` jest:
   - budowa symulacji (`build_simulation`),
   - dodanie Slonca, planet i gwiazd z Gaia (opcjonalnie),
   - opcjonalne dodanie test particle,
   - inicjalizacja `ExposureState` dla sledzonych cial.
4. Petla `n_steps`:
   - integracja orbitalna o `dt_yr`,
   - dla kazdego sledzonego ciala:
     - wybor najblizszej gwiazdy,
     - masa gwiazdy -> jasnosc,
     - odleglosc -> strumien na powierzchni,
     - tlumienie w skale i bio,
     - update dawki skumulowanej.
5. Zlozenie `SimulationReport`.
6. Formatowanie tekstowe raportu przez `format_demo_report`.

---

## 7. Jak uruchomic (praktycznie)

W katalogu repo:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 7.1 Szybki test calego projektu

```powershell
python -m microbe_radiation_model.demos.demo
```

Dostajesz:
- test `Masa -> Jasnosc -> Strumien`,
- pelny raport demo.

### 7.2 Tylko pipeline promieniowania (bez REBOUND)

```powershell
python -m microbe_radiation_model.demos.run_radiation_demo
```

### 7.3 Pipeline polaczony (REBOUND + promieniowanie)

```powershell
python -m microbe_radiation_model.demos.run_simulation
```

Jesli `rebound` nie dziala, automatycznie zobaczysz tryb `static_radiation`.

### 7.4 Entry point pakietu simulation

```powershell
python -m microbe_radiation_model.simulation
```

### 7.5 Runner raportow runtime

```powershell
python run.py
```

`run.py` uruchamia raport statyczny i raport connected.

---

## 8. Jak czytac raport wyjsciowy

Przyklad pol:
- `Tryb`: `static_radiation` albo `rebound_pipeline`
- `Odleglosc od gwiazdy` [AU]
- `Strumien na powierzchni skaly` [W/m^2]
- `Strumien w centrum biologicznym` [W/m^2]
- `Krok czasu ekspozycji` [s]
- `Czas koncowy symulacji` [roku]
- `Liczba cial stalych`
- `Cialo N: ekspozycja skumulowana = ... [J/m^2]`

Interpretacja:
- `local_flux` pokazuje, ile promieniowania dociera do chronionego punktu,
- `cumulative_exposure` pokazuje dawke narosnieta po wielu krokach czasu.

---

## 9. Zalozenia i ograniczenia modelu

1. Relacja `L ~ M^3.5` jest uproszczeniem dla gwiazd ciagu glownego.
2. Tlumienie Beer-Lamberta jest modelem efektywnym (brak pelnego transportu czastek).
3. Skala i rdzen sa modelowane jako obiekty kuliste i jednorodne.
4. W symulacji promieniowania lokalny punkt probkowania to `(0,0,0)` (centrum).
5. Podmodel gamma wewnetrznego to przyblizenie, nie Monte Carlo.
6. Dane Gaia sa traktowane statycznie po zaladowaniu (gwiazdy dodane jako punkty o stalej predkosci 0).

---

## 10. Gdzie rozwijac projekt dalej

1. Dodanie sprzezenia `internal_heat` + `radionuclide_model` do glownego raportu.
2. Rozszerzenie modelu tlumienia o energie-zalezny przekroj.
3. Wiecej scenariuszy i parser CLI argumentow (czas, liczba krokow, skala, sklad).
4. Dodanie testow jednostkowych dla:
   - integralnosci jednostek,
   - zachowania granicznego (`distance -> 0`, `bio_mass_fraction -> 0/1`),
   - regresji raportu.

