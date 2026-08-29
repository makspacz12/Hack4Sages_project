# Lithopanspermia Digital Twin

**A computational model of interstellar microbial transfer — from impact ejection to
arrival dose.**

🥇 **First place worldwide — Hack4Sages** · 🇨🇭 **Selected for presentation at ETH Zürich**

Live demo: **https://makspacz12.github.io/lithopanspermia-digital-twin/**

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
physically explicit survival calculation, so that the outcome for any given fragment is
traceable back to the mechanisms that produced it:

- **Transport** — REBOUND integration of ejecta on escape trajectories, with impact
  sampling, planetary perturbation, radiation pressure and dust erosion.
- **Dose** — stellar flux and galactic cosmic rays attenuated through rock by
  Beer–Lambert, plus the internal dose from the fragment's own U/Th/K, with the
  finite-size correction that makes small fragments leak gamma out through their surface.
- **Environment** — surface temperature from radiative equilibrium, interior from
  radiogenic heating. DNA hydrolysis is implemented as a second kill channel, but
  see **What the model does not currently do** below: in interplanetary space it
  is inactive.
- **Survival** — an exponential inactivation model applied per fragment, per timestep,
  against the dose that fragment actually received.

Rather than simulate one named system, the model treats the problem as a parameter study:
how do ejection speed, fragment size, shielding depth and travel time shape the
probability of viable arrival? Parameter sweeps and one-at-a-time sensitivity analysis are
first-class outputs, not afterthoughts.

### Scientific practice

The project is built to be checked rather than trusted:

- **Every run carries a provenance record** — a SHA-256 digest of its complete parameter
  set, the resolved random seed, the source commit, and a command that reproduces it
  exactly. Runs reproduce bit-for-bit.
- **The physics is under test.** 196 Python and 279 JavaScript tests, anchored where
  possible to published values rather than to the code's own outputs — the failure mode
  that lets two compensating errors hide each other.
- **Uncertain constants are declared, not buried.** A live coefficient audit ships inside
  every output file, stating for each constant whether it is cited and what remains
  unresolved. Quantities that depend on an open coefficient are marked provisional.

## Repository layout

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
radiogenic heating — and drives the hydrolysis rate. Hydrolysis is a second kill
channel in principle; in interplanetary space it is inactive, because the rate is
cut to zero below freezing and fragments never get that warm.

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

### What the model does not currently do

Stated here rather than left for a reader to discover, because two of these
limit what the outputs mean.

**Hydrolysis is inactive in interplanetary space.** The rate is cut to zero
below 273.15 K, and fragments run between roughly 80 and 240 K, so the channel
contributes nothing to any run at these distances and `--no-thermal` does not
change survival. That also means `hydrolysis_surv_coeff`, the one coefficient
still uncited, is multiplied by zero throughout. The cut-off is itself a
simplification: hydrolysis in ice slows down, it does not stop.

**Fragments do not escape on the timescales the demo runs.** Reaching the
escape threshold takes centuries, so a run of a few thousand years ends with
every fragment still bound to the Sun. The `escaped`, `arrived` and `destroyed`
states exist and are exercised by tests, but a short run will report zero of
each. Survival numbers from such a run describe a fragment in transit, not one
that arrived anywhere.

**Survival times are far shorter than interstellar transit times.** At the
published inactivation coefficient an unshielded fragment is sterilised to
N/N0 = 1e-6 in a few hundred thousand years, while transfer between stars takes
10^7 years or more. The model says microbes die long before they could arrive,
and that is a result rather than a defect - it is the quantitative form of the
argument that lithopanspermia needs large, well-shielded fragments.

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
