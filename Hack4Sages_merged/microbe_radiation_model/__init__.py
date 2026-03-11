"""
Pakiet łączący model promieniowania z prostą warstwą symulacyjną.

Najważniejsze funkcje są eksportowane na poziomie pakietu, żeby można było
łatwo uruchomić demo albo zbudować własny pipeline w notebooku.
"""

from .chemistry.hydrolysis_model import compute_hydrolysis_rate
from .data_store import load_rock_radiation_summary
from .internal_heat.model import heat_production_from_rock
from .thermal import equilibrium_temperature_from_flux, temperature_profile_surface_mid_center

__all__ = [
    "compute_hydrolysis_rate",
    "equilibrium_temperature_from_flux",
    "heat_production_from_rock",
    "load_rock_radiation_summary",
    "temperature_profile_surface_mid_center",
]

try:
    from .simulation.builder import build_simulation
    from .simulation.engine import run_simulation
    from .simulation.scenarios import format_demo_report, run_connected_demo, run_mars_ejecta_pipeline_demo, run_static_radiation_demo

    __all__.extend(
        [
            "build_simulation",
            "format_demo_report",
            "run_connected_demo",
            "run_mars_ejecta_pipeline_demo",
            "run_simulation",
            "run_static_radiation_demo",
        ]
    )
except ImportError:
    pass

try:
    from .asteroid_state import AsteroidState, AsteroidStateStore
    from .erosion import DustErosionConfig, apply_dust_erosion_step, make_dust_erosion_step_hook
    from .impacts.mars_impact import create_mars_impact

    __all__.extend(
        [
            "AsteroidState",
            "AsteroidStateStore",
            "DustErosionConfig",
            "apply_dust_erosion_step",
            "create_mars_impact",
            "make_dust_erosion_step_hook",
        ]
    )
except ImportError:
    pass

try:
    from .simulation.gaia_catalog import fetch_gaia_table, load_or_fetch_gaia_table

    __all__.extend(
        [
            "fetch_gaia_table",
            "load_or_fetch_gaia_table",
        ]
    )
except ImportError:
    pass
