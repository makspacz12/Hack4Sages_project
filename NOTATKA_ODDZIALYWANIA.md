# Notatka: fizyczne oddziaływania na asteroidy i życie w środku

Model: rdzeń w `model/microbe_radiation_model/`. Web (`web/`) tylko rysuje wyniki z JSON —
prawdziwa fizyka jest w Pythonie. Poniżej każde oddziaływanie: o co chodzi po ludzku,
wzór, gdzie w kodzie, i **[WADA]** jeśli fizyka jest zaimplementowana wątpliwie.

Geometria obiektu: kula skały o promieniu `R`, w środku mała kulka „bio" (mikroby) o
promieniu `r_bio`. Masa bio = `bio_mass_fraction` (domyślnie 1%) masy skały, więc
`r_bio = R · (ρ_skała/ρ_bio · f)^(1/3)`. Grubość osłony = `R − r_bio`.
Plik: `physics/geometry.py::biological_core_radius`.

---

## 1. Grawitacja / transport (ruch po orbicie)

**Po ludzku:** fragment po wyrzuceniu z Marsa leci w polu grawitacyjnym Słońca i planet.
To decyduje, gdzie fragment się znajdzie i jak długo — a od tego zależy dawka.

**Wzór:** przyspieszenie `a = G·M/r²` skierowane do ciała przyciągającego; całkowane
numerycznie (N-body, biblioteka REBOUND).

**W kodzie:** `simulation/engine.py`, `simulation/reboundx_forces.py`.
Web ma własny zabawkowy silnik `web/src/physics.js` (`a = G·m/(r²+ε²)`, całkowanie
półjawne) — służy tylko do animacji, nie do wyników.

**[WADA — drobna]** Web używa softeningu `ε` i prostego całkowania Eulera-symplektycznego;
to jest wizualizacja, nie liczy dawek, więc nie wpływa na wynik naukowy.

---

## 2. Ciśnienie promieniowania (spycha fragment od gwiazdy)

**Po ludzku:** światło niesie pęd. Fotony bombardujące fragment popychają go na zewnątrz,
osłabiając efektywną grawitację. Im mniejszy fragment, tym silniej (bo stosunek
powierzchni do masy rośnie).

**Wzór:** `β = F_rad / F_grav = 3·L·Q_pr / (16π·c·G·M·ρ·s)`
gdzie `s` = promień ciała, `ρ` = gęstość, `Q_pr ≈ 1 + (2/3)·albedo`.
Efektywne przyspieszenie: `a = −(1−β)·G·M·r/r³` (dla `β>1` fragment jest wypychany).
Jasność z masy gwiazdy: `L = L_⊙·(M/M_⊙)^3.5`.

**W kodzie:** `radiation/pressure.py::compute_beta_single_star`,
`radiation_pressure_accel_nearest_star`. To standardowy wzór Burnsa–Lamy–Sotera. Poprawny.

**[OK]** Kierunek (na zewnątrz, odejmuje się od grawitacji) i skalowanie `1/s` poprawne.

---

## 3. Promieniowanie gwiazdy / „UV" / fotony (ogrzewanie + rzekome UV)

**Po ludzku:** gwiazda świeci; strumień maleje z kwadratem odległości. Część jest
pochłaniana w skorupie skały. W modelu to głównie **grzeje** powierzchnię.

**Wzory:**
- strumień na powierzchni: `F = L / (4π·d²)`
- osłabienie w głąb skały (prawo Beera–Lamberta): `F(x) = F₀·exp(−k·ρ·x)`,
  `k` = masowy współczynnik osłabiania `[m²/kg]`, tu `k = 0.01` → głębokość 1/e
  `= 1/(k·ρ) ≈ 1/(0.01·3000) ≈ 3.3 cm`.

**W kodzie:** `radiation/stellar/radiation_model.py::stellar_flux`,
`radiation/shielding_model.py::attenuation_factor`, składane w `simulation/scenarios.py`.
Eksport nazywa to `uv_surface_flux`, `uv_local_flux`.

