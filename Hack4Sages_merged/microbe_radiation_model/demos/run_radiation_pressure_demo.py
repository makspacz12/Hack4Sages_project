"""
Enable REBOUNDx radiation pressure for generated asteroids.
"""

import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from microbe_radiation_model.demos.console import configure_utf8_output
from microbe_radiation_model.impacts import ImpactEjectaConfig, create_mars_impact
from microbe_radiation_model.simulation.builder import build_simulation
from microbe_radiation_model.simulation.config import RadiationPressureConfig
from microbe_radiation_model.simulation.engine import run_simulation
from microbe_radiation_model.simulation.particle_ops import ParticleMetadataStore
from microbe_radiation_model.simulation.reboundx_forces import (
    apply_radiation_pressure_forces,
    make_dynamic_beta_step_hook,
)


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

    beta_by_particle = {
        particle_index: float(asteroid_state.current_beta or 0.0)
        for particle_index, asteroid_state in asteroid_state_store.by_index.items()
    }
    _rebx, radiation_forces = apply_radiation_pressure_forces(
        build_result.sim,
        beta_by_particle,
        RadiationPressureConfig(enabled=True, dynamic_refresh=True),
    )
    step_hook = make_dynamic_beta_step_hook(
        asteroid_state_store=asteroid_state_store,
        metadata_store=metadata_store,
        refresh_interval_steps=1,
    )
    run_simulation(
        sim=build_result.sim,
        star_indices=build_result.star_indices,
        body_indices=asteroid_state_store.asteroid_indices(),
        dt_yr=1.0 / 365.25,
        n_steps=3,
        step_hook=step_hook,
    )

    current_betas = [
        float(asteroid_state_store.get(asteroid.sim_index).current_beta or asteroid.beta)
        for asteroid in impact_result.asteroids
    ]

    print("=== Demo ciśnienia promieniowania ===")
    print(f"Radiation forces aktywne. c = {radiation_forces.params['c']:.2f} AU/yr")
    print(f"Beta przypisane {len(beta_by_particle)} asteroidom.")
    print(f"Dynamiczny refresh wykonany po 3 krokach. Zakres beta: {min(current_betas):.3e} - {max(current_betas):.3e}")


if __name__ == "__main__":
    main()
