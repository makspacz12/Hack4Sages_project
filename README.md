# Lithopanspermia Digital Twin

**A computational model of interstellar microbial transfer — from impact ejection to
arrival dose.**

🥇 **First place worldwide — Hack4Sages** · 🇨🇭 **Selected for presentation at ETH Zürich**

Live demo: **https://makspacz12.github.io/lithopanspermia-digital-twin/**

---

## The one-sentence result

Over the 3 000-year run the surviving microbial fraction sits between **0.77 and 0.97**,
which reads as "almost nothing happens" and hides the disagreement entirely. Extrapolated
to the transfer times the literature actually discusses, the same published band for the
one uncertain biological coefficient opens to **43 orders of magnitude at 1 Myr** and 432
at 10 Myr. Sterilisation to N/N₀ = 10⁻⁶ arrives after **133 kyr to 3.0 Myr**, against
transfer times of tens of Myr.

**The model's answer is, to first order, a statement about one coefficient nobody has
pinned down.** Across the swarm, survival correlates with the sampled `c_rad` at
**r = −0.993**. That is the headline the interface leads with, and the reason it lets you
move that coefficient and watch the answer move.

---

## About

Research into the origin of life has largely asked how biology arises *within* a single
environment. Lithopanspermia asks a different question: whether living material can be
**redistributed between planetary systems** by ordinary astrophysical processes — and, if
so, under what conditions it could still be viable on arrival.

The hypothesis is speculative in its conclusion but not in its premises. Each step is
independently established: hypervelocity impacts eject competent rock at escape velocity;
some fraction of that ejecta leaves the system entirely; microorganisms have documented
tolerances to vacuum, shock and radiation; and the dose accumulated in transit can be
computed rather than assumed. What has been missing is an end-to-end model that carries a
fragment from the moment of ejection to the moment of arrival while tracking everything
that happens to the life inside it.

This project is that model. It couples an N-body gravitational transport layer to a
physically explicit survival calculation, so that the outcome for any fragment is
traceable back to the mechanisms that produced it.

---

## The result factorises exactly — and that shapes the whole tool

Survival in this model is

```
N/N₀ = exp( −c_rad · D_cum  −  c_hyd · H_cum )
```

verified against the shipped replay to a worst deviation of **1.2 × 10⁻¹⁵**. Two numbers
per fragment therefore settle the answer completely: the dose it accumulated, and the
inactivation coefficient it was assigned.

Three consequences run through the entire design:

1. **Everything else the model computes exists to produce the first of those two
   numbers.** Three thousand years of N-body integration, the thermal model, radiation
   pressure, dust erosion, the whole radionuclide chain: all of it exists to say what dose
   a fragment took.
2. **The biological answer can be recomputed in the browser instantly, for any
   coefficient, with no new simulation.** This is why the coefficient is a live control
   rather than a fixed input.
3. **The honest figure is not a time series.** It is the plane those two numbers live in,
   with iso-survival contours across it and the swarm placed on it — the *answer surface*,
   the first figure in the analysis dock.

---

## What the interface shows, and why

### The headline band

A probability box across the top, with a selectable horizon. It is **not** a confidence
interval and the copy says so: `c_rad` is a fixed number nobody knows, not a sampled one,
so the object is the range of answers consistent with the published literature (Sarma et
al., CHI 2024). Hard ends, no gradient — a soft edge would imply a density that does not
exist.

It also attributes the width: **c_rad accounts for 94 %** of the spread, the entire N-body
run for the rest. That split is scale-free — both terms are linear in time — which a test
pins, because if it ever stopped being true the sentence would have to name its horizon.

### The answer surface

Dose on the horizontal axis, inactivation coefficient on the vertical, both logarithmic so
the contours of `exp(−cD)` are straight lines of slope −1: the eye reads a straight line
far more reliably than a hyperbola. The published chronic band is a shaded **strip, not a
line** — the literature gives a range with no preferred value inside it, and a central line
would invent one. The coefficient slider walks a marker up and down through the contours.

One caveat is stated rather than hidden: hydrolysis is a second channel that moves survival
by about 2 × 10⁻⁴ and cannot live on these two axes, so a point is *drawn* dose-only while
the survival *quoted* for it is the model's real answer.

### The 3D scene

The scene draws the **osculating orbit** each fragment is on — the ellipse it would follow
from here if every perturbation stopped — solved from position and velocity, not
interpolated from samples. Watching those ellipses breathe under the planets *is* the
secular eccentricity pumping that spreads the swarm.

The camera frames the swarm from its own median aphelion. Median rather than maximum, so
the fragment at 31 AU does not shrink everything else to a point; it runs past the edge,
which is honest, because it visibly *is* an outlier.

