# Cosmos 3D — Interstellar Lithopanspermia Simulator

A 3D interactive visualizer exploring the probability of life travelling between solar systems via meteorites (lithopanspermia). Built with Three.js, Vite, and WebR.

---
Check it out here: https://makspacz12.github.io/Hack4Sages_project/

## Quick Start

**Prerequisites:** Node.js ≥ 18

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

Then open the URL shown in the terminal (default: `http://localhost:5173`).

---

## Simulation Data

All simulation data files live in **`public/data/`**.

| File | Description |
|------|-------------|
| `solar_simulation.json` | Default replay — Solar System orbital data |
| `cosmos_visualizer_simulation.json` | Mars ejecta simulation (1000 frames) |
| `solar_system.json` | Static Solar System object definitions |
| `simulation_template.json` | Template for creating custom simulations |
| `gamma_radiation_timeseries.json` | Per-frame gamma radiation time series |

### Adding your own simulation

1. Place your `.json` file in `public/data/`.
2. Each frame must follow this structure:
```json
{
  "frames": [
    {
      "objects": [
        { "id": "mars_ejecta_1", "pos": [x, y, z], "vel": [vx, vy, vz], "properties": { ... } }
      ]
    }
  ]
}
```
3. Load it via the URL parameter: `?sim=your_file.json`

---

## Pages

| URL | Description |
|-----|-------------|
| `/` | Main 3D simulator |
| `/research.html` | Research paper — lithopanspermia methodology |
| `/further_details.html` | Extended details |

---

## Running Tests

```bash
npm test
```

245 unit tests across 15 files (Vitest).

---

## Tech Stack

- **Three.js 0.162** — WebGL 3D rendering
- **Vite 5.2** — dev server & bundler
- **Vitest 1.4** — unit testing
- **WebR 0.4.2** — R / WebAssembly in the browser
