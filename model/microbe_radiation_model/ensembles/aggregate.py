"""Aggregate a list of scalar run metrics into median + percentiles."""

from __future__ import annotations

from typing import Iterable, Sequence


def percentile_summary(
    values: Iterable[float],
    percentiles: Sequence[float] = (10.0, 25.0, 50.0, 75.0, 90.0),
) -> dict:
    """
    Return count, mean, and requested percentiles for ``values``.

    Percentile 50 is the median. Uses linear interpolation between closest
    ranks (same idea as numpy.percentile default for small n).
    """

    data = sorted(float(v) for v in values)
    n = len(data)
    if n == 0:
        return {
            "n": 0,
            "mean": None,
            "percentiles": {f"p{int(p)}": None for p in percentiles},
        }

    def _percentile(p: float) -> float:
        if n == 1:
            return data[0]
        # Position in [0, n-1] for percentile p in [0, 100].
        pos = (p / 100.0) * (n - 1)
        lo = int(pos)
        hi = min(lo + 1, n - 1)
        frac = pos - lo
        return data[lo] * (1.0 - frac) + data[hi] * frac

    return {
        "n": n,
        "mean": sum(data) / n,
        "percentiles": {f"p{int(p)}": _percentile(p) for p in percentiles},
    }