### The workspace menu

One bar along the top — Figures, Scene, Panels, Analysis — listing every panel by name with
a line saying what it is, a checkmark for what is shown, and a tear-off target beside each
figure. Detached charts open in their own window and stay linked to the replay.

### The run console

Every model parameter, editable, with the numeric field as the primary control and the
slider secondary. The parameter schema is frozen into the bundle at build time, so the full
set of controls renders **with no solver running** — which is how almost everyone will see
it. Each parameter carries a written explanation on hover *and on keyboard focus*: what the
quantity is, what moving it does, and — only where the number is not settled — the published
range and the paper it came from.

### The provenance panel

Every replay carries a SHA-256 digest of its complete parameter set, the resolved seed, the
source commit, whether the tree was dirty, a command that reproduces the run, and a live
audit of which constants are cited. The panel leads with one line: a coloured dot and a
verdict, ordered by how badly each condition undermines the record.

---

## Scientific practice

The project is built to be checked rather than trusted:

- **Every run carries a provenance record.** Runs reproduce bit-for-bit.
- **The physics is under test.** 284 Python and 488 JavaScript tests, anchored where
  possible to published values rather than to the code's own outputs — the failure mode
  that lets two compensating errors hide each other.
- **Uncertain constants are declared, not buried.** A live coefficient audit ships inside
  every output file.
- **Claims in comments are measured, not asserted.** Several comments in this repository
  once stated numbers nobody had computed; where that was found, the comment now records
  both the true measurement and the fact that it had been wrong.

---

## Sensitivity: why the tornado chart was removed

The sensitivity page used to show a one-at-a-time tornado. It was replaced rather than
annotated, because taking its shipped sample apart showed it was not merely older but
actively misleading. Measured from the file:

- the run lasted **half a year**, with four fragments
- the largest swing it measured was **2.0 × 10⁻⁷**
- **two of the eight knobs moved the result by exactly zero**
- its baseline for the radiation coefficient was 3.16 × 10⁻⁶ 1/Gy — a factor of **7.9 below
  the floor of this model's own published band**

A reader who sees a ±10 % OAT design applied to a coefficient uncertain by a factor of
seventeen has been given a reason to distrust everything else on the screen.

**Morris elementary-effects screening** replaces it, with the conventions checked at the
sources rather than copied from practice, because the two disagree:

| Convention | Source |
|---|---|
| μ\* on x, σ on y, equal unit scale, square area | Morris (1991) *Technometrics* 33(2), Figs 1 & 4; Saltelli et al. (2012) *Chem. Rev.* 112(5) |
| σ/μ\* = 0.1, 0.5, 1 diagonals separating linear / monotonic / interacting | García Sánchez et al. (2014) *Energy and Buildings* 68:741–753 |
| ±2·SEM wedge, SEM = σ/√r — a **significance** test, not a shape classifier | Morris (1991) |
| μ plotted beside μ\*, because μ\* exists so a sign-changing factor does not cancel | Campolongo, Cariboni & Saltelli (2007) *EMS* 22:1509–1518 |
| r(k) = π^(k/2) / (Γ(k/2+1)·2^k) — the fraction of space an OAT design can reach | Saltelli & Annoni (2010) *EMS* 25(12):1508–1517 |

The cost comparison is stated **at equal budget**, not as a slogan: this screening cost 108
model evaluations; a one-at-a-time design over the same eight factors costs the same order,
reaches **1.59 %** of the space, and detects no interactions at all.

What the screening says: simulated time and the radiation coefficient dominate; hydrolysis
is alive, where both its knobs read exactly 0.0 before the freezing cut was removed;
fragment radius is nearly irrelevant. Only fragment radius — the least influential of the
eight — changes sign; every other factor is strictly monotone to within 0.04 %.

---

## Repository layout

```
.
├── model/       Python simulation — transport, radiation, thermal, chemistry, biology
├── web/         3D visualizer (Three.js + Vite), deployed to GitHub Pages
├── analysis/    Empirical survival-function work (R + Python) and its figures
├── tools/       Scripts that connect the three above
├── README.md    this file
└── RUNNING.md   how to install and run everything
```

| Part | Language | Entry point |
|---|---|---|
| [`model/`](model/) | Python 3.12+ | `python run.py` |
| [`web/`](web/) | JavaScript (Three.js, Vite) | `npm run dev` |
| [`analysis/`](analysis/) | R + Python | `Rscript radiation_to_survival.R` |
| [`tools/`](tools/) | Python | `python tools/export_simulation_to_web.py` |

The visualizer can drive the model directly: start
`python -m microbe_radiation_model.server` and the **Run console** picks parameters,
launches a real REBOUND run, shows its progress and plays the result. Without the solver
the page falls back to the bundled replay — with every control still rendered and editable.

