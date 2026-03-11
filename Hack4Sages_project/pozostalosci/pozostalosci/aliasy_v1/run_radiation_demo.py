"""
Zgodnościowy punkt wejścia do statycznego demo z katalogu ``demos``.
"""

import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from microbe_radiation_model.demos.run_radiation_demo import main


if __name__ == "__main__":
    main()
