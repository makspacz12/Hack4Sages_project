"""
Biological calibration constants used by the survival function.
"""

# ── radiation_surv_coeff [1/Gy] ─────────────────────────────────────────────
#
# Inactivation coefficient in N/N0 = exp(-c_rad * D), read directly off
# Mileikowsky, C. et al. (2000), Icarus 145(2), 391-427,
# doi:10.1006/icar.1999.6317, table "Effects of GCR and Natural Radioactivity",
# as c_rad = (kill frequency per year) / (dose rate in Gy per year).
#
# READING THE SOURCE TABLE. Two traps, and this project fell into both.
#
# 1. The kill-frequency columns carry a MULTIPLIER IN THE HEADER: "Kill freq/year
#    sigma-F (x 10^-5)" for B. subtilis and (x 10^-6) for D. radiodurans. Drop it
#    and every coefficient comes out 1e5 to 1e6 too large.
# 2. The dose-rate column is in cGy/year, not Gy/year - another factor of 100.
#
# The reading is confirmed by the table's own internal arithmetic. At zero
# shielding B. subtilis has 2.1e-5 /yr, and ln(10^6)/2.1e-5 = 0.66 Ma against a
# tabulated 0.66. Three further rows check out the same way, including the two
# natural-radioactivity asymptotes at 69 and 230 Ma.
#
# WHAT THIS REPLACED. Runtime sampled 1e-6 to 1e-5, which is 11x to 250x too
# small, and a comment called it an "engineering under-tune" so populations
# would survive short demo runs. It did not survive its own cross-check: against
# Valtonen et al. (2009), ApJ 690:210, whose natural-radioactivity kill term is
# 0.075/Myr, the old band gives 0.003/Myr - 25x low. The corrected values give
# 0.045/Myr, within a factor of 1.7.
#
# A separate misreading took the linear-regression slopes in
# analysis/radiation_to_survival.R (0.157-0.441) to be 1/Gy. That script fits
# raw table numbers with both the header multiplier and the cGy conversion
# missing, so those slopes are 1e3 to 1e4 too large. They are not a coefficient.
#
# c_rad is not a constant: within this table it rises about 4x with shielding
# depth as the LET spectrum hardens, and differs about 3x between species. A
# single coefficient therefore carries roughly a factor-of-2 systematic.

# B. subtilis wild-type spores, chronic exposure. The cleanest single value in
# the source: sigma-F = 2.50e-6 /yr normalised to 1 cGy/yr, so 2.50e-4 /Gy.
DEFAULT_RADIATION_SURV_COEFF_PER_GY = 2.5e-4

# Sampled per fragment to stand for the organism it carries. Spans the published
# range, from D. radiodurans at shallow shielding to B. subtilis deep inside.
RADIATION_SURV_COEFF_MIN_PER_GY = 2.5e-5   # D. radiodurans R1
RADIATION_SURV_COEFF_MAX_PER_GY = 4.3e-4   # B. subtilis, 600 g/cm^2

# ACUTE laboratory low-LET D10, for reference only - NOT applicable to galactic
# cosmic rays. Derived from D10 = 1.5-3.8 kGy as c = ln(10)/D10. It is 2-10x
# above the chronic values because for heavy ions the action cross-section
# saturates (Baltschukat & Horneck 1991, Radiat. Environ. Biophys. 30:87): a
# single HZE track deposits enormous local dose but only kills the spore it
# hits, so per unit MEAN dose high-LET radiation is less efficient, not more.
# Use only as a deliberate pessimistic upper bound.
ACUTE_LOW_LET_SURV_COEFF_MIN_PER_GY = 6.1e-4
ACUTE_LOW_LET_SURV_COEFF_MAX_PER_GY = 1.5e-3

# Kept under the old names so existing imports and the provenance audit keep
# working; they now point at the acute band, which is what they always were.
LITERATURE_RADIATION_SURV_COEFF_MIN_PER_GY = ACUTE_LOW_LET_SURV_COEFF_MIN_PER_GY
LITERATURE_RADIATION_SURV_COEFF_MAX_PER_GY = ACUTE_LOW_LET_SURV_COEFF_MAX_PER_GY

# AUDIT WARNING — NO CITED SOURCE.
# Written historically as 1.2 / 0.001. No peer-reviewed derivation found.
# Keep as an explicit sensitivity / audit parameter until replaced by a
# genome-based lethality model.
HYDROLYSIS_SURV_COEFF = 1.2 / 0.001
