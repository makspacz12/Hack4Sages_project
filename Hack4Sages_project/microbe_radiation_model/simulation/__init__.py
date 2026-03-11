"""
Warstwa uruchomieniowa dla REBOUND i pipeline'u promieniowania.

Ten katalog zbiera odpowiedzialności związane z:
- budową układu w REBOUND,
- sprzężeniem odległości z promieniowaniem,
- uruchamianiem scenariuszy pokazowych.
"""

from .builder import build_simulation
from .coupling import process_radiation_step
from .engine import nearest_star_index, run_simulation
from .scenarios import format_demo_report, run_connected_demo, run_static_radiation_demo

__all__ = [
    "build_simulation",
    "format_demo_report",
    "nearest_star_index",
    "process_radiation_step",
    "run_connected_demo",
    "run_simulation",
    "run_static_radiation_demo",
]
