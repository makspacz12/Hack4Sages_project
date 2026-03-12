from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Rock:
    """
    Basic rock / asteroid definition.

    Stores default parameters only.
    Physics calculations should be implemented elsewhere.
    """

    name: str

    # geometry
    radius_m: float | None = None

    # material properties
    density_kg_m3: float | None = None
    albedo: float | None = None
    water_mass_fraction: float | None = None
    porosity: float | None = None
    thermal_conductivity_w_mk: float | None = None

    # population models
    probability: float | None = 1.0

    # radiogenic composition
    uranium238_ppm: float | None = None
    thorium232_ppm: float | None = None
    potassium_percent: float | None = None

    # free-form extension space for future parameters
    extra: dict[str, Any] = field(default_factory=dict)

    notes: str = ""