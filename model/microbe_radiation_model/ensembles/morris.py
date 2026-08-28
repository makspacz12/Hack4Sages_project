"""
Elementary effects (Morris) screening.

The one-at-a-time tornado this replaces has three defects that are properties of
the method rather than of the implementation.

FIRST, IT BARELY LOOKS AT THE PROBLEM. An OAT design varies each factor from a
single baseline, so every sample lies on a cross inside the hypersphere
inscribed in the input hypercube. The fraction of the cube that sphere occupies
is

    r(k) = pi^(k/2) / (Gamma(k/2 + 1) * 2^k)

which collapses with dimension: r(2) = 0.79, r(3) = 0.52, r(8) = 0.016, and for
the eighteen knobs this project exposes, r(18) = 3.1e-7. Saltelli & Annoni
(2010), Environmental Modelling & Software 25(12):1508-1517, set this out as a
geometric proof and call the resulting analysis perfunctory unless the model is
known to be linear. This one is not: fragment radius enters attenuation and dust
erosion with opposite signs, so the two effects partly cancel.

SECOND, IT CANNOT SEE INTERACTIONS AT ALL. Detecting an interaction requires
moving more than one factor at once, which OAT by construction never does.

THIRD, PERTURBING BY A FIXED PERCENTAGE MISSTATES THE UNCERTAINTY. A +/-10%
nudge measures a local derivative at a point nobody claims to know. The
radiation coefficient is uncertain by a factor of seventeen; ten percent of it
is not the question anyone is asking.

Morris fixes all three at the same cost. Trajectories walk through the space one
factor at a time but from many different starting points, so the design is
global rather than local; the spread of a factor's effects across trajectories
detects non-linearity and interaction; and each factor is sampled across its own
declared range rather than a shared percentage.

The output is two numbers per factor:

    mu*  mean absolute elementary effect - how much the factor matters
    sigma  standard deviation of its effects - how much that depends on where
           you are, which is non-linearity, interaction, or both

Plotted against each other they separate "important and linear" from "important
and entangled", which a tornado bar cannot express.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Callable, Sequence

import numpy as np


@dataclass(frozen=True)
class MorrisFactor:
    """One factor, with the range it is actually uncertain over."""

    id: str
    label: str
    low: float
    high: float
    log: bool = False
    unit: str = ""

    def __post_init__(self) -> None:
        if not (self.high > self.low):
            raise ValueError(f"{self.id}: high must exceed low")
        if self.log and self.low <= 0.0:
            raise ValueError(f"{self.id}: log range needs a positive low")

    def to_value(self, unit_position: float) -> float:
        """Map a position in [0, 1] onto the factor's own range."""
        x = min(1.0, max(0.0, unit_position))
        if self.log:
            return self.low * (self.high / self.low) ** x
        return self.low + x * (self.high - self.low)


