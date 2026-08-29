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

and fits `kill_frequency = a · dose_rate + b` for four organisms. The raw slopes
are decimal-reduction coefficients **per kGy** (≈ `1/D10` with `D10` in kGy):

| Organism | raw slope `a` [1/kGy, log10] | intercept | R² |
|---|---|---|---|
| *B. subtilis* spores | 0.157 | 0.473 | 0.891 |
| *B. subtilis* (polymer-embedded) | 0.401 | 1.136 | 0.891 |
| *D. radiodurans* | 0.441 | 1.908 | 0.771 |
| *H. salinarum* | 0.362 | 1.992 | 0.666 |

The simulation uses a natural-exponential kill term with dose in **Gy**:

```
c_rad [1/Gy] = (a_per_kGy / 1000) * ln(10)
```

which maps these slopes onto roughly **`3.6e-4 … 1.0e-3 1/Gy`**. Note that
`biology/constants.py` no longer uses this derivation: it now reads
`radiation_surv_coeff` straight off Mileikowsky's chronic-exposure table
(kill frequency per year / dose rate) and samples **`2.5e-5 … 4.3e-4 1/Gy`**
per fragment. The `coefficients_under_audit` block in any export carries the
authoritative value.

## Relationship to the model

`survival_function.py` here is the reference; the version the simulation
actually runs is `model/microbe_radiation_model/biology/survival.py`. The
package version additionally converts the hydrolysis rate from 1/s to 1/year
using `SECONDS_PER_YEAR`, which the reference version does not do - it expects
`hDNA` already in the same time unit as `t`.

The hard-coded `hydrolysis_surv_coeff = 1.2 / 0.001 = 1200` appears in both
files with **no cited source** (audit / sensitivity parameter). Unlike
`radiation_surv_coeff`, nothing in this directory derives it.

To reproduce the raw-slope table:

```bash
Rscript analysis/radiation_to_survival.R    # needs the tidyverse package
```
