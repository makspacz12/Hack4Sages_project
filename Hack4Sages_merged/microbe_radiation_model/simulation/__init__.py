"""
Warstwa uruchomieniowa dla REBOUND i pipeline'u promieniowania.

Ten katalog zbiera odpowiedzialności związane z:
- budową układu w REBOUND,
- sprzężeniem odległości z promieniowaniem,
- uruchamianiem scenariuszy pokazowych.
"""

from .config import (
    BarycenterConfig,
    HydrolysisModelConfig,
    ImpactSimulationConfig,
    OutputConfig,
    RadiationPressureConfig,
    SimulationMaterialConfig,
    SimulationRunConfig,
    ThermalModelConfig,
)
from .coupling import process_radiation_step
from .scenarios import format_demo_report, run_connected_demo, run_mars_ejecta_pipeline_demo, run_static_radiation_demo

__all__ = [
    "HydrolysisModelConfig",
    "ImpactSimulationConfig",
    "OutputConfig",
    "RadiationPressureConfig",
    "SimulationMaterialConfig",
    "SimulationRunConfig",
    "ThermalModelConfig",
    "BarycenterConfig",
    "format_demo_report",
    "process_radiation_step",
    "run_connected_demo",
    "run_mars_ejecta_pipeline_demo",
    "run_static_radiation_demo",
]

try:
    from .builder import build_simulation
    from .barycenter import move_simulation_to_center_of_mass, simulation_barycenter, simulation_momentum
    from .engine import nearest_star_index, run_simulation
    from .solar_system import SolarSystemBuildConfig, build_solar_system, ensure_spice_kernels

    __all__.extend(
        [
            "SolarSystemBuildConfig",
            "build_simulation",
            "build_solar_system",
            "ensure_spice_kernels",
            "move_simulation_to_center_of_mass",
            "nearest_star_index",
            "run_simulation",
            "simulation_barycenter",
            "simulation_momentum",
        ]
    )
except ImportError:
    pass

try:
    from .gaia_catalog import GaiaCatalogConfig, fetch_gaia_table, gaia_table_to_particles, load_or_fetch_gaia_table

    __all__.extend(
        [
            "GaiaCatalogConfig",
            "fetch_gaia_table",
            "gaia_table_to_particles",
            "load_or_fetch_gaia_table",
        ]
    )
except ImportError:
    pass

try:
    from .particle_ops import ParticleMetadataStore, count_permanent_bodies, remove_generated_bodies
    from .reboundx_forces import apply_radiation_pressure_forces, make_dynamic_beta_step_hook, refresh_dynamic_beta
    from ..erosion import DustErosionConfig, apply_dust_erosion_step, make_dust_erosion_step_hook

    __all__.extend(
        [
            "DustErosionConfig",
            "ParticleMetadataStore",
            "apply_radiation_pressure_forces",
            "apply_dust_erosion_step",
            "count_permanent_bodies",
            "make_dynamic_beta_step_hook",
            "make_dust_erosion_step_hook",
            "refresh_dynamic_beta",
            "remove_generated_bodies",
        ]
    )
except ImportError:
    pass
