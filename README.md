# Hack4Sages — Lithopanspermia Digital Twin

Live demo: **https://makspacz12.github.io/Hack4Sages_project/**

## What this project is

Most origins-of-life research focuses on how life emerges locally within a single
environment. An alternative view asks whether biological material can be redistributed
between planetary systems through natural astrophysical processes.

The **lithopanspermia** hypothesis suggests that microorganisms embedded in rocky ejecta
from impact events could survive interstellar travel. Although uncertain, the idea is
grounded in known physics: ejecta can escape planetary systems, persist on interstellar
trajectories, and experience radiation-driven decay that can be modeled probabilistically.

This repository is a **minimal digital twin of interstellar biological transfer**,
combining a simplified gravitational transport model with a trajectory-dependent survival
function. Rocky ejecta are launched from a source system and propagate toward a target
system, carrying hypothetical microbial payloads whose survival probability decreases with
travel time and radiation exposure. Instead of modeling one specific astrophysical system,
we study how a small set of parameters — ejection speed, travel time, shielding — shapes
the probability of viable arrival.

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

The three parts form one pipeline:

```
  analysis/                model/                          web/
  ─────────                ──────                          ────
  Mileikowsky (2000)   →   survival coefficients
  dose→kill regression                                  
                           REBOUND orbits
                           radiation + shielding
                           thermal + hydrolysis
                           survival per fragment
                                    │
                                    │  tools/export_simulation_to_web.py
                                    ▼
                                                          replay JSON → 3D swarm
```

| Part | Language | Entry point |
|---|---|---|
| [`model/`](model/) | Python 3.12+ | `python run.py` |
| [`web/`](web/) | JavaScript (Three.js, Vite) | `npm run dev` |
| [`analysis/`](analysis/) | R + Python | `Rscript radiation_to_survival.R` |
| [`tools/`](tools/) | Python | `python tools/export_simulation_to_web.py` |

The visualizer can drive the model directly: start
`python -m microbe_radiation_model.server` and the **Run console** in the browser
picks parameters, launches a real REBOUND run, shows its progress and plays the
result. Without the solver the page falls back to the bundled replay.

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

**Parameter sweeps (offline, no browser):**

```bash
cd model && source .venv/bin/activate
# 2D heatmap: velocity × fragment radius
python -m microbe_radiation_model.ensembles --grid --v-steps 3 --radius-steps 3 --seeds 0,1,2
# OAT sensitivity tornado (±10 %, one knob at a time)
python -m microbe_radiation_model.ensembles --tornado --quick --seeds 0,1,2
```

Load the JSON in `web/grid.html` or `web/sensitivity.html`, or use the bundled samples
in `web/public/data/`.

**Feed a fresh simulation into the visualizer:**

```bash
python tools/export_simulation_to_web.py --run
```

Full command reference: [RUNNING.md](RUNNING.md).

## How the model works

```
stellar mass → luminosity → flux at the rock surface
    → Beer-Lambert attenuation through rock and biological core → local flux
    → cumulative dose (× time) → surviving microbial fraction
```

Temperature is computed in parallel — surface from radiative equilibrium, interior from
radiogenic heating — and drives the hydrolysis rate, which is the second kill channel
alongside radiation.

| Layer | Where |
|---|---|
| Orbital transport (REBOUND), impact ejecta, dust erosion | `model/microbe_radiation_model/simulation/`, `impacts/`, `erosion/` |
| Stellar radiation, galactic cosmic rays, shielding, internal gamma | `model/microbe_radiation_model/radiation/` |
| Surface and interior temperature, radiogenic heat, hydrolysis | `model/microbe_radiation_model/thermal/`, `internal_heat/`, `chemistry/` |
| Survival function | `model/microbe_radiation_model/biology/` |
| Rock properties, cited to source | `model/microbe_radiation_model/materials/rocks/` |

## Known questions in the physics

Absolute survival numbers remain provisional where coefficients are still under
audit. Several older issues now have published replacements; residual caveats
are kept so we do not over-claim calibration.

**Still open**

1. **`hydrolysis_surv_coeff = 1200`** (`biology/constants.py`) — written as
   `1.2/0.001` with **no cited source**. Treat as a sensitivity / audit
   parameter until replaced by a genome-based depurination lethality model.

**Resolved (cited), residual uncertainty kept**

2. **`radiation_surv_coeff`** (`biology/constants.py`) — **runtime = DEMO**
   `~1e-6`–`1e-5` 1/Gy (under-tune so populations survive demo timescales).
   **Literature D10** band `~3.6e-4`–`1.0e-3` 1/Gy (Mileikowsky 2000 conversion)
   is recorded next to those constants but not sampled. Residual: intentional
   dual calibration; single-exponential form ignores repair / GCR RBE.
3. **DNA hydrolysis Arrhenius** (`chemistry/constants.py`) — **resolved.**
   `Ea = 130 kJ/mol`, `A = 2.3e11` 1/s from Lindahl & Nyberg (1972)
   (doi:10.1021/bi00769a018); Allentoft et al. (2012) support Ea ~130–155 kJ/mol
   in fossil matrices. Residual: rate still depends on strand length and water
   activity.
4. **Internal gamma dose** (`radiation/radionuclide_model/gamma.py`) — **resolved.**
   Cresswell, Carter & Sanderson (2018), Table 5
   (doi:10.1016/j.radmeas.2018.02.007). Infinite-matrix factors; finite-size
   geometry is still an approximation, not Monte Carlo transport.
5. **Cosmic ray attenuation** (`simulation/config.py`) — **resolved.** GCR use
   `k = 1/1600` m²/kg from Gosse & Phillips (2001) (~160 g/cm²). Residual:
   calibrated for cosmogenic-nuclide production, not absorbed dose.

See [`model/microbe_radiation_model/TECHNICAL_DOCUMENTATION.md`](model/microbe_radiation_model/TECHNICAL_DOCUMENTATION.md)
and `provenance.audit_coefficients` for the live status of each constant.

## Documentation

- [RUNNING.md](RUNNING.md) — installation and every run command
- [model/REPOSITORY_MAP.md](model/REPOSITORY_MAP.md) — what each item in the model is for
- [model/microbe_radiation_model/MODULE_CATALOG.md](model/microbe_radiation_model/MODULE_CATALOG.md) — one line per module
- [model/microbe_radiation_model/TECHNICAL_DOCUMENTATION.md](model/microbe_radiation_model/TECHNICAL_DOCUMENTATION.md) — physics and data-flow reference
- [web/README.md](web/README.md) — visualizer architecture and data contract
- [analysis/README.md](analysis/README.md) — where the survival coefficients come from
