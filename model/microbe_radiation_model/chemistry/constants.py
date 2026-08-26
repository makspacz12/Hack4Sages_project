"""
Constants used by the hydrolysis model.
"""

GAS_CONSTANT_J_MOL_K = 8.314

# Averaged effective values. NOTE: see the audit note below - these do not
# reproduce literature DNA hydrolysis rates.

# AUDIT WARNING - with A = 1e12 1/s and Ea = 60 kJ/mol the rate at 298 K is
# 3.08e1 1/s (half-life 23 ms). Measured DNA depurination at 298 K is ~3e-11 1/s
# (half-life ~700 yr), which corresponds to Ea ~ 130 kJ/mol at the same A.
# As written, the hydrolysis kill channel is ~12 orders of magnitude too fast
# and will dominate the survival function whenever T > 273.15 K.
HYDROLYSIS_A_S_INV = 1.0e12
HYDROLYSIS_EA_J_MOL = 6.0e4


FREEZING_TEMPERATURE_K = 273.15

