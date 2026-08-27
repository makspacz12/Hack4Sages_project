"""
Biological calibration constants used by the survival function.

Two radiation bands appear in the project history — both are documented here.
Runtime uses the DEMO band so survival does not collapse on kyr–Myr timescales
in short conference runs. The LITERATURE band is the Mileikowsky D10 conversion.
"""

# ── radiation_surv_coeff [1/Gy] ─────────────────────────────────────────────
#
# DEMO (runtime — sampled / default):
#   ~1e-6 … 1e-5 1/Gy
#   Engineering under-tune: microbes survive long enough for the digital-twin
#   narrative. With the literature band below, kill is ~50–100× faster and
#   populations drop too quickly for typical demo integrations.
#
# LITERATURE (not used at runtime — for talk / sensitivity / future switch):
#   ~3.6e-4 … 1.0e-3 1/Gy
#   Mileikowsky et al. (2000) decimal-reduction slopes ~0.157–0.441 per kGy
#   (≈ 1/D10, log10) → natural-exp 1/Gy via:
#       c_rad = (slope_per_kGy / 1000) * ln(10)
#   doi:10.1006/icar.1999.6317
#
RADIATION_SURV_COEFF_MIN_PER_GY = 1e-6   # DEMO; literature min ≈ 3.6e-4 1/Gy (Mileikowsky D10)
RADIATION_SURV_COEFF_MAX_PER_GY = 1e-5   # DEMO; literature max ≈ 1.0e-3 1/Gy (Mileikowsky D10)
DEFAULT_RADIATION_SURV_COEFF_PER_GY = (
    RADIATION_SURV_COEFF_MIN_PER_GY * RADIATION_SURV_COEFF_MAX_PER_GY
) ** 0.5  # DEMO geometric mean ≈ 3.2e-6; literature mid ≈ 6e-4 1/Gy

# Named aliases so callers / docs can refer to the unused band without magic numbers.
LITERATURE_RADIATION_SURV_COEFF_MIN_PER_GY = 3.6e-4  # D10 conversion; runtime uses DEMO 1e-6
LITERATURE_RADIATION_SURV_COEFF_MAX_PER_GY = 1.0e-3  # D10 conversion; runtime uses DEMO 1e-5

# AUDIT WARNING — NO CITED SOURCE.
# Written historically as 1.2 / 0.001. No peer-reviewed derivation found.
# Keep as an explicit sensitivity / audit parameter until replaced by a
# genome-based lethality model.
HYDROLYSIS_SURV_COEFF = 1.2 / 0.001
