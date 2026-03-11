"""
Pakiet łączący model promieniowania z prostą warstwą symulacyjną.

Najważniejsze funkcje są eksportowane na poziomie pakietu, żeby można było
łatwo uruchomić demo albo zbudować własny pipeline w notebooku.
"""

from .simulation.builder import build_simulation
from .simulation.engine import run_simulation
from .simulation.scenarios import format_demo_report, run_connected_demo, run_static_radiation_demo

__all__ = [
    "build_simulation",
    "format_demo_report",
    "run_connected_demo",
    "run_simulation",
    "run_static_radiation_demo",
]
