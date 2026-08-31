# Prezentacja — 5 slajdów

Zrzuty ekranu: `prezentacja/screeny/` (38 plików, 3840×2160, gotowe do wrzucenia
na slajd bez skalowania w górę).

---

## Zasada nadrzędna

Ten projekt ma **jeden wynik i jedno zdanie**:

> Odpowiedź modelu jest, w pierwszym przybliżeniu, stwierdzeniem o jednym
> współczynniku, którego nikt nie ustalił. `c_rad` odpowiada za **94%** rozrzutu.

Wszystkie pięć slajdów prowadzi do tego zdania i od niego wraca. Nie
opowiadaj o architekturze, testach ani o technologii — to jest materiał na
pytania z sali, nie na slajd.

**Jeden slajd = jeden obraz + maksymalnie trzy linijki tekstu.** Ekran ma
1920 px szerokości; wszystko drobniejsze niż podpis osi i tak nie dojdzie do
dwunastego rzędu.

---

## Slajd 1 — Lithopanspermia

**Obraz:** `21-prez-2-roj.png` — czarne tło, Słońce, kolorowe elipsy
oskulacyjne czternastu odłamków. Zero interfejsu, sam widok.

**Tekst na obrazie (biały, duży, lewy górny róg):**

```
LITHOPANSPERMIA
Czy życie może przelecieć między układami gwiezdnymi?
```

**Co mówisz (30 s):** hipoteza jest spekulatywna w konkluzji, ale nie
w przesłankach. Uderzenia wyrzucają skałę powyżej prędkości ucieczki — mamy
meteoryty marsjańskie. Mikroorganizmy mają udokumentowane tolerancje na
próżnię, wstrząs i promieniowanie. Dawka w tranzycie **daje się policzyć,
a nie założyć**. Brakowało modelu, który przeprowadzi odłamek od wyrzutu do
przylotu.

> Ten slajd nie ma bulletów. Jeden obraz, jedno pytanie.

---

## Slajd 2 — Przyrząd

**Obraz:** `12-widok-badawczy-3000lat.png` — pełny układ: konsola parametrów
po lewej, ciemna scena w środku, panel analizy po prawej, pasek transportu
na dole.

**Tekst:** trzy podpisy z cienkimi liniami odchodzącymi do obrazu:

```
← 15 parametrów modelu, każdy z opublikowanym zakresem i źródłem
  ciemny prostokąt = obserwacja, wszystko wokół = przyrząd
  9 wykresów liczonych z odtwarzanego biegu, klatka po klatce →
```

**Co mówisz (45 s):** łańcuch przyczynowy w jednym zdaniu — masa gwiazdy →
jasność → strumień na powierzchni skały → tłumienie Beer-Lamberta przez skałę
i rdzeń biologiczny → dawka skumulowana → ułamek przeżywających mikrobów.
Trzy tysiące lat całkowania N-ciałowego (REBOUND, IAS15) istnieje po to, żeby
powiedzieć **jedną liczbę: jaką dawkę wziął odłamek**.

**Wstawka w rogu, jeśli masz sekundę:** `03-konsola-uruchomieniowa.png` —
pokazuje, że każdy parametr jest edytowalny i opisany.

---

## Slajd 3 — Wynik (szczyt wystąpienia)

**Obraz:** `50-wykres-3000lat-01-the-answer-surface.png` — powierzchnia
odpowiedzi. Dawka na osi poziomej, `c_rad` na pionowej, obie logarytmiczne,
więc kontury `exp(−cD)` są prostymi o nachyleniu −1. Zacieniony pas to
opublikowane pasmo chroniczne. Czternaście punktów to rój.

**Tekst pod obrazem, dużą czcionką:**

```
6,0×10⁻⁴⁶  ←—————————————————→  1,0×10⁻²
43 rzędy wielkości. Jeden współczynnik odpowiada za 94% tego rozrzutu.
To NIE jest przedział ufności.
```

**Co mówisz (60 s):** `c_rad` jest **ustaloną liczbą, której nie znamy** — nie
zmienną losową, którą próbkujemy. Literatura (Mileikowsky et al. 2000) daje
zakres 2,5×10⁻⁵ – 4,3×10⁻⁴ 1/Gy, czyli czynnik 17. Pasmo jest narysowane
z twardymi końcami, bez gradientu, bo gradient sugerowałby gęstość, której nie
ma. Zacieniony jest **pas, nie linia** — linia środkowa wymyśliłaby wartość
preferowaną, której źródło nie podaje.

**Rezerwowy obraz na to samo:** `02-pasmo-wyniku.png` — samo pasmo wyniku,
wycięte, jeśli chcesz slajd bez wykresu.

---

## Slajd 4 — Dwa odkrycia, których nie szukaliśmy

