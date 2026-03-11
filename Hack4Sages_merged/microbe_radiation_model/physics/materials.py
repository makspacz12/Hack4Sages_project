from dataclasses import dataclass


@dataclass(frozen=True)
class Material:
    """
    Właściwości fizyczne materiału używanego w obliczeniach ekranowania.
    """

    name: str
    density: float
    k: float
