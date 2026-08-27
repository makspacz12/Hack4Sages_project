"""
End-of-run summary of fragment terminal outcomes (Mars pipeline).

Detection lives in scenarios.py; this module only classifies final state and
computes counts / medians for reporting.
"""

from __future__ import annotations

from typing import Any, Iterable


def _median(values: Iterable[float]) -> float | None:
    data = sorted(float(v) for v in values)
    if not data:
        return None
    n = len(data)
    mid = n // 2
    if n % 2:
        return data[mid]
    return 0.5 * (data[mid - 1] + data[mid])


def _classify_fragment(state) -> str:
    if not state.active:
        reason = getattr(state, "termination_reason", None)
        if reason in ("entered_effective_hill", "entered_hill_sphere"):
            return "arrived"
        if reason == "collided_with_star":
            return "collided_star"
        if reason == "collided_with_planet":
            return "collided_planet"
        return "destroyed_other"
    if state.extra.get("escaped_sun", False):
        return "escaped_travelling"
    return "travelling"


def _event_time_and_survival(state, bucket: str) -> tuple[float | None, float | None]:
    extra = state.extra
    if bucket == "escaped_travelling":
        return (
            extra.get("escape_time_years"),
            extra.get("population_fraction_at_escape", state.population_fraction),
        )
    if bucket in (
        "arrived",
        "collided_star",
        "collided_planet",
        "destroyed_other",
    ):
        return (
            extra.get("termination_time_years"),
            extra.get("population_fraction_at_termination", state.population_fraction),
        )
    # Still flying at end of run — no discrete event time.
    return (None, state.population_fraction)


def build_terminal_events_report(
    asteroid_state_store,
    body_indices: list[int],
    *,
    simulation_time_years: float | None = None,
) -> dict[str, Any]:
    """
    Summarise how fragments ended: counts plus median time and survival per group.
    """

    buckets = (
        "arrived",
        "collided_star",
        "collided_planet",
        "escaped_travelling",
        "travelling",
        "destroyed_other",
    )
    counts = {name: 0 for name in buckets}
    times: dict[str, list[float]] = {name: [] for name in buckets}
    survivals: dict[str, list[float]] = {name: [] for name in buckets}

    for body_index in body_indices:
        state = asteroid_state_store.get(body_index)
        bucket = _classify_fragment(state)
        counts[bucket] += 1
        event_time, survival = _event_time_and_survival(state, bucket)
        if event_time is not None:
            times[bucket].append(float(event_time))
        if survival is not None:
            survivals[bucket].append(float(survival))

    groups = {}
    for name in buckets:
        groups[name] = {
            "count": counts[name],
            "median_time_years": _median(times[name]),
            "median_population_fraction": _median(survivals[name]),
        }

    return {
        "n_fragments": len(body_indices),
        "simulation_time_years": simulation_time_years,
        "counts": counts,
        "groups": groups,
    }
