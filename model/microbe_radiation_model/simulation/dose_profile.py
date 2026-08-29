"""
Dose as a function of depth inside a fragment.

Every other output in this project reports what happened at the centre of the
rock. That is the most shielded point, and reporting only it hides the thing the
whole project is about: shielding is why lithopanspermia is arguable at all, and
how much you get depends entirely on how deep you are.

The two channels attenuate on completely different scales, which is the point of
plotting them together. Photons in silicate are stopped within centimetres;
cosmic rays, being charged particles, penetrate roughly sixteen times deeper.
A fragment can therefore be opaque to starlight and nearly transparent to the
radiation that actually kills the microbes.

This module produces the profile as a static property of a fragment's geometry -
it does not change frame to frame - so it is exported once per run rather than
per step.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..physics.materials import Material
from ..radiation.shielding_model import radiation_at_points_in_rock_with_bio_core
from .config import DEFAULT_GCR_ATTENUATION_K_M2_KG


@dataclass(frozen=True)
class DepthSample:
    """One radial sample, from the surface inward."""

    depth_m: float
    radius_fraction: float
    photon_fraction: float
    cosmic_ray_fraction: float


def _profile_for_channel(
    radii, rock_radius, bio_radius, rock_material, bio_material,
):
    """
    Transmitted fraction along one radius, for a single attenuation coefficient.

    Sampled along the x axis: the geometry is spherically symmetric, so one
    radius carries the whole profile.
    """
    points = [(r, 0.0, 0.0) for r in radii]
    results = radiation_at_points_in_rock_with_bio_core(
        points=points,
        rock_radius=rock_radius,
        bio_radius=bio_radius,
        rock_material=rock_material,
        bio_material=bio_material,
        surface_flux=1.0,      # unit source, so the answer is a fraction
    )
    return [float(result.local_flux) for result in results]


def dose_depth_profile(
    rock_radius_m: float,
    bio_radius_m: float,
    rock_material: Material,
    bio_material: Material,
    samples: int = 40,
    gcr_attenuation_k_m2_kg: float | None = None,
) -> list[DepthSample]:
    """
    Transmitted fraction of surface radiation, surface to centre.

    Returns both channels at each depth. The cosmic-ray curve is computed by
    substituting the charged-particle attenuation coefficient for the photon one
    the material carries, which is the same substitution the main pipeline makes.
    """
    if rock_radius_m <= 0.0:
        raise ValueError("rock_radius_m must be positive")
    if samples < 2:
        raise ValueError("samples must be at least 2")

    # Read the effective coefficient, not the module constant. Binding the
    # default at import time meant a sensitivity run that overrode the
    # cosmic-ray attenuation still drew the unoverridden curve, so the file
    # carried an audit block reporting one value beside a chart computed from
    # another - the exact contradiction the audit exists to prevent.
    from ..run_overrides import effective_gcr_attenuation_k_m2_kg

    if gcr_attenuation_k_m2_kg is None:
        gcr_attenuation_k_m2_kg = effective_gcr_attenuation_k_m2_kg()

    from dataclasses import replace

    # Surface first, centre last: a reader traces the path radiation takes.
    radii = [
        rock_radius_m * (1.0 - i / (samples - 1)) for i in range(samples)
    ]

    photon = _profile_for_channel(
        radii, rock_radius_m, bio_radius_m, rock_material, bio_material,
    )
    cosmic = _profile_for_channel(
        radii, rock_radius_m, bio_radius_m,
        replace(rock_material, k=gcr_attenuation_k_m2_kg),
        replace(bio_material, k=gcr_attenuation_k_m2_kg),
    )

    return [
        DepthSample(
            depth_m=rock_radius_m - r,
            radius_fraction=r / rock_radius_m,
            photon_fraction=p,
            cosmic_ray_fraction=c,
        )
        for r, p, c in zip(radii, photon, cosmic)
    ]


def attenuation_depth_m(k_m2_kg: float, density_kg_m3: float) -> float:
    """
    Depth at which the transmitted fraction falls to 1/e.

    Quoted alongside the curves so a reader can check the plot against a number
    rather than eyeballing where it crosses.
    """
    if k_m2_kg <= 0.0 or density_kg_m3 <= 0.0:
        raise ValueError("k and density must both be positive")
    return 1.0 / (k_m2_kg * density_kg_m3)


def profile_payload(
    rock_radius_m: float,
    bio_radius_m: float,
    rock_material: Material,
    bio_material: Material,
    rock_type: str | None = None,
    samples: int = 40,
) -> dict:
    """The profile as plain JSON, ready for the replay file."""
    from ..run_overrides import effective_gcr_attenuation_k_m2_kg as effective_gcr

    profile = dose_depth_profile(
        rock_radius_m, bio_radius_m, rock_material, bio_material, samples=samples,
    )
    return {
        "rock_type": rock_type,
        "rock_radius_m": float(rock_radius_m),
        "bio_radius_m": float(bio_radius_m),
        "density_kg_m3": float(rock_material.density),
        "photon_attenuation_depth_m": attenuation_depth_m(
            rock_material.k, rock_material.density,
        ),
        "cosmic_ray_attenuation_depth_m": attenuation_depth_m(
            effective_gcr(), rock_material.density,
        ),
        # The biological core attenuates on its own terms, and the curve is
        # NOT a single exponential because of it: outside the core the path is
        # rock, inside it the path is rock down to the core plus core material
        # the rest of the way. Without these two numbers a reader - or the
        # browser - can reproduce the curve near the surface and gets it wrong
        # at the centre, which is the half that decides whether the microbes
        # live. Photons see the core's own coefficient; charged particles see
        # the substituted one, in the core exactly as in the rock.
        "bio_density_kg_m3": float(bio_material.density),
        "bio_photon_attenuation_depth_m": attenuation_depth_m(
            bio_material.k, bio_material.density,
        ),
        "bio_cosmic_ray_attenuation_depth_m": attenuation_depth_m(
            effective_gcr(), bio_material.density,
        ),
        "samples": [
            {
                "depth_m": s.depth_m,
                "radius_fraction": s.radius_fraction,
                "photon_fraction": s.photon_fraction,
                "cosmic_ray_fraction": s.cosmic_ray_fraction,
            }
            for s in profile
        ],
    }
