"""
Helper configuration objects for the run scenarios.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..erosion import DustErosionConfig
from ..catalogs.asteroid_properties import DEFAULT_ROCK_VARIANTS
from ..materials.rocks import Rock
from ..physics.materials import Material

try:
    from .gaia_catalog import GaiaCatalogConfig
except ImportError:
    @dataclass(frozen=True)
    class GaiaCatalogConfig:
        csv_path: str = "nearest_50_gaia.csv"
        csv_cwd: str | None = None
        mode: str = "csv"
        top_n: int = 50
        overwrite_csv: bool = False
        main_table: str | None = None
        reference_time_utc: str | None = None

try:
    from .solar_system import SolarSystemBuildConfig
except ImportError:
    @dataclass(frozen=True)
    class SolarSystemBuildConfig:
        use_planets: bool = True
        mode: str = "simple"
        observation_time_utc: str | None = None
        kernel_dir: str | None = None
        download_kernels: bool = False
        use_cache: bool = True
        cache_path: str | None = "microbe_radiation_model/data/solar_system_horizons_cache.json"


@dataclass(frozen=True)
class SimulationMaterialConfig:
    """
    Material and geometric parameters for the tracked object.
    """

    rock_radius: float
    bio_mass_fraction: float
    rock_material: Material
    bio_material: Material
    # Thermal conductivity of the rock [W/(m*K)].
    #
    # Kept separate from `rock_material.k`, which is the Beer-Lambert MASS
    # ATTENUATION coefficient [m^2/kg]. The two are different physical
    # quantities and must never be assigned from one another.
    rock_thermal_conductivity_w_mk: float = 2.0


@dataclass(frozen=True)
class BarycenterConfig:
    """
    Controls whether the built simulation is moved to the center-of-mass frame.
    """

    enabled: bool = False


@dataclass(frozen=True)
class RadiationPressureConfig:
    """
    Controls the REBOUNDx radiation force integration layer.
    """

    enabled: bool = False
    dynamic_refresh: bool = False
    refresh_interval_steps: int = 1


@dataclass(frozen=True)
class ImpactSimulationConfig:
    """
    High-level impact defaults used by impact demos.
    """

    enabled: bool = False
    n_asteroids: int = 10
    mars_index: int = 4
    cone_half_angle: float = 60.0
    v_min_kms: float = 5.03
    v_max_kms: float = 20.0
    alpha_v: float = 2.5
    radius_min_m: float = 0.001
    radius_max_m: float = 5.0
    q_size: float = 2.0
    size_velocity_corr: bool = True
    spin_period_range: tuple[float, float] = (2.0, 20.0)
    obliquity_range: tuple[float, float] = (0.0, 180.0)
    seed: int | None = None


@dataclass(frozen=True)
class ThermalModelConfig:
    """
    Controls post-processing of temperature estimates for rocks.
    """

    enabled: bool = True
    compute_internal_profile: bool = True


@dataclass(frozen=True)
class HydrolysisModelConfig:
    """
    Controls whether hydrolysis estimates are written to reports/exports.
    """

    enabled: bool = True


@dataclass(frozen=True)
class OutputConfig:
    """
    Controls visualization-oriented exports produced by scenarios.
    """

    export_json: bool = True
    export_visualizer_json: bool = False
    visualizer_output_path: str = "cosmos_visualizer_simulation.json"
    visualizer_name: str = "Hack4Sages Mars ejecta simulation"
    visualizer_description: str = (
        "Solar System plus nearby Gaia stars and Mars ejecta propagated with REBOUND."
    )
    visualizer_playback_fps: int = 30
    visualizer_position_scale: float = 60.0
    export_star_uv_profile: bool = True
    star_profile_distances_au: tuple[float, ...] = (0.1, 0.5, 1.0, 2.0, 5.0, 10.0)


@dataclass(frozen=True)
class SimulationRunConfig:
    """
    Parametry przebiegu czasowego i konfiguracji otoczenia REBOUND.
    """

    dt_yr: float = 1.0 / 365.25
    n_steps: int = 10
    integration_substeps: int = 10
    add_test_particle: bool = True
    gaia: GaiaCatalogConfig = field(default_factory=GaiaCatalogConfig)
    solar_system: SolarSystemBuildConfig = field(default_factory=SolarSystemBuildConfig)
    barycenter: BarycenterConfig = field(default_factory=BarycenterConfig)
    radiation_pressure: RadiationPressureConfig = field(default_factory=RadiationPressureConfig)
    dust_erosion: DustErosionConfig = field(default_factory=DustErosionConfig)
    impact: ImpactSimulationConfig = field(default_factory=ImpactSimulationConfig)
    thermal: ThermalModelConfig = field(default_factory=ThermalModelConfig)
    hydrolysis: HydrolysisModelConfig = field(default_factory=HydrolysisModelConfig)
    output: OutputConfig = field(default_factory=OutputConfig)

    @property
    def gaia_csv_path(self) -> str:
        return self.gaia.csv_path

    @property
    def use_planets(self) -> bool:
        return self.solar_system.use_planets


# Default radius of a simulated ejecta fragment [m].
#
# This is deliberately NOT taken from the rock catalog. A `Rock` built by
# `rock_variants_from_sources` carries `radius_m` of the *reference body* it was
# measured on (for `basalt_vtype` that is asteroid 4 Vesta, 261 385 m), which is
# five orders of magnitude larger than the fragments `ImpactSimulationConfig`
# samples (0.001-5 m). Using the catalog radius here shields the biological core
# completely and makes the whole radiation-to-biology chain report zeros.
DEFAULT_FRAGMENT_RADIUS_M: float = 0.5

# Beer-Lambert MASS ATTENUATION coefficient of the rock [m^2/kg].
#
# This is `Material.k`, used as `exp(-k * rho * x)` in `radiation/shielding_model.py`.
# It is NOT thermal conductivity - assigning `Rock.thermal_conductivity_w_mk`
# (2.0 W/(m*K) for basalt) here attenuates a 0.5 m fragment by exp(-3460), which
# rounds to exactly zero flux at the biological core.
DEFAULT_ROCK_ATTENUATION_K_M2_KG: float = 0.01

# Fallback thermal conductivity when the rock variant does not define one [W/(m*K)].
DEFAULT_ROCK_THERMAL_CONDUCTIVITY_W_MK: float = 2.0


def default_material_config(
    rock_radius_m: float | None = None,
) -> SimulationMaterialConfig:
    """
    Return the default material set used by the current demos.

    Parameters
    ----------
    rock_radius_m : float, optional
        Radius of the simulated ejecta fragment [m]. Defaults to
        `DEFAULT_FRAGMENT_RADIUS_M`. Material properties (density, thermal
        conductivity) still come from the first entry of `DEFAULT_ROCK_VARIANTS`;
        only the geometry is decoupled from the catalog.

    Notes
    -----
    `rock_material.k` is the Beer-Lambert mass attenuation coefficient [m^2/kg].
    The rock's thermal conductivity [W/(m*K)] is carried separately in
    `SimulationMaterialConfig.rock_thermal_conductivity_w_mk`.
    """

    default_rock_variant = DEFAULT_ROCK_VARIANTS[0]
    rock_attenuation_k = DEFAULT_ROCK_ATTENUATION_K_M2_KG
    rock_thermal_conductivity = DEFAULT_ROCK_THERMAL_CONDUCTIVITY_W_MK

    if rock_radius_m is None:
        rock_radius = DEFAULT_FRAGMENT_RADIUS_M
    elif rock_radius_m <= 0.0:
        raise ValueError("rock_radius_m must be positive.")
    else:
        rock_radius = float(rock_radius_m)

    if isinstance(default_rock_variant, dict):
        rock_name = str(default_rock_variant["name"])
        rock_density = float(default_rock_variant["density"])
    else:
        rock = default_rock_variant
        if not isinstance(rock, Rock):
            raise TypeError(
                "DEFAULT_ROCK_VARIANTS should contain Rock objects "
                "or legacy dict variants."
            )
        if rock.density_kg_m3 is None:
            raise ValueError(f"Rock '{rock.name}' is missing density_kg_m3.")
        rock_name = rock.name
        rock_density = rock.density_kg_m3
        if rock.thermal_conductivity_w_mk is not None:
            rock_thermal_conductivity = rock.thermal_conductivity_w_mk

    return SimulationMaterialConfig(
        rock_radius=rock_radius,
        bio_mass_fraction=0.01,
        rock_material=Material(name=rock_name, density=rock_density, k=rock_attenuation_k),
        bio_material=Material(name="bio", density=1100.0, k=0.02),
        rock_thermal_conductivity_w_mk=rock_thermal_conductivity,
    )
