"""
One-at-a-time (OAT) sensitivity analysis → tornado ordering.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Callable, Iterable, Sequence

from ..server import PARAMETERS, _DEFAULTS, validate
from ..simulation.config import GaiaCatalogConfig, OutputConfig, SimulationMaterialConfig, SimulationRunConfig
from .aggregate import percentile_summary
from ..run_overrides import RunOverrides, apply_overrides, physics_baseline_values
from .runner import _run_one_member

PHYSICS_KNOB_SPECS: list[dict[str, Any]] = [
    {
        "id": "hydrolysis_ea",
        "label": "Hydrolysis Ea",
        "unit": "J/mol",
        "override_key": "hydrolysis_ea_j_mol",
        "baseline_key": "hydrolysis_ea",
    },
    {
        "id": "hydrolysis_surv_coeff",
        "label": "Hydrolysis surv. coeff.",
        "unit": "",
        "override_key": "hydrolysis_surv_coeff",
        "baseline_key": "hydrolysis_surv_coeff",
    },
    {
        "id": "radiation_surv_coeff",
        "label": "Radiation surv. coeff.",
        "unit": "1/Gy",
        "override_key": "radiation_surv_coeff",
        "baseline_key": "radiation_surv_coeff",
    },
    {
        "id": "gcr_attenuation_k",
        "label": "GCR attenuation k",
        "unit": "m²/kg",
        "override_key": "gcr_attenuation_k_m2_kg",
        "baseline_key": "gcr_attenuation_k",
    },
]

SERVER_KNOB_KEYS = [p["key"] for p in PARAMETERS if p["key"] != "seed"]

QUICK_KNOB_IDS = {
    "years",
    "bio_fraction",
    "dust_flux",
    "radius_max",
    "hydrolysis_ea",
    "hydrolysis_surv_coeff",
    "radiation_surv_coeff",
    "gcr_attenuation_k",
}


@dataclass(frozen=True)
class KnobSpec:
    id: str
    label: str
    unit: str
    kind: str  # "server" | "physics"
    server_key: str | None = None
    override_key: str | None = None
    baseline_key: str | None = None

    def physics_baseline(self, baseline: dict[str, float]) -> float:
        if not self.baseline_key:
            raise ValueError(f"knob {self.id} has no baseline_key")
        return float(baseline[self.baseline_key])

    def override_value(self, overrides: RunOverrides) -> float:
        if not self.override_key:
            raise ValueError(f"knob {self.id} has no override_key")
        return float(getattr(overrides, self.override_key))


def all_knob_specs() -> list[KnobSpec]:
    by_key = {p["key"]: p for p in PARAMETERS}
    specs: list[KnobSpec] = []
    for key in SERVER_KNOB_KEYS:
        meta = by_key[key]
        specs.append(
            KnobSpec(
                id=key,
                label=str(meta.get("label", key)),
                unit=str(meta.get("unit", "")),
                kind="server",
                server_key=key,
            )
        )
    for meta in PHYSICS_KNOB_SPECS:
        specs.append(
            KnobSpec(
                id=meta["id"],
                label=meta["label"],
                unit=meta.get("unit", ""),
                kind="physics",
                override_key=meta["override_key"],
                baseline_key=meta["baseline_key"],
            )
        )
    return specs


def select_knob_specs(knob_ids: Iterable[str] | None, *, quick: bool = False) -> list[KnobSpec]:
    specs = all_knob_specs()
    if quick:
        allowed = QUICK_KNOB_IDS
        return [s for s in specs if s.id in allowed]
    if knob_ids is None:
        return specs
    wanted = set(knob_ids)
    chosen = [s for s in specs if s.id in wanted]
    missing = sorted(wanted - {s.id for s in chosen})
    if missing:
        raise ValueError(f"unknown knob id(s): {', '.join(missing)}")
    return chosen


def baseline_parameter_values(**overrides: Any) -> dict[str, Any]:
    values = dict(_DEFAULTS)
    values.update(overrides)
    return validate(values)


def configs_for_sensitivity(values: dict[str, Any]) -> tuple[SimulationMaterialConfig, SimulationRunConfig]:
    from ..server import build_configs

    material, run = build_configs(values)
    run = replace(
        run,
        gaia=GaiaCatalogConfig(csv_path=""),
        output=OutputConfig(
            export_json=False,
            export_visualizer_json=False,
            export_star_uv_profile=False,
        ),
    )
    return material, run


def _spec_for_server_key(key: str) -> dict[str, Any]:
    for spec in PARAMETERS:
        if spec["key"] == key:
            return spec
    raise KeyError(key)


def perturb_server_value(
    values: dict[str, Any],
    key: str,
    *,
    fraction: float,
    side: str,
) -> dict[str, Any]:
    spec = _spec_for_server_key(key)
    current = values[key]
    if spec["type"] == "bool":
        perturbed = False if side == "low" else True
    else:
        factor = 1.0 - fraction if side == "low" else 1.0 + fraction
        perturbed = current * factor
        if spec["type"] == "int":
            perturbed = int(round(perturbed))
        perturbed = max(spec["min"], min(spec["max"], perturbed))
    trial = dict(values)
    trial[key] = perturbed
    return validate(trial)


def perturb_physics_overrides(
    baseline: dict[str, float],
    knob: KnobSpec,
    *,
    fraction: float,
    side: str,
) -> RunOverrides:
    assert knob.baseline_key and knob.override_key
    base = float(baseline[knob.baseline_key])
    factor = 1.0 - fraction if side == "low" else 1.0 + fraction
    value = base * factor
    return RunOverrides(**{knob.override_key: value})


def _run_case(
    seeds: Sequence[int],
    *,
    values: dict[str, Any],
    overrides: RunOverrides | None,
    progress: Callable[[int, int], None] | None,
    progress_base: int,
    progress_total: int,
) -> dict[str, Any]:
    material, run_config = configs_for_sensitivity(values)
    metrics: list[float] = []
    for i, seed in enumerate(seeds):
        if progress is not None:
            progress(progress_base + i, progress_total)
        with apply_overrides(overrides):
            run = _run_one_member(material, run_config, seed)
        metrics.append(run["metric"])
    return percentile_summary(metrics)


def build_tornado_rows(
    baseline_p50: float,
    knob_results: Sequence[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in knob_results:
        low_p50 = item["low_aggregate"]["percentiles"]["p50"]
        high_p50 = item["high_aggregate"]["percentiles"]["p50"]
        span = max(
            abs((low_p50 or 0.0) - baseline_p50),
            abs((high_p50 or 0.0) - baseline_p50),
        )
        rows.append(
            {
                "id": item["id"],
                "label": item["label"],
                "unit": item.get("unit", ""),
                "baseline_value": item["baseline_value"],
                "low_value": item["low_value"],
                "high_value": item["high_value"],
                "baseline_p50": baseline_p50,
                "low_p50": low_p50,
                "high_p50": high_p50,
                "span": span,
            }
        )
    rows.sort(key=lambda row: row["span"], reverse=True)
    return rows


def run_oat_sensitivity(
    seeds: Sequence[int],
    *,
    fraction: float = 0.10,
    base_values: dict[str, Any] | None = None,
    knob_specs: Sequence[KnobSpec] | None = None,
    progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    seeds = list(seeds)
    if not seeds:
        raise ValueError("seeds must be a non-empty sequence")
    if not (0.0 < fraction < 1.0):
        raise ValueError("fraction must be between 0 and 1")

    specs = list(knob_specs or all_knob_specs())
    values = dict(base_values or baseline_parameter_values())
    physics_base = physics_baseline_values()

    total_runs = (1 + 2 * len(specs)) * len(seeds)
    done = 0

    baseline_aggregate = _run_case(
        seeds,
        values=values,
        overrides=None,
        progress=progress,
        progress_base=done,
        progress_total=total_runs,
    )
    done += len(seeds)
    baseline_p50 = baseline_aggregate["percentiles"]["p50"]
    if baseline_p50 is None:
        raise RuntimeError("baseline run produced no median survival metric")

    knob_results: list[dict[str, Any]] = []
    for spec in specs:
        if spec.kind == "server":
            assert spec.server_key
            low_values = perturb_server_value(values, spec.server_key, fraction=fraction, side="low")
            high_values = perturb_server_value(values, spec.server_key, fraction=fraction, side="high")
            low_overrides = None
            high_overrides = None
            baseline_value = values[spec.server_key]
            low_value = low_values[spec.server_key]
            high_value = high_values[spec.server_key]
        else:
            low_values = values
            high_values = values
            low_overrides = perturb_physics_overrides(physics_base, spec, fraction=fraction, side="low")
            high_overrides = perturb_physics_overrides(physics_base, spec, fraction=fraction, side="high")
            baseline_value = spec.physics_baseline(physics_base)
            low_value = spec.override_value(low_overrides)
            high_value = spec.override_value(high_overrides)

        low_aggregate = _run_case(
            seeds,
            values=low_values,
            overrides=low_overrides,
            progress=progress,
            progress_base=done,
            progress_total=total_runs,
        )
        done += len(seeds)
        high_aggregate = _run_case(
            seeds,
            values=high_values,
            overrides=high_overrides,
            progress=progress,
            progress_base=done,
            progress_total=total_runs,
        )
        done += len(seeds)

        knob_results.append(
            {
                "id": spec.id,
                "label": spec.label,
                "unit": spec.unit,
                "kind": spec.kind,
                "baseline_value": baseline_value,
                "low_value": low_value,
                "high_value": high_value,
                "low_aggregate": low_aggregate,
                "high_aggregate": high_aggregate,
            }
        )

    if progress is not None:
        progress(total_runs, total_runs)

    tornado = build_tornado_rows(float(baseline_p50), knob_results)
    return {
        "kind": "oat_sensitivity",
        "metric": "median_population_fraction",
        "fraction": float(fraction),
        "seeds": [int(s) for s in seeds],
        "baseline": {
            "values": values,
            "aggregate": baseline_aggregate,
            "p50": float(baseline_p50),
        },
        "knobs": knob_results,
        "tornado": tornado,
    }
