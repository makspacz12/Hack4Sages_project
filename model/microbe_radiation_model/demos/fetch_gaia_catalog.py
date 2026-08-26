"""
Fetch and save the Gaia catalog used by the simulation layer.
"""

import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from microbe_radiation_model.demos.console import configure_utf8_output
from microbe_radiation_model.simulation.gaia_catalog import GaiaCatalogConfig, load_or_fetch_gaia_table, resolve_gaia_csv_path


def main() -> None:
    configure_utf8_output()
    config = GaiaCatalogConfig(mode="query_and_save")
    table = load_or_fetch_gaia_table(config)
    output_path = resolve_gaia_csv_path(config.csv_path, config.csv_cwd)
    print(f"Pobrano {len(table)} gwiazd z Gaia DR3.")
    print(f"Zapisano kanoniczny katalog do: {output_path}")
    print("Kolumny runtime: distance_pc, mass_msun_resolved, radius_rsun_resolved, radius_au_resolved, x/y/z_au, vx/vy/vz_au_per_yr.")


if __name__ == "__main__":
    main()
