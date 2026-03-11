from .types import Rock

BASALT = Rock(
    name="basalt",
    radius_m=0.5,
    density_kg_m3=3000.0,
    albedo=0.07,
    probability=0.50,
    uranium238_ppm=0.5,
    thorium232_ppm=1.0,
    potassium_percent=0.5,
    notes="Default basalt-like rock."
)

CHONDRITE = Rock(
    name="chondrite",
    radius_m=0.5,
    density_kg_m3=3500.0,
    albedo=0.15,
    probability=0.30,
    uranium238_ppm=0.02,
    thorium232_ppm=0.04,
    potassium_percent=0.08,
    notes="Default chondritic rock."
)

ICE_RICH = Rock(
    name="ice_rich",
    radius_m=0.5,
    density_kg_m3=1500.0,
    albedo=0.40,
    probability=0.20,
    uranium238_ppm=0.001,
    thorium232_ppm=0.002,
    potassium_percent=0.01,
    notes="Default ice-rich body."
)

DEFAULT_ROCK_VARIANTS = [
    BASALT,
    CHONDRITE,
    ICE_RICH,
]