"""
Helpers for managing generated particles in REBOUND simulations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ParticleMetadataStore:
    """
    Lightweight metadata registry keyed by REBOUND particle index.
    """

    by_index: dict[int, dict[str, Any]] = field(default_factory=dict)

    def set(self, particle_index: int, **metadata: Any) -> None:
        current = self.by_index.setdefault(particle_index, {})
        current.update(metadata)

    def get(self, particle_index: int) -> dict[str, Any]:
        return dict(self.by_index.get(particle_index, {}))

    def remove_after_index(self, particle_index: int) -> None:
        for key in list(self.by_index):
            if key > particle_index:
                self.by_index.pop(key, None)


def remove_particles_after_index(sim: Any, first_removed_index: int) -> int:
    """
    Remove every particle at or after ``first_removed_index``.
    """

    removed = 0
    for index in range(sim.N - 1, first_removed_index - 1, -1):
        sim.remove(index)
        removed += 1
    return removed


def remove_generated_bodies(sim: Any, n_permanent: int) -> int:
    """
    Remove all particles beyond the permanent-body boundary.
    """

    return remove_particles_after_index(sim, n_permanent)


def count_permanent_bodies(n_permanent: int) -> int:
    """
    Return the number of permanent bodies stored by the builder.
    """

    return n_permanent
