# Jak to uruchomić

Instrukcja po polsku, sprawdzona na Twoim komputerze. Każda komenda poniżej
została przeze mnie wykonana i działa.

Wersja angielska: [`RUNNING.md`](RUNNING.md).

---

## Najkrótsza wersja

Chcesz tylko zobaczyć program:

```bash
cd web
npm run dev
```

Otwórz adres, który się wypisze (zwykle `http://localhost:5173`). To wszystko.
`node_modules` jest już zainstalowane, więc `npm install` nie jest potrzebne.

---

## 1. Wizualizacja 3D

To jest ta część, której użyjesz na konferencji.

```bash
cd web
npm run dev
```

Vite wypisze adres. Jeśli port jest zajęty, wybierze następny wolny, albo
możesz wymusić konkretny:

```bash
npx vite --port 4321 --strictPort
```

> **Uwaga na port 3000.** Twój drugi projekt `spaceshield` go używa. Jeśli
> uruchomisz `npm run dev` i Vite weźmie 3000, przerwij (`Ctrl+C`) i użyj
> komendy z `--port 4321` powyżej.

### Wybór przebiegu symulacji

Domyślnie ładuje się przebieg **100 000-letni**. To on pokazuje wszystkie
dziesięć wykresów. Na biegu 3000-letnim praktycznie nic się nie dzieje: żaden
odłamek nie ginie, więc diagram fazowy nie ma czego narysować, a przeżywalność
zmienia się tylko 1,29 raza, czyli wychodzi płaska linia.

Pozostałe dwa:

```
http://localhost:5173/?replay=data/cosmos_visualizer_simulation.json
http://localhost:5173/?replay=data/run_1myr.json
```

Albo prościej: w programie menu **Analysis** → sekcja „simulation run".

### Testy wizualizacji

```bash
cd web
npm test
```

Powinno przejść **643 testy**.

---

## 2. Symulacja (model Pythonowy)

### WAŻNE: najpierw pełna ścieżka do katalogu `model/`

Terminal startuje zwykle w `C:\Windows\system32` albo w Twoim katalogu
domowym. `cd model` szuka podkatalogu **względem miejsca, w którym stoisz**,
więc zadziała dopiero wtedy, gdy już jesteś w repozytorium. Najpewniej jest
podać pełną ścieżkę:

```powershell
cd C:\Users\Maksg\Desktop\hack4_sages_nowy\model
```

Sprawdzenie, czy jesteś we właściwym miejscu:

```powershell
python -c "import rebound; print(rebound.__version__)"
```

Powinno wypisać `5.1.1`.

**Dlaczego katalog ma znaczenie.** Nie chodzi o REBOUND, ten jest zainstalowany
globalnie i widać go zewsząd. Chodzi o pakiet `microbe_radiation_model`, który
leży wewnątrz `model/`. Python szuka pakietów w bieżącym katalogu, więc
uruchomiony gdzie indziej powie:

```
No module named microbe_radiation_model
```

To nie jest zepsuta instalacja, tylko zły katalog.

### Sprawdzenie bez uruchamiania

Zanim odpalisz długi bieg, zobacz, co program zamierza zrobić:

```bash
cd model
python -m microbe_radiation_model --asteroids 14 --years 3000 --dt 20 --seed 42 --dry-run
```

Wypisze pełną konfigurację i zakończy się bez liczenia.

### Prawdziwy bieg

```bash
cd model
python -m microbe_radiation_model --asteroids 14 --years 3000 --dt 20 --seed 42
```

**Ile to trwa.** Koszt zależy od liczby klatek, nie od długości symulacji.
Zmierzone na Twoim komputerze: około **3,2 sekundy na klatkę**.

| Komenda | Klatek | Czas | Rozmiar pliku |
|---|---|---|---|
| `--years 300 --dt 20` | 16 | ~50 s | 0,8 MB |
| `--years 3000 --dt 20` | 151 | ~8 min | 7,0 MB |
| `--years 100000 --dt 1000` | 101 | ~5 min | 4,9 MB |
| `--years 1000000 --dt 5000` | 201 | ~11 min | 9,7 MB |

