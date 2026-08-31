# Przygotowanie na konferencję — dokument pełny

Dokument po polsku. Obejmuje **całość projektu**: pytanie naukowe, każdy wzór,
każdą decyzję projektową, przepływ danych od uderzenia w Marsa do piksela na
ekranie, wszystkie wykresy, cały interfejs, oraz odpowiedzi na pytania, które
mogą paść z sali.

Każda liczba w tym dokumencie została przeze mnie odczytana z kodu albo
policzona z danych. Nie ma tu wartości „z pamięci".

Dokumenty pokrewne: [`PRZEWODNIK.md`](PRZEWODNIK.md) (krótszy opis użytkowy),
[`URUCHAMIANIE.md`](URUCHAMIANIE.md) (komendy),
[`CONFERENCE_THEORY.md`](CONFERENCE_THEORY.md) (wersja angielska, twierdzenia T1–T11).

---

## Spis treści

**CZĘŚĆ I — NAUKA**
1. [Pytanie i dlaczego jest otwarte](#1-pytanie-i-dlaczego-jest-otwarte)
2. [Architektura: trzy warstwy](#2-architektura-trzy-warstwy)
3. [Pełny łańcuch fizyczny](#3-pełny-łańcuch-fizyczny)
4. [Wszystkie wzory](#4-wszystkie-wzory)
5. [Dynamika orbitalna](#5-dynamika-orbitalna)
6. [Promieniowanie: trzy kanały](#6-promieniowanie-trzy-kanały)
7. [Osłona i jej granice](#7-osłona-i-jej-granice)
8. [Termika](#8-termika)
9. [Chemia: hydroliza DNA](#9-chemia-hydroliza-dna)
10. [Biologia: funkcja przeżycia](#10-biologia-funkcja-przeżycia)
11. [Erozja pyłowa](#11-erozja-pyłowa)

**CZĘŚĆ II — WYNIKI**
12. [Trzy przebiegi, trzy odpowiedzi](#12-trzy-przebiegi-trzy-odpowiedzi)
13. [Wynik główny i dlaczego nie jest liczbą](#13-wynik-główny-i-dlaczego-nie-jest-liczbą)
14. [Dwa odkrycia, których nie szukaliśmy](#14-dwa-odkrycia-których-nie-szukaliśmy)

**CZĘŚĆ III — INTERFEJS**
15. [Filozofia projektowa UI](#15-filozofia-projektowa-ui)
16. [Anatomia ekranu](#16-anatomia-ekranu)
17. [Wizualizacja 3D: każda decyzja](#17-wizualizacja-3d-każda-decyzja)
18. [Wszystkie wykresy](#18-wszystkie-wykresy)
19. [Tryb prezentacji](#19-tryb-prezentacji)

**CZĘŚĆ IV — RZETELNOŚĆ**
20. [Czego model nie robi](#20-czego-model-nie-robi)
21. [Jak weryfikowaliśmy](#21-jak-weryfikowaliśmy)
22. [Błędy, które znaleźliśmy u siebie](#22-błędy-które-znaleźliśmy-u-siebie)
23. [Prowenancja i odtwarzalność](#23-prowenancja-i-odtwarzalność)

**CZĘŚĆ V — OBRONA**
24. [Pytania trudne z odpowiedziami](#24-pytania-trudne-z-odpowiedziami)
25. [Czego NIE mówić](#25-czego-nie-mówić)
26. [Scenariusz wystąpienia](#26-scenariusz-wystąpienia)
27. [Bibliografia](#27-bibliografia)

---

# CZĘŚĆ I — NAUKA

## 1. Pytanie i dlaczego jest otwarte

### Hipoteza

**Litopanspermia**: życie może przenosić się między ciałami niebieskimi wewnątrz
odłamków skalnych wyrzuconych po uderzeniu meteorytu.

### Co już wiemy na pewno

Na Ziemi znaleziono **ponad 300 meteorytów marsjańskich**. Transport materii
z Marsa na Ziemię jest więc faktem obserwacyjnym, nie hipotezą. Wieki cząstkowe
z ekspozycji na promieniowanie kosmiczne dają czasy przelotu od **0,35 do 16
milionów lat** (Gladman et al. 1996), przy czym istnieje szybki kanał
dostarczający materiał w mniej niż milion lat.

### Co pozostaje otwarte

Czy **cokolwiek żywego** przetrwałoby taki lot. Tu wchodzi ten model.

### Dlaczego to jest trudne pytanie

Bo odpowiedź zależy od stałej, której **nikt nie zna dokładnie**. Współczynnik
inaktywacji radiacyjnej `c_rad` jest w literaturze podawany w paśmie
rozciągającym się na **czynnik 17**. Ponieważ wchodzi do wykładnika, przekłada
się to na **43 rzędy wielkości** w wyniku końcowym.

To nie jest wada modelu. To stan wiedzy, i uczciwe narzędzie musi go pokazać,
zamiast wybrać jedną wartość i podać jeden wynik.

---

## 2. Architektura: trzy warstwy

```
┌─────────────────────────────────────────────────────────────┐
│  analysis/     R + Python                                   │
│  wyznaczenie współczynników przeżycia z literatury          │
└────────────────────────┬────────────────────────────────────┘
                         │ współczynniki
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  model/        Python, 90 modułów                           │
│  REBOUND (orbity) + promieniowanie + termika + chemia       │
│  + biologia → plik replay JSON                              │
└────────────────────────┬────────────────────────────────────┘
                         │ tools/export_simulation_to_web.py
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  web/          JavaScript, 57 modułów, Three.js + Vite      │
│  scena 3D + 9 wykresów + tryb prezentacji                   │
└─────────────────────────────────────────────────────────────┘
```

### Dlaczego taki podział

**Decyzja projektowa 1: model liczy raz, przeglądarka przelicza wiele razy.**

Symulacja 3000 lat trwa około ośmiu minut. Gdyby każda zmiana `c_rad` wymagała
nowego biegu, interaktywność byłaby niemożliwa.

Rozwiązaniem jest **eksport dawki skumulowanej zamiast samego wyniku**.
Ponieważ funkcja przeżycia faktoryzuje się dokładnie (§10), przeglądarka może
podstawić dowolne `c_rad` i policzyć odpowiedź w mikrosekundach.

To jest architektoniczna konsekwencja wyboru fizycznego, a nie odwrotnie.

### Rozmiary warstw

| Warstwa | Moduły | Testy |
|---|---|---|
| `model/` | 90 plików Python | 290 |
| `web/` | 57 plików JavaScript | 638 |
| `analysis/` | R + Python | — |

---

## 3. Pełny łańcuch fizyczny

### W jednym zdaniu

> Masa gwiazdy → jasność → strumień na powierzchni skały → tłumienie
> Beer-Lamberta → dawka w rdzeniu biologicznym; **równolegle** temperatura →
> szybkość hydrolizy DNA. Oba kanały wchodzą do funkcji przeżycia jako suma
> wykładników.

### Rozpisane

```
MASA GWIAZDY
    │  L = L☉ · (M/M☉)^3.5
    ▼
JASNOŚĆ
    │  F = L / (4πd²)
    ▼
STRUMIEŃ NA POWIERZCHNI ────────────┐
    │                               │
    │ tłumienie exp(−k·ρ·x)         │ równowaga radiacyjna
    ▼                               ▼
DAWKA W RDZENIU                  TEMPERATURA
    │                               │  Arrhenius
    │                               ▼
    │                          SZYBKOŚĆ HYDROLIZY
    │                               │
    └───────────┬───────────────────┘
                ▼
      N/N₀ = exp(−c_rad·D − c_hyd·H)
                │
                ▼
          PRZEŻYWALNOŚĆ
```

**Równolegle**, niezależnie od powyższego:

```
GALAKTYCZNE PROMIENIOWANIE KOSMICZNE (spoza Układu Słonecznego)
    │  ~0,194 Gy/rok przy zerowej osłonie
    │  tłumione własnym k (160 g/cm²)
    ▼
DOMINUJĄCY WKŁAD DO DAWKI  ← to jest główny zabójca
```

oraz:

```
ROZPAD PROMIENIOTWÓRCZY W SAMEJ SKALE (U, Th, K)
    │  współczynniki Cresswell et al. (2018)
    ▼
WKŁAD ZNIKOMY: 0,042% całości
```

---

## 4. Wszystkie wzory

Tabela referencyjna. Kolumna „gdzie" wskazuje plik w `model/microbe_radiation_model/`.

| # | Krok | Wzór | Gdzie |
|---|---|---|---|
| 1 | Jasność gwiazdy | `L = L☉ · (M/M☉)^3,5` | `physics/stellar_physics.py` |
| 2 | Strumień | `F = L / (4πd²)` | `radiation/stellar/radiation_model.py` |
| 3 | Rdzeń biologiczny | `m_core = f·m_rock`, `R_core` z masy i ρ | `physics/geometry.py` |
| 4 | Tłumienie | `A = exp(−k·ρ·x)` | `radiation/shielding_model.py` |
| 5 | Dawka | `E += F_local · dt` | `radiation/exposure_model.py` |
| 6 | Rozpad wewnętrzny | U/Th/K → Bq → dawka α/β/γ | `radiation/radionuclide_model/gamma.py` |
| 7 | Temperatura powierzchni | `T = ((1−A)·F / 4σ)^(1/4)` | `thermal/surface_temperature.py` |
| 8 | Temperatura wnętrza | `T(r) = T_s + Q/(6k_th)·(R² − r²)` | `thermal/internal_profile.py` |
| 9 | Hydroliza | `k = A·exp(−Ea/R_gT) · a_w · w_water` | `chemistry/hydrolysis_model.py` |
| 10 | Przeżycie | `N/N₀ = exp(−(kill_rad + kill_hyd)·t)` | `biology/survival.py` |
| 11 | Ciśnienie promieniowania | `β = 3LQ_pr / (16πcGMρs)` | `radiation/pressure.py` |
| 12 | Erozja | `dR/dt = −(Y·Φ)/(4ρ)` | `erosion/dust.py` |

### Stałe użyte w modelu

| Stała | Wartość | Źródło |
|---|---|---|
| kalibracja GCR | **0,194 Gy/rok** na jednostkę modelową | Mileikowsky et al. (2000), Tab. IV |
| `k` fotony | **0,01 m²/kg** → 3,3 cm w skale | — |
| `k` GCR | **6,25×10⁻⁴ m²/kg** → 53 cm, czyli 160 g/cm² | Gosse & Phillips (2001) |
| Arrhenius `A` | **2,3×10¹¹ 1/s** | dopasowane do pomiaru |
| Arrhenius `Ea` | **130 kJ/mol** | Lindahl & Nyberg (1972) |
| `c_rad` domyślne | **2,5×10⁻⁴ 1/Gy** | Mileikowsky et al. (2000) |
| `c_rad` pasmo | **2,5×10⁻⁵ – 4,3×10⁻⁴ 1/Gy** | jak wyżej |
| `c_hyd` | **1200** | ⚠️ **BEZ ŹRÓDŁA** |
| gamma U | 1,12×10⁻⁴ Gy/rok na ppm | Cresswell et al. (2018), Tab. 5 |
| gamma Th | 4,89×10⁻⁵ Gy/rok na ppm | jak wyżej |
| gamma K | 2,48×10⁻⁴ Gy/rok na % wag. | jak wyżej |

---

## 5. Dynamika orbitalna

### Silnik

**REBOUND**, całkowanie **IAS15** — schemat Gaussa-Radaua 15. rzędu
z adaptacyjnym krokiem.

### Dlaczego IAS15, a nie coś szybszego

Naturalne pytanie z sali. Odpowiedź ma trzy części:

1. **Siła niekonserwatywna.** W modelu działa ciśnienie promieniowania.
   Całkowanie symplektyczne, które byłoby szybsze, zakłada hamiltonowskość
   układu i traci swoje gwarancje w obecności takiej siły.

2. **Bliskie przeloty.** Odłamki przechodzą blisko planet. Schemat o stałym
   kroku albo zgubi taki przelot, albo musi mieć krok dobrany do najgorszego
   przypadku w całym biegu.

3. **Brak dryfu energii.** IAS15 nie ma sekularnego dryfu energii z samej
   konstrukcji (Rein & Spiegel 2015), więc nadaje się do 10⁹ czasów
   dynamicznych.

**Koszt:** adaptacyjny krok zagęszcza się przy bliskich przelotach, przez co
bieg 1 mln lat trwa około 11 minut zamiast kilku.

### Jednostki

`(AU, rok, masa Słońca)`, co daje **G = 4π²**. To standard w REBOUND i eliminuje
całą klasę błędów jednostkowych.

### Zawartość sceny

- Słońce
- 8 planet (efemerydy z JPL Horizons, nie zaszyte na sztywno)
- do 50 najbliższych gwiazd z katalogu Gaia
- rój odłamków z uderzenia w Marsa

### Losowanie roju

Promienie i prędkości z uciętego rozkładu potęgowego, kierunki w stożku o
zadanym kącie rozwarcia.

**Ważna uwaga o konwencji.** `q_size` jest wykładnikiem **różniczkowym**:
`dN/dr ~ r^(-q)`. Przy `q_size = 2` daje to `N(>r) ~ r^(-1)`. W literaturze
o ejekcie uderzeniowej „nachylenie 2" zwykle oznacza nachylenie **kumulatywne**,
więc jest to miejsce, gdzie łatwo o nieporozumienie.

### Stany końcowe

| Status | Warunek |
|---|---|
| `traveling` | leci dalej |
| `escaped_and_travelling` | energia orbitalna > 0 **i** r > 240 AU |
| `arrived` | wejście w efektywną sferę Hilla obcej gwiazdy |
| `destroyed` | zderzenie albo starcie erozją do 1 µm |

---

## 6. Promieniowanie: trzy kanały

### 6.1 Galaktyczne promieniowanie kosmiczne (GCR) — dominujące

**Czym jest.** Naładowane cząstki przychodzące **spoza Układu Słonecznego**:
~90% protony, ~9% jądra helu, ~1% ciężkie jony (HZE).

**Kluczowa konsekwencja, którą zmierzyłem w danych:**

| Wielkość | Zależność od odległości od Słońca |
|---|---|
| `uv_local_flux` (światło Słońca) | **r^(−1,90)** — prawo odwrotności kwadratu ✓ |
| `gcr_local_flux` (promienie kosmiczne) | **r^(+0,08)** — praktycznie płaskie |

Dopasowanie na 2100 próbkach z zakresu 1,05–33,6 AU.

**Dlaczego to ważne.** Ktoś zaproponował wykres „gorących peryheliów" — orbity
kolorowane lokalną mocą dawki, gdzie punkt najbliższy Słońcu świeciłby najmocniej.
Byłby to piękny wykres. **Nie zrobiliśmy go**, bo pokazywałby gradient, którego
nie ma. W kodzie jest test zapisujący te wykładniki, żeby nikt nie zbudował tego
później.

To jest przykład decyzji, którą warto opowiedzieć: *odrzuciliśmy atrakcyjny
wykres, bo dane go nie popierają.*

**Kalibracja.** 1,0 jednostki modelowej = **0,194 Gy/rok**, czyli wiersz
Mileikowsky'ego przy zerowej osłonie (19,4 cGy/rok).

**Weryfikacja niezależna:**

| Źródło | Wartość |
|---|---|
| Mileikowsky (2000), zerowa osłona | 19,4 cGy/rok = 0,194 Gy/rok |
| przestrzeń międzyplanetarna, minimum słoneczne | 150–300 mGy/rok |
| MSL/RAD w locie na Marsa (w wodzie) | 458 ± 32 µGy/dzień = 0,167 Gy/rok |

Wartość RAD jest **niższa**, i słusznie: mierzono ją **wewnątrz sondy**, za
średnio 16 g/cm² osłony. Nasze odłamki mają 0,4–17 g/cm², więc właściwym
punktem odniesienia jest przestrzeń swobodna.

> **Uwaga o pomyłce recenzenta.** Jeden z audytów twierdził, że 0,194 jest
> 10× za duże, czytając NASA-owskie „19–20 cGy/rok" jako 0,019 Gy/rok. To jest
> 0,19 Gy/rok. Kontrola została zapisana w kodzie **w obu jednostkach naraz**,
> właśnie dlatego, że to miejsce, w którym łatwo o taką pomyłkę.

### 6.2 Promieniowanie gwiazdowe (fotony) — pochłaniane w skorupie

Strumień bolometryczny `L/(4πd²)`. W eksporcie nazwany `uv_*`, choć model nie
ma widma UV — to znana nieścisłość nazewnicza, warta wspomnienia, gdyby ktoś
zapytał.

Znaczenie praktyczne: **żadne**, bo fotony giną w pierwszych centymetrach skały.

### 6.3 Rozpad promieniotwórczy w skale — znikomy

Uran, tor i potas w samej skale dają dawkę wewnętrzną. Współczynniki
z Cresswell, Carter & Sanderson (2018), Tabela 5.

**Wynik:** rozpad wewnętrzny to **0,042%** całkowitej dawki. Promienie
kosmiczne dostarczają **2376 razy** więcej.

To jest wynik, nie porażka. Narzędzie, które oznacza własne kanały jako
nieistotne, mówi coś innego niż takie, które przedstawia wszystkie podsystemy
z równą wagą.

---

## 7. Osłona i jej granice

### 7.1 Prawo Beer-Lamberta

```
A = exp(−k · ρ · x)
```

### 7.2 Dwa kanały, dwa bardzo różne współczynniki

| Kanał | k [m²/kg] | Droga tłumienia przy ρ = 3000 |
|---|---|---|
| fotony | 0,01 | **3,3 cm** |
| GCR | 6,25×10⁻⁴ | **53 cm** |

**To jest sedno całej pracy.** Cienka skorupa zatrzymuje światło gwiazdy.
Promienie kosmiczne potrzebują pół metra skały.

### 7.3 Co to znaczy dla tego roju

Odłamki mają 1,3–57,5 mm, czyli gęstość kolumnową 0,4–17 g/cm².

Policzone transmisje do środka:

| Odłamek | Przepuszcza |
|---|---|
| największy, 57,5 mm | **90%** |
| najmniejszy, 1,3 mm | **99,8%** |
| dla porównania: głaz 1 m | 15% |

**Ten rój jest praktycznie bez osłony.**

To nie dyskwalifikuje pracy. Mileikowsky podaje 12–15 Myr przeżycia dla ciał
poniżej 3 cm, więc jest to reżim opisany w literaturze. Ale wyniku **nie wolno
cytować tak, jakby dotyczył metrowego głazu** — tam jest 1 Myr za 1 m osłony
i 25 Myr za 2–3 m.

### 7.4 Znane ograniczenie: narastanie kaskady

**To jest najpoważniejsze ograniczenie modelu i trzeba je powiedzieć samemu,
zanim ktoś zapyta.**

Beer-Lambert jest monotoniczny: mówi, że dawka spada z każdym gramem osłony.
**Promienie kosmiczne tak się nie zachowują.** Cząstka pierwotna produkuje
cząstki wtórne szybciej, niż sama jest pochłaniana, więc dawka **rośnie**
z głębokością, zanim zacznie spadać.

Tabela Mileikowsky'ego, ta sama, z której bierzemy kalibrację, pokazuje to wprost:

| Osłona [g/cm²] | Dawka [cGy/rok] | Wobec powierzchni |
|---|---|---|
| 0 | 19,4 | 1,00× |
| 10 | 23,8 | 1,23× |
| **30** | **24,9** | **1,28× ← szczyt** |
| 100 | 18,3 | 0,94× |
| 200 | 8,7 | 0,45× |
| 800 | 0,06 | 0,003× |

Dawka rośnie o **28%** zanim zacznie opadać. To samo widać niezależnie
u Dartnella et al. (2007) dla regolitu marsjańskiego: szczyt przy 30–40 g/cm².

**Nasz rój (0,4–17 g/cm²) siedzi w całości w strefie narastania**, gdzie model
ma **zły znak gradientu**. Błąd jest ograniczony do około 25% w mocy dawki
i idzie w stronę **optymistyczną**.

Poza kilkoma setkami g/cm² wykładnik jest dobrym opisem, więc dla ciał
metrowych — tych, o które literatura panspermii naprawdę pyta — model działa
poprawnie. Zawodzi na małym końcu.

Jest to udokumentowane w `radiation/shielding_model.py`.

---

## 8. Termika

### 8.1 Temperatura powierzchni

Równowaga radiacyjna szarego ciała:

```
T = ((1 − A) · F / 4σ)^(1/4)
```

Dzielenie przez 4 odpowiada ciału **szybko rotującemu**: pochłania przekrojem
πr², wypromieniowuje całą powierzchnią 4πr².

**Weryfikacja niezależna.** Policzyłem `T = 278,6·(1−A)^(1/4)/√r_AU` osobno:

| Odległość | Mój rachunek | Model |
|---|---|---|
| 1 AU | ~260 K | — |
| 33,6 AU | 46,1 K | — |
| zakres modelu | — | **46,0 – 260,4 K** |

Zgodność lepsza niż 1%.

### 8.2 Temperatura wnętrza

```
T(r) = T_s + Q/(6·k_th) · (R² − r²)
```

Dokładne rozwiązanie stacjonarne dla kuli grzanej równomiernie ciepłem
radiogenicznym.

### 8.3 Znane uproszczenie: albedo

Katalog skał podaje albedo **geometryczne** (z JPL SBDB), a wzór na temperaturę
równowagi wymaga albedo **Bonda**. Dla tych ciał `A_Bond ≈ q·p` przy całce
fazowej `q ≈ 0,3–0,4`, więc używanie geometrycznego **przeszacowuje** albedo
i zaniża temperaturę o do ~10%.

Ponieważ hydroliza i tak jest znikoma (§9.3), nie zmienia to żadnego wniosku.
Ale jest to realna nieścisłość i warto ją znać.

---

## 9. Chemia: hydroliza DNA

### 9.1 Co to jest

DNA w wodzie rozpada się samo. Wiązanie między zasadą a cukrem pęka
(**depurynacja**), zostawiając „dziurę" w nici. Nie potrzeba promieniowania —
wystarczy woda i temperatura.

### 9.2 Kinetyka

```
k = A · exp(−Ea / (R·T)) · a_w · w_water
```

| Stała | Wartość | Źródło |
|---|---|---|
| `A` | 2,3×10¹¹ 1/s | dopasowane do pomiaru |
| `Ea` | 130 kJ/mol | **Lindahl & Nyberg (1972)**, Biochemistry 11:3610 |

**Weryfikacja.** `k(310 K) = 2,86×10⁻¹¹ 1/s` wobec zmierzonych ~3×10⁻¹¹ 1/s
w 37°C. Zgodność lepsza niż 5%.

Lindahl podaje `Ea = 31 ± 2 kcal/mol = 129,7 ± 8,4 kJ/mol`, więc 130 leży
dokładnie w środku pasma niepewności.

### 9.3 Aktywność wody — subtelność warta wspomnienia

Poniżej zera woda jest w równowadze z lodem, więc jej aktywność spada.
Model liczy to z obniżenia temperatury zamarzania:

```
ln(a_w) = −(ΔH_top/R)·(1/T − 1/T_top)
```

To dodaje **6 kJ/mol** do efektywnego nachylenia Arrheniusa. Dlatego zmierzone
w danych **135 kJ/mol** to nie błąd, tylko 130 + 6.

Warto to wiedzieć: jeśli powiesz na scenie „używamy 130 kJ/mol Lindahla",
a ktoś zmierzy z Waszych danych 135, macie gotową odpowiedź.

### 9.4 Dlaczego hydroliza jest tu prawie nieistotna

Zmierzony rozrzut w roju:

| Kanał | Rozrzut między odłamkami |
|---|---|
| dawka GCR | **1,3×** |
| hydroliza | **119 rzędów wielkości** |

Hydroliza waha się gigantycznie, bo jest wykładnicza w temperaturze, a odłamki
wędrują od 46 K do 260 K. Ale w wartościach bezwzględnych **nigdy nie
przekracza ~1%** całkowitego tempa zabijania.

To dało jeden z lepszych wykresów (§18.3).

### 9.5 Uczciwe zastrzeżenie o zakresie stosowalności

Lindahl mierzył DNA **w rozcieńczonym roztworze wodnym, pH 7,4, w zakresie
45–80°C**. DNA w przetrwalniku to zupełnie inne środowisko: wysycone białkami
SASP, odwodnione, zmineralizowane dipikolinianem wapnia.

Stosowanie tej kinetyki do przetrwalników jest **ekstrapolacją poza warunki
pomiaru**, i to w dwie strony naraz (temperatura i substrat). Model traktuje to
jako **górne ograniczenie**, i tak należy o tym mówić.

---

## 10. Biologia: funkcja przeżycia

### 10.1 Wzór

```
N/N₀ = exp(−c_rad · D − c_hyd · H)
```

gdzie `D` to dawka skumulowana [Gy], `H` hydroliza skumulowana [bezwymiarowa].

### 10.2 Dlaczego to faktoryzuje się dokładnie

Ponieważ oba współczynniki są **stałe na fragment**, mnożenie przeżyć krokowych
daje dokładnie tę postać. To nie jest przybliżenie.

**Weryfikacja numeryczna.** Odtworzyłem `population_fraction` dla wszystkich
14 odłamków z zapisanych `D` i `H`:

```
najgorsza reszta względna: 1,6×10⁻¹⁵
```

To precyzja maszynowa. Cały suwak `c_rad` stoi na tej własności — gdyby była
przybliżeniem, przeliczanie w przeglądarce byłoby zgadywaniem.

### 10.3 Współczynnik `c_rad` — najważniejsza liczba projektu

Źródło: **Mileikowsky et al. (2000)**, *Icarus* 145(2):391–427, Tabela IV.

```
c_rad = (częstość zabijania na rok) / (moc dawki w Gy na rok)
```

| Wartość | Organizm |
|---|---|
| 2,5×10⁻⁵ 1/Gy | *D. radiodurans* R1, najodporniejszy znany |
| **2,5×10⁻⁴ 1/Gy** | *B. subtilis*, przetrwalniki — **domyślna** |
| 4,3×10⁻⁴ 1/Gy | *B. subtilis* przy 600 g/cm² |

### 10.4 Dwie pułapki w tabeli źródłowej

**To jest dobra historia na scenę**, bo pokazuje staranność.

1. **Mnożnik w nagłówku.** Kolumny częstości zabijania mają ×10⁻⁵ dla
   *B. subtilis* i ×10⁻⁶ dla *D. radiodurans*. Pominięcie go daje wynik
   **100 000–1 000 000× za duży**.

2. **Jednostka mocy dawki.** Kolumna jest w **cGy/rok, nie Gy/rok** — kolejny
   czynnik 100.

**Weryfikacja odczytu.** Tabela sama się sprawdza: przy zerowej osłonie
*B. subtilis* ma 2,1×10⁻⁵ /rok, a `ln(10⁶)/2,1×10⁻⁵ = 0,658 Ma` wobec
stabelaryzowanych **0,66 Ma**. Trzy kolejne wiersze zgadzają się tak samo.

**Kontrola niezależna.** Wobec Valtonen et al. (2009), gdzie człon
naturalnej radioaktywności wynosi 0,075/Myr, nasze pasmo daje 0,045/Myr —
zgodność w granicach czynnika 1,7.

### 10.5 Czego wcześniej NIE zrobiliśmy dobrze

Wcześniejsza wersja podawała pasmo **3,6×10⁻⁴ – 1,0×10⁻³ 1/Gy**, wyprowadzone
z nachyleń regresji w `analysis/radiation_to_survival.R`.

**To było błędne, i to sprawdzalnie:** runtime nigdy nie próbkował tego pasma.
Tylko 3 z 14 odłamków w wysłanym replayu w nie wpadają.

Same nachylenia nie są współczynnikiem. Ten skrypt dopasowuje surowe liczby
z tabeli, w których brakuje **obu** poprawek z §10.4. Odczytane jako D10 dają
2,3–6,4 kGy, czyli w istocie **ostre laboratoryjne pasmo niskiego LET** —
a to pasmo **nie przenosi się** na promieniowanie kosmiczne.

**Dlaczego nie przenosi się.** Dla ciężkich jonów przekrój czynny na działanie
nasyca się (Baltschukat & Horneck 1991): pojedynczy ślad HZE deponuje ogromną
dawkę lokalną, ale zabija tylko ten jeden przetrwalnik, który trafi. Na
jednostkę **średniej** dawki promieniowanie o wysokim LET jest więc **mniej**
skuteczne, nie bardziej.

Kod nosi to pasmo jako `6,1×10⁻⁴ – 1,5×10⁻³ 1/Gy` z jawną etykietą
„tylko referencyjne".

### 10.6 Uczciwe zastrzeżenie

`c_rad` **nie jest stałą**. W samej tej tabeli rośnie ~4× z głębokością osłony
(bo widmo LET twardnieje) i różni się ~3× między gatunkami. Pojedynczy
współczynnik niesie więc systematykę rzędu czynnika 2.

W wysłanym roju przeżywalność koreluje z wylosowanym `c_rad` na poziomie
**r = −0,993**. Odpowiedź modelu jest zatem, w pierwszym przybliżeniu,
**stwierdzeniem o tym współczynniku** — i dlatego interfejs pozwala go ruszać.

### 10.7 Współczynnik bez źródła

```python
HYDROLYSIS_SURV_COEFF = 1.2 / 0.001   # = 1200
```

Kod mówi o tym wprost:

> AUDIT WARNING — NO CITED SOURCE. Written historically as 1.2 / 0.001.
> No peer-reviewed derivation found. Keep as an explicit sensitivity / audit
> parameter until replaced by a genome-based lethality model.

**To trzeba powiedzieć samemu na scenie.** Narzędzie, które tak pisze o sobie
we własnym kodzie, robi inne oświadczenie niż takie, które podaje każdą liczbę
z równą pewnością.

Praktycznie nie ma znaczenia, bo czynnik Arrheniusa wygasza ten kanał (§9.4).

---

## 11. Erozja pyłowa

### 11.1 Wzór

```
dR/dt = −(Y · Φ) / (4ρ)
```

gdzie `Y` to wydajność wyrzucania, `Φ` strumień masy pyłu, `ρ` gęstość.

### 11.2 Kluczowa własność: to jest recesja powierzchni

Tempo **nie zależy od wielkości ciała**. Duży i mały odłamek tracą tyle samo
mikrometrów na rok. Dlatego czas życia skaluje się wprost z promieniem — i to
jest podstawa jednego z głównych wyników (§14.1).

### 11.3 Zmierzone tempa

Zależą od składu skały, w zakresie **17,1 – 89,5 µm na tysiąc lat**:

| Skała | Tempo [µm/kyr] |
|---|---|
| chondryt CI | 89,5 |
| chondryt CM | 80,6 |
| bogata w związki organiczne | 51,3 |
| bogata w lód | 40,1 |
| krzemian uwodniony | 33,3 |
| chondryt zwyczajny | 31,9 |
| żelazo-nikiel | 27,4 |
| oliwin | 24,1 |
| enstatyt | 23,3 |
| żelazokamień | 17,1 |

Rozpiętość **5,2×**.

---

# CZĘŚĆ II — WYNIKI

## 12. Trzy przebiegi, trzy odpowiedzi

To **nie są trzy długości tego samego pytania**, tylko trzy różne pytania.

### 12.1 Trzy tysiące lat — przebieg konferencyjny

| | |
|---|---|
| klatek | 151 |
| dawka | 553 – 726 Gy |
| przeżywalność | 0,775 – 0,971 |
| stan końcowy | **14 leci, 0 zniszczonych** |

**Nic nie ginie.** Najgorszy odłamek zachowuje 77,5% mikrobów.

**Wniosek:** przelot przez Układ Słoneczny w tej skali czasu jest **do
przeżycia**. To jest wynik, nie brak wyniku.

Wszystkie wykresy są skalibrowane pod ten przebieg.

### 12.2 Sto tysięcy lat

| | |
|---|---|
| klatek | 101 |
| dawka | 3 746 – 19 793 Gy |
| przeżywalność | 0 – 0,259 |
| stan końcowy | **7 leci, 7 zniszczonych** |

**Siedem odłamków zniszczonych — ale nie przez promieniowanie.** Ich własne
dawki przewidują 3–86% przeżycia. Zniknęły, bo **erozja starła je do
mikrometra**.

Tu pojawiają się dwa wykresy, których nie ma w krótkim biegu: diagram fazowy
i „same dose, different fate".

### 12.3 Milion lat

| | |
|---|---|
| klatek | 201 |
| dawka | 2 958 – 191 470 Gy |
| przeżywalność | 0 – **1,5×10⁻¹⁰** |
| stan końcowy | **1 leci, 13 zniszczonych** |

Ocalał tylko największy odłamek (33,9 mm). Ale jego przeżywalność to
**1,5×10⁻¹⁰** — cztery rzędy wielkości za progiem sterylizacji (10⁻⁶).

**Uczciwa odpowiedź narzędzia na własne pytanie: ten rój nie przelatuje.**

Transfer międzygwiezdny trwa dziesiątki milionów lat (Belbruno et al. 2012),
a tu po jednym milionie nie ma już nic żywego.

---

## 13. Wynik główny i dlaczego nie jest liczbą

### Pasmo odpowiedzi

```
6,0×10⁻⁴⁶  ←──────────────────────────────→  1,0×10⁻²
najwrażliwszy organizm,                    najodporniejszy,
najbardziej napromieniowany odłamek        najmniej napromieniowany
```

**43 rzędy wielkości.**

### Co to znaczy, a czego nie znaczy

**To NIE jest przedział ufności.** To jest **zakres odpowiedzi zgodnych
z opublikowaną literaturą**. `c_rad` jest ustaloną liczbą, której nie znamy —
nie zmienną losową, którą próbkujemy.

Ta różnica jest kluczowa i pojawia się na ekranie **jako osobna, niezwijalna
linia**, właśnie dlatego, że jest to najgroźniejsze możliwe nieporozumienie.

### Skąd bierze się 43 rzędy

Jeden współczynnik odpowiada za **94%** rozrzutu. Cały trzytysiącletni bieg
N-ciałowy odpowiada za resztę.

To jest, w pewnym sensie, główny wynik pracy: **niepewność biologiczna
dominuje nad niepewnością dynamiczną o rzędy wielkości.**

---

## 14. Dwa odkrycia, których nie szukaliśmy

Oba wyszły z biegów długich, i oba są mocniejsze niż to, po co je uruchamiano.

### 14.1 Prawo czasu życia

```
czas życia = promień początkowy / tempo erozji
```

Przewiduje los **14 z 14** odłamków w biegu 100 tys. lat. Bez ani jednego
dopasowywanego parametru.

**I nie jest to zwykły próg rozmiaru.** Odłamek 3,15 mm zginął, a 2,71 mm
przeżył — bo tempo erozji zależy od składu (§11.3). Los rozstrzyga
**kombinacja rozmiaru i składu**, więc potrzeba diagramu dwuwymiarowego,
nie progu.

**Test poza próbką.** To samo prawo, **bez żadnej zmiany**, przewiduje 14 z 14
losów w biegu 1 mln lat — dziesięć razy dłuższym. Jedyny ocalały ma policzony
czas życia **1062 tys. lat przy biegu 1000 tys.**, więc prawo jest testowane
dokładnie na granicy, nie z wygodnym marginesem.

Przy czternastu punktach trafienie w jednym biegu mogło być przypadkiem.
Trafienie w drugim, na który go nie wyprowadzano, przypadkiem nie jest.

### 14.2 Ta sama dawka, inny los

Siedem odłamków przeżywających 100 tys. lat pochłania **18 776 – 19 793 Gy**,
czyli rozrzut **5,4%**. Ich przeżywalność różni się **522-krotnie**.

Środowisko było praktycznie identyczne. **Różnica jest w organizmie, nie
w podróży.**

To jest teza projektu w jednym obrazku, i wyszła z danych, a nie z założeń.

---

# CZĘŚĆ III — INTERFEJS

## 15. Filozofia projektowa UI

### Zasada naczelna

> **Ciemny prostokąt to obserwacja. Wszystko wokół to przyrząd.**

Scena 3D nigdy nie jest zasłaniana przez panele. Panele stoją **obok** niej,
każdy najwyżej 26% szerokości okna. Jedyne rzeczy rysowane na ciemnym tle to
dwa podpisy w rogach, które opisują to, co w nim jest.

### Skąd ta zasada

Z badania prawdziwych platform naukowych: **ESASky**, **NASA Eyes on the Solar
System**, **JPL Horizons**, **GWOSC**, **CERN Open Data**, **NASA ADS**,
**SDSS SkyServer**. Wszystkie robią to samo: dają danym cały ekran, a chrome
spychają na obrzeże i pokazują na żądanie.

### Co czyni interfejs wiarygodnym, a nie efektownym

To nie jest kwestia powściągliwości wizualnej. Chodzi o **wystawienie na wierzch
rzeczy nośnych epistemicznie**: jednostek, niepewności, wersji, prowenancji,
definicji pól — i o łatwość **wyniesienia danych** z narzędzia.

Efektowność jest tym, co się robi, gdy treść nie udźwignie strony. Tutaj treść
udźwignie.

### Konkretne wzorce zapożyczone

| Wzorzec | Skąd | Gdzie u nas |
|---|---|---|
| widok + panele na obrzeżu | ESASky | cały układ |
| jednostki w nagłówku, nie w komórce | GWOSC | wykresy i odczyty |
| kolejność: co, potem dlaczego | CERN Open Data | pasmo wyniku |
| progresywne ujawnianie | Observable | zwijany nagłówek |
| skala interfejsu pod salę | — | menu View |

---

## 16. Anatomia ekranu

```
┌──────────────────────────────────────────────────────────────┐
│ A. PASMO WYNIKU    6,0×10⁻⁴⁶ ──────────── 1,0×10⁻²          │
│    ⚠ to nie jest przedział ufności   [zwiń/rozwiń]           │
├──────────────────────────────────────────────────────────────┤
│ B. MENU   Figures  Scene  Panels  Analysis  View   [3 przyc.]│
├────────────┬─────────────────────────────┬───────────────────┤
│            │                             │                   │
│ C. KONSOLA │      D. SCENA 3D            │ E. PANEL ANALIZY  │
│    lewa    │      (ciemna)               │    prawy          │
│            │                             │                   │
│ parametry  │  Słońce, planety, odłamki   │  9 wykresów       │
│ modelu     │                             │  suwak c_rad      │
│            │  [podpis skal] [pasek dawki]│  prowenancja      │
├────────────┴─────────────────────────────┴───────────────────┤
│ F. TRANSPORT  ⏮ ‹ ▶ › ⏭  klatka 1/151  t=0  [Orbital motion]│
└──────────────────────────────────────────────────────────────┘
```

### A. Pasmo wyniku

Zawiera cztery rzeczy, w tej kolejności:

1. **liczbę** — pasmo przeżywalności z opisanymi końcami
2. **atrybucję** — który współczynnik odpowiada za ile procent rozrzutu
3. **ostrzeżenie** — że to nie przedział ufności
4. **przycisk** — „How this number was reached"

**Decyzja projektowa 2: proza jest domyślnie zwinięta, ostrzeżenie nigdy.**

Wcześniej nagłówek zajmował 153 px, czyli 18% wysokości ekranu przy 1280×800,
i dwa z czterech wierszy były zdaniami. Zdania warto przeczytać raz; przez
resztę wystąpienia są martwym ciężarem.

Ale gdy zrobiliśmy je zwijalnymi, **razem z nimi znikło ostrzeżenie o przedziale
ufności**. To był błąd, i to najgroźniejszy z możliwych, bo ukrywał dokładnie
tę informację, której ukrywać nie wolno. Ostrzeżenie jest teraz **osobnym
elementem, poza blokiem zwijanym i poza tym, co ukrywa tryb prezentacji**,
a testy pilnują obu tych rzeczy.

### C. Konsola uruchomieniowa

Piętnaście parametrów, każdy z podpowiedzią zawierającą: co to jest, co się
stanie po zmianie, wartość domyślną i — gdzie istotne — opublikowany zakres ze
źródłem.

**Decyzja projektowa 3: podpowiedzi nie w atrybucie `title`.**

Specyfikacja HTML sama odradza `title`: nie pojawia się przy fokusie
klawiatury, nie da się go najechać (więc cytowanie w środku jest nieklikalne)
i w ogóle nie działa na dotyku. WCAG 2.2 SC 1.4.13 wymaga, żeby taka treść dała
się odrzucić, najechać i była trwała. Wszystkie trzy są zaimplementowane.

### F. Transport

**Decyzja projektowa 4: nazwa „Orbital motion" zamiast „Smoothing".**

Ten przełącznik decyduje, czy scena pokazuje surowe zapisane pozycje, czy
przesuwa ciała po ich własnych orbitach. „Smoothing" nie mówiło nic o tym, co
robi z danymi. Nowa nazwa mówi, a podpowiedź podaje liczby: dokładność 0,03 AU
wobec 2,5 AU, o które ciało „przeskakiwałoby" bez tego.

**Nieujawniona interpolacja byłaby nieuczciwa. Ujawniona jest po prostu tym,
co scena rysuje.**

---

## 17. Wizualizacja 3D: każda decyzja

### 17.1 Problem czasu i jego rozwiązanie

**Problem.** Klatki są zapisywane **co 20 lat**, a odłamki okrążają Słońce
w 1,8–3,8 roku. Między dwiema klatkami ciało robi **osiem pełnych obiegów**,
a jego mediana przemieszczenia to **2,48 AU**. Odtworzenie samych zapisanych
pozycji to teleportacja, nie ruch.

**Dlaczego nie zagęścić symulacji.** Policzone:

| dt | klatek na 3000 lat | rozmiar pliku |
|---|---|---|
| 1 rok | 3 000 | **141 MB** |
| 0,25 roku | 12 000 | **564 MB** |
| 0,05 roku | 60 000 | **2,8 GB** |

Plik ma dziś 7 MB. Każde zagęszczenie wystarczające do płynności jest
20–400× poza budżetem.

**Rozwiązanie: propagacja Keplerowska.** Każde ciało jest przesuwane po
**własnej elipsie oskulacyjnej**, wyliczonej z wektora stanu.

**Dlaczego to jest uczciwe.** Scena **już** rysuje te elipsy zamiast łączyć
zapisane punkty — właśnie po to, żeby krzywa była dokładna wszędzie, a nie
poprawna w 151 miejscach i zmyślona pomiędzy. Przesunięcie znacznika **po tej
krzywej** nie dodaje żadnego nowego twierdzenia. Odmawianie ruchu po linii,
którą się już narysowało, nie jest uczciwsze — jest tylko niekonsekwentne.

**Dokładność, zmierzona wobec REBOUND** na każdej 20-letniej przerwie:

| | |
|---|---|
| mediana błędu | **0,0295 AU** = 1,8 jednostki świata |
| skok, który zastępuje | **2,48 AU** = 149 jednostek |
| poprawa | **84×** |

### 17.2 Który obiekt wolno propagować

**Decyzja projektowa 5, i moja pomyłka po drodze.**

Pierwsza wersja testu brzmiała `dt/okres ≤ 0,25`. **Wykluczyła 13 z 14
odłamków i zostawiła ten jeden, który naprawdę zawodzi.** Orbita o okresie
2,4 roku propaguje się przez 20 lat doskonale — po prostu obiega osiem razy.

Druga wersja: `a > 6 AU`. To **zamroziło Saturna, Urana i Neptuna**, bo półoś
nie odróżnia zaburzonego odłamka od planety. Planety stały nieruchomo, podczas
gdy układ wewnętrzny krążył wokół nich. Nic nie rzuciło błędu.

**Właściwym kryterium jest mimośród**, i rozdziela on czysto:

| Grupa | Mimośród |
|---|---|
| wszystkie planety | 0,007 – 0,205 |
| trzynaście odłamków | 0,155 – 0,550 |
| **asteroid_011** | **0,962** ← jedyny wykluczony |

Orbita bliska parabolicznej najsilniej zakrzywia się przy peryhelium i najłatwiej
ulega przekształceniu przez bliski przelot, więc zapisany zestaw elementów nie
przeżywa 20-letniej przerwy. Jej zmierzony błąd sięga 24 AU.

### 17.3 Dwa zegary

Interpolacja usunęła teleportację, ale **nie mogła sprawić, że ruch orbitalny
stanie się widoczny** — tej informacji nie ma w sekwencji klatek. Nawet przy
najwolniejszym ustawieniu transportu orbita zamyka się w 0,12 sekundy.

**Rozwiązanie: dwa zegary o różnych tempach.**

Uzasadnienie jest fizyczne, nie kosmetyczne. Obie wielkości mają **zupełnie
inną strukturę czasową**:

| Wielkość | Struktura |
|---|---|
| ruch orbitalny | okresowy w skali lat, **znany analitycznie** |
| dawka | **linia prosta** |

Dawka odchyla się od `rate × t` o najwyżej **0,19%** przez 3000 lat i **0,14%**
przez 100 tys. lat. Nie ma w niej struktury, którą można by przegapić.

Zegar orbitalny biegnie więc **3 lata na sekundę** (mediana odłamka zamyka
orbitę w 0,8 s), a transport dalej odlicza swoje 3000 lat. **Żadna wielkość
nie jest pokazywana w tempie, które ją zniekształca.**

### 17.4 Trzy skale rozmiarów

**Decyzja projektowa 6, i najtrudniejszy kompromis w projekcie.**

Ciała w scenie różnią się promieniem o **jedenaście rzędów wielkości**.

Prawdziwa skala jest niemożliwa:

| Ciało | Przy prawdziwej skali |
|---|---|
| Ziemia | 4,2×10⁻³ piksela |
| Jowisz | 4,7×10⁻² piksela |

Cztery do pięciu rzędów **poniżej jednego piksela**. Widok w prawdziwej skali
to pusty czarny prostokąt.

**Co było źle wcześniej.** Planety były przemapowane pierwiastkiem sześciennym
na pasmo 5–11 jednostek. Zachowywało to kolejność i **niszczyło proporcje**:
Jowisz jest 29,3× większy od Merkurego, a był rysowany 2,2× większy.
**Spłaszczenie 13-krotne** — i to kłamstwo, któremu prawdziwe promienie
w pliku wprost przeczyły.

**Rozwiązanie: jeden mnożnik na rodzinę.** Wspólny mnożnik **skraca się
w stosunku**, więc każda proporcja wewnątrz rodziny jest dokładnie prawdziwa.

| Rodzina | Czynnik | Efekt |
|---|---|---|
| planety | ×1300 | **Jowisz : Merkury = 29,3 : 1** ✓ |
| Słońce | osobno | nie połyka orbity Merkurego |
| odłamki | ×8×10¹¹ | 0,59 – 17,8 px |

**Dlaczego trzy, a nie jeden.** Przy czynniku planet odłamek 57,5 mm ma
**4,9×10⁻⁸ piksela**, a Słońce miałoby 363 jednostki przy orbicie Merkurego
równej 28 — **połknęłoby układ wewnętrzny**.

**Trzy skale, wszystkie nazwane na ekranie.** Wewnątrz rodziny proporcje są
dokładne; między rodzinami nie są, i podpis to mówi. To jest uczciwa forma
kompromisu, którego nie da się uniknąć.

**Zasada, której nie wolno złamać.** Słońce nie może być narysowane większe niż
orbita, wewnątrz której leży. Jedna z wersji miała `SUN_R = 44` przy orbicie
Merkurego 28 — czyli **1,6× tej orbity**. To jedyny rodzaj przesady, na który
ten projekt nie może sobie pozwolić, bo mówiłby coś fałszywego o **strukturze**
układu. Test tego pilnuje.

**Co NIE jest przesadzone:** odległości orbitalne, czasy przelotu, dawki,
przeżywalność. Powiększone są tylko kule oznaczające położenia.

### 17.5 Wygląd planet

**Decyzja projektowa 7: tekstury wyglądały źle nie z powodu rozdzielczości.**

Shader mnożył pobraną teksturę przez „kolor identyfikacyjny" ciała. To jest
kolor razy kolor — a tekstura **już** niesie prawdziwy wygląd.

Zmierzone wyniki przy punkcie podsłonecznym:

| Planeta | Średnia tekstury | Po pomnożeniu |
|---|---|---|
| Ziemia | 84,101,130 | **29,101,214** ← kanał czerwony wyzerowany |
| Mars | 183,99,72 | **263,50,7** ← jeden przycięty, dwa zgniecione |
| Uran | 155,203,210 | **147,331,399** ← dwa przycięte |

**Siedem z dziewięciu ciał** albo prześwietlało się do bieli, albo traciło
kanał. Kontynenty Ziemi **nie miały prawa się pojawić**.

Słońce ocalało **przypadkiem**: jego `#FFD580` prawie pokrywa się z własną
teksturą, więc mnożenie było prawie neutralne. **To jest cały powód, dla którego
Słońce wyglądało dobrze, a planety nie** — ta sama biblioteka tekstur, ten sam
rozmiar, inny shader.

### 17.6 Oświetlenie ciał bezatmosferycznych

**Decyzja projektowa 8: regolit nie jest lambertowski.**

Regolit **rozprasza wstecznie**: zwraca światło w stronę źródła, zamiast
rozkładać je jak `cos(i)`. Zmierzone na Bennu (Golish et al. 2021), podział
Lunar-Lambert to `L(α) = exp(−0,009α)`, więc `L(0) = 1,0` — przy małym kącie
fazowym powierzchnia jest **czystym Lommelem-Seeligerem**.

Widoczny skutek to dokładnie to, co odróżnia prawdziwe zdjęcia asteroid od
renderów: kula lambertowska gaśnie płynnie od środka i wygląda jak bila,
a prawdziwe ciało bezatmosferyczne jest **równomiernie jasne prawie do
terminatora**, po czym gwałtownie ciemnieje.

**Zastosowane tylko tam, gdzie prawdziwe.** Każdy odłamek to skała
bezatmosferyczna, tak samo Merkury i Mars. Jowisz, Saturn, Uran i Neptun
**nie mają powierzchni**, a Wenus widzimy jako pokrywę chmur — nadanie im prawa
regolitu twierdziłoby coś fałszywego o tym, na co patrzy widz.

### 17.7 Tekstury odłamków

**Decyzja projektowa 9: nie użyliśmy zdjęcia prawdziwej komety.**

Planety noszą prawdziwe mapy, bo prawdziwe mapy istnieją — Jowisz był
fotografowany. **Te odłamki nie.** To kamienie 1,3–57,5 mm, które model wymyślił,
losując z rozkładu rozmiarów. Nie ma zdjęcia żadnego z nich.

Ubranie ich w pobrany obraz komety 67P umieściłoby na ekranie **konkretny,
prawdziwy, zmierzony obiekt** i podpisało go jako coś, co wyprodukowała
symulacja — wymyślony wygląd z autorytetem fotografii, w pracy, której cała
teza brzmi, że to narzędzie oznacza, czego nie wie.

**Zamiast tego powierzchnia jest generowana z własnych, cytowanych właściwości
skały:** albedo → jasność bazowa, porowatość → chropowatość, woda → jasne
wtrącenia, gęstość → połysk metaliczny.

Tekstura jest więc **zakodowaniem fizyki**, którą model i tak liczy, a nie
ilustracją. Dwa odłamki wyglądają inaczej, bo ich skatalogowane właściwości się
różnią, a czytelnik pytający „dlaczego" dostaje liczbę, nie estetykę.

---

## 18. Wszystkie wykresy

### 18.1 Same dose, different fate ⭐

**Co pokazuje.** Siedem odłamków przeżywających 100 tys. lat: dawka po lewej,
przeżywalność po prawej, linia łącząca każdy odłamek.

**Liczby:** dawka waha się o **5,4%**, przeżywalność o **522×**.

**Dlaczego wykres parowany, a nie punktowy.** Punktowy zaprasza czytelnika do
szukania trendu i znalezienia słabego. Połączenie dawki z losem czyni
porównanie **strukturalnym**: oś dawki zapada się prawie do punktu, oś
przeżywalności rozciąga na trzy dekady, **linie się krzyżują**. Nie da się
skonstruować odczytu, w którym zrobiło to środowisko.

**Dlaczego tylko ocalali.** Siedem zniszczonych zostało startych erozją, nie
wysterylizowanych. Ich zero jest zerem innego rodzaju i uśrednienie dwóch
mechanizmów byłoby jedynym błędem, któremu ten wykres ma zapobiegać.

### 18.2 Diagram fazowy przeżycia ⭐

**Co pokazuje.** Promień początkowy wobec tempa erozji, z narysowaną granicą
`czas życia = długość biegu`.

**Odczyt:** „lifetime = radius / erosion rate predicts 14 of 14 fates, with no
free parameters".

**Dlaczego dwie osie, a nie próg.** Bo próg rozmiaru byłby fałszem: odłamek
3,15 mm zginął, a 2,71 mm przeżył.

**Dlaczego osie logarytmiczne.** Promień rozciąga się na czynnik 32, tempo na
5,2. Na osiach liniowych małe odłamki wpadają w róg, a granica przestaje być
prostą.

**Rysowany tylko wtedy, gdy jest co rysować.** Przy 3000 latach nic nie ginie,
więc nie ma granicy — a wykres pokazujący ją, wymyślałby ją.

### 18.3 Wykres Arrheniusa

**Co pokazuje.** `log(szybkość hydrolizy)` wobec `1000/T`.

**Wynik:** prosta o `r = −0,9992` z 2100 próbek, dająca **135 kJ/mol**.

**Dlaczego jest wartościowy.** Nie pokazuje korelacji — **odtwarza znaną stałą**,
podręcznikową wartość dla hydrolizy wiązania fosfodiestrowego DNA. Czytelnik
może ją sprawdzić.

Jest to też jedyne miejsce, gdzie rój naprawdę się ze sobą nie zgadza: dawka
waha się 1,3×, hydroliza 119 rzędów wielkości.

### 18.4 Powierzchnia odpowiedzi

`c_rad` wobec dawki, z konturami przeżywalności i zaznaczonym opublikowanym
pasmem. Każdy odłamek to punkt.

Pokazuje **wszystkie wyniki, jakie biologia może dać** — czyli dokładnie to,
czego pojedyncza liczba pokazać nie może.

### 18.5 Pozostałe pięć

| Wykres | Co mówi |
|---|---|
| **Surviving microbial fraction** | przeżywalność w czasie, linia na odłamek |
| **Distance from the Sun** | odległość heliocentryczna, widać eliptyczność |
| **Orbital energy** | ε < 0 znaczy związany ze Słońcem |
| **Where the dose comes from** | GCR kontra rozpad wewnętrzny, **2376×** różnicy |
| **Dust erosion** | ubytek promienia w ppm |
| **Shielding against depth** | transmisja wgłąb, dwa kanały na jednej osi log |

### 18.6 Wykresy, których **nie** zrobiliśmy

To jest równie ważne i warte opowiedzenia.

| Odrzucony wykres | Dlaczego |
|---|---|
| gorące peryhelia | dawka **nie** zależy od odległości (r^+0,08) |
| animacja umierania życia | **nic nie ginie** w biegu 3000 lat |
| kolorowanie przeżywalnością na skali auto | zakres 0,78–0,97, skala auto by go zniekształciła |
| tornado z `tornado_sample.json` | bieg bazowy to 0,5 roku, słupki byłyby szumem numerycznym |
| macierz korelacji Pearsona | Pearson 0,05 wobec Spearman 0,97 dla tych samych danych |
| rozkład rozmiarów | n = 14, za mało na cokolwiek obronnego |

---

## 19. Tryb prezentacji

### Po co osobny tryb

Układ badawczy daje scenie ~40% ekranu i otacza ją każdym parametrem modelu,
kolumną wykresów i paskiem przełączników. To właściwe narzędzie do
**eksplorowania** modelu i niewłaściwe do **sali**: nikt w dwunastym rzędzie
nie czyta listy parametrów, a prelegent i tak wie, co w niej jest.

Klawisz `P` przełącza. Pełne UI wraca jednym klawiszem.

### Dlaczego rozdziały, a nie nawigacja na żywo

Przeciąganie kamery na scenie kosztuje czas i opanowanie, a zgubiony widok
przed publicznością odzyskuje się źle. Każdy rozdział to **jeden klawisz**
ustawiający kamerę, czas i widoczne panele.

### Sześć rozdziałów

| # | Tytuł | Treść |
|---|---|---|
| 1 | The rock | Mars w chwili wyrzutu |
| 2 | The swarm | 14 odłamków, orbity „oddychają" |
| 3 | Dose accumulating | kolor to dawka, skala 0–1000 Gy |
| 4 | Size is the story | rozmiar decyduje o osłonie |
| 5 | **The honest answer** | **suwak `c_rad` na scenie, na żywo** |
| 6 | Wait a hundred times longer | bieg 100 tys. lat |

### Rozdział 5 — najmocniejszy moment

Suwak `c_rad` jest **przenoszony** z panelu analizy na środek sceny, nie
kopiowany. Dwa suwaki dla jednej liczby mogłyby się rozjechać, a ten na scenie
byłby tym, którego nikt do niczego nie podłączył.

Działa **tylko dlatego**, że funkcja przeżycia faktoryzuje się dokładnie —
przeglądarka przelicza całą odpowiedź bez nowego biegu. **To jest rzecz, której
nikt inny na tej konferencji nie pokaże.**

### Rozdział 6 — wymaga innego biegu

Odkrycie o erozji **istnieje tylko przy 100 tys. lat**. Rozdział mówi o tym
i **proponuje wczytanie** właściwego biegu, zamiast po cichu pokazywać
trzytysiącletni, w którym nic nie ginie.

---

# CZĘŚĆ IV — RZETELNOŚĆ

## 20. Czego model nie robi

Uczciwa lista. **Warto ją wygłosić samemu**, zanim padnie z sali.

1. **Brak pełnego transportu cząstek.** Beer-Lambert jest modelem efektywnym.
2. **Jeden skalar `k` na kanał.** Brak zależności od energii, brak osobnych
   przekrojów dla protonów, cząstek α i HZE w osłonie. Podział 90/9/1% jest
   tylko raportowany.
3. **Brak narastania kaskady** (§7.4). Zły znak gradientu w pierwszych
   ~100 g/cm², błąd do ~25% w stronę optymistyczną.
4. **Kule jednorodne**, dawka liczona w środku.
5. **Brak potencjału galaktycznego.** Gwiazdy Gaia to punkty w próżni.
6. **Gamma wewnętrzna to przybliżenie analityczne**, nie Monte Carlo.
7. **Brak sublimacji lodu, spalacji, ablacji atmosferycznej** przy celu.
8. **Jeden bieg = jedno losowanie.** Brak zespołów, więc brak rozkładu wyniku.
9. **Brak 11-letniego cyklu słonecznego.** 0,194 Gy/rok to wartość z minimum;
   średnia po cyklu byłaby ~1,6–1,8× niższa.
10. **Albedo geometryczne tam, gdzie potrzebne Bonda** (§8.3), do ~10% w `T`.
11. **`c_hyd = 1200` bez źródła** (§10.7).
12. **Kanały traktowane jako niezależne.** Literatura dokumentuje synergię
    między uszkodzeniem radiacyjnym a wysuszeniem, bo oba obciążają ten sam,
    skończony system naprawczy. Model jest tu **optymistyczny**, choć przy tych
    temperaturach numerycznie nieistotnie.

---

## 21. Jak weryfikowaliśmy

### 21.1 Testy

| Warstwa | Liczba testów |
|---|---|
| `web/` | **638** |
| `model/` | **290** |

Nie sprawdzają tylko, czy kod się nie wywala. Sprawdzają fizykę:

- czy funkcja przeżycia faktoryzuje się do precyzji maszynowej
- czy temperatury mieszczą się między najzimniejszą a najgorętszą fizycznie
  dopuszczalną wartością — **w każdej klatce dla każdego odłamka**
- czy `β` jest odwrotnie proporcjonalne do promienia
- czy implikowana gęstość ziarna każdej z 24 skał to gęstość **istniejącego
  materiału**
- czy jasność na skali dawki rośnie monotonicznie
- czy **wszystkie osiem planet** wolno propagować
- czy odłamek nigdy nie jest rysowany większy niż potrzeba

### 21.2 Weryfikacje niezależne

Każdą kluczową liczbę przeliczyłem od zera, nie ufając komentarzom w kodzie:

| Wielkość | Model | Kontrola niezależna | Zgodność |
|---|---|---|---|
| dawka GCR | 0,184–0,242 Gy/rok | 150–300 mGy/rok (min. słoneczne) | ✓ |
| temperatura | 46,0–260,4 K | 46,1–260 K (ciało szare) | <1% |
| `β` | 4,9×10⁻⁶–2,9×10⁻⁴ | 2,4×10⁻⁶–3,8×10⁻⁴ (Burns) | ✓ |
| hydroliza 37°C | 2,86×10⁻¹¹ 1/s | ~3×10⁻¹¹ (Lindahl) | <5% |
| faktoryzacja | — | reszta 1,6×10⁻¹⁵ | maszynowa |
| odczyt tabeli | 0,658 Ma | 0,66 Ma (Mileikowsky) | ✓ |
| prawo czasu życia | 14/14 | 14/14 na innym biegu | poza próbką |

### 21.3 Odtwarzalność

Dwa biegi 1 mln lat z tym samym ziarnem dały wynik **identyczny co do bitu**:
te same siedem zniszczonych odłamków, zerowa różnica dawki.

---

## 22. Błędy, które znaleźliśmy u siebie

**To jest dobry materiał na scenę**, bo pokazuje, jakiego typu błędy tu
występowały i że zostały złapane.

| Błąd | Skutek | Jak znaleziony |
|---|---|---|
| shader mnożył teksturę przez kolor | kontynenty Ziemi nie mogły się pojawić | pomiar średnich kanałów |
| `keplerSafe` używało półosi | **Saturn, Uran, Neptun stały nieruchomo** | test na wszystkich planetach |
| budżet dawki sumował dwie jednostki | krzywa 3076 Gy, 5× więcej niż jakikolwiek odłamek otrzymał | porównanie z wyeksportowaną dawką |
| erozja odwrotnie proporcjonalna do parametru wydajności | przy interwale 5 rój tracił ¼ masy, którą powinien | bieg kontrolny |
| `iron_nickel`: gęstość Psyche + porowatość litego metalu | implikowana gęstość ziarna 4214 kg/m³ — **takiego materiału nie ma** | test spójności 24 skał |
| porowatość CI 0,11, potem moje 0,35 | oba niezgodne z gęstością obok | komentarz, który sam napisałem, wyliczał 0,508 |
| paski w panelu skalowane do 100 przy wartościach 10⁻⁴ | wyglądało jak „brak promieniowania wewnętrznego" | pomiar zakresów |
| zegar orbitalny działał na pauzie | znacznik dryfował o pełną orbitę od pozycji, którą raportował panel | prześledzenie pętli |
| odcisk palca nie obejmował kalibracji dawki | można było zmienić każdą liczbę, digest zostawał | test perturbacyjny |

**Wszystkie naprawione i zabezpieczone testami.**

---

## 23. Prowenancja i odtwarzalność

Każdy plik wynikowy niesie:

- **ziarno losowania** (rozstrzygnięte przed biegiem, nie ma biegów bez ziarna)
- **skrót SHA-256** parametrów **i audytowanych współczynników**
- **commit gita** oraz flagę „dirty"
- **wersje bibliotek**: REBOUND 5.1.1, numpy, scipy, astropy
- **listę współczynników pod audytem** ze statusem i cytowaniem
- **komendę odtwarzającą** bieg

### Dlaczego digest obejmuje współczynniki

Początkowo obejmował tylko konfigurację. Ale liczby decydujące o wyniku są
**stałymi w kodzie**: `HYDROLYSIS_SURV_COEFF`, kalibracja dawki GCR, para
Arrheniusa, współczynnik tłumienia. Ich zmiana zmieniała **każdą wartość
w wyniku**, a `parameters_sha256` zostawał identyczny.

Odcisk reklamowany jako „równe skróty znaczą identyczne dane wejściowe" nie
wykrywał więc dokładnie tych zmian, które najprawdopodobniej mają znaczenie.
Teraz obejmuje jedno i drugie, a test perturbuje współczynnik i sprawdza, czy
digest się rusza.

---

# CZĘŚĆ V — OBRONA

## 24. Pytania trudne z odpowiedziami

### „Jaka jest Wasza liczba? Jakie prawdopodobieństwo?"

**Nie podajemy jednej liczby, i to jest wynik, nie unik.**

Współczynnik `c_rad` jest w literaturze znany z dokładnością do czynnika 17,
a wchodzi do wykładnika, więc daje 43 rzędy wielkości rozrzutu. Do tego
`hydrolysis_surv_coeff = 1200` nie ma źródła, co mówimy wprost we własnym kodzie.

Pokazujemy **zależności i kształty**. Suwak `c_rad` przelicza całą odpowiedź na
żywo — właśnie po to, żeby było widać, że pytanie brzmi „jaki organizm",
a nie „jaka podróż".

### „Skąd bierze się współczynnik przeżycia?"

Mileikowsky et al. (2000), *Icarus* 145 — częstość zabijania podzielona przez
moc dawki. Runtime próbkuje **2,5×10⁻⁵ – 4,3×10⁻⁴ 1/Gy** (chroniczne).

W tej tabeli są **dwie pułapki**: mnożnik w nagłówku i cGy zamiast Gy.
Pominięcie ich ląduje na paśmie ostrym laboratoryjnym, które **nie przenosi
się** na promieniowanie kosmiczne, bo dla ciężkich jonów przekrój czynny się
nasyca.

Odczyt sprawdzony arytmetyką samej tabeli (0,658 wobec 0,66 Ma) i skontrolowany
wobec Valtonen et al. (2009) w granicach czynnika 1,7.

### „Beer-Lambert dla promieniowania kosmicznego? Poważnie?"

Model efektywny z **osobnym `k`** dla cząstek naładowanych, dającym 160 g/cm².

**I znamy jego granicę:** nie ma narastania kaskady. Dawka realnie rośnie
o 28% do głębokości ~30 g/cm², zanim zacznie spadać, a nasz rój siedzi w całości
w tej strefie. Błąd jest ograniczony do ~25% i idzie w stronę optymistyczną.

Powyżej kilkuset g/cm², czyli dla ciał metrowych, o które literatura naprawdę
pyta, wykładnik jest dobrym opisem.

### „Ile lat trwa transfer międzygwiezdny?"

Dziesiątki milionów lat (Belbruno et al. 2012, „transfer timescales of 10s Myr";
Melosh 2003 podaje minimum 4 Myr, medianę 50 Myr).

**Nasz najdłuższy bieg to 1 milion lat**, więc jesteśmy o rząd–dwa poniżej.
Część wnioskowania jest **ekstrapolacją dawki**, nie pełną trajektorią do celu,
i tak to przedstawiamy.

### „Wasze odłamki mają milimetry. Literatura mówi o metrach."

**Zgadza się, i to jest najpoważniejsze ograniczenie zakresu.**

Droga tłumienia to 160 g/cm². Nasze odłamki mają 0,4–17 g/cm², więc największy
przepuszcza 90% strumienia do środka. **Ten rój jest praktycznie bez osłony.**

Jest to reżim, który literatura opisuje — Mileikowsky podaje 12–15 Myr dla ciał
poniżej 3 cm. Ale **nie cytujemy tego wyniku jako dotyczącego metrowego głazu**,
bo tam jest 1 Myr za 1 m i 25 Myr za 2–3 m.

### „Dlaczego Mars?"

Bo meteoryty marsjańskie na Ziemi **potwierdzają** wyrzut i przelot w obrębie
Układu Słonecznego. Ponad 300 okazów, wieki ekspozycji 0,35–16 Myr.

Pytanie międzygwiezdne jest otwarte — i to je badamy.

### „Czy interpolujecie dane?"

**Tak, i mówimy o tym wprost.** Pozycje są próbkowane co 20 lat; między
próbkami każde ciało jest przesuwane po **własnej orbicie oskulacyjnej**.

Przez jedną przerwę to przybliżenie jest dokładne do **0,03 AU**, wobec 2,5 AU,
o które ciało przeskakiwałoby bez tego. Znacznik jest **na krzywej, a krzywa
jest dokładna**.

Nieujawniona interpolacja byłaby nieuczciwa. Ta jest opisana w podpowiedzi
kontrolki i w dokumentacji.

### „Dlaczego rozmiary ciał są przesadzone?"

Bo przy prawdziwej skali Ziemia ma **4,2×10⁻³ piksela**. Widok w prawdziwej
skali to pusty czarny prostokąt.

**Ale proporcje wewnątrz każdej rodziny są dokładnie prawdziwe** — jeden
mnożnik skraca się w stosunku. Jowisz do Merkurego to 29,3:1 na ekranie, bo
tyle wynosi naprawdę.

Trzy rodziny mają trzy różne mnożniki, bo ciała różnią się o jedenaście rzędów
wielkości. **Podpis na ekranie nazywa wszystkie trzy.**

### „Model ma tylko jeden bieg. Gdzie jest statystyka?"

Słuszna uwaga i **wpisana w listę ograniczeń**. Jeden bieg to jedno losowanie,
więc nie mamy rozkładu wyniku, tylko punktową realizację.

To, co mamy zamiast, to **przezroczystość względem parametru dominującego**:
`c_rad` odpowiada za 94% rozrzutu, i można nim ruszać na żywo.

Zespół wielu ziaren to najbardziej wartościowe możliwe rozszerzenie.

### „Skąd wiadomo, że nie ma błędów w kodzie?"

Nie wiadomo, i nie twierdzimy inaczej. **Wiadomo natomiast, że były**, bo je
znaleźliśmy i naprawiliśmy — lista w §22.

928 testów, z których większość sprawdza **własności fizyczne**, nie tylko czy
kod się uruchamia. Każda kluczowa liczba przeliczona niezależnie. Prowenancja
obejmująca współczynniki, więc zmiana kalibracji zmienia odcisk palca.

---

## 25. Czego NIE mówić

| Nie mówić | Bo |
|---|---|
| „prawdopodobieństwo wynosi X" | to pasmo 43 rzędów, nie liczba |
| „przedział ufności" | to zakres odpowiedzi zgodnych z literaturą |
| „symulujemy transfer międzygwiezdny" | najdłuższy bieg to 1 Myr, transfer to dziesiątki Myr |
| „nasze wyniki dowodzą, że litopanspermia działa/nie działa" | pokazujemy zależność, nie rozstrzygnięcie |
| „model jest zwalidowany" | jest zweryfikowany wewnętrznie i wobec literatury; walidacja to co innego |
| „to są metrowe głazy" | to milimetry, bez osłony |

---

## 26. Scenariusz wystąpienia

Dziesięć minut to około siedmiu minut treści plus pytania.

| Czas | Rozdział | Na ekranie | Co powiedzieć |
|---|---|---|---|
| 0:00–1:00 | **1. The rock** | Mars, t=0, brak paneli | Meteoryty marsjańskie dowodzą, że wyrzut się zdarza. Pytanie brzmi, czy cokolwiek w środku przeżywa. |
| 1:00–2:30 | **2. The swarm** | 14 elips, ruch płynny | Czternaście odłamków, okresy 1,8 do 75 lat. Elipsy „oddychają" — to zaburzenia sekularne. |
| 2:30–4:00 | **3. Dose** | kolor = dawka, pasek 0–1000 Gy | Promieniowanie kosmiczne przychodzi spoza układu. Dawka **nie** zależy od odległości od Słońca, i to jest nieoczywiste. |
| 4:00–5:30 | **4. Size** | rozmiar wg promienia, wykres osłony | Droga tłumienia to pół metra. **Każdy odłamek tutaj jest przezroczysty.** |
| 5:30–7:00 | **5. Honest answer** | **suwak `c_rad` na żywo** | Jeden współczynnik ma w literaturze rozrzut 17×. To daje 43 rzędy w odpowiedzi. Nie dajemy liczby — dajemy zależność. |
| (zapas) | **6. 100 kyr** | erozja niszczy 7 z 14 | A jeśli poczekać sto razy dłużej, o losie decyduje **erozja, nie promieniowanie**. |

### Wskazówki techniczne

- **Wczytaj stronę przed wejściem.** Parsowanie 7 MB JSON na obcym laptopie
  to widoczna zwłoka.
- **Menu View → Projector albo Large hall**, zależnie od sali.
- **Rozdziały to klawisze 1–6**, nie przeciągaj kamery na żywo.
- **Nie uruchamiaj `export_simulation_to_web.py`** przed wystąpieniem.
- **Przećwicz przeciąganie suwaka w rozdziale 5.** To jest moment, który
  zapamiętają.

---

## 27. Bibliografia

### Biologia i przeżycie

- **Mileikowsky, C. et al. (2000)**. Natural Transfer of Viable Microbes in
  Space. *Icarus* **145**(2):391–427. doi:10.1006/icar.1999.6317
  — współczynniki przeżycia, dawka GCR, tabela osłon
- **Nicholson, W. et al. (2000)**. *Microbiol. Mol. Biol. Rev.* **64**(3):548–572
  — odporność przetrwalników
- **Horneck, G., Klaus, D. & Mancinelli, R. (2010)**. *Microbiol. Mol. Biol. Rev.*
  **74**(1):121–156 — mikrobiologia kosmiczna, synergia kanałów
- **Baltschukat, K. & Horneck, G. (1991)**. *Radiat. Environ. Biophys.* **30**:87
  — nasycanie przekroju czynnego dla ciężkich jonów
- **Valtonen, M. et al. (2009)**. *ApJ* **690**:210 — kontrola niezależna

### Chemia

- **Lindahl, T. & Nyberg, B. (1972)**. *Biochemistry* **11**(19):3610–3618.
  doi:10.1021/bi00769a018 — kinetyka hydrolizy DNA, Ea = 31±2 kcal/mol
- **Lindahl, T. (1993)**. *Nature* **362**:709–715 — niestabilność DNA

### Promieniowanie

- **Cresswell, A., Carter, J. & Sanderson, D. (2018)**.
  *Radiation Measurements* **120**:195–201 — dawki od U/Th/K, Tab. 5
- **Gosse, J. & Phillips, F. (2001)**. *Quaternary Science Reviews* **20**:1475
  — długość tłumienia, 150–170 g/cm²
- **Zeitlin, C. et al. (2013)**. *Science* **340**:1080 — MSL/RAD w locie
- **Guo, J. et al. (2015)**. *A&A* **577**:A58 — wariacje dawki MSL/RAD
- **Dartnell, L. et al. (2007)**. *Biogeosciences* **4**:545 — narastanie kaskady

### Dynamika i transfer

- **Rein, H. & Spiegel, D. (2015)**. *MNRAS* **446**:1424 — IAS15
- **Belbruno, E. et al. (2012)**. *Astrobiology* **12**(8):754–774 — transfer
  międzygwiezdny, dziesiątki Myr
- **Melosh, H. (2003)**. *Astrobiology* **3**(1):207–215 — wymiana między układami
- **Gladman, B. et al. (1996)**. *Science* **271**:1387 — transfer Mars–Ziemia
- **Burns, J., Lamy, P. & Soter, S. (1979)**. *Icarus* **40**:1–48 — ciśnienie
  promieniowania

### Materiały i optyka

- **Golish, D. et al. (2021)**. *Icarus* **357**:113724 — fotometria Bennu,
  Lommel-Seeliger
- **Macke, R., Consolmagno, G. & Britt, D. (2011)**. *MAPS* **46**(12):1842–1862
  — porowatość chondrytów węglistych
- **Opeil, C., Consolmagno, G. & Britt, D. (2010)**. *Icarus* **208**:449–454
  — przewodnictwo cieplne meteorytów
- **Watanabe, S. et al. (2019)**. *Science* **364**:268 — Ryugu
- **Elkins-Tanton, L. et al. (2020)**. *JGR Planets* — Psyche

### Wizualizacja

- **Crameri, F., Shephard, G. & Heron, P. (2020)**. *Nature Communications*
  **11**:5444 — paleta batlow
- **Okabe, M. & Ito, K. (2008)** — paleta bezpieczna dla daltonistów
- **Limpert, E., Stahel, W. & Abbt, M. (2001)**. *BioScience* **51**(5):341–352
  — zapis multiplikatywny niepewności

### Dane

- Tekstury planet: **Solar System Scope**, CC BY 4.0
- Efemerydy: **JPL Horizons**
- Katalog gwiazd: **Gaia**