def sample_trajectories(
    factors: Sequence[MorrisFactor],
    trajectories: int,
    levels: int,
    rng: np.random.Generator,
) -> list[list[dict[str, float]]]:
    """
    Morris trajectories in unit space.

    Each trajectory starts somewhere random on a grid and then changes exactly
    one factor per step, in random order, so a walk of k factors costs k+1
    evaluations and yields one elementary effect per factor. Reverting to the
    baseline between steps - what OAT does - is what makes OAT both symmetric
    and inefficient, since two effects measured from the same point are not
    independent.
    """
    if trajectories < 1:
        raise ValueError("trajectories must be at least 1")
    if levels < 2:
        raise ValueError("levels must be at least 2")

    k = len(factors)
    delta = levels / (2.0 * (levels - 1))     # the standard Morris step
    grid = np.linspace(0.0, 1.0 - delta, max(1, levels // 2))

    out: list[list[dict[str, float]]] = []
    for _ in range(trajectories):
        base = rng.choice(grid, size=k)
        order = rng.permutation(k)
        point = {f.id: float(base[i]) for i, f in enumerate(factors)}
        walk = [dict(point)]
        for idx in order:
            fid = factors[idx].id
            # Step away from the current value, reflecting at the boundary so
            # the walk stays inside the cube.
            point[fid] = point[fid] + delta if point[fid] + delta <= 1.0 \
                else point[fid] - delta
            walk.append(dict(point))
        out.append(walk)
    return out


def elementary_effects(
    factors: Sequence[MorrisFactor],
    walk: Sequence[dict[str, float]],
    outputs: Sequence[float],
) -> dict[str, float]:
    """
    One elementary effect per factor, from a single trajectory.

    The effect is the change in output divided by the change in the factor's
    unit position, so effects from different factors are comparable even though
    the factors have different units and ranges.
    """
    if len(outputs) != len(walk):
        raise ValueError("need one output per point on the trajectory")
    effects: dict[str, float] = {}
    for i in range(1, len(walk)):
        moved = [f.id for f in factors if walk[i][f.id] != walk[i - 1][f.id]]
        if len(moved) != 1:
            # A step that moved nothing carries no information; a step that
            # moved two factors is not an elementary effect at all.
            continue
        fid = moved[0]
        step = walk[i][fid] - walk[i - 1][fid]
        if step == 0.0:
            continue
        effects[fid] = (outputs[i] - outputs[i - 1]) / step
    return effects


def summarise(
    factors: Sequence[MorrisFactor],
    per_trajectory: Sequence[dict[str, float]],
) -> list[dict[str, Any]]:
    """
    mu*, mu and sigma per factor.

    mu* is the mean of the ABSOLUTE effects. Plain mu can cancel to nearly zero
    for a factor whose influence changes sign across the space - which is
    exactly the non-monotonic case a screening method must not miss - so mu* is
    the one to rank on. Both are reported, because mu far below mu* is itself
    the signature of a sign change.
    """
    rows: list[dict[str, Any]] = []
    for factor in factors:
        values = [t[factor.id] for t in per_trajectory if factor.id in t]
        if not values:
            rows.append({
                "id": factor.id, "label": factor.label, "unit": factor.unit,
                "mu_star": 0.0, "mu": 0.0, "sigma": 0.0, "samples": 0,
                "low": factor.low, "high": factor.high, "log": factor.log,
            })
            continue
        arr = np.asarray(values, dtype=float)
        rows.append({
            "id": factor.id,
            "label": factor.label,
            "unit": factor.unit,
            "mu_star": float(np.mean(np.abs(arr))),
            "mu": float(np.mean(arr)),
            # Population sd with one sample is zero, not undefined.
            "sigma": float(np.std(arr, ddof=1)) if arr.size > 1 else 0.0,
            "samples": int(arr.size),
            "low": factor.low,
            "high": factor.high,
            "log": factor.log,
        })
    rows.sort(key=lambda r: r["mu_star"], reverse=True)
    return rows


def explored_fraction(k: int) -> float:
    """
    Fraction of the input space an OAT design of k factors can reach.

    Reported next to the results so the comparison is quantitative rather than
    rhetorical: this is the number Saltelli & Annoni derive, and for eighteen
    factors it is three ten-millionths of one.
    """
    if k < 1:
        raise ValueError("k must be at least 1")
    return math.pi ** (k / 2) / (math.gamma(k / 2 + 1) * 2 ** k)


def run_morris(
    factors: Sequence[MorrisFactor],
    evaluate: Callable[[dict[str, float]], float],
    trajectories: int = 8,
    levels: int = 4,
    seed: int | None = None,
) -> dict[str, Any]:
    """
    Screen every factor.

    `evaluate` receives real parameter values, already mapped out of unit space,
    and returns the scalar being studied. Cost is trajectories * (k + 1)
    evaluations - the same order as an OAT design of the same size, which is the
    point: this is not a more expensive analysis, it is a better one.
    """
    rng = np.random.default_rng(seed)
    walks = sample_trajectories(factors, trajectories, levels, rng)

    per_trajectory: list[dict[str, float]] = []
    evaluations = 0
    for walk in walks:
        outputs = []
        for point in walk:
            outputs.append(evaluate({f.id: f.to_value(point[f.id]) for f in factors}))
            evaluations += 1
        per_trajectory.append(elementary_effects(factors, walk, outputs))

    return {
        "kind": "morris_screening",
        "factors": summarise(factors, per_trajectory),
        "trajectories": trajectories,
        "levels": levels,
        "evaluations": evaluations,
        "seed": seed,
        "oat_explored_fraction": explored_fraction(len(factors)),
        "note": (
            "mu* ranks factors by influence; sigma measures how much that "
            "influence depends on where in the space you are, which is "
            "non-linearity or interaction. A one-at-a-time design over these "
            f"{len(factors)} factors would sample "
            f"{explored_fraction(len(factors)):.2e} of the input space and "
            "could not detect interactions at all."
        ),
    }
