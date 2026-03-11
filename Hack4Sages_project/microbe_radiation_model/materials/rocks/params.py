from typing import Any, Callable

from .types import Rock


RockHook = Callable[[Rock], Any]


def get_rock_param(
    rock: Rock,
    field_name: str,
    value: Any = None,
    hook: RockHook | None = None,
    default: Any = None,
    required: bool = False,
) -> Any:
    """
    Resolve a parameter using the following priority:

    1. explicit value passed by user
    2. value returned by hook(rock)
    3. attribute stored in rock
    4. value from rock.extra[field_name]
    5. provided default

    Parameters
    ----------
    rock : Rock
        Rock object with stored default properties.
    field_name : str
        Name of the field to resolve.
    value : Any, optional
        Explicit override value.
    hook : callable, optional
        Function taking Rock and returning computed value.
    default : Any, optional
        Fallback default if nothing else is available.
    required : bool, optional
        If True, raise error when value cannot be resolved.

    Returns
    -------
    Any
        Resolved parameter value.
    """

    # 1. explicit value
    if value is not None:
        return value

    # 2. computed hook
    if hook is not None:
        computed = hook(rock)
        if computed is not None:
            return computed

    # 3. direct attribute on Rock
    if hasattr(rock, field_name):
        attr_value = getattr(rock, field_name)
        if attr_value is not None:
            return attr_value

    # 4. extra dictionary
    if field_name in rock.extra and rock.extra[field_name] is not None:
        return rock.extra[field_name]

    # 5. default fallback
    if default is not None:
        return default

    if required:
        raise ValueError(
            f"Could not resolve required rock parameter '{field_name}' "
            f"for rock '{rock.name}'."
        )

    return None


def with_rock_overrides(rock: Rock, **overrides: Any) -> Rock:
    """
    Create a new Rock instance with selected fields overridden.
    """
    data = {
        "name": rock.name,
        "radius_m": rock.radius_m,
        "density_kg_m3": rock.density_kg_m3,
        "albedo": rock.albedo,
        "water_mass_fraction": rock.water_mass_fraction,
        "porosity": rock.porosity,
        "probability": rock.probability,
        "uranium238_ppm": rock.uranium238_ppm,
        "thorium232_ppm": rock.thorium232_ppm,
        "potassium_percent": rock.potassium_percent,
        "extra": dict(rock.extra),
        "notes": rock.notes,
    }

    for key, value in overrides.items():
        if key in data:
            data[key] = value
        else:
            data["extra"][key] = value

    return Rock(**data)
