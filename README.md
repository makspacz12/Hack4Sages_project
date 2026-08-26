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
npm test             # 245 tests
```

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

## Known open questions in the physics

Four coefficients in the model do not currently reconcile with first-principles or
published values. They are marked `AUDIT WARNING` in the source and they change the
project's conclusion by many orders of magnitude, so treat absolute survival numbers as
provisional until they are settled:

1. **Internal gamma dose** (`radiation/radionuclide_model/gamma.py`) — the uncited
   coefficients give 46.6 Gy/yr for basalt against 1.07e-3 Gy/yr computed from activity
   and decay-chain energy.
2. **`radiation_surv_coeff`** (`simulation/scenarios.py`) — defaults to `5e-6`, while
   [`analysis/`](analysis/README.md) derives 0.157–0.441 from Mileikowsky et al. (2000).
   This error very nearly cancels the one above, so the final numbers look plausible for
   the wrong reason.
3. **DNA hydrolysis** (`chemistry/constants.py`) — `Ea = 60 kJ/mol` gives a 23 ms
   half-life at 298 K against a measured ~700 years; `Ea ≈ 130 kJ/mol` reproduces the
   literature.
4. **Cosmic ray attenuation** — GCR are attenuated with the photon mass attenuation
   coefficient rather than the ~10× smaller value appropriate for charged particles.

See [`model/microbe_radiation_model/TECHNICAL_DOCUMENTATION.md`](model/microbe_radiation_model/TECHNICAL_DOCUMENTATION.md)
§9 for the full derivations.

## Documentation

- [RUNNING.md](RUNNING.md) — installation and every run command
- [model/REPOSITORY_MAP.md](model/REPOSITORY_MAP.md) — what each item in the model is for
- [model/microbe_radiation_model/MODULE_CATALOG.md](model/microbe_radiation_model/MODULE_CATALOG.md) — one line per module
- [model/microbe_radiation_model/TECHNICAL_DOCUMENTATION.md](model/microbe_radiation_model/TECHNICAL_DOCUMENTATION.md) — physics and data-flow reference
- [web/README.md](web/README.md) — visualizer architecture and data contract
- [analysis/README.md](analysis/README.md) — where the survival coefficients come from
