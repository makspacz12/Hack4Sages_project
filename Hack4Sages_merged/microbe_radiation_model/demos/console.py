"""
Helpers for safely printing non-ASCII report text to the console.
"""

import sys


def configure_utf8_output() -> None:
    """
    Switch standard output to UTF-8 when the interpreter supports it.
    """

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