**Obraz:** `60-wykres-100tys-01-the-rock-fails-before-the-life-inside-it.png` —
czternaście pasów: długość to jak długo skała przetrwała, kolor to ile
populacji jeszcze żyło, gdy skała znikła.

**Tekst:**

```
7 z 14 odłamków startych przez pył — i 7 z nich wciąż żyło, gdy skała znikła.
czas życia = promień początkowy / tempo erozji   ·   14/14, zero dopasowanych parametrów
Ta sama dawka (rozrzut 5,4%), przeżywalność różna 522-krotnie.
```

**Co mówisz (45 s):** to wyszło z biegu uruchomionego po coś innego. Prawo
czasu życia przewiduje los **14 z 14** odłamków w biegu 100 tys. lat, a potem —
bez żadnej zmiany — **14 z 14** w biegu milionletnim, dziesięć razy dłuższym.
To jest test poza próbką. I nie jest to zwykły próg rozmiaru: odłamek 3,15 mm
zginął, a 2,71 mm przeżył, bo tempo erozji zależy od składu.

Drugie odkrycie: siedem odłamków przeżywających 100 tys. lat pochłania
18 776 – 19 793 Gy, czyli praktycznie identyczne środowisko — a ich
przeżywalność różni się 522 razy. **Różnica jest w organizmie, nie w podróży.**
To jest teza projektu w jednym obrazku i wyszła z danych, nie z założeń.

> Wariant: zestaw obok siebie `50-wykres-3000lat-01-the-answer-surface.png`
> i `60-wykres-100tys-02-the-answer-surface.png` — ten sam wykres po 3 tys.
> i po 100 tys. lat. Chmura punktów zjeżdża poniżej progu sterylizacji.
> Bardzo mocne wizualnie.

---

## Slajd 5 — Uczciwa odpowiedź + demo na żywo

**Obraz:** `24-prez-5-odpowiedz.png` — rozdział 5 trybu prezentacji: scena,
karta `radiation inactivation` na środku, panel analizy po prawej.

**Tekst:**

```
N/N₀ = exp(−c_rad·D − c_hyd·H)   — przeżywalność faktoryzuje się dokładnie
Dlatego suwak przelicza całą odpowiedź w przeglądarce, bez nowej symulacji.
Sterylizacja (10⁻⁶) po 133 tys. – 3,0 mln lat. Transfer trwa dziesiątki mln.
```

**Co robisz (60 s):** przechodzisz na żywo do przeglądarki, wciskasz `P`,
potem `5`, i **przeciągasz suwak**. Cztery gotowe organizmy do kliknięcia:
*D. radiodurans* R1, przetrwalniki *B. subtilis*, *B. subtilis* przy
600 g/cm², i ostry D10 niskiego LET — ten ostatni **nie stosuje się** do
promieni kosmicznych, powiedz to głośno, ktoś na sali to wie.

**Zdanie zamykające:** model odpowiada „nie" własnemu pytaniu w tej
konfiguracji — po milionie lat zostaje jeden odłamek z przeżywalnością
1,5×10⁻¹⁰, cztery rzędy poniżej progu sterylizacji. To jest wynik, nie
usterka: to ilościowa postać argumentu, że lithopanspermia wymaga **dużych,
dobrze osłoniętych** odłamków. Dlatego `q_size` jest teraz wystawionym
parametrem.

---

# Które zrzuty są najlepsze

## Klasa A — te wchodzą na slajdy

| Plik | Co przedstawia | Gdzie |
|---|---|---|
| `21-prez-2-roj.png` | rój elips na czarnym tle, zero UI — najładniejszy obraz w projekcie | slajd 1 |
| `12-widok-badawczy-3000lat.png` | cały przyrząd naraz, scena wypełniona orbitami | slajd 2 |
| `50-wykres-3000lat-01-the-answer-surface.png` | powierzchnia odpowiedzi, powiększona | slajd 3 |
| `60-wykres-100tys-01-the-rock-fails-before-the-life-inside-it.png` | 14 pasów: erozja kontra promieniowanie | slajd 4 |
| `24-prez-5-odpowiedz.png` | suwak `c_rad` na scenie + panel analizy | slajd 5 |

## Klasa B — rezerwa i pytania z sali

