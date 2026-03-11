"""
Generate notebook-style Mars ejecta inside the current simulation.
"""

import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from microbe_radiation_model.demos.console import configure_utf8_output
from microbe_radiation_model.impacts import ImpactEjectaConfig, create_mars_impact
from microbe_radiation_model.simulation.builder import build_simulation


def main() -> None:
    configure_utf8_output()
    build_result = build_simulation()
    impact_result = create_mars_impact(
        build_result.sim,
        ImpactEjectaConfig(star_indices=build_result.star_indices),
    )
    asteroid_df = impact_result.to_dataframe()

    print("=== Demo impaktu marsjańskiego ===")
    print(f"Dodano asteroid: {len(impact_result.asteroids)}")
    print(f"Pierwszy indeks: {impact_result.first_index}")
    print(f"Najbliższa gwiazda dla impaktu: {impact_result.nearest_star_index}")
    print(
        "Zakres beta: "
        f"{asteroid_df['beta'].min():.3e} - {asteroid_df['beta'].max():.3e}"
    )


if __name__ == "__main__":
    main()
