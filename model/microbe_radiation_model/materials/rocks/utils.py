from .types import Rock


def get_rock_by_name(rocks: list[Rock], name: str) -> Rock:
    """
    Find a rock variant by name.
    """
    for rock in rocks:
        if rock.name == name:
            return rock
    raise ValueError(f"Rock '{name}' not found.")


def normalize_probabilities(rocks: list[Rock]) -> list[Rock]:
    """
    Normalize probability values so they sum to 1.
    """
    total = sum(r.probability for r in rocks)

    if total == 0:
        return rocks

    normalized = []
    for r in rocks:
        normalized.append(
            Rock(
                name=r.name,
                radius_m=r.radius_m,
                density_kg_m3=r.density_kg_m3,
                albedo=r.albedo,
                water_mass_fraction=r.water_mass_fraction,
                porosity=r.porosity,
                thermal_conductivity_w_mk=r.thermal_conductivity_w_mk,
                probability=r.probability / total,
                uranium238_ppm=r.uranium238_ppm,
                thorium232_ppm=r.thorium232_ppm,
                potassium_percent=r.potassium_percent,
                extra=dict(r.extra),
                notes=r.notes,
            )
        )

    return normalized