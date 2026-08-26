# Hack4Sages — Lithopanspermia Digital Twin

Live demo (3D visualizer): **https://makspacz12.github.io/Hack4Sages_project/**

## What this project is

Most origins-of-life research focuses on how life emerges locally within a single
environment. An alternative view asks whether biological material can be redistributed
between planetary systems through natural astrophysical processes.

The **lithopanspermia** hypothesis suggests that microorganisms embedded in rocky ejecta
from impact events could survive interstellar travel. Although uncertain, the idea is
grounded in known physics: ejecta can escape planetary systems, persist on interstellar
trajectories, and experience radiation-driven decay that can be modeled probabilistically.

This repository is a **minimal digital twin of interstellar biological transfer**, combining
a simplified gravitational transport model with a trajectory-dependent survival function.

Rocky ejecta are launched from a source system and propagate toward a target system,
carrying hypothetical microbial payloads whose survival probability decreases with travel
time and radiation exposure. Instead of modeling one specific astrophysical system, we study
how a small set of parameters — ejection speed, travel time, shielding — shapes the
probability of viable arrival.

The digital twin integrates three layers:

| Layer | What it does | Where it lives |
|---|---|---|
| **Physical transport** | Ballistic trajectories in a restricted N-body framework (REBOUND) | `Hack4Sages_merged/microbe_radiation_model/simulation/` |
| **Biological survival** | Radiation dose, shielding, temperature and hydrolysis models | `Hack4Sages_merged/microbe_radiation_model/radiation/`, `thermal/`, `chemistry/`, `biology/` |
| **Visualization** | 3D Three.js swarm viewer, replay of exported JSON | branch `kacper` (deployed to GitHub Pages) |

## Repository layout

```
.
├── README.md                 <- this file
├── RUNNING.md                <- how to install and run the simulation
├── .gitignore
└── Hack4Sages_merged/        <- the Python simulation package (canonical runtime)
    ├── run.py                <- main entry point
    ├── requirements.txt
    ├── nearest_50_gaia.csv   <- Gaia catalog of the 50 nearest stars
    ├── environment.ipynb     <- historical working notebook (not runtime)
    ├── REPOSITORY_MAP.md
    ├── microbe_radiation_model/
    └── archive/              <- legacy modules, drafts, compatibility aliases
```

> **Important:** the 3D web visualizer is **not on `main`**. It lives on the `kacper`
> branch (`index.html`, `src/*.js`, `public/data/*.json`, Vite + Vitest + a GitHub Pages
> workflow). The R/Python survival-function analysis lives on the `zosia` branch.

## Quick start

```bash
cd Hack4Sages_merged
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Full instructions, including the Mars ejecta pipeline, are in [RUNNING.md](RUNNING.md).

## Documentation

- [RUNNING.md](RUNNING.md) — installation and run commands
- [Hack4Sages_merged/REPOSITORY_MAP.md](Hack4Sages_merged/REPOSITORY_MAP.md) — what each top-level item is for
- [Hack4Sages_merged/microbe_radiation_model/MODULE_CATALOG.md](Hack4Sages_merged/microbe_radiation_model/MODULE_CATALOG.md) — one line per module
- [Hack4Sages_merged/microbe_radiation_model/TECHNICAL_DOCUMENTATION.md](Hack4Sages_merged/microbe_radiation_model/TECHNICAL_DOCUMENTATION.md) — full physics and data-flow reference
