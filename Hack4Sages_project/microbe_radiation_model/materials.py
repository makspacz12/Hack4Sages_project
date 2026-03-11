from dataclasses import dataclass


@dataclass(frozen=True)
class Material:
    """
    Physical properties of a material.

    Parameters
    ----------
    name : str
        Material name.
    density : float
        Density [kg/m^3].
    k : float
        Mass attenuation coefficient [m^2/kg].
    """
    name: str
    density: float
    k: float