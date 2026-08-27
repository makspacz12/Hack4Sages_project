"""
Constants used by the hydrolysis model.
"""

GAS_CONSTANT_J_MOL_K = 8.314

# DNA depurination / hydrolytic backbone damage (Arrhenius).
#
# Lindahl, T., & Nyberg, B. (1972). Rate of depurination of native
# deoxyribonucleic acid. Biochemistry, 11(19), 3610-3618.
# doi:10.1021/bi00769a018
#
# Ea = 31 ± 2 kcal/mol ≈ 130 kJ/mol; A ≈ 2.3e11 1/s (pH 7.4 solution).
# At 298 K this gives k ≈ 4e-12 1/s (half-life ~thousands of years per site),
# not the previous A=1e12 / Ea=60 kJ/mol values that implied a 23 ms half-life.
# Fossil/silica matrix work (e.g. Allentoft et al. 2012, Proc. R. Soc. B,
# doi:10.1098/rspb.2012.1745) reports Ea in a similar 130-155 kJ/mol band.
HYDROLYSIS_A_S_INV = 2.3e11
HYDROLYSIS_EA_J_MOL = 1.30e5

FREEZING_TEMPERATURE_K = 273.15
