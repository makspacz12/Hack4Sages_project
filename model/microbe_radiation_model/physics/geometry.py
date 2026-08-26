import math


def sphere_volume(radius: float) -> float:
    """
    Return the volume of a sphere of the given radius.
    """
    if radius <= 0:
        raise ValueError("radius must be positive")

    return (4.0 / 3.0) * math.pi * radius ** 3


def sphere_mass(radius: float, density: float) -> float:
    """
    Return the mass of a uniform sphere for the given radius and density.
    """
    if density <= 0:
        raise ValueError("density must be positive")

    return density * sphere_volume(radius)


def radius_from_mass_and_density(mass: float, density: float) -> float:
    """
    Recover the radius of a sphere from its mass and density.
    """
    if mass <= 0:
        raise ValueError("mass must be positive")
    if density <= 0:
        raise ValueError("density must be positive")

    volume = mass / density
    return ((3.0 * volume) / (4.0 * math.pi)) ** (1.0 / 3.0)


def biological_core_radius(
    rock_radius: float,
    rock_density: float,
    bio_density: float,
    bio_mass_fraction: float,
) -> float:
    """
    Compute the radius of the central biological core inside the rock.

    The core mass is taken as a fraction of the total rock mass.
    """
    if rock_radius <= 0:
        raise ValueError("rock_radius must be positive")
    if rock_density <= 0:
        raise ValueError("rock_density must be positive")
    if bio_density <= 0:
        raise ValueError("bio_density must be positive")
    if not (0.0 <= bio_mass_fraction <= 1.0):
        raise ValueError("bio_mass_fraction must be between 0 and 1")

    total_rock_mass = sphere_mass(rock_radius, rock_density)
    bio_mass = total_rock_mass * bio_mass_fraction

    if bio_mass == 0:
        return 0.0

    return radius_from_mass_and_density(bio_mass, bio_density)