---

## Quick start

**Simulation:**

```bash
cd model
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

**Visualizer:**

```bash
cd web
npm install
npm run dev          # http://localhost:3000
npm test             # Vitest unit tests
```

**Sensitivity screening and parameter sweeps:**

```bash
cd model && source .venv/bin/activate

# Morris elementary-effects screening
python -m microbe_radiation_model.ensembles --morris --quick \
  --seeds 0,1 --trajectories 12 --levels 4 --asteroids 6 --years 200 --dt 2 \
  --out ../web/public/data/morris_sample.json

# 2D heatmap: velocity × fragment radius
python -m microbe_radiation_model.ensembles --grid --v-steps 3 --radius-steps 3 --seeds 0,1,2
```

Load the JSON in `web/grid.html` or `web/sensitivity.html`, or use the bundled samples.

**Feed a fresh simulation into the visualizer:**

```bash
python tools/export_simulation_to_web.py --run
```

**Re-freeze the parameter schema** after changing `server.PARAMETERS`, so the run console
still renders offline:

```bash
python tools/export_parameter_schema.py
```

Full command reference: [RUNNING.md](RUNNING.md).

---

## How the model works

```
stellar mass → luminosity → flux at the rock surface
    → Beer-Lambert attenuation through rock and biological core → local flux
    → cumulative dose (× time) → surviving microbial fraction
