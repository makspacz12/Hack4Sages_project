# Theory — what to know before the conference

Study and talk-track notes for the project. Updated as we go.
Items: `T1`, `T2`, … — work through them in order.

Related: [`TODO.md`](TODO.md) (implementation work).

---

## T1. What this project is

**Lithopanspermia Digital Twin** — a minimal digital twin of interstellar biological transfer.

Hypothesis: microorganisms in rocky fragments ejected by impacts can survive travel between stellar systems. The project does not model one specific system — it explores how a small set of parameters (ejection speed, time, shielding, size) shapes the chance of viable arrival.

Live: https://makspacz12.github.io/lithopanspermia-digital-twin/

Pipeline:

```
analysis/  →  survival coefficients (Mileikowsky 2000)
model/     →  REBOUND + radiation + thermal + hydrolysis + survival → JSON
web/       →  Three.js replay / Run console
```

---

## T2. Physics chain (one sentence)

> Stellar mass → luminosity → flux at the rock surface → Beer–Lambert attenuation →
> dose at the biological core; in parallel temperature → DNA hydrolysis rate.
> Both kill channels enter the survival function as a sum of exponents.

---

## T3. Equations (as in code)

| # | Step | Formula | Where |
|---|---|---|---|
| 1 | Luminosity | `L = L_☉ · (M/M_☉)^3.5` | `physics/stellar_physics.py` |
| 2 | Flux | `F = L / (4πd²)` | `radiation/stellar/radiation_model.py` |
| 3 | Bio core | `m_core = f·m_rock`, `R_core` from mass and ρ | `physics/geometry.py` (`f` default 0.01) |
| 4 | Attenuation | `A = exp(−k·ρ·x)` | `radiation/shielding_model.py` |
| 5 | Dose | `E += F_local·dt` | `radiation/exposure_model.py` |
| 6 | Interior | U/Th/K → Bq → α/β/γ dose (Cresswell et al.) | `radiation/radionuclide_model/gamma.py` |
| 7 | Surface T | `T = ((1−A)·F / 4σ)^(1/4)` | `thermal/surface_temperature.py` |
| 8 | Interior T | `T(r) = T_s + Q/(6k_th)·(R²−r²)` | `thermal/internal_profile.py` |
| 9 | Hydrolysis | `k = A·exp(−Ea/R_gT)·w_water`; T&lt;273.15 → 0 | `chemistry/hydrolysis_model.py` |
| 10 | Survival | `N/N₀ = exp(−(kill_rad + kill_hyd)·t)` | `biology/survival.py` |

- `kill_rad = radiation_surv_coeff · (D_space + D_decay)` [1/yr]
- `kill_hyd = k_hydrolysis · SECONDS_PER_YEAR · 1200` [1/yr]
- `1200 = 1.2/0.001` — **uncited**, audit parameter (T9c)

---

## T4. Two attenuation channels (key number for the stage)

| Channel | k [m²/kg] | Attenuation path at ρ≈3000 | Meaning |
|---|---|---|---|
| “UV” / stellar photons | `0.01` | **≈ 3.3 cm** | a thin crust is enough |
| GCR | `1/1600 ≈ 6.25e-4` | **≈ 0.5 m** | cm fragments are “transparent”; metres shield |

**Punchline:** without shielding, lithopanspermia does not work. Fragment size is the whole story.

Note: the stellar flux in code is **bolometric** `L/(4πd²)`, but the export names it `uv_*`. The model has no UV spectrum (see open items → label / UV fraction).

---

## T5. Numbers to remember

- `F = 1361 W/m²`, albedo 0 → `T ≈ 278.6 K` (1 AU) — thermal OK.
- GCR dose: `flux × 0.194 Gy/yr`; inside the heliosphere flux=1, outside ×1.3 → **~0.2–0.25 Gy/yr**.
- At literature `radiation_surv_coeff ≈ 6e-4` 1/Gy: `kill_rad ≈ 1.2e-4/yr` at ~0.2 Gy/yr → lifetime ~thousands of years without shielding (not ~17 years as with a wrong 0.3 1/Gy).
- Hydrolysis at `Ea = 130 kJ/mol`, `A = 2.3e11`: order **~10⁻¹² 1/s** at 298 K (years–thousands of years per site), not 23 ms.
- Dust erosion: `dR/dt = −(Y·Φ)/(4ρ)`. At Y=10, Φ=1e-12, ρ=3000 → **~2.6 mm loss per 10⁵ yr**. Invisible for metres, devastating for mm (`radius_min` = 1 mm).
- **Size optimum (narrative):** erosion eats small fragments, GCR penetrates thin ones → expected optimum around dm–m. The heatmap should show this.

---

