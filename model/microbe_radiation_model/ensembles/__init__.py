"""Ensemble runs: many simulations → distribution of survival, not one curve."""

from .aggregate import percentile_summary
from .grid import build_heatmap_p50, linspace_values
from .runner import (
    cheap_ensemble_run_config,
    run_parameter_grid,
    run_seed_ensemble,
    write_ensemble_json,
)
from .sensitivity import run_oat_sensitivity, build_tornado_rows, select_knob_specs

__all__ = [
    "build_heatmap_p50",
    "build_tornado_rows",
    "cheap_ensemble_run_config",
    "linspace_values",
    "percentile_summary",
    "run_oat_sensitivity",
    "run_parameter_grid",
    "run_seed_ensemble",
    "select_knob_specs",
    "write_ensemble_json",
]

from .morris import (  # noqa: E402
    MorrisFactor,
    explored_fraction,
    run_morris,
)

__all__ = list(globals().get("__all__", [])) + [
    "MorrisFactor",
    "explored_fraction",
    "run_morris",
]
