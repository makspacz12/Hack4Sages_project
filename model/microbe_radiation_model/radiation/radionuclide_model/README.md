# radionuclide_model

Model of the radiation sources inside the rock itself.

## Purpose

- Convert the rock composition (U-238, Th-232, K) into radioactive activity.
- Estimate a simplified internal gamma field.

## Structure

- `constants.py`
  - conversion constants (ppm / % → Bq/kg)
- `activity.py`
  - `activity_from_rock`: specific activity [Bq/kg]
  - `volumetric_activity_bq_m3`: volumetric activity [Bq/m³]
- `geometry.py`
  - rock geometry from mass and density (volume, radius)
- `gamma.py`
  - `internal_gamma_rate_from_rock`: simplified gamma field model
- `__init__.py`
  - public API of the sub-package

## Input

- Rock type: `Rock` from `microbe_radiation_model.materials.rocks`
- Optional parameters: `uranium238_ppm`, `thorium232_ppm`, `potassium_percent`,
  `mass_kg`, `radius_m`, `density_kg_m3`

## Output

- `RadionuclideActivity`: `u238_bq_kg`, `th232_bq_kg`, `k40_bq_kg`, `total_bq_kg`
- `RockGeometry`: `mass_kg`, `density_kg_m3`, `volume_m3`, `radius_m`
- `InternalGammaField`: `specific_activity_bq_kg`, `volumetric_activity_bq_m3`,
  `radius_m`, `gamma_mu_inv_m`, `internal_gamma_rate`

## Calculation pipeline

1. U/Th/K composition → activity [Bq/kg]
2. activity [Bq/kg] → [Bq/m³] via density
3. mass + density → rock radius
4. `A_v · (1 − exp(−µ·R)) / µ` → internal gamma field indicator

## Notes

- The model is deliberately simplified and computationally light.
- It assumes a homogeneous rock and spherical geometry.
- It is an approximation, not Monte Carlo particle transport.
