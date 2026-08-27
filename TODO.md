# TODO — project work before / around the conference

Action items only. Theory: `[CONFERENCE_THEORY.md](CONFERENCE_THEORY.md)`.

Removed from the list (already in code):

- escape / collision / Hill-sphere arrival detection (in `scenarios.py`);
- “single k for GCR and photons” fix and “gamma without citations” fix (done).

Items: `W0`, `W-N1`, … — work through them in order.

---

## W0. Cleanup (first, hours)

- [x] Finish WIP radius range: `radius_min` / `radius_max` (`server.py`, `controlPanel.js`, `rangeLog.js`, tests). — `rangeLog` + `TestServerRadiusWiring` / `TestFragmentRadiusBounds` green (2026-08-27).
- [x] Check and remove stray root `package-lock.json` (the real one lives in `web/`).
- [x] Update README: gamma + GCR as **resolved** with residual; open = hydrolysis + `radiation_surv_coeff`.
- [x] Remove the “no Python tests” sentence from `TECHNICAL_DOCUMENTATION.md` (`model/tests/` exists).

---



## W1. Calibration before any sweep (1–2 days)

Without this, N1/N3/N4 get computed twice.

- [x] **W1a — hydrolysis:** `Ea = 130 kJ/mol`, `A = 2.3e11` 1/s (Lindahl & Nyberg 1972).
- [x] **W1b —** `radiation_surv_coeff`**:** range `3.6e-4 … 1.0e-3` **1/Gy** (Mileikowsky D10 → natural-exp); option C from research.
- [x] **W1c — constant 1200:** no source → left as **AUDIT / sensitivity** in `biology/constants.py`.

---



## Research — what actually needs to be found

Only items without which a given task cannot be closed honestly. Everything else (ensembles, heatmaps, report, tornado, demo) is engineering / team decision.


| ID                                      | What to find                                                                                                                                                    | Why                                               | Blocks                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------- |
| **R1**                                  | Published hydrolysis `Ea` (and ideally prefactor `A`)                                                                                                           | **DONE** — Lindahl & Nyberg 1972                  | W1a ✓                   |
| **R2**                                  | Origin of `hydrolysis_surv_coeff = 1200`                                                                                                                        | **DONE** — NO_SOURCE → audit param                | W1c ✓                   |
| **R3**                                  | Simplified, citable dose-vs-thickness model with **buildup / spallation** (not full MCNP) — e.g. empirical “dose at center vs g/cm²” curve for GCR at our scale | Without this W-P2 is guessing the curve shape     | W-P2                    |
| **R4**                                  | Ice sublimation rate in vacuum (Hertz–Knudsen or equivalent) + saturated vapor pressure vs T, with citation                                                     | Wire `dR/dt` for `ice_rich`                       | W-P3                    |
| **R5** *(only if doing W-P1 / real UV)* | Tabulated attenuation / stopping power: UV vs protons vs α vs HZE at our scale **or** UV fraction in the stellar spectrum (not bolometry)                       | Avoid inventing separate `k` values from thin air | W-P1, optional UV in W2 |
| **R6** *(only if doing W-P4)*           | Radio-resistance / DNA-repair data newer than Mileikowsky 2000 for extremophiles                                                                                | Broader biological basis                          | W-P4                    |


**No research needed for:** W0, W-N1, W-N2, W-N3, W-N4, W2 (except optional UV → R5).

---



## W-N1. Run ensembles

- [x] Seed loop + aggregation (`ensembles/runner.py`)
- [x] 2D grid speed × radius + `heatmap_p50` in JSON (`--grid`)
- [x] Web heatmap — **W-N3** ✓

```bash
# random spread only (seed)
python -m microbe_radiation_model.ensembles --seeds 0,1,2,3,4 --out ensemble.json

# 3×3 grid, 2 seeds per cell
python -m microbe_radiation_model.ensembles --grid --v-steps 3 --radius-steps 3 \
  --seeds 0,1 --out grid.json
```

---



## W-N2. Terminal-events report — 1–2 days

**DONE:** `simulation/terminal_report.py` + `SimulationReport.terminal_events_report`;
time and survival recorded on collision / Hill / first escape.

- [x] Table / JSON: how many escaped / collided / “arrived”, median time and survival.
- [ ] Optional: explicit trajectory fields in `asteroid_state` — not now.
- [x] Mars pipeline only (no port to `engine.py`).

**Do not redo:** bound/escape/Hill classification — already exists.

---



## W-N3. Probability maps — 3–4 days

**Requires W-N1.** Heatmap `speed × radius` → median survival. Response shape, not a single point.

- [x] `web/grid.html` + `charts/heatmap.js` — SVG heatmap from JSON (`kind: parameter_grid`).
- [ ] Optional: run grid from server API — not now.



## W-N4. Sensitivity analysis — 3–4 days

- [x] OAT ±10% → `ensembles/sensitivity.py` + CLI `--tornado` / `--quick`.
- [x] Knobs: `server.py` + Ea, `radiation_surv_coeff`, `hydrolysis_surv_coeff`, GCR k (`run_overrides.py`).
- [x] Web tornado: `sensitivity.html` + `charts/tornado.js`.
- [ ] Sobol — only if time remains.

---



## W-P1. Energy-dependent cross sections — ~1 week

**Not “add a second k”** — photon and GCR are already split. Missing: separate k / cross sections for protons, α, HZE and sensible UV (not bolometry). → research **R5**

GCR 90/9/1 % split today is report-only — all components share one k.

---



## W-P2. Spallation / secondaries — 1–2 weeks

Shielding is monotonic `exp(−kρx)`. Without a secondary cascade the model cannot find a non-trivial thickness optimum from radiation alone (only erosion vs attenuation). → research **R3**. High cost — likely after the conference.

---



## W-P3. Ice sublimation — 3–5 days

`ICE_RICH` has water; radius changes only via dust erosion. Add mass loss from sublimation in the same `dR/dt` hook as erosion. → research **R4**

---



## W-P4. Broader biological database — several days

W1b first. Then newer data → research **R6**. Without W1b it is cosmetic.

---



## W2. Demo / presentation (in parallel with W-N*)

- [ ] `npm test` (web) + `model/tests/` green.
- [ ] `python tools/export_simulation_to_web.py --check`.
- [ ] Ready **long offline replay** (escape / longer timescale) — plan B and workaround for short demo.
- [ ] Confirm offline operation (Gaia / Horizons cache).
- [ ] Optional: rename or compute UV fraction (`uv_*` vs bolometry).
- [ ] Optional: align meaning of `cumulative_exposure` (today excludes GCR).
- [ ] Consider `radiation_surv_coeff` slider in UI (most honest knob).

---



## Order


| Step | What               | Why                                |
| ---- | ------------------ | ---------------------------------- |
| 0    | W0                 | do not build on WIP / stale README |
| 1    | W1                 | calibration before sweeps          |
| 2    | W-N1 → W-N3 → W-N4 | scientific core for the stage      |
| 3    | W-N2 + W2          | demo credibility                   |
| 4    | W-P*               | after conference / if time remains |


**If only one thing:** W-N1 + W-N3.