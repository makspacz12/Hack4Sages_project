"""
Run the Mars pipeline many times and summarise survival.

MVP = seed ensemble (same knobs, different seeds).
Grid = 2D sweep of ejection speed × fragment radius, seeds per cell.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from dataclasses import replace
from pathlib import Path
from typing import Any, Callable, Sequence

from ..simulation.config import (
    GaiaCatalogConfig,
    ImpactSimulationConfig,
    OutputConfig,
    SimulationMaterialConfig,
    SimulationRunConfig,
    default_material_config,
)
from ..simulation.scenarios import (
    _default_mars_pipeline_run_config,
    run_mars_ejecta_pipeline_demo,
)
from .aggregate import percentile_summary
from .grid import build_heatmap_p50, linspace_values


def cheap_ensemble_run_config(**overrides: Any) -> SimulationRunConfig:
    """
    Short, export-free Mars config suitable for many ensemble members.

    Defaults intentionally small so a seed loop finishes on a laptop. Pass
    overrides (n_steps, impact=..., etc.) when you need a heavier run.
    """

    base = _default_mars_pipeline_run_config()
    run = replace(
        base,
        dt_yr=overrides.pop("dt_yr", 0.05),
        n_steps=overrides.pop("n_steps", 21),  # ~1 yr span at dt=0.05
        integration_substeps=overrides.pop("integration_substeps", 5),
        gaia=overrides.pop("gaia", GaiaCatalogConfig(csv_path="")),
        output=overrides.pop(
            "output",
            OutputConfig(
                export_json=False,
                export_visualizer_json=False,
                export_star_uv_profile=False,
            ),
        ),
        impact=replace(
            base.impact,
            n_asteroids=overrides.pop("n_asteroids", 8),
        ),
    )
    if overrides:
        run = replace(run, **overrides)
    return run


def _metric_from_report(report) -> float | None:
    summary = getattr(report, "survival_summary", None) or {}
    value = summary.get("median_population_fraction")
    if value is None:
        value = summary.get("mean_population_fraction")
    return None if value is None else float(value)


def _run_one_member(
    material_config: SimulationMaterialConfig,
    run_config: SimulationRunConfig,
    seed: int,
) -> dict[str, Any]:
    member = replace(run_config, impact=replace(run_config.impact, seed=int(seed)))
    report = run_mars_ejecta_pipeline_demo(
        material_config=material_config,
        run_config=member,
    )
    if not report.used_rebound:
        raise RuntimeError(
            f"ensemble member seed={seed} did not run REBOUND: {report.message}"
        )
    metric = _metric_from_report(report)
    if metric is None:
        raise RuntimeError(f"ensemble member seed={seed} produced no survival metric")
    return {
        "seed": int(seed),
        "metric": metric,
        "survival_summary": report.survival_summary,
        "total_time_years": report.total_time_years,
        "terminal_events_report": report.terminal_events_report,
    }


def _with_grid_point(
    run_config: SimulationRunConfig,
    *,
    velocity_kms: float,
    radius_m: float,
) -> SimulationRunConfig:
    impact: ImpactSimulationConfig = replace(
        run_config.impact,
        v_min_kms=float(velocity_kms),
        v_max_kms=float(velocity_kms),
        radius_min_m=float(radius_m),
        radius_max_m=float(radius_m),
    )
    return replace(run_config, impact=impact)


def run_seed_ensemble(
    seeds: Sequence[int],
    *,
    material_config: SimulationMaterialConfig | None = None,
    run_config: SimulationRunConfig | None = None,
    progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    """
    Run one Mars pipeline per seed; aggregate end-of-run median survival.
    """

    material_config = material_config or default_material_config()
    run_config = run_config or cheap_ensemble_run_config()
    seeds = list(seeds)
    if not seeds:
        raise ValueError("seeds must be a non-empty sequence")

    runs: list[dict[str, Any]] = []
    metrics: list[float] = []

    for i, seed in enumerate(seeds):
        if progress is not None:
            progress(i, len(seeds))
        run = _run_one_member(material_config, run_config, seed)
        metrics.append(run["metric"])
        runs.append(run)

    if progress is not None:
        progress(len(seeds), len(seeds))

    return {
        "kind": "seed_ensemble",
        "metric": "median_population_fraction",
        "n_seeds": len(seeds),
        "runs": runs,
        "aggregate": percentile_summary(metrics),
    }


def run_parameter_grid(
    seeds: Sequence[int],
    *,
    velocity_kms: Sequence[float],
    radius_m: Sequence[float],
    material_config: SimulationMaterialConfig | None = None,
    run_config: SimulationRunConfig | None = None,
    progress: Callable[[int, int], None] | None = None,
    include_runs: bool = False,
) -> dict[str, Any]:
    """
    2D grid: for each (velocity, radius) point run all seeds and aggregate.

    Each cell pins ``v_min = v_max`` and ``radius_min = radius_max`` so every
    fragment in that cell shares the grid coordinates (power-law collapses).
  """

    material_config = material_config or default_material_config()
    base_config = run_config or cheap_ensemble_run_config()
    seeds = list(seeds)
    velocities = list(velocity_kms)
    radii = list(radius_m)
    if not seeds:
        raise ValueError("seeds must be a non-empty sequence")
    if not velocities or not radii:
        raise ValueError("velocity_kms and radius_m must be non-empty")

    cells: list[dict[str, Any]] = []
    total = len(velocities) * len(radii) * len(seeds)
    done = 0

    for radius in radii:
        for velocity in velocities:
            cell_config = _with_grid_point(
                base_config,
                velocity_kms=velocity,
                radius_m=radius,
            )
            cell_runs: list[dict[str, Any]] = []
            cell_metrics: list[float] = []
            for seed in seeds:
                if progress is not None:
                    progress(done, total)
                run = _run_one_member(material_config, cell_config, seed)
                cell_metrics.append(run["metric"])
                if include_runs:
                    cell_runs.append(run)
                done += 1

            cell: dict[str, Any] = {
                "velocity_kms": float(velocity),
                "radius_m": float(radius),
                "aggregate": percentile_summary(cell_metrics),
            }
            if include_runs:
                cell["runs"] = cell_runs
            cells.append(cell)

    if progress is not None:
        progress(total, total)

    return {
        "kind": "parameter_grid",
        "metric": "median_population_fraction",
        "axes": {
            "velocity_kms": [float(v) for v in velocities],
            "radius_m": [float(r) for r in radii],
        },
        "seeds": [int(s) for s in seeds],
        "n_cells": len(cells),
        "cells": cells,
        "heatmap_p50": build_heatmap_p50(cells, velocities, radii),
    }


def ensemble_provenance(overrides: Any = None) -> dict[str, Any]:
    """
    The reproducibility record for a sweep.

    A sweep has no single parameter set to digest - that is the point of it -
    so this records the environment, the source version and the coefficient
    audit, which are what a reader needs to know whether two sweeps are
    comparable. Any active physics overrides are recorded too: without them a
    file produced under an override would state the module constant and quietly
    misreport its own calibration.
    """
    from dataclasses import asdict

    from ..provenance import (
        audit_coefficients, collect_environment, collect_source_version,
    )
    from ..run_overrides import active_overrides

    resolved = overrides if overrides is not None else active_overrides()
    return {
        "schema_version": 1,
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "environment": collect_environment(),
        "source": collect_source_version(),
        "coefficients_under_audit": audit_coefficients(),
        "physics_overrides": asdict(resolved) if resolved is not None else None,
    }


def write_ensemble_json(result: dict[str, Any], path: str | Path) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    # Stamped here rather than by the caller so no sweep can be written without
    # one. Every other output in this project carries provenance; these did not,
    # which meant the files a figure would come from were the untraceable ones.
    payload = dict(result)
    payload.setdefault("provenance", ensemble_provenance())
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return out
