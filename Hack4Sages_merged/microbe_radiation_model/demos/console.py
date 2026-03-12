"""
Pomocnicze funkcje do bezpiecznego wypisywania polskich komunikatów w konsoli.
"""

import sys


def configure_utf8_output() -> None:
    """
    Przełącza standardowe wyjście na UTF-8, jeśli interpreter to wspiera.
    """

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
