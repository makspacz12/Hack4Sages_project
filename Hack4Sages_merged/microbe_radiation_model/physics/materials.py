from dataclasses import dataclass


@dataclass(frozen=True)
class Material:
    """
    Physical properties of a material used in the shielding calculation.
    """

    name: str
    density: float
    k: float
