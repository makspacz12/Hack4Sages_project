# Radionuclides Module

## Purpose

This module models **internal radioactive sources inside a rock**.
It converts rock composition (U-238, Th-232, K) into **radioactive activity** and estimates the **gamma radiation field inside the rock**.

The goal is to estimate how much radiation is produced by the rock material itself and how much of it reaches the interior (e.g. a biological niche inside the rock).

The model follows this pipeline:

```
rock composition (U, Th, K)
        ↓
specific activity (Bq/kg)
        ↓
volumetric activity (Bq/m³)
        ↓
rock geometry (radius, volume)
        ↓
gamma attenuation in rock
        ↓
internal gamma radiation field
```

---

# Module Structure

```
radiation/radionuclides/
│
├── constants.py
├── activity.py
├── geometry.py
├── gamma.py
└── __init__.py
```

## constants.py

Defines empirical conversion constants used to convert radionuclide concentrations into radioactive activity.

Examples:

```
1 ppm U-238  ≈ 12.4 Bq/kg
1 ppm Th-232 ≈ 4.1 Bq/kg
1 % K        ≈ 313 Bq/kg
```

These constants come from nuclear decay physics combined with isotopic abundances and half-life values.

---

## activity.py

This file converts **rock composition** into **radioactive activity**.

It computes:

```
Bq/kg
```

which represents the number of nuclear decays per second per kilogram of rock.

Formula used:

```
activity = concentration × conversion_constant
```

Example:

```
U_activity = U_ppm × 12.4
Th_activity = Th_ppm × 4.1
K_activity = K_percent × 313
```

The module then sums these contributions:

```
total_activity = U + Th + K
```

The file also converts **mass activity → volumetric activity**:

[
A_v = A_m \cdot \rho
]

where

* (A_v) — volumetric activity (Bq/m³)
* (A_m) — specific activity (Bq/kg)
* (\rho) — rock density (kg/m³)

---

## geometry.py

Computes basic **spherical geometry of the rock**.

Using density and mass:

[
V = \frac{m}{\rho}
]

where

* (V) — volume
* (m) — mass
* (\rho) — density

Then the radius of the equivalent sphere is calculated:

[
R = \left(\frac{3V}{4\pi}\right)^{1/3}
]

This assumes the rock body can be approximated as a **homogeneous sphere**.

---

## gamma.py

This module estimates the **internal gamma radiation field** inside the rock.

It uses a simplified attenuation model for gamma radiation:

[
I = I_0 e^{-\mu x}
]

where

* (I) — intensity after traveling distance (x)
* (I_0) — initial intensity
* (\mu) — gamma attenuation coefficient
* (x) — path length in material

For a homogeneous radioactive sphere the internal gamma field is approximated as:

[
\text{gamma field} \sim
A_v \frac{1 - e^{-\mu R}}{\mu}
]

where

* (A_v) — volumetric activity (Bq/m³)
* (R) — rock radius
* (\mu) — gamma attenuation coefficient (1/m)

This expression approximates the balance between:

* gamma emission from the rock volume
* attenuation inside the material.

---

# Physical Principles Used

The module relies on several physical laws:

### Radioactive decay law

[
A = \lambda N
]

where

* (A) — activity
* (\lambda) — decay constant
* (N) — number of radioactive atoms.

This defines the relationship between isotope abundance and radioactive decay rate.

---

### Mass–activity conversion

Used to convert concentration (ppm or %) into specific activity (Bq/kg).

---

### Mass–volume relationship

[
\rho = \frac{m}{V}
]

Used to compute rock volume from mass and density.

---

### Exponential attenuation law

[
I = I_0 e^{-\mu x}
]

Describes how gamma radiation weakens while passing through material.

---

# Model Assumptions and Approximations

Several simplifications are used in this model.

### Empirical activity constants

Instead of computing activity directly from half-life and atomic mass, the model uses standard geophysical conversion constants.

---

### Secular equilibrium in decay chains

The U-238 and Th-232 decay chains are assumed to be in **secular equilibrium**, meaning daughter isotopes produce activity comparable to the parent isotope.

---

### Uniform rock composition

The rock is assumed to be **chemically homogeneous**:

```
U, Th and K concentrations are uniform across the rock volume
```

Real rocks may contain mineral grains and heterogeneities.

---

### Spherical geometry

The rock is approximated as a **sphere**, which simplifies radiation transport calculations.

---

### Simplified gamma transport

The gamma field calculation uses a simplified attenuation model rather than a full radiation transport simulation (e.g. Monte Carlo).

---

# Output of the Module

The module produces estimates of:

* **specific activity** (Bq/kg)
* **volumetric activity** (Bq/m³)
* **internal gamma radiation field**

These values represent the **strength of internal radioactive sources** inside the rock.

They can later be combined with:

* external cosmic radiation
* shielding by rock layers
* biological radiation tolerance models.

