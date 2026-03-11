import math

def survival_fraction(kill_per_year_radiation, t):
    """
    Computes N/N0 based on the formula:

        N/N0 = exp(-[kill_per_year] * t)

    Parameters
    ----------
        kill_per_year_radiation -- deaths resulting from all radiation recieved
        Time (t)

    Returns
    -------
    float
        The survival fraction N/N0
    """
    exponent = - (kill_per_year_radiation * t)
    return math.exp(exponent)





