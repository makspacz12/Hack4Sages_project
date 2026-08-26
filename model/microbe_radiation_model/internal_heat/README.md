# internal_heat

Radiogenic heat production from the decay of uranium, thorium and potassium in the rock.

## What this module computes

1. Takes the U [ppm], Th [ppm] and K [%] concentrations from the `Rock`.
2. Converts them to mass fractions.
3. Computes heat production per kilogram from the empirical geophysical coefficients.
4. Multiplies by density to get W/m³.
5. If the rock mass is known, also computes the object's total thermal power in W.

In short: **radionuclide concentration → heat per mass → heat per volume → total power.**

## Modules

- `constants.py`
  - heat coefficients for U / Th / K in µW·kg⁻¹ per mass fraction
  - `DEFAULT_HEAT_COEFFICIENTS`: U-238 98.29, Th-232 26.18, K 0.003387
- `model.py`
  - `heat_production_from_rock(...)` → `RadiogenicHeatResult`

## Output: `RadiogenicHeatResult`

| Field | Meaning |
|---|---|
| `uranium_w_kg`, `thorium_w_kg`, `potassium_w_kg` | Per-element heat production [W/kg] |
| `total_w_kg` | Combined heat production [W/kg] |
| `total_w_m3` | Volumetric heat production [W/m³] |
| `mass_kg`, `volume_m3`, `radius_m` | Resolved geometry |
| `total_power_w` | Total thermal power of the body [W] |

## How it is used

`total_w_m3` feeds `thermal/internal_profile.py`, which turns it into the centre
temperature via `T(0) = T_surface + Q·R² / (6·k_th)`.
