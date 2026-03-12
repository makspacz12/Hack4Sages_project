"""
Mars impact / ejecta generation migrated from the notebook.
"""

from __future__ import annotations

import numpy as np
from astropy import units as u
from astropy.constants import M_sun as M_SUN

from ..materials.rocks import DEFAULT_ROCK_VARIANTS, Rock, with_rock_overrides
from ..radiation.pressure import compute_beta_single_star, nearest_star_for_position, q_pr_from_albedo
from .sampling import random_cone_directions, sample_truncated_power_law
from .types import GeneratedAsteroid, ImpactEjectaConfig, ImpactResult


def create_mars_impact(sim, config: ImpactEjectaConfig | None = None) -> ImpactResult:
    """
    Create a Mars impact event and add ejecta asteroids to the simulation.
    """

    config = config or ImpactEjectaConfig()
    rng = np.random.default_rng(config.seed)

    rock_variants = config.rock_variants or list(DEFAULT_ROCK_VARIANTS)
    star_indices = config.star_indices or [0]
    p_mars = sim.particles[config.mars_index]
    mars_pos = np.array([p_mars.x, p_mars.y, p_mars.z], dtype=float)
    mars_vel = np.array([p_mars.vx, p_mars.vy, p_mars.vz], dtype=float)

    impact_normal = config.impact_normal
    if impact_normal is None:
        vec = rng.standard_normal(3)
        impact_normal = tuple(vec / np.linalg.norm(vec))
    impact_normal_vec = np.asarray(impact_normal, dtype=float)
    impact_normal_vec /= np.linalg.norm(impact_normal_vec)

    # Losujemy typy skał zgodnie z ich prawdopodobieństwami,
    # a następnie rozmiary zależnie od rodzaju skały.
    sampled_rocks, radii_m = _sample_rock_variants_with_sizes(
        rock_variants=rock_variants,
        radius_min_m=config.radius_min_m,
        radius_max_m=config.radius_max_m,
        q_size=config.q_size,
        n_asteroids=config.n_asteroids,
        rng=rng,
    )
    velocities_kms = sample_truncated_power_law(
        config.v_min_kms,
        config.v_max_kms,
        config.alpha_v,
        config.n_asteroids,
        rng,
    )

    if config.size_velocity_corr:
        sorted_r = np.sort(radii_m)
        sorted_v = np.sort(velocities_kms)[::-1]
        perm = rng.permutation(config.n_asteroids)
        radii_m = sorted_r[perm]
        velocities_kms = sorted_v[perm]

    rock_names = [rock.name for rock in sampled_rocks]
    densities = np.array([float(rock.density_kg_m3) for rock in sampled_rocks], dtype=float)
    albedos = np.array([float(rock.albedo) for rock in sampled_rocks], dtype=float)
    mass_kg = (4.0 / 3.0) * np.pi * radii_m**3 * densities
    mass_msun = mass_kg / M_SUN.value
    q_pr_values = q_pr_from_albedo(albedos)

    mars_radius_au = _mars_radius_au(p_mars)
    directions = random_cone_directions(impact_normal_vec, config.cone_half_angle, config.n_asteroids, rng)
    launch_positions = mars_pos + directions * mars_radius_au

    nearest_star_index = nearest_star_for_position(sim, launch_positions[0], star_indices)
    if nearest_star_index is None:
        nearest_star_index = 0
    nearest_star_mass = sim.particles[nearest_star_index].m
    beta_arr = compute_beta_single_star(nearest_star_mass, radii_m, rho=densities, q_pr=q_pr_values)
    kms_to_au_yr = (1.0 * u.km / u.s).to(u.AU / u.yr).value
    v_au_yr = velocities_kms * kms_to_au_yr
    vx = directions[:, 0] * v_au_yr + mars_vel[0]
    vy = directions[:, 1] * v_au_yr + mars_vel[1]
    vz = directions[:, 2] * v_au_yr + mars_vel[2]

    spin_periods_h = rng.uniform(*config.spin_period_range, config.n_asteroids)
    obliquities_deg = rng.uniform(*config.obliquity_range, config.n_asteroids)
    spin_axes = rng.standard_normal((config.n_asteroids, 3))
    spin_axes /= np.linalg.norm(spin_axes, axis=1, keepdims=True)

    radii_au = radii_m * (1.0 * u.m).to(u.AU).value
    first_idx = sim.N
    asteroids: list[GeneratedAsteroid] = []

    for idx in range(config.n_asteroids):
        sim.add(
            m=0.0,
            r=radii_au[idx],
            x=launch_positions[idx, 0],
            y=launch_positions[idx, 1],
            z=launch_positions[idx, 2],
            vx=vx[idx],
            vy=vy[idx],
            vz=vz[idx],
        )

        # Random radiation sensitivity coefficient for this asteroid, independent
        # of its physical properties. Kept small so that survival decays over
        # Myr timescales rather than in a few steps.
        radiation_surv_coeff = rng.uniform(1e-6, 1e-5)

        asteroids.append(
            GeneratedAsteroid(
                sim_index=first_idx + idx,
                rock=sampled_rocks[idx],
                population_fraction=1.0,
                launch_x_au=float(launch_positions[idx, 0]),
                launch_y_au=float(launch_positions[idx, 1]),
                launch_z_au=float(launch_positions[idx, 2]),
                radius_m=float(radii_m[idx]),
                radius_au=float(radii_au[idx]),
                density_kg_m3=float(densities[idx]),
                rock_type=rock_names[idx],
                albedo=float(albedos[idx]),
                mass_kg=float(mass_kg[idx]),
                mass_msun=float(mass_msun[idx]),
                beta=float(beta_arr[idx]),
                q_pr=float(q_pr_values[idx]),
                nearest_star=int(nearest_star_index),
                v_ejecta_kms=float(velocities_kms[idx]),
                spin_period_h=float(spin_periods_h[idx]),
                obliquity_deg=float(obliquities_deg[idx]),
                spin_axis_x=float(spin_axes[idx, 0]),
                spin_axis_y=float(spin_axes[idx, 1]),
                spin_axis_z=float(spin_axes[idx, 2]),
                # dodatkowa metadana dla modelu przeżywalności
                radiation_surv_coeff=float(radiation_surv_coeff),
            )
        )

    return ImpactResult(
        first_index=first_idx,
        nearest_star_index=int(nearest_star_index),
        asteroids=asteroids,
    )


