"""
Zgodnościowy punkt wejścia do pełnego uruchomienia z katalogu ``demos``.
"""

import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from microbe_radiation_model.demos.run_simulation import main
from microbe_radiation_model.simulation.engine import nearest_star_index, run_simulation

__all__ = ["nearest_star_index", "run_simulation"]


if __name__ == "__main__":
    main()
