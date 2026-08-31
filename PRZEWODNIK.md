# Przewodnik po programie

Dokument po polsku. Wyjaśnia, **czym jest ten program, jak go używać i jaka fizyka
i chemia się za nim kryje**. Napisany tak, żeby dało się go czytać bez wcześniejszej
znajomości kodu.

Pozostała dokumentacja jest po angielsku: `README.md` (opis projektu),
`CONFERENCE_THEORY.md` (teoria i twierdzenia T1–T11), `RUNNING.md` (komendy),
`model/REPOSITORY_MAP.md` (mapa katalogów).

---

## Spis treści

1. [O co w tym chodzi](#1-o-co-w-tym-chodzi)
2. [Jak uruchomić](#2-jak-uruchomić)
3. [Co widzisz na ekranie](#3-co-widzisz-na-ekranie)
4. [Jak używać: przewodnik krok po kroku](#4-jak-używać-przewodnik-krok-po-kroku)
5. [Fizyka: co dokładnie jest liczone](#5-fizyka-co-dokładnie-jest-liczone)
6. [Chemia i biologia: jak giną mikroby](#6-chemia-i-biologia-jak-giną-mikroby)
7. [Wykresy: co każdy z nich mówi](#7-wykresy-co-każdy-z-nich-mówi)
8. [Trzy przebiegi symulacji](#8-trzy-przebiegi-symulacji)
9. [Czego model NIE robi](#9-czego-model-nie-robi)
10. [Skąd wiadomo, że liczby są dobre](#10-skąd-wiadomo-że-liczby-są-dobre)
11. [Słowniczek](#11-słowniczek)

---

## 1. O co w tym chodzi

### Pytanie naukowe

**Litopanspermia** to hipoteza, że życie może przenosić się między planetami
wewnątrz odłamków skalnych wyrzuconych po uderzeniu meteorytu. Nie jest to
fantazja: na Ziemi znaleziono ponad 300 meteorytów marsjańskich. Wiemy więc,
że kamienie z Marsa **fizycznie do nas docierają**. Otwarte pytanie brzmi:
czy cokolwiek żywego mogłoby ten lot przeżyć?

Ten program odpowiada na to pytanie liczbowo.

### Analogia

Wyobraź sobie, że wrzucasz butelkę z listem do oceanu. Trzy rzeczy decydują,
czy list dotrze czytelny:

1. **Czy butelka dopłynie** (dynamika: prądy, wiatr) → tu: orbity i grawitacja
2. **Czy butelka przetrwa** (fale, kamienie) → tu: erozja pyłowa
3. **Czy atrament nie wyblaknie** (słońce, woda) → tu: promieniowanie i hydroliza

Program liczy wszystkie trzy naraz, dla czternastu „butelek" jednocześnie.

### Co konkretnie robi

```
1. Uderzenie w Marsa wyrzuca 14 odłamków skalnych (1,05 mm – 33,9 mm)
2. REBOUND całkuje ich orbity przez Układ Słoneczny
3. Po drodze każdy odłamek:
     - pochłania promieniowanie kosmiczne (dawka rośnie)
     - grzeje się i stygnie (temperatura zależy od odległości od Słońca)
     - traci warstwę powierzchni (erozja pyłowa)
4. Mikroby w środku giną: od promieniowania i od hydrolizy DNA
5. Wynik: jaki ułamek populacji przeżył
```

### Główny wynik

Odpowiedź nie jest jedną liczbą, i to jest **celowe**. Kluczowy współczynnik
`c_rad` (wrażliwość mikroba na promieniowanie) jest w literaturze znany
z dokładnością do czynnika 17. To przekłada się na **43 rzędy wielkości**
rozrzutu w wyniku końcowym.

Program pokazuje więc nie liczbę, tylko **zależność**: przesuwasz suwak
`c_rad`, a cała odpowiedź przelicza się natychmiast.

---

## 2. Jak uruchomić

### Wizualizacja (to, czego użyjesz najczęściej)

```bash
cd web
npm install        # tylko za pierwszym razem
npm run dev        # otwiera http://localhost:5173
```

### Symulacja (gdy chcesz nowe dane)

```bash
cd model
python -m microbe_radiation_model --asteroids 14 --years 3000 --dt 20 --seed 42
```

Potem przeniesienie wyniku do wizualizacji:

```bash
python tools/export_simulation_to_web.py
```

> **Uwaga.** Ta komenda **nadpisze** replay konferencyjny. Plik w `web/public/data/`
> ma 151 klatek i wszystkie wykresy są pod niego skalibrowane. Jest test, który
> to blokuje, ale przed prezentacją lepiej po prostu tego nie uruchamiać.

### Testy

```bash
cd web && npm test        # 638 testów
cd model && python -m pytest -q   # 290 testów
```

---

## 3. Co widzisz na ekranie

```
┌──────────────────────────────────────────────────────────────┐
│  WYNIK: 6,0×10⁻⁴⁶ ─────────────────────── 1,0×10⁻²          │  ← pasmo odpowiedzi
│  ostrzeżenie: to NIE jest przedział ufności                  │
├──────────────────────────────────────────────────────────────┤
│  Figures  Scene  Panels  Analysis  View    [Run] [Obj] [Anal]│  ← menu
├────────────┬─────────────────────────────┬───────────────────┤
│            │                             │                   │
│  KONSOLA   │      SCENA 3D               │   PANEL ANALIZY   │
│  URUCHOM.  │      (ciemna)               │   (wykresy)       │
│            │                             │                   │
│ parametry  │   Słońce, planety,          │   9 wykresów      │
│ modelu     │   14 odłamków               │                   │
│            │                             │                   │
├────────────┴─────────────────────────────┴───────────────────┤
│  ⏮ ‹ ▶ › ⏭   klatka 1/151   t = 0 lat   [Orbital motion]    │  ← transport
└──────────────────────────────────────────────────────────────┘
```

### Zasada projektowa

**Ciemny prostokąt to obserwacja, wszystko wokół to przyrząd.** Scena nigdy nie
jest zasłaniana przez panele. Panele stoją obok niej i każdy zajmuje najwyżej
26% szerokości okna.

### Dwa podpisy w rogach sceny

- **lewy dół:** informacja o trzech skalach rozmiarów (patrz §5.6)
- **prawy dół:** pasek koloru dawki, 0–1000 Gy

---

## 4. Jak używać: przewodnik krok po kroku

### 4.1 Pierwsze uruchomienie

Po wejściu na stronę animacja rusza sama. Zobaczysz Słońce, kilka planet
i czternaście małych odłamków. Kolor odłamka to **pochłonięta dawka** — im
jaśniejszy, tym więcej promieniowania zebrał.

### 4.2 Sterowanie czasem (dolny pasek)

| Przycisk | Co robi |
|---|---|
| ⏮ | pierwsza klatka |
| ‹ | krok wstecz |
| ▶ | odtwarzaj / pauza |
| › | krok naprzód |
| ⏭ | ostatnia klatka |
| suwak | przewijanie |
| `step/s` | ile klatek na sekundę |
| **Orbital motion** | patrz niżej |

**„Orbital motion" — co to naprawdę jest.** Klatki są zapisywane co 20 lat,
a odłamki okrążają Słońce w 1,8–3,8 roku. Między dwiema klatkami ciało robi
więc **osiem pełnych obiegów**. Gdyby pokazać same zapisane pozycje, wszystko
teleportowałoby się losowo.

Przy włączonej opcji każde ciało jest przesuwane **po własnej elipsie**.
To nie jest zgadywanie: elipsa wynika z wektora stanu (pozycja + prędkość),
więc pozycja jest **obliczana**, nie zmyślana. Sprawdzone wobec całkowania
REBOUND: błąd 0,03 AU wobec 2,5 AU, które ciało „przeskakiwałoby" bez tego.

### 4.3 Menu (pasek górny)

| Menu | Co zawiera |
|---|---|
| **Figures** | które wykresy pokazać |
| **Scene** | warstwy: ślady odłamków, ślady planet, powłoki UV, gwiazdy Gaia, gwiezdne tło |
| **Panels** | które panele otworzyć |
| **Analysis** | osobne strony + **wybór przebiegu symulacji** |
| **View** | skala interfejsu: biurko / duży ekran / projektor / duża sala |

**Wybór przebiegu** (menu Analysis) to najważniejsza rzecz do pokazania na
konferencji — patrz §8.

### 4.4 Konsola uruchomieniowa (panel lewy)

Piętnaście parametrów modelu. Każdy ma znak `?` z wyjaśnieniem: co to jest,
co się stanie po zmianie, jaka jest wartość domyślna i — gdzie to istotne —
opublikowany zakres wraz ze źródłem.

Najważniejsze:

| Parametr | Znaczenie | Domyślnie |
|---|---|---|
| `q_size` | jak stromo małe odłamki przeważają nad dużymi | 2,0 |
| `radius_min` / `radius_max` | zakres rozmiarów odłamków | 0,001–5,0 m |
| `bio_fraction` | jaki ułamek masy to „ładunek" biologiczny | 0,01 |
| `asteroids` | ile odłamków wyrzucić | 25 |
| `v_min` / `v_max` | prędkości wyrzutu | 5,03–20 km/s |
| `seed` | ziarno losowania (ta sama liczba = ten sam rój) | 42 |
| `years` / `dt` | jak długo i z jakim krokiem | 2,5 / 0,025 |

### 4.5 Suwak `c_rad` — najważniejszy element

W panelu analizy jest kontrolka **radiation inactivation**. To współczynnik
mówiący, jak szybko promieniowanie zabija mikroby.

Przesuń go, a **cała odpowiedź przeliczy się natychmiast**, bez uruchamiania
symulacji. Jest to możliwe, bo funkcja przeżycia faktoryzuje się dokładnie:

```
N/N₀ = exp(−c_rad · D_skumulowana − c_hyd · H_skumulowana)
```

Dawka `D` i hydroliza `H` są zapisane w pliku, więc przeglądarka podstawia nowe
`c_rad` i liczy wynik od nowa. Sprawdziłem to numerycznie: zgodność do
**1,6×10⁻¹⁵**, czyli do precyzji maszynowej.

Są też cztery gotowe organizmy do kliknięcia:

- **D. radiodurans R1** — najodporniejszy znany organizm (2,5×10⁻⁵ 1/Gy)
- **B. subtilis, przetrwalniki** — wartość domyślna (2,5×10⁻⁴)
- **B. subtilis przy 600 g/cm²** — głęboko osłonięty (4,3×10⁻⁴)
- **ostry D10 niskiego LET** — laboratoryjny, **nie stosuje się** do promieni kosmicznych

### 4.6 Tryb prezentacji

| Klawisz | Działanie |
|---|---|
| `P` | włącz / wyłącz tryb prezentacji |
| `1`–`6` | skok do rozdziału |
| `←` `→` | poprzedni / następny rozdział |
| `Esc` | wyjście |

Sześć rozdziałów:

1. **The rock** — Mars w chwili wyrzutu
2. **The swarm** — 14 odłamków, orbity się „oddychają"
3. **Dose accumulating** — kolor to dawka
4. **Size is the story** — rozmiar decyduje o osłonie
5. **The honest answer** — suwak `c_rad` na scenie, na żywo
6. **Wait a hundred times longer** — przebieg 100 tys. lat

---

## 5. Fizyka: co dokładnie jest liczone

### 5.1 Łańcuch przyczynowy w jednym zdaniu

> Masa gwiazdy → jasność → strumień na powierzchni skały → tłumienie
> Beer-Lamberta → dawka w rdzeniu biologicznym; równolegle temperatura →
> szybkość hydrolizy DNA. Oba kanały wchodzą do funkcji przeżycia jako suma
> wykładników.

### 5.2 Dynamika orbitalna

Silnik: **REBOUND**, całkowanie IAS15 (15. rzędu, adaptacyjny krok).

Jednostki: `(AU, rok, masa Słońca)`, co daje `G = 4π²`.

W scenie: Słońce, 8 planet, do 50 najbliższych gwiazd z katalogu Gaia,
i rój odłamków z uderzenia w Marsa.

**Dlaczego IAS15, a nie coś szybszego.** Symplektyczne całkowanie byłoby
szybsze, ale nie radzi sobie z siłą niekonserwatywną (ciśnienie promieniowania)
ani z bliskimi przelotami obok planet. IAS15 nie ma sekularnego dryfu energii
z samej konstrukcji.

### 5.3 Promieniowanie kosmiczne (GCR) — główny zabójca

To jest najważniejsza część fizyki i najczęściej źle rozumiana.

**Promienie kosmiczne przychodzą spoza Układu Słonecznego.** Nie są to fotony
od Słońca. To naładowane cząstki: ~90% protony, ~9% jądra helu, ~1% ciężkie
jony (HZE).

Konsekwencja, którą sam zmierzyłem w danych:

| Wielkość | Zależność od odległości |
|---|---|
| `uv_local_flux` (światło Słońca) | **r⁻¹·⁹⁰** — prawo odwrotności kwadratu ✓ |
| `gcr_local_flux` (promienie kosmiczne) | **r⁺⁰·⁰⁸** — praktycznie płaskie |

**Dlatego nie ma czegoś takiego jak „gorące peryhelium".** Zaproponowano taki
wykres, i go **nie zrobiłem**, bo pokazywałby gradient, którego nie ma.
Test w kodzie zapisuje te wykładniki, żeby nikt tego nie zbudował później.

**Kalibracja dawki.** 1,0 jednostki modelowej GCR = **0,194 Gy/rok**.
Wartość z Mileikowsky et al. (2000), Tabela IV, wiersz przy zerowej osłonie
(19,4 cGy/rok). Zweryfikowana wobec dwóch niezależnych źródeł: dawka GCR
w przestrzeni międzyplanetarnej to 150–300 mGy/rok w minimum słonecznym.

> **Uwaga.** Recenzent twierdził, że ta wartość jest 10× za duża. Sprawdziłem
> sam: pomylił jednostki, czytając „19–20 cGy/rok" jako 0,019 Gy/rok. To jest
> 0,19 Gy/rok. Kontrola została zapisana w kodzie w obu jednostkach, właśnie
> dlatego, że to miejsce, gdzie łatwo o taką pomyłkę.

### 5.4 Osłona: prawo Beer-Lamberta

```
A = exp(−k · ρ · x)
```

gdzie `k` to masowy współczynnik tłumienia [m²/kg], `ρ` gęstość, `x` droga.

**Dwa kanały, dwa bardzo różne współczynniki:**

| Kanał | k [m²/kg] | Droga tłumienia przy ρ≈3000 |
|---|---|---|
| fotony (światło gwiazdy) | 0,01 | **≈ 3,3 cm** |
| GCR | 6,25×10⁻⁴ | **≈ 0,53 m** |

To jest **sedno całej pracy**. Cienka skorupa zatrzymuje światło. Promienie
kosmiczne potrzebują pół metra skały.

**Co to znaczy dla tego roju.** Odłamki mają 1,3–57,5 mm, czyli 0,4–17 g/cm².
Policzyłem transmisję:

- największy odłamek (57,5 mm) przepuszcza **90%** promieniowania do środka
- najmniejszy przepuszcza **99,8%**

**Ten rój jest praktycznie bez osłony.** To nie jest wada — to legalny reżim,
który literatura opisuje (Mileikowsky podaje 12–15 Myr przeżycia dla ciał
poniżej 3 cm). Ale wyniku **nie wolno cytować tak, jakby dotyczył metrowego
głazu**, bo tam jest 1 Myr za 1 m osłony.

### 5.5 Znane ograniczenie: narastanie kaskady

Beer-Lambert jest monotoniczny — mówi, że dawka spada z każdym gramem osłony.
**Promienie kosmiczne tak się nie zachowują.**

Cząstka pierwotna produkuje cząstki wtórne szybciej, niż sama jest pochłaniana,
więc dawka **rośnie** z głębokością zanim zacznie spadać. Tabela Mileikowsky'ego,
z której model bierze kalibrację, pokazuje to wprost:

| osłona [g/cm²] | dawka [cGy/rok] |
|---|---|
| 0 | 19,4 |
| 10 | 23,8 |
| **30** | **24,9 ← szczyt** |
| 100 | 18,3 |
| 800 | 0,06 |

Dawka rośnie o **28%** zanim zacznie opadać. Rój (0,4–17 g/cm²) siedzi
w całości w tej strefie, więc model ma tam **zły znak gradientu**. Błąd jest
ograniczony do ~25% i idzie w stronę optymistyczną. Jest to opisane w kodzie,
w `radiation/shielding_model.py`.

### 5.6 Temperatura

Równowaga radiacyjna szarego ciała:

```
T = ((1 − A) · F / 4σ)^(1/4)
```

`A` to albedo, `F` strumień, `σ` stała Stefana-Boltzmanna. Dzielenie przez 4
odpowiada ciału szybko rotującemu (pochłania przekrojem πr², wypromieniowuje
całą powierzchnią 4πr²).

Sprawdziłem to niezależnie: dla realistycznych albedo daje **46,1 K przy
33,6 AU** i **~260 K przy 1 AU**. Model eksportuje 46,0–260,4 K. Zgodność
lepsza niż 1%.

Wnętrze: `T(r) = T_s + Q/(6k_th)·(R² − r²)` — dokładne rozwiązanie stacjonarne
dla kuli grzanej równomiernie.

### 5.7 Trzy skale rozmiarów

Ciała w tej scenie różnią się promieniem o **jedenaście rzędów wielkości** —
od milimetrowego kamienia do Słońca. **Żadna pojedyncza skala tego nie obejmie.**

Liczby, które to przesądzają:
- odłamek 57,5 mm w skali planet miałby **4,9×10⁻⁸ piksela**
- Słońce w skali planet miałoby 363 jednostki przy orbicie Merkurego 28 —
  **połknęłoby układ wewnętrzny**

Rozwiązanie: **trzy jawnie nazwane skale**, każda z prawdziwymi proporcjami
wewnątrz siebie.

| Rodzina | Czynnik | Efekt |
|---|---|---|
| planety | ×1300 | Jowisz : Merkury = **29,3 : 1** (prawda) |
| Słońce | osobno | nie połyka orbity Merkurego |
| odłamki | ×8×10¹¹ | 0,59 do 17,8 px |

Wcześniej planety były przeskalowane pierwiastkiem sześciennym na pasmo
5–11 jednostek, co dawało stosunek **2,2:1** zamiast 29,3:1 — spłaszczenie
rzeczywistości **13-krotne**. Jeden wspólny mnożnik skraca się w stosunku,
i to jest cały powód, dla którego działa.

**Co NIE jest przeskalowane:** odległości orbitalne, czasy przelotu, dawki
i przeżywalność. Powiększone są tylko kule oznaczające położenia.

---

## 6. Chemia i biologia: jak giną mikroby

### 6.1 Dwa niezależne kanały śmierci

```
N/N₀ = exp(−c_rad · D − c_hyd · H)
```

- `c_rad · D` — promieniowanie: dawka skumulowana razy wrażliwość organizmu
- `c_hyd · H` — hydroliza: chemiczny rozpad DNA

Sprawdziłem numerycznie na wszystkich 14 odłamkach: równość zachodzi
z błędem **1,6×10⁻¹⁵**. To dlatego suwak `c_rad` może przeliczać wynik
w przeglądarce.

### 6.2 Hydroliza DNA — chemia

**Co to jest.** DNA w wodzie samo się rozpada. Wiązanie między zasadą
a cukrem pęka (depurynacja), zostaje „dziura" w nici. Nie potrzeba do tego
promieniowania — wystarczy woda i temperatura.

**Kinetyka Arrheniusa:**

```
k = A · exp(−Ea / (R·T)) · a_w · w_water
```

| Stała | Wartość | Źródło |
|---|---|---|
| `A` (czynnik przedwykładniczy) | 2,3×10¹¹ 1/s | dopasowane do pomiaru |
| `Ea` (energia aktywacji) | 130 kJ/mol | **Lindahl & Nyberg (1972)**, Biochemistry 11:3610 |

Sprawdzenie: `k(310 K) = 2,86×10⁻¹¹ 1/s` wobec zmierzonych ~3×10⁻¹¹ w 37°C.
Zgodność lepsza niż 5%.

**Aktywność wody `a_w`.** Poniżej zera woda jest w równowadze z lodem,
więc jej aktywność spada. Wzór z obniżenia temperatury zamarzania. To dodaje
6 kJ/mol do efektywnej energii aktywacji, więc zmierzone w danych 135 kJ/mol
to nie błąd — to 130 + 6.

### 6.3 Dlaczego hydroliza jest tu prawie nieistotna

Zmierzyłem rozrzut w roju:

| Wielkość | Rozrzut między odłamkami |
|---|---|
| dawka GCR | **1,3×** |
| hydroliza | **119 rzędów wielkości** |

Hydroliza waha się gigantycznie, bo jest wykładnicza w temperaturze, a odłamki
wędrują od 46 K do 260 K. Ale w wartościach bezwzględnych jest **znikoma**:
nigdy nie przekracza ~1% całkowitego tempa zabijania.

To dało jeden z ciekawszych wykresów — wykres Arrheniusa, gdzie ta zależność
jest prostą o `r = −0,9992` i odtwarza energię aktywacji **135 kJ/mol**,
czyli podręcznikową wartość dla hydrolizy wiązania fosfodiestrowego DNA.

### 6.4 Współczynnik `c_rad` — najważniejsza liczba i największa niepewność

Źródło: **Mileikowsky et al. (2000)**, *Icarus* 145(2):391–427.

```
c_rad = (częstość zabijania na rok) / (moc dawki w Gy na rok)
```

Wartości używane w programie:

| Wartość | Organizm |
|---|---|
| 2,5×10⁻⁵ 1/Gy | D. radiodurans R1 (najodporniejszy) |
| **2,5×10⁻⁴ 1/Gy** | B. subtilis, przetrwalniki (domyślna) |
| 4,3×10⁻⁴ 1/Gy | B. subtilis przy 600 g/cm² |

**Dwie pułapki w tabeli źródłowej** (obie udokumentowane w kodzie):

1. Kolumny częstości zabijania mają **mnożnik w nagłówku**: ×10⁻⁵ dla
   *B. subtilis*, ×10⁻⁶ dla *D. radiodurans*. Pominięcie go daje wynik
   100 000–1 000 000× za duży.
2. Kolumna mocy dawki jest w **cGy/rok, nie Gy/rok** — kolejny czynnik 100.

**Weryfikacja odczytu.** Tabela sama się sprawdza: przy zerowej osłonie
*B. subtilis* ma 2,1×10⁻⁵ /rok, a `ln(10⁶)/2,1×10⁻⁵ = 0,658 Ma` wobec
stabelaryzowanych 0,66 Ma.

### 6.5 Uczciwe zastrzeżenie

`c_rad` **nie jest stałą**. W samej tej tabeli rośnie ~4× z głębokością osłony
(bo widmo LET twardnieje) i różni się ~3× między gatunkami.

W wysłanym roju przeżywalność koreluje z wylosowanym `c_rad` na poziomie
**r = −0,993**. Odpowiedź modelu jest więc, w pierwszym przybliżeniu,
**stwierdzeniem o tym współczynniku** — i dlatego interfejs pozwala go ruszać.

### 6.6 Współczynnik bez źródła

`HYDROLYSIS_SURV_COEFF = 1200` w `biology/constants.py` **nie ma cytowania**.
Kod mówi to wprost:

> AUDIT WARNING — NO CITED SOURCE. Written historically as 1.2 / 0.001.
> No peer-reviewed derivation found.

To jest właściwy sposób noszenia niepewnej stałej: nazwać ją, a nie ukryć.
Praktycznie nie ma znaczenia, bo czynnik Arrheniusa i tak wygasza ten kanał.

---

## 7. Wykresy: co każdy z nich mówi

### 7.1 Same dose, different fate ⭐ najważniejszy

Siedem odłamków, które przeżywają 100 tys. lat, pochłania **18 776–19 793 Gy**,
czyli rozrzut **5,4%**. Ich przeżywalność różni się **522-krotnie**.

Środowisko było praktycznie identyczne. Różnica jest w **organizmie**, nie
w podróży. To teza projektu w jednym obrazku.

Rysowany jako wykres parowany (nie punktowy) właśnie po to, żeby linie się
krzyżowały — wtedy nie da się wyczytać historii, w której zrobiło to
środowisko.

### 7.2 Diagram fazowy przeżycia ⭐

```
czas życia = promień początkowy / tempo erozji
```

Przewiduje los **14 z 14** odłamków. Bez ani jednego dopasowywanego parametru.

I nie jest to zwykły próg rozmiaru: odłamek 3,15 mm zginął, a 2,71 mm przeżył,
bo tempo erozji zależy od składu skały i zmienia się **5,2-krotnie**
(17,1 µm/kyr dla żelazokamienia, 89,5 dla chondrytu CI).

**Test poza próbką:** to samo prawo, bez zmian, przewiduje 14 z 14 losów
w przebiegu 1 mln lat. Jedyny ocalały ma policzony czas życia 1062 tys. lat
przy biegu 1000 tys. — czyli prawo jest testowane dokładnie na granicy.

### 7.3 Wykres Arrheniusa

`log(szybkość hydrolizy)` wobec `1000/T`. Prosta o `r = −0,9992` z 2100 próbek,
dająca energię aktywacji **135 kJ/mol**.

Ten wykres nie pokazuje korelacji — **odtwarza znaną stałą**, którą chemik
może sprawdzić.

### 7.4 Pozostałe

| Wykres | Co mówi |
|---|---|
| **Surviving microbial fraction** | przeżywalność w czasie, jedna linia na odłamek |
| **Distance from the Sun** | odległość heliocentryczna, pokazuje eliptyczność orbit |
| **Orbital energy** | ε < 0 znaczy związany ze Słońcem |
| **Where the dose comes from** | GCR kontra rozpad wewnętrzny (2376× różnicy) |
| **Dust erosion** | ubytek promienia w ppm |
| **The answer surface** | `c_rad` wobec dawki, z konturami przeżywalności |
| **Shielding against depth** | transmisja wgłąb odłamka, dwa kanały |

---

## 8. Trzy przebiegi symulacji

Menu **Analysis** → sekcja „simulation run". To **trzy różne pytania**, nie
trzy długości.

### 3000 lat (domyślny, konferencyjny)

151 klatek. **Nic nie ginie** — najgorszy odłamek zachowuje 77,5% mikrobów.
Wszystkie wykresy są skalibrowane pod ten przebieg.

Wniosek: przelot przez Układ Słoneczny jest **do przeżycia**.

### 100 tysięcy lat

101 klatek. **Siedem z czternastu odłamków zniszczonych** — ale nie przez
promieniowanie. Ich własne dawki przewidują 3–86% przeżycia. Zniknęły, bo
**erozja pyłowa starła je do mikrometra**.

Tu pojawiają się dwa wykresy, których nie ma w krótkim biegu: diagram fazowy
i „same dose, different fate".

### 1 milion lat

201 klatek. **Trzynaście z czternastu zniszczonych.** Ocalał tylko największy
(33,9 mm), ale jego przeżywalność to **1,5×10⁻¹⁰** — cztery rzędy wielkości
za progiem sterylizacji.

**Uczciwa odpowiedź narzędzia na własne pytanie: ten rój nie przelatuje.**
Transfer międzygwiezdny trwa dziesiątki milionów lat, a tu po jednym milionie
nie ma już nic żywego.

---

## 9. Czego model NIE robi

Uczciwa lista ograniczeń. Warto ją znać, zanim ktoś zapyta.

1. **Nie ma pełnego transportu cząstek.** Beer-Lambert jest modelem efektywnym.
2. **Jeden skalar `k` na kanał.** Brak zależności od energii, brak osobnych
   przekrojów czynnych dla protonów, cząstek α i HZE w osłonie.
3. **Brak narastania kaskady** (patrz §5.5) — model ma zły znak gradientu
   w pierwszych ~100 g/cm², błąd do ~25% w stronę optymistyczną.
4. **Kule jednorodne**, dawka liczona w środku.
5. **Brak potencjału galaktycznego.** Gwiazdy Gaia to punkty w próżni.
6. **Gamma wewnętrzna to przybliżenie analityczne**, nie Monte Carlo.
7. **Brak sublimacji lodu, spalacji, ablacji atmosferycznej** przy celu.
8. **Jeden przebieg = jedno losowanie.** Brak zespołów, więc brak rozkładu
   wyniku.
9. **Cykl słoneczny 11-letni nie jest modelowany.** 0,194 Gy/rok to wartość
   z minimum słonecznego; średnia po cyklu byłaby niższa.

---

## 10. Skąd wiadomo, że liczby są dobre

### Testy

- **638 testów** po stronie wizualizacji
- **290 testów** po stronie modelu

Nie sprawdzają tylko, czy kod się nie wywala. Sprawdzają fizykę:

- czy funkcja przeżycia faktoryzuje się do precyzji maszynowej
- czy temperatury mieszczą się między najzimniejszą a najgorętszą fizycznie
  dopuszczalną wartością, w każdej klatce dla każdego odłamka
- czy `β` jest odwrotnie proporcjonalne do promienia
- czy implikowana gęstość ziarna każdej z 24 skał to gęstość istniejącego
  materiału
- czy jasność na wykresie dawki rośnie monotonicznie

### Niezależne weryfikacje

Każdą kluczową liczbę przeliczyłem od zera:

| Wielkość | Model | Kontrola niezależna |
|---|---|---|
| dawka GCR | 0,184–0,242 Gy/rok | 150–300 mGy/rok (minimum słoneczne) ✓ |
| temperatura | 46,0–260,4 K | 46,1–260 K (ciało szare) ✓ |
| β | 4,9×10⁻⁶–2,9×10⁻⁴ | 2,4×10⁻⁶–3,8×10⁻⁴ (wzór Burnsa) ✓ |
| hydroliza w 37°C | 2,86×10⁻¹¹ 1/s | ~3×10⁻¹¹ (Lindahl & Nyberg) ✓ |
| faktoryzacja | — | błąd 1,6×10⁻¹⁵ ✓ |

### Prowenancja

Każdy plik wynikowy niesie: ziarno losowania, skrót SHA-256 parametrów,
commit gita, flagę „dirty", wersje bibliotek i **listę audytowanych
współczynników** z cytowaniami. Skrót obejmuje także te współczynniki, więc
zmiana kalibracji dawki zmienia odcisk palca.

### Co poszło źle po drodze

Warto to wiedzieć, bo pokazuje, jakiego typu błędy tu występowały:

- Shader mnożył teksturę przez kolor identyfikacyjny — kanał czerwony Ziemi
  wychodził wyzerowany, kontynenty nie miały prawa się pojawić
- `keplerSafe` używało półosi zamiast mimośrodu, przez co **Saturn, Uran
  i Neptun stały nieruchomo**
- Wykres budżetu dawki sumował jednostki modelowe z Gy/rok — krzywa dochodziła
  do 3076 Gy, pięć razy więcej niż jakikolwiek odłamek otrzymał
- Erozja była **odwrotnie proporcjonalna** do parametru wydajnościowego
- `iron_nickel` miał gęstość Psyche obok porowatości litego metalu, co
  implikowało gęstość ziarna 4214 kg/m³ — takiego materiału nie ma

Wszystkie naprawione i zabezpieczone testami.

---

## 11. Słowniczek

| Termin | Znaczenie |
|---|---|
| **AU** | jednostka astronomiczna, 149 597 870,7 km, średnia odległość Ziemia–Słońce |
| **Gy (grej)** | jednostka dawki pochłoniętej, 1 J na kg |
| **GCR** | galactic cosmic rays, galaktyczne promieniowanie kosmiczne |
| **HZE** | ciężkie jony o wysokiej energii, ~1% GCR, najgroźniejsze biologicznie |
| **LET** | linear energy transfer, ile energii cząstka oddaje na jednostkę drogi |
| **D10** | dawka redukująca populację dziesięciokrotnie |
| **`c_rad`** | współczynnik inaktywacji radiacyjnej, ułamek ginący na grej |
| **REBOUND** | biblioteka do całkowania problemu N ciał |
| **IAS15** | całkowanie 15. rzędu, adaptacyjny krok, bez dryfu energii |
| **elementy oskulacyjne** | elipsa, po której ciało leciałoby, gdyby zniknęły wszystkie siły poza grawitacją Słońca |
| **`β` (beta)** | stosunek ciśnienia promieniowania do grawitacji |
| **Beer-Lambert** | prawo wykładniczego tłumienia w ośrodku |
| **hydroliza** | rozpad chemiczny pod wpływem wody |
| **depurynacja** | odłączenie zasady purynowej od szkieletu DNA |
| **prowenancja** | zapis pochodzenia wyniku: ziarno, kod, wersje, współczynniki |
| **replay** | plik JSON z zapisem przebiegu, klatka po klatce |

---

## Źródła

- **Mileikowsky, C. et al. (2000)**, *Icarus* 145(2):391–427,
  doi:10.1006/icar.1999.6317 — współczynniki przeżycia, dawka GCR
- **Lindahl, T. & Nyberg, B. (1972)**, *Biochemistry* 11(19):3610–3618,
  doi:10.1021/bi00769a018 — kinetyka hydrolizy DNA
- **Cresswell, A., Carter, J. & Sanderson, D. (2018)**,
  *Radiation Measurements* 120:195–201 — dawki od U/Th/K
- **Gosse, J. & Phillips, F. (2001)**, *Quaternary Science Reviews* 20:1475 —
  długość tłumienia promieni kosmicznych
- **Belbruno, E. et al. (2012)**, *Astrobiology* 12(8):754–774 — czasy
  transferu międzygwiezdnego
- **Zeitlin, C. et al. (2013)**, *Science* 340:1080 — pomiary MSL/RAD
- **Burns, J., Lamy, P. & Soter, S. (1979)**, *Icarus* 40:1–48 — ciśnienie
  promieniowania
- **Crameri, F. et al. (2020)**, *Nature Communications* 11:5444 — paleta
  barw batlow
- **Okabe, M. & Ito, K. (2008)** — paleta bezpieczna dla daltonistów