def _sample_rock_variants_with_sizes(
    rock_variants: list[Rock | dict],
    radius_min_m: float,
    radius_max_m: float,
    q_size: float,
    n_asteroids: int,
    rng: np.random.Generator,
) -> tuple[list[Rock], np.ndarray]:
    """
    Sample rock variants and radii with size ranges scaled by reference radius.

    - Najpierw normalizujemy warianty skal i ich prawdopodobieństwa.
    - Następnie dla każdej asteroidy losujemy typ skały z danego rozkładu.
    - Dla każdego typu skały wyznaczamy zakres promieni na podstawie
      promienia referencyjnego (rock.radius_m) i globalnych ograniczeń,
      po czym losujemy promień z rozkładu potęgowego.
    """

    normalized = [_normalize_variant(variant) for variant in rock_variants]
    probabilities = np.array(
        [
            v.probability if v.probability is not None else 1.0
            for v in normalized
        ],
        dtype=float,
    )
    probabilities = probabilities / probabilities.sum()

    # Losujemy indeks wariantu skały dla każdej asteroidy.
    variant_indices = rng.choice(
        len(normalized),
        size=n_asteroids,
        p=probabilities,
    )

    radii_m = np.empty(n_asteroids, dtype=float)
    sampled_rocks: list[Rock] = []

    for idx in range(n_asteroids):
        base_rock = normalized[variant_indices[idx]]
        ref_radius = base_rock.radius_m or 1.0

        # Zakres promieni skalowany przez promień referencyjny.
        #  - dolna granica: 1% promienia referencyjnego,
        #  - górna granica: 20% promienia referencyjnego,
        #  z dodatkowymi globalnymi ograniczeniami.
        r_min_scaled = 0.01 * ref_radius
        r_max_scaled = 0.20 * ref_radius

        local_min = max(radius_min_m, r_min_scaled)
        local_max = min(radius_max_m, r_max_scaled)

        # Zabezpieczenie na wypadek bardzo małego/dużego ref_radius.
        if not (local_max > local_min > 0.0):
            local_min = radius_min_m
            local_max = radius_max_m

        radius_sample = sample_truncated_power_law(
            local_min,
            local_max,
            q_size,
            1,
            rng,
        )[0]
        radii_m[idx] = float(radius_sample)

        sampled_rocks.append(
            with_rock_overrides(
                base_rock,
                radius_m=float(radius_sample),
            )
        )

    return sampled_rocks, radii_m


def _normalize_variant(variant: Rock | dict) -> Rock:
    if isinstance(variant, dict):
        variant = Rock(
            name=str(variant["name"]),
            radius_m=float(variant["radius_m"]) if variant.get("radius_m") is not None else None,
            density_kg_m3=float(variant["density"]),
            albedo=float(variant["albedo"]),
            water_mass_fraction=(
                float(variant["water_mass_fraction"])
                if variant.get("water_mass_fraction") is not None
                else None
            ),
            porosity=float(variant["porosity"]) if variant.get("porosity") is not None else None,
            thermal_conductivity_w_mk=(
                float(variant["thermal_conductivity_w_mk"])
                if variant.get("thermal_conductivity_w_mk") is not None
                else None
            ),
            probability=float(variant.get("prob", variant.get("probability", 1.0))),
            uranium238_ppm=float(variant["uranium238_ppm"]) if variant.get("uranium238_ppm") is not None else None,
            thorium232_ppm=float(variant["thorium232_ppm"]) if variant.get("thorium232_ppm") is not None else None,
            potassium_percent=(
                float(variant["potassium_percent"])
                if variant.get("potassium_percent") is not None
                else None
            ),
            extra=dict(variant.get("extra", {})),
            notes=str(variant.get("notes", "")),
        )

    density = variant.density_kg_m3
    albedo = variant.albedo
    if density is None or albedo is None:
        raise ValueError(f"Rock '{variant.name}' is missing density or albedo.")
    return variant


def _mars_radius_au(mars_particle) -> float:
    if getattr(mars_particle, "r", 0.0) and mars_particle.r > 0.0:
        return float(mars_particle.r)
    return float((3389.5 * u.km).to(u.AU).value)