| Plik | Kiedy się przyda |
|---|---|
| `02-pasmo-wyniku.png` | slajd 3 bez wykresu, sama liczba i ostrzeżenie |
| `60-wykres-100tys-02-the-answer-surface.png` | zestawienie „3 tys. ↔ 100 tys. lat" |
| `23-prez-4-rozmiar.png` | „a co z osłoną?" — głębokość tłumienia to pół metra |
| `03-konsola-uruchomieniowa.png` | „skąd wasze parametry?" — każdy ma źródło |
| `30-morris-sensitivity.png` | „robiliście analizę wrażliwości?" — Morris, 108 przebiegów, 8 czynników |
| `45-jak-doszlismy-do-liczby.png` | „jak doszliście do tej liczby?" |
| `50-wykres-3000lat-05-where-the-dose-comes-from.png` | „a rozpad U/Th/K w skale?" — 0,04% całości |
| `31-grid-heatmap.png` | „przeszukaliście przestrzeń parametrów?" |
| `44-menu-view.png` | skala interfejsu pod projektor / dużą salę |

## Klasa C — nie używać na slajdach

`32-research.png`, `33-further-details.png` — dużo tekstu, nieczytelne z sali.
`36-widok-badawczy-100tys.png`, `01-widok-badawczy.png` — scena pusta, bo
w biegu 100 tys. lat rój rozjeżdża się poza kadr. Pozostałe menu.

---

# Plan wykonania

## 1. Format i szablon (15 min)

- 16:9, 1920×1080. Zrzuty są 3840×2160, więc wchodzą przy 200% i nie będą
  miękkie na projektorze.
- **Tło slajdów czarne albo bardzo ciemne grafitowe.** Zrzuty sceny mają
  czarne tło; na białym slajdzie zobaczysz brzydką ramkę. Wykresy z panelu
  analizy też są ciemne.
- Jeden krój, dwa stopnie: tytuł ~54 pt, podpis ~28 pt. Nic mniejszego.
- Akcent: ten sam stonowany granat, którego używa interfejs — nie pomarańcz.

## 2. Montaż slajdów (60 min)

1. Wrzuć pięć obrazów klasy A na pięć pustych slajdów, na pełne tło.
2. Dopisz tytuły. Dopiero potem podpisy.
3. Slajdy 2 i 4 potrzebują **linii odsyłających** do fragmentów obrazu —
   cienka biała linia 1 px, bez strzałek.
4. Slajd 3 potrzebuje jednej dużej liczby. Zrób ją tekstem w edytorze, nie
   wycinaj z obrazu — musi być ostra.
5. Na końcu przejrzyj wszystko **zmrużonymi oczami z dwóch metrów**. Co
   znika, to trzeba powiększyć albo wyrzucić.

## 3. Demo na żywo (30 min przygotowania)

```powershell
cd C:\Users\Maksg\Desktop\hack4_sages_nowy\web
npx vite --port 4321 --strictPort
```

Otwórz **przebieg konferencyjny**, nie domyślny:

```
http://localhost:4321/?replay=data/cosmos_visualizer_simulation.json
```

> Domyślnie ładuje się bieg 100 tys. lat, w którym rój rozjeżdża się poza kadr
> i scena wygląda na pustą. Na scenę bierz bieg 3000-letni.

- Włącz w dolnym pasku **Comet trails** i **Planet trails** — bez nich scena
  jest czarnym prostokątem z kilkoma kropkami.
- Przewiń do końca biegu, żeby wykresy były wypełnione.
- Menu **View** → skala pod salę (`projektor` albo `duża sala`).
- Klawisze: `P` tryb prezentacji, `1`–`6` rozdziały, `←` `→` przewijanie,
  `Esc` wyjście. Sześć rozdziałów jest już napisanych i odpowiada dokładnie
  temu, co masz na slajdach.

**Czego NIE robić przed wystąpieniem:** nie uruchamiaj
`python tools/export_simulation_to_web.py` — nadpisze replay, pod który
skalibrowane są wszystkie wykresy.

## 4. Próba (2× po 10 min)

- Raz z laptopa, raz podłączony do zewnętrznego ekranu — rozdzielczość się
  zmieni i układ paneli też.
- Zmierz czas. Pięć slajdów plus demo to realnie **4–5 minut**, jeśli nie
  wpadniesz w opowiadanie o architekturze.
- Przygotuj jedno zdanie na wypadek, gdyby demo nie wstało: „mam to na
  slajdzie" i przechodzisz do klasy B.

## 5. Zapas na pytania

Trzymaj otwarte w drugiej karcie `sensitivity.html` (Morris) i `grid.html`
(heatmap). To odpowiada na większość pytań typu „a sprawdzaliście…".

---

# Czego nie wkładać na slajdy

- Liczby testów (284 Pythona, 643 JS). Budują zaufanie w README, na slajdzie
  wyglądają na wypełniacz.
- Architektury katalogów.
- List technologii (Three.js, REBOUND, Vite). Powiedz „REBOUND, IAS15" raz,
  w kontekście dlaczego akurat ten całkownik — i tyle.
- Słów „digital twin" bez wyjaśnienia, co konkretnie jest bliźniakiem.