## T6. Orbital dynamics

- REBOUND units: `(AU, yr, Msun)`, `G = 4π²`.
- Sun + planets + up to 50 Gaia stars as gravitating points (`nearest_50_gaia.csv`).
- Mars impact: swarm of fragments — radius and speed from a truncated power law, directions in a cone.
- **Terminal states (already in code):**
  - escape: orbital energy relative to the Sun `> 0` **and** `r > 240 AU` → `escaped_sun`;
  - collision: geometric overlap → `collided_with_star` / `collided_with_planet`;
  - “arrival”: entry into the effective Hill sphere of a foreign star (from `v_inf`) → `entered_effective_hill` / status `arrived`.
- Export statuses: `traveling`, `escaped_and_travelling`, `arrived`, `destroyed*`.

**Timescale vs demo:** 240 AU threshold at 20 km/s ≈ ~57 years; default run = 2.5 years. To the nearest star ~60 000 years; max in UI = 2000 years. Statuses exist but almost never fire in a short demo — long offline replay or say this honestly on stage.

---

## T7. What the model deliberately does not do

1. No full particle transport — Beer–Lambert is effective.
2. One scalar k per channel (photon / GCR) — no energy dependence or separate proton/α/HZE cross sections in shielding (90/9/1 % GCR split is reporting only).
3. Homogeneous spheres; dose computed at the centre `(0,0,0)`.
4. No galactic potential; Gaia stars are points in vacuum.
5. Internal gamma = analytical approximation, not Monte Carlo.
6. No ice sublimation, spallation, atmospheric ablation at the target.
7. One run = one random draw (no ensembles → no result distribution).

---

## T8. Where biology comes from

Mileikowsky et al. (2000), *Icarus* 145 — raw slopes (log10, **per kGy** ≈ 1/D10):

| Organism | raw `a` [1/kGy] |
|---|---|
| *B. subtilis* spores | 0.157 |
| *B. subtilis* in polymer | 0.401 |
| *D. radiodurans* | 0.441 |
| *H. salinarum* | 0.362 |

Conversion to the model (`N/N0 = exp(-c·D)`, D in Gy):

`c_rad = (a_per_kGy / 1000) · ln(10)` → **`3.6e-4 … 1.0e-3 1/Gy`** (`biology/constants.py`).

Runtime samples from this range. Naive `0.15–0.5` as 1/Gy is too sensitive (mammals); old `~1e-6` is too hardy.

Hydrolysis Arrhenius: **Lindahl & Nyberg (1972)** — `Ea = 130 kJ/mol`, `A = 2.3e11` 1/s.

---

## T9. Open / residual

| ID | Issue | Status |
|---|---|---|
| T9c | `hydrolysis_surv_coeff = 1200` without source | **OPEN** — audit / sensitivity (`biology/constants.py`) |
| T9d | “UV” label on bolometric flux | export / `star_uv_profile.json` |
| T9e | `cumulative_exposure` excludes GCR | stellar channel only |

**Resolved with citation (residual in README):**
- `radiation_surv_coeff` — Mileikowsky D10 → 1/Gy;
- hydrolysis `Ea`/`A` — Lindahl & Nyberg 1972;
- gamma — Cresswell 2018;
- GCR `k` — Gosse & Phillips 2001.

---

## T10. Hard questions — answers

**“What is your number / probability?”**  
We do not give a single number: among other things `hydrolysis_surv_coeff=1200` has no source and model simplifications (T7) shift the result. We show dependencies and shapes; with run ensembles — distribution and sensitivity.

**“Where does the survival coefficient come from?”**  
Mileikowsky 2000 D10 (per kGy, log10) → `c_rad ≈ 3.6e-4…1.0e-3 1/Gy` after unit conversion.

**“Beer–Lambert for GCR?”**  
Effective model with separate k for charged particles (~0.5 m scale). No spallation = no non-trivial thickness optimum from shielding alone.

**“How many years for interstellar transfer?”**  
Dynamics in the demo: years–thousands of years. Interstellar transit 10⁴–10⁵ years — part of the inference is dose extrapolation, not a full trajectory to the target.

**“Why Mars?”**  
Martian meteorites on Earth confirm ejection and transit within the Solar System. The interstellar question is open — that is what we study.

---

## T11. Slide narrative (sketch)

1. Hypothesis + Martian meteorites.
2. Chain T2 — one slide.
3. GCR attenuation path ≈ 0.5 m.
4. Erosion vs shielding → a size optimum must exist.
5. (Target) survival heatmap.
6. (Target) sensitivity tornado — honesty.
7. Limitations T7 — our words, not questions from the audience.

---

## Additions (ongoing)

_Append new items here after joint walkthroughs._
