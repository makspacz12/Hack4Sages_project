from dataclasses import dataclass


@dataclass(frozen=True)
class RockVariant:
    """
    Opis materiału skały/asteroidy używany w modelach symulacyjnych.
    """

    name: str

    # physical properties
    density_kg_m3: float
    albedo: float

    # probability in population models
    probability: float

    # radiogenic composition
    uranium238_ppm: float
    thorium232_ppm: float
    potassium_percent: float