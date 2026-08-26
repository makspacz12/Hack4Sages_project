"""
Biological survival layer.

Converts accumulated radiation dose and DNA hydrolysis rate into a surviving
microbial population fraction.
"""

from .survival import survival_function

__all__ = ["survival_function"]
