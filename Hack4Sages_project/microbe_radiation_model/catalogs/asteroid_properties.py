"""
Domyślne warianty skał i asteroid wykorzystywane w modelach projektu.
"""
from rock_material import RockVariant

DEFAULT_ROCK_VARIANTS = [
    {"name": "basalt", "density": 3000.0, "albedo": 0.07, "prob": 0.50},
    {"name": "chondrite", "density": 3500.0, "albedo": 0.15, "prob": 0.30},
    {"name": "ice_rich", "density": 1500.0, "albedo": 0.40, "prob": 0.20},
]
# only for now 

"""
Domyślne warianty skał i asteroid wykorzystywane w modelach projektu.
"""

DEFAULT_ROCK_VARIANTS = [
    RockVariant(
        name="basalt",
        density_kg_m3=3000.0,
        albedo=0.07,
        probability=0.50,
        uranium238_ppm=0.5,
        thorium232_ppm=1.0,
        potassium_percent=0.5,
    ),
    RockVariant(
        name="chondrite",
        density_kg_m3=3500.0,
        albedo=0.15,
        probability=0.30,
        uranium238_ppm=0.02,
        thorium232_ppm=0.04,
        potassium_percent=0.08,
    ),
    RockVariant(
        name="ice_rich",
        density_kg_m3=1500.0,
        albedo=0.40,
        probability=0.20,
        uranium238_ppm=0.001,
        thorium232_ppm=0.002,
        potassium_percent=0.01,
    ),
]