Bieg 1 mln lat potrafi trwać dłużej, bo IAS15 zagęszcza krok przy bliskich
przelotach obok planet.

### Najważniejsze przełączniki

| Przełącznik | Znaczenie | Domyślnie |
|---|---|---|
| `--asteroids N` | ile odłamków | 25 |
| `--years Y` | ile lat symulować | 2,5 |
| `--dt D` | ile lat na klatkę | 0,025 |
| `--seed S` | ziarno losowania | losowe |
| `--dry-run` | tylko pokaż konfigurację | — |
| `--no-planets` | wyłącz grawitację planet | — |
| `--no-erosion` | wyłącz erozję pyłową | — |

**O ziarnie.** To samo `--seed` daje **identyczny co do bitu** wynik.
Sprawdziłem to: dwa biegi 1 mln lat z `--seed 42` dały te same siedem
zniszczonych odłamków i zerową różnicę dawki.

### Testy modelu

```bash
cd model
python -m pytest -q
```

Powinno przejść **290 testów**.

---

## 3. Przeniesienie wyniku do wizualizacji

```bash
python tools/export_simulation_to_web.py
```

Uruchamiaj z katalogu głównego repozytorium (nie z `model/`).

### ⚠️ Ostrzeżenie przed konferencją

**Ta komenda nadpisze replay, pod który skalibrowane są wszystkie wykresy.**

Obecnie:
- `web/public/data/cosmos_visualizer_simulation.json` — 151 klatek, 3000 lat
- `model/microbe_radiation_model/data/` — cokolwiek ostatnio policzyłeś

Jeśli w katalogu modelu leży krótki bieg testowy, eksport zastąpi nim replay
konferencyjny. Jest test, który to wykryje (`npm test` zacznie padać), ale
**przed prezentacją najbezpieczniej po prostu tego nie uruchamiać**.

Bezpieczne sprawdzenie, co by się stało:

```bash
python tools/export_simulation_to_web.py --check
```

Nic nie zapisuje, tylko raportuje.

---

## 4. Typowe problemy

### „No module named microbe_radiation_model"

Jesteś poza katalogiem `model/`. Podaj pełną ścieżkę:

```powershell
cd C:\Users\Maksg\Desktop\hack4_sages_nowy\model
```

### „cd : Cannot find path ... because it does not exist"

To samo: `cd model` działa tylko wtedy, gdy stoisz już w katalogu
`hack4_sages_nowy`. Z `C:\Windows\system32` trzeba pełnej ścieżki.

### Port zajęty

```bash
cd web
npx vite --port 4321 --strictPort
```

### Symulacja trwa bardzo długo i nic nie pisze

To normalne. Program wypisuje wynik dopiero na końcu. Sprawdź, czy plik rośnie:

```bash
ls -la model/microbe_radiation_model/data/cosmos_visualizer_simulation.json
```

### Chcę szybki bieg testowy

```bash
cd model
python -m microbe_radiation_model --asteroids 5 --years 100 --dt 20 --seed 1
```

Około 20 sekund.

### Testy padają po moich zmianach

Uruchom pojedynczy plik, żeby zobaczyć, który dokładnie:

```bash
cd web
npx vitest run tests/nazwa.test.js
```

---

## 5. Struktura katalogów

```
hack4_sages_nowy/
├── model/          symulacja Pythonowa  (uruchamiaj STĄD)
│   └── microbe_radiation_model/   90 modułów
├── web/            wizualizacja 3D      (uruchamiaj STĄD)
│   ├── src/            57 modułów JavaScript
│   ├── tests/          643 testy
│   └── public/data/    pliki replay
├── analysis/       analiza w R i Pythonie
├── tools/          skrypt eksportu      (uruchamiaj z KORZENIA)
├── PRZEWODNIK.md   opis programu po polsku
├── URUCHAMIANIE.md ten plik
├── README.md       opis projektu po angielsku
└── OPRACOWANIE.md  Twoje prywatne notatki (nie idzie na GitHub)
```

**Zasada:** `model/` i `web/` uruchamiasz z ich własnych katalogów,
`tools/` z katalogu głównego.
