"""
Run a simple isotropic dust-erosion demo on generated asteroids.
"""

import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from microbe_radiation_model.demos.console import configure_utf8_output
from microbe_radiation_model.erosion import make_dust_erosion_step_hook
from microbe_radiation_model.impacts import ImpactEjectaConfig, create_mars_impact
from microbe_radiation_model.simulation.builder import build_simulation
from microbe_radiation_model.simulation.engine import run_simulation
from microbe_radiation_model.simulation.particle_ops import ParticleMetadataStore


def main() -> None:
    configure_utf8_output()
    build_result = build_simulation()
    impact_result = create_mars_impact(
        build_result.sim,
        ImpactEjectaConfig(star_indices=build_result.star_indices),
    )
    asteroid_state_store = impact_result.asteroid_state_store()
    metadata_store = ParticleMetadataStore()
    for particle_index, metadata in asteroid_state_store.metadata_by_particle().items():
        metadata_store.set(particle_index, **metadata)

    initial_radii = {
        particle_index: asteroid_state_store.get(particle_index).radius_m
        for particle_index in asteroid_state_store.asteroid_indices()
    }
    step_hook = make_dust_erosion_step_hook(
        asteroid_state_store=asteroid_state_store,
        dt_yr=1.0 / 365.25,
        dust_mass_flux_kg_m2_s=1e-12,
        excavation_yield=10.0,
        flux_definition="cross_section",
        refresh_interval_steps=1,
        metadata_store=metadata_store,
    )
    run_simulation(
        sim=build_result.sim,
        star_indices=build_result.star_indices,
        body_indices=asteroid_state_store.asteroid_indices(),
        dt_yr=1.0 / 365.25,
        n_steps=3,
        step_hook=step_hook,
    )

    final_radii = [
        asteroid_state_store.get(particle_index).radius_m
        for particle_index in asteroid_state_store.asteroid_indices()
    ]
    initial_min_radius = min(initial_radii.values())
    final_min_radius = min(final_radii)

    print("=== Demo erozji pyłowej ===")
    print(f"Liczba asteroid: {len(final_radii)}")
    print(f"Minimalny promień początkowy: {initial_min_radius:.6e} m")
    print(f"Minimalny promień końcowy: {final_min_radius:.6e} m")
    print(
        "Przykładowa utrata promienia: "
        f"{asteroid_state_store.get(asteroid_state_store.asteroid_indices()[0]).extra['cumulative_radius_loss_m']:.6e} m"
    )


if __name__ == "__main__":
    main()
