"""2D parameter grids for ensemble runs (velocity × fragment radius)."""

from __future__ import annotations

from typing import Sequence


def linspace_values(lo: float, hi: float, n: int) -> list[float]:
    """Inclusive endpoints, ``n`` points (``n`` must be >= 2 unless lo == hi)."""

    if n < 1:
        raise ValueError("n must be at least 1")
    if n == 1:
        return [float(lo)]
    if hi < lo:
        raise ValueError("hi must be >= lo")
    if hi == lo:
        return [float(lo)] * n
    step = (hi - lo) / (n - 1)
    return [lo + i * step for i in range(n)]


def build_heatmap_p50(
    cells: Sequence[dict],
    velocity_kms: Sequence[float],
    radius_m: Sequence[float],
) -> list[list[float | None]]:
    """
    Build a 2D table [radius_index][velocity_index] of median (p50) survival.

    Rows follow ``radius_m`` (outer), columns follow ``velocity_kms``.
    """

    index: dict[tuple[float, float], float | None] = {}
    for cell in cells:
        key = (float(cell["velocity_kms"]), float(cell["radius_m"]))
        agg = cell.get("aggregate") or {}
        percentiles = agg.get("percentiles") or {}
        index[key] = percentiles.get("p50")

    table: list[list[float | None]] = []
    for r in radius_m:
        row: list[float | None] = []
        for v in velocity_kms:
            row.append(index.get((float(v), float(r))))
        table.append(row)
    return table
