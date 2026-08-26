"""
Package entry point: ``python -m microbe_radiation_model``.

Delegates to the CLI in ``cli.py``.
"""

import sys

from .cli import main

if __name__ == "__main__":
    sys.exit(main())
