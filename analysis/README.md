# analysis

The empirical work behind the biological half of the model: where the survival
function comes from, and where its coefficients were measured.

| File | Contents |
|---|---|
| `radiation_to_survival.R` | Linear regressions of cell kill frequency against radiation dose rate, from Mileikowsky et al. (2000) |
| `survival_function.py` | Reference implementation of the survival function |
| `figures/` | Plots produced during the analysis |

## Where `radiation_surv_coeff` comes from

`radiation_to_survival.R` digitises the dose-rate / kill-frequency table from

> Mileikowsky, C. et al. (2000). *Natural Transfer of Viable Microbes in Space.*
> Icarus 145(2), 391-427. https://doi.org/10.1006/icar.1999.6317

and fits `kill_frequency = a · dose_rate + b` for four organisms. The slope `a`
**is** the `radiation_surv_coeff` parameter of the survival function:

| Organism | `a` = radiation_surv_coeff [1/Gy] | intercept | R² |
|---|---|---|---|
| *B. subtilis* spores | 0.157 | 0.473 | 0.891 |
| *B. subtilis* (polymer-embedded) | 0.401 | 1.136 | 0.891 |
| *D. radiodurans* | 0.441 | 1.908 | 0.771 |
| *H. salinarum* | 0.362 | 1.992 | 0.666 |

Range: **0.157 - 0.441**, which is exactly the `<0.15, 0.5>` quoted in the
docstring of `model/microbe_radiation_model/biology/survival.py`.

> **This matters for the simulation.** `simulation/scenarios.py` currently
> defaults `radiation_surv_coeff` to `5e-6` - five orders of magnitude below the
> value these fits support. Since this directory establishes that the 0.15-0.5
> range is the sourced one, the `5e-6` default is the value that needs
> explaining, and the most likely explanation is that it was tuned to offset the
> inflated gamma dose coefficients in `radiation/radionuclide_model/gamma.py`.
> See the `AUDIT WARNING` comments in both files.

To reproduce the table:

```bash
Rscript analysis/radiation_to_survival.R    # needs the tidyverse package
```

## Relationship to the model

`survival_function.py` here is the reference; the version the simulation
actually runs is `model/microbe_radiation_model/biology/survival.py`. The
package version additionally converts the hydrolysis rate from 1/s to 1/year
using `SECONDS_PER_YEAR`, which the reference version does not do - it expects
`hDNA` already in the same time unit as `t`.

The hard-coded `hydrolysis_surv_coeff = 1.2 / 0.001` appears in both files with
no cited source. Unlike `radiation_surv_coeff`, nothing in this directory
derives it.