**[WADA A — nazewnictwo + rola w biologii]**
1. To **nie jest UV**. Strumień jest **bolometryczny** (`L/4πd²`, całe światło), a `k=0.01`
   m²/kg (0.1 cm²/g) odpowiada raczej miękkiemu promieniowaniu rentgenowskiemu.
   Prawdziwe UV ginie w **poniżej 1 µm** skały, nie w 3 cm. Etykieta `uv_*` jest myląca.
2. Ten kanał **w ogóle nie wchodzi do funkcji przeżycia** (patrz §9). Fotony gwiazdy
   działają tylko pośrednio: podnoszą temperaturę → przyspieszają hydrolizę.
   Jeśli w prezentacji pada „UV zabija mikroby na powierzchni" — model tego nie liczy.
   Dawka biologiczna pochodzi wyłącznie z GCR (§7) i radionuklidów (§8).

---

## 4. Temperatura równowagowa powierzchni (Stefan–Boltzmann)

**Po ludzku:** skała pochłania światło i wypromieniowuje ciepło. Gdy oba się równoważą,
ustala się temperatura. Skała pochłania na kole `πR²`, a promieniuje z całej kuli `4πR²`.

**Wzór:** `T = ((1−A)·F / (4σ))^(1/4)`, `σ` = stała Stefana–Boltzmanna,
`A` = albedo. Równoważnie `T = ((1−A)·L / (16π·σ·d²))^(1/4)`.

**W kodzie:** `thermal/surface_temperature.py::equilibrium_temperature_from_flux`. Poprawne.

**[WADA K — drobna]** Emisyjność `ε` przyjęta = 1 (pominięta). Brak podziału na stronę
dzienną/nocną i rotację — to model „szybkiego rotatora" (kula izotermiczna). Dla zimnej
skały w przestrzeni różnice są małe.

---

## 5. Ciepło radiogeniczne + przewodnictwo (temperatura wewnątrz)

**Po ludzku:** rozpad U/Th/K grzeje skałę od środka. Ciepło ucieka przez przewodnictwo do
powierzchni, więc środek jest cieplejszy niż powierzchnia.

**Wzory:**
- moc na jednostkę objętości: `Q = ρ·Σ(cᵢ·wᵢ)` (`cᵢ` — współczynniki ciepła dla U, Th, K;
  `wᵢ` — udziały masowe).
- profil temperatury w kuli ze stałym źródłem (rozwiązanie `∇²T = −Q/k_th`):
  `T(r) = T_pow + Q/(6·k_th)·(R² − r²)`, w środku `T_środek = T_pow + Q·R²/(6·k_th)`.

**W kodzie:** `internal_heat/model.py::heat_production_from_rock`,
`thermal/internal_profile.py::temperature_inside_sphere`. Wzory poprawne.

Uwaga: `k_th` (przewodnictwo cieplne, ~2 W/m·K) jest trzymane osobno od `Material.k`
(osłabianie promieniowania, m²/kg). Kod wyraźnie ostrzega, by ich nie mylić — historycznie
podstawienie jednego za drugie zerowało strumień w rdzeniu.

---

## 6. Hydroliza DNA (chemiczne „przecinanie" DNA przez wodę)

**Po ludzku:** cząsteczki wody powoli rozrywają wiązania w DNA (depurynacja). Im cieplej i
im więcej ciekłej wody, tym szybciej. Poniżej 0 °C woda nie znika całkiem — cienkie
niezamarznięte błonki na ziarnach minerałów wciąż działają, tylko wolno.

**Wzory:**
- Arrhenius: `k = A·exp(−Ea/(R_g·T))`, tu `A = 2.3·10¹¹ /s`, `Ea = 130 kJ/mol`
  (Lindahl & Nyberg 1972).
