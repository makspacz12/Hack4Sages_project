#combined function

def survival_function(radiation_space, radiation_decay, Temp, t, hDNA, radiation_surv_coeff):
     """
    Computes fraction of surviving microbes based on function
        N/N0 = exp(- (kill_radiation + kill_hydrolysis) * t)
        N/N0 = exp(- ((radiation_surv_coeff*dose_rate) + reaction_rate_hydrolysis*hydrolysis_surv_coeff) * t)

    Parameters
    ----------
        dose_rate = radiation_space + radiation_decay = total radiation recieved from space and radioactive decay [Gy/year]
        radiation_surv_coeff = how much radiation affects the microbes [arbitrary]; b <0.15, 0.5> for linear 
        Temp = temperature in given time step [K]
        t = time since meteorite launch [years]
        hDNA = rate of DNA hydrolysis [...?]
        hydrolysis_surv_coeff = how much hydrolysis affects DNA [arbitrary]
    
    Returns
    -------
        survival_function(N/N0) - proportion of original microbe population surviving in given time-step
    """
     N_N0 = math.exp(-((radiation_surv_coeff*(radiation_space + radiation_decay)) + hDNA*(2.3/0.001) * t)
     return(N_N0)