```

Temperature is computed in parallel — surface from radiative equilibrium, interior from
radiogenic heating — and drives the hydrolysis rate.

| Layer | Where |
|---|---|
| Orbital transport (REBOUND), impact ejecta, dust erosion | `model/microbe_radiation_model/simulation/`, `impacts/`, `erosion/` |
| Stellar radiation, galactic cosmic rays, shielding, internal gamma | `model/microbe_radiation_model/radiation/` |
| Surface and interior temperature, radiogenic heat, hydrolysis | `model/microbe_radiation_model/thermal/`, `internal_heat/`, `chemistry/` |
| Survival function | `model/microbe_radiation_model/biology/` |
| Rock properties, cited to source | `model/microbe_radiation_model/materials/rocks/` |
| Osculating orbits for the scene | `web/src/orbits.js` |

---

## What the bundled run actually contains

Quoting the shipped replay rather than an idealised description, because these numbers are
what a reader will see:

| | |
|---|---|
| Fragments | 14, radii **1.3 mm to 57.5 mm** |
| Duration | 3 000 years, 151 frames, 73 bodies (Sun, 8 planets, 50 real Gaia stars, 14 fragments) |
| Accumulated dose | 553 – 726 Gy |
| Surviving fraction | 0.775 – 0.971 |
| Fates | **bound 14 · unbound 0 · arrived 0** |

---

## Known questions in the physics

Stated here rather than left for a reader to discover.

**Nothing in a typical swarm is shielded.** Ejecta sizes follow a truncated power law from
1 mm with slope `q_size = 2`, whose median is 2 mm and which yields **0.14 fragments above
10 cm per swarm of fourteen**. The cosmic-ray attenuation length is about 0.46 m, so every
fragment here keeps more than 90 % of the flux at its centre. Lithopanspermia in this
configuration rests entirely on the rare large fragments in the tail — which is why
`q_size` is now an exposed parameter.

**Fragments do not escape on the timescales the demo runs.** A run of a few thousand years
ends with every fragment still bound to the Sun. The `escaped`, `arrived` and `destroyed`
states exist and are exercised by tests, but a short run reports zero of each. The
interface says so on its face rather than leaving the reader to assume otherwise.

**Survival times are far shorter than interstellar transit times.** The model says microbes
die long before they could arrive. That is a result, not a defect — it is the quantitative
form of the argument that lithopanspermia needs large, well-shielded fragments.

**Internal U/Th/K decay is negligible here** — 0.0107 % of the dose, a ratio of 9313 : 1
against cosmic rays. A fully cited subsystem that turns out not to matter in this
configuration, drawn on a log axis because a stacked area would give it zero pixels and so
claim it does not exist.

**The rock thermal model is isothermal.** Centre and surface temperatures are equal to
twelve significant figures.

**The output step aliases the orbits.** A frame is written every 20 years while periods run
from 1.8 to 74.6 years. The scene solves each fragment's orbit rather than joining sampled
points, so the *drawing* is exact — but a per-frame readout still steps past events.

### Coefficient status

**Still open**

1. **`hydrolysis_surv_coeff = 1200`** (`biology/constants.py`) — written as `1.2/0.001`
   with **no cited source**. Treat as a sensitivity / audit parameter.

**Resolved (cited), residual uncertainty kept**

2. **`radiation_surv_coeff`** — runtime samples **2.5e-5 – 4.3e-4 1/Gy** per fragment
   (default 2.5e-4), from the chronic-exposure table in Mileikowsky et al. (2000). Two
   traps in that table are documented in the code: a **multiplier in the column header**
   (×10⁻⁵, ×10⁻⁶) and a dose-rate column in **cGy/year, not Gy/year**. Getting them wrong
   lands you on the acute laboratory band (6.1e-4 – 1.5e-3), which does **not** transfer to
   cosmic rays: for heavy ions the action cross-section saturates, so per unit *mean* dose
   high-LET radiation is less efficient, not more (Baltschukat & Horneck 1991).
   Cross-checked against Valtonen et al. (2009) to within a factor of 1.7.
3. **DNA hydrolysis Arrhenius** — `Ea = 130 kJ/mol`, `A = 2.3e11` 1/s, Lindahl & Nyberg
   (1972).
4. **Internal gamma dose** — Cresswell, Carter & Sanderson (2018), Table 5.
5. **Cosmic-ray attenuation** — `k = 1/1600` m²/kg, Gosse & Phillips (2001). Calibrated for
   cosmogenic-nuclide production, not absorbed dose.

---

## Design decisions worth defending

**The data palette is not Wolfram's.** The interface deliberately resembles Mathematica in
its chrome, typography and density — but Mathematica's own default series colours,
`ColorData[97]`, fail an accessibility check: slots 2 and 3 separate by ΔE00 **1.8** under
protanopia and 12.8 with normal vision. The six rock-class colours here are Okabe & Ito,
darkened where the published values are too light to hold 3:1, and measured against the
white panel: worst adjacent separation 10.4 under deuteranopia, 18.1 with normal vision.
Selection is deliberately **not** blue — the navy accent already owns that register — and
not the obvious magenta either: the first candidate separated from the icy rock class by
ΔE00 **4.7** with normal vision, so a selected fragment and an icy one were the same
colour. The violet that replaced it clears 15.8. One residual is stated rather
than hidden — the sky/purple pair falls to 4.3 under tritanopia and is carried by dash
patterns, which is what secondary encoding is for.

**Light ground, restrained navy, dark scene.** Everything a reader lifts into a slide
lands on white, and a projector in a lit room destroys exactly the low tones a dark scene
of small dots depends on. The accent is a muted navy rather than an orange: orange is a
*warning* colour in instrument conventions, and spending it on ordinary headings and links
leaves nothing louder for an actual caution — navy is the register scientific publishing
already uses for structure and reference, and it keeps the warm end of the spectrum free
for **data**, where the vermillion now lives and nowhere else. The neutrals are cooled to
match, because a warm grey beside a navy accent reads as two unrelated decisions.

The 3D view stays dark as an inset with its own ground, so the rule reads in two seconds:
the dark rectangle is the observation, everything around it is the instrument.

Every colour is measured against the ground — `--ink` 12.00:1, `--accent` 8.06:1, `--warn`
4.71:1, `--bad` 6.90:1 — and `--accent-lit` exists **only** for the dark inset, where it
reads 5.78:1 while the navy itself would read 2.30:1.

**Multiplicative notation.** Uncertain coefficients are written `1.0e-4 ×/ 4.1 1/Gy`, not
`±`. A quantity known to within a factor is not symmetric on a linear scale (Limpert, Stahel
& Abbt 2001, *BioScience* 51(5):341–352). The centre is the **geometric** mean of the
endpoints, which reproduces 2.5e-5 and 4.3e-4 exactly.

**Explanations are not `title` attributes.** The HTML specification discourages `title`
because user agents do not expose it accessibly; it never appears on keyboard focus, cannot
be hovered so a citation inside it is unclickable, and does not appear at all on touch. The
replacement satisfies WCAG 2.2 SC 1.4.13 — dismissable, hoverable, persistent — and each
of those three is tested rather than asserted.

---

## Documentation

- [RUNNING.md](RUNNING.md) — installation and every run command
- [model/REPOSITORY_MAP.md](model/REPOSITORY_MAP.md) — what each item in the model is for
- [model/microbe_radiation_model/MODULE_CATALOG.md](model/microbe_radiation_model/MODULE_CATALOG.md) — one line per module
- [model/microbe_radiation_model/TECHNICAL_DOCUMENTATION.md](model/microbe_radiation_model/TECHNICAL_DOCUMENTATION.md) — physics and data-flow reference
- [web/README.md](web/README.md) — visualizer architecture and data contract
- [analysis/README.md](analysis/README.md) — where the survival coefficients come from