- aktywność ciekłej wody poniżej zamarzania (równowaga z lodem):
  `ln(a_w) = −(ΔH_top/R_g)·(1/T − 1/T_top)`, `a_w = 1` w `T_top = 273,15 K`,
  `≈ 0,81` przy 253 K.
- łączny efektywny tempo: `k_hyd = A·exp(−Ea/R_g·T)·a_w(T)·w_water`
  (`w_water` = udział masowy wody w skale).

**W kodzie:** `chemistry/hydrolysis_model.py`. Współczynniki cytowane (Lindahl & Nyberg).
Fizyka rozsądna.

**[WADA J — NAPRAWIONE 2026-09-01]** Było: `CONFERENCE_THEORY.md` wiersz 48 nadal pisał
„T < 273,15 K → k = 0" (twarde cięcie), którego kod nie robi (używa ciągłej
`water_activity`). Wiersz 9 tabeli przepisany na `k = A·exp(−Ea/R_gT)·a_w(T)·w_water`
+ przypis o `a_w`. README było już spójne (w. 184 mówi „before the freezing cut was removed").

---

## 7. Galaktyczne promieniowanie kosmiczne (GCR) — GŁÓWNY zabójca w modelu

**Po ludzku:** naładowane cząstki (90% protony, 9% jądra helu, 1% ciężkie jony HZE) lecą
z całej Galaktyki. Wiatr słoneczny częściowo je wymiata blisko gwiazdy, więc **im dalej od
Słońca, tym więcej GCR**. Przenikają skałę ~16× głębiej niż fotony.

**Wzory:**
- modulacja słoneczna (natężenie względem 1 AU):
  `f(r) = M − (M−1)·exp(−(r−1)/L)`, tu `M = 1,3` (poziom międzygwiazdowy / 1 AU),
  `L = 10 AU` (skala). Rośnie z `r`, ~3%/AU przy 1 AU.
- osłona w skale (Beer–Lambert z własnym współczynnikiem): `exp(−k_GCR·ρ·x)`,
  `k_GCR = 1/1600 m²/kg` (długość osłabiania ~160 g/cm², Gosse & Phillips 2001).
- kalibracja na dawkę: `1,0` jednostki modelu `= 0,194 Gy/rok`
  (Mileikowsky i in. 2000; daje ~0,18–0,24 Gy/rok dla nieosłoniętego ciała — zgodne z
  pomiarami MSL/RAD i NASA dla przestrzeni międzyplanetarnej).

**W kodzie:** `radiation/cosmic/cosmic_radiation_model.py` (modulacja),
`cosmic_spectrum.py` (skład), `radiation/shielding_model.py` (osłona),
`simulation/scenarios.py` (kalibracja `GCR_MODEL_UNIT_TO_GY_PER_YEAR = 0.194`).

**[WADA B — brak build-up / maksimum Pfotzera]** Beer–Lambert jest monotoniczny (dawka
tylko maleje z głębokością). Dla naprawdę cienkich osłon (0,4–17 g/cm², czyli cały
domyślny rój!) dawka GCR **realnie rośnie** z głębokością do maksimum, bo cząstka
pierwotna produkuje kaskadę wtórnych szybciej, niż jest pochłaniana. Tabela w kodzie:
przy 10 g/cm² dawka jest **+23%** względem powierzchni, a model przewiduje −6%.
Skutek: model **zaniża dawkę i zawyża przeżycie** małych fragmentów, do ~25% w dawce.
Ograniczenie jest w modelu opisane, ale realne. Dla ciał metrowych i większych
(o które naprawdę chodzi w panspermii) wykładnik jest OK.

**[WADA C — za mała amplituda modulacji]** `M = 1,3` znaczy, że GCR w ośrodku
międzygwiazdowym jest tylko o 30% wyższe niż przy 1 AU. Realnie natężenie GCR przy 1 AU
jest **stłumione ~2–10×** względem lokalnego ośrodka międzygwiazdowego (zależnie od cyklu
słonecznego). Kształt (rośnie z `r`) jest dobry, ale **zakres gradientu mocno zaniżony** —
przez to trajektoria fragmentu wpływa na dawkę słabiej, niż powinna.

**[WADA D — heliosfera ∝ √L]** `cosmic_flux_by_star` skaluje promień heliosfery jako
`120 AU·√(L/L_⊙)`. Fizycznie rozmiar heliosfery zależy od ciśnienia wiatru gwiazdowego
kontra ośrodek międzygwiazdowy, nie od jasności. To słabe przybliżenie (zaznaczone w
docstringu jako „Assumptions").

---

## 8. Wewnętrzne promieniowanie radionuklidów (rozpad U / Th / K w samej skale)

**Po ludzku:** sama skała jest lekko radioaktywna. Mikroby siedzą **wtopione w minerał**,
więc pochłaniają też krótkozasięgowe promieniowanie α i β — a to ono dominuje
(α z uranu ≈ 25× wkład γ). Mała skała „traci" część dawki γ przez własną powierzchnię.

**Wzory:**
- dawka = `Σ (współczynnik_dawki · stężenie)` osobno dla α, β, γ
  (współczynniki Cresswell, Carter & Sanderson 2018, Tab. 5;
  `Gy/rok na ppm` dla U i Th, `Gy/rok na %` dla K).
- poprawka skończonego rozmiaru dla γ (dawka w środku kuli / dawka „nieskończonej matrycy"):
  `D(R)/D_∞ = 1 − exp(−(μ/ρ)·ρ·R)`, `μ/ρ = 0,077 cm²/g`.
  Dla bazaltu: 50% przy ~3 cm, 90% przy ~10 cm, 99% przy ~20 cm promienia.
- α i β mają zasięg milimetrowy → dla każdej sensownej skały to „nieskończona matryca",
  bez poprawki geometrycznej.

**W kodzie:** `radiation/radionuclide_model/gamma.py::radiation_decay_gy_per_year_from_rock`
(to jest właściwa ścieżka dawki, α+β+γ) oraz `gamma_self_dose_fraction` (poprawka).
Wywoływane w `simulation/scenarios.py` przy liczeniu przeżycia z **prawdziwym promieniem
i gęstością fragmentu** (linie ~1082–1093) — to zostało świadomie naprawione.

**[WADA E — NAPRAWIONE 2026-09-01]**
Było: w `scenarios.py` `gamma_dose` do `env_updates` / `radiation_decay_gy_per_year`
(panel + JSON) liczone z `material_config.rock_material.density` (domyślny bazalt),
nie z gęstością fragmentu. Ten sam błąd „jeden fragment, dwa ciała", co naprawiony
wyżej dla przeżycia. Teraz przekazuje `density_kg_m3=rock.density_kg_m3`.

**[WADA F — NAPRAWIONE 2026-09-01]**
Było: `_collect_json_output_payloads` wołało `radiation_decay_gy_per_year_from_rock(rock)`
bez `radius_m`/`density_kg_m3` → wartość „nieskończonej matrycy" (górne ograniczenie),
podczas gdy przeżycie używa wersji z poprawką skończonego rozmiaru. Teraz przekazuje
`radius_m=rock.radius_m, density_kg_m3=rock.density_kg_m3` — eksportowane
`gamma_surface_flux` / `gamma_local_flux` zgadzają się z tym, co faktycznie zabija mikroby.

**[WADA H — proxy „pola gamma" bez kalibracji]**
`internal_gamma_rate_from_rock` liczy `A_v·(1−exp(−μR))/μ`. Jednostki wychodzą `Bq/m²`,
to **nie jest dawka [Gy/s]**, tylko niekalibrowane proxy. Nie mylić z
`radiation_decay_gy_per_year_from_rock`. Sprawdzić, czy `internal_gamma_rate` nie trafia
gdzieś jako dawka (jeśli tylko jako pole informacyjne — OK).

---

## 9. Funkcja przeżycia (jak dawka + hydroliza przekładają się na % żywych)

**Po ludzku:** każda „porcja" dawki i każda reakcja hydrolizy ma szansę zabić komórkę.
Zakładamy model „jednego trafienia": liczba żywych spada wykładniczo.

**Wzór:**
```
N/N₀ = exp( −(c_rad·dawka_rate + k_hyd·c_hyd) · t )
```
- `c_rad` (`radiation_surv_coeff`) `[1/Gy]` — jak bardzo promieniowanie szkodzi;
  próbkowane per fragment `2,5·10⁻⁵ … 4,3·10⁻⁴ 1/Gy` (domyślnie `2,5·10⁻⁴`),
  z Mileikowsky i in. 2000 (spory B. subtilis / D. radiodurans).
- `dawka_rate` = `radiation_space` (GCR po osłonie) + `radiation_decay` (radionuklidy).
- `k_hyd` = tempo hydrolizy `[1/s]`, `c_hyd = HYDROLYSIS_SURV_COEFF = 1200`.
- przeżycia z kroków mnożą się: łącznie `exp(−c_rad·D_cum − c_hyd·H_cum)`.

**W kodzie:** `biology/survival.py::survival_function`, wołane co krok w
`simulation/scenarios.py`. `biology/constants.py` trzyma współczynniki + notatkę audytową.

**[WADA G — `c_hyd = 1200` bez źródła]** W `biology/constants.py` wprost:
„AUDIT WARNING — NO CITED SOURCE". Cała **skala** kanału hydrolizy w przeżyciu jest
umowna — wynik biologiczny może się przez to przesuwać dowolnie. Trzymane jako parametr
wrażliwości, nie jako liczba do cytowania.

**[WADA L — brak naprawy DNA i członu kwadratowego]** Czysto wykładnicze „single-hit":
nie ma reperacji DNA (mikroby się nie „leczą" między porcjami dawki) ani członu
liniowo-kwadratowego. Uproszczenie konserwatywne (raczej zaniża przeżycie w kanale
promieniowania — przeciwny kierunek do wady B).

**[WADA M — `c_rad` niepewne do czynnika ~17]** Zakres w literaturze `2,5·10⁻⁵ … 1,5·10⁻³
1/Gy` (chroniczne vs ostre, zależność od gatunku i twardości widma LET). To **dominujące
źródło niepewności** całego wyniku „ile mikrobów przeżyło". Model to uczciwie próbkuje i
eksportuje `D_cum`, żeby można było przeliczyć wynik dla innego `c_rad`.

---

## 10. Erozja pyłowa (mikrometeoroidy ścierają skałę z zewnątrz)

**Po ludzku:** strumień pyłu międzyplanetarnego uderza w skałę i zdrapuje warstwę po
warstwie. Skała się kurczy → osłona nad mikrobami cieńcze → dawka rośnie.

**Wzór (wyprowadzenie):** strumień masy `Φ [kg/m²/s]` pada na przekrój `πR²`.
Masa ubywa: `dm/dt = Y·Φ·πR²` (`Y` = wydajność wykopu). Objętość: `dV/dt = Y·Φ·πR²/ρ`.
Ale `dV/dt = 4πR²·dR/dt`, więc:
```
dR/dt = −Y·Φ / (4ρ)        (strumień zdefiniowany na przekroju)
dR/dt = −Y·Φ / ρ           (strumień już uśredniony po całej powierzchni)
```

**W kodzie:** `erosion/dust.py::radius_change_rate_from_dust_mass_flux`
(dzielnik `4·ρ` dla `"cross_section"`). Wyprowadzenie **poprawne**.
Po erozji: `R` maleje, masa i `r_bio` przeliczane, dawka rośnie automatycznie.
Poniżej `R = 1 µm` fragment oznaczany jako „eroded_away".

**[WADA I — heurystyczne mnożniki]** `resolve_dust_erosion_context` mnoży `Y` przez
`porosity_factor = 1 + coeff·porowatość` i `hydrolysis_factor = 1 + coeff·(tempo/ref)`.
To czyste heurystyki „chemiczne osłabienie materiału", **bez kalibracji** (przyznane w
docstringu). Domyślnie `distance_flux_exponent = 0`, więc skalowanie strumienia pyłu z
odległością jest wyłączone — `Φ` jest stałą wejściową, nie wynika z modelu pyłu.

---

## 11. Zderzenie z Marsem / wyrzut (skąd fragmenty się biorą)

**Po ludzku:** duża asteroida uderza w Marsa, wybija odłamki z prędkością powyżej
ucieczkowej (~5 km/s), z rozkładem prędkości i rozmiarów. Te odłamki to nasze fragmenty.

**Wzory / parametry:** `ImpactSimulationConfig` — `v_min = 5,03 km/s`, `v_max = 20 km/s`,
rozkład prędkości `∝ v^(−α)` (`α = 2,5`), rozkład rozmiarów `∝ s^(−q)` (`q = 2`),
stożek wyrzutu `60°`, opcjonalna korelacja rozmiar–prędkość (małe lecą szybciej).

**W kodzie:** `impacts/mars_impact.py`, `impacts/sampling.py`, `simulation/config.py`.

**[OK]** To warstwa „warunków początkowych", nie ciągłe oddziaływanie. Rozkłady
potęgowe są standardem dla ejekty impaktowej.

---

## Szybka mapa: co realnie decyduje o przeżyciu w modelu

| Kanał | Wchodzi do `survival_function`? | Uwaga |
|---|---|---|
| GCR (§7) po osłonie | **TAK** — `radiation_space` | główny zabójca; wada B (za mała dawka na małych ciałach) |
| Radionuklidy U/Th/K (§8) | **TAK** — `radiation_decay` | w przeżyciu liczone dobrze; eksport/panel z wadami E, F |
| Hydroliza (§6) | **TAK** — przez `k_hyd·c_hyd` | skala `c_hyd = 1200` bez źródła (wada G) |
| „UV"/fotony gwiazdy (§3) | **NIE bezpośrednio** | tylko przez temperaturę → hydroliza; zła etykieta (wada A) |
| Erozja (§10) | pośrednio | zcieńcza osłonę → więcej GCR; mnożniki heurystyczne (wada I) |
| Ciśnienie promieniowania (§2), grawitacja (§1) | pośrednio | zmieniają trajektorię → odległość → dawkę GCR |
| Ciepło radiogeniczne (§5) | pośrednio | podnosi `T_środek` → hydroliza |

## Najważniejsze do sprawdzenia na inspekcji (priorytet)

1. **Wada B** — brak build-up GCR: dla domyślnego roju (0,4–17 g/cm²) model jest w złym
   znaku, zawyża przeżycie do ~25% w dawce. Największy realny błąd fizyczny.
2. **Wada A** — „UV" to strumień bolometryczny, nie UV, i nie ma własnego członu
   śmiertelności. Jeśli narracja mówi inaczej — rozjazd z modelem.
3. **Wady G + M** — `c_hyd = 1200` bez źródła; `c_rad` niepewne do czynnika ~17. To nie
   „błędy", ale to one rządzą liczbą na końcu — trzeba je jawnie pokazywać jako wrażliwość.
4. **Wada C** — amplituda modulacji słonecznej `M = 1,3` zaniża zależność dawki od
   trajektorii.

**Naprawione 2026-09-01 (drobne, bezpieczne, 290 testów Pythona nadal przechodzi):**
wady **E, F** (spójność dawki gamma w eksporcie/panelu z tym, co liczy przeżycie) i
**J** (rozjazd `CONFERENCE_THEORY.md` vs kod dla hydrolizy).
