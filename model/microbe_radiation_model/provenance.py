"""
Provenance: what a result file has to carry to be reproducible.

A number nobody can regenerate is not a result. Before this module, an export
recorded its units and its time step and nothing else - not the parameters, not
the random seed, not the version of the code that produced it. Two files could
not be told apart, and the replay shipped with the site could not be traced to
any run at all.

Every export now carries a `provenance` block. The contract is simple:

    Given only the file, you can rebuild the command that produced it.

Three details make that true rather than aspirational:

* **The seed is resolved, not recorded as "None".** A run with no fixed seed is
  not reproducible, so `resolve_seed` draws one, the run uses it, and it is
  written down. There is no such thing as an unseeded run any more.
* **The coefficients are imported from the modules that define them**, never
  copied as literals. A constant cannot drift away from its record, because the
  record is generated from the constant. Where a coefficient had no name to
  import - the survival sensitivity was an inline default - it was given one
  rather than transcribed here.
* **A digest covers the inputs.** Two files with the same
  `parameters_sha256` came from the same configuration; different digests mean
  different runs, without diffing nested dictionaries by eye.

The block also carries the four unresolved coefficients with their audit status,
so any figure made from a file states its own caveat.
"""

from __future__ import annotations

import hashlib
import json
import platform
import subprocess
import sys
from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from importlib import metadata
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "1.0"

#: Packages whose version can change a result. Recorded whether present or not -
#: "reboundx was absent" is itself part of what produced the numbers.
TRACKED_PACKAGES = ("rebound", "reboundx", "numpy", "scipy", "astropy", "spiceypy")

_MAX_SEED = 2**31 - 1


# ── Seed ──────────────────────────────────────────────────────────────────


def resolve_seed(seed: int | None) -> int:
    """
    Return a concrete seed, drawing one when none was given.

    Recording ``seed: null`` documents that a run cannot be repeated. Drawing
    the seed here and writing it down means every run can be.
    """
    if seed is not None:
        return int(seed)
    import secrets

    return secrets.randbelow(_MAX_SEED)


# ── Environment ───────────────────────────────────────────────────────────


def package_versions() -> dict[str, str | None]:
    """Installed version of each tracked package, or None when absent."""
    versions: dict[str, str | None] = {}
    for name in TRACKED_PACKAGES:
        try:
            versions[name] = metadata.version(name)
        except metadata.PackageNotFoundError:
            versions[name] = None
    return versions


def collect_environment() -> dict[str, Any]:
    """Interpreter and platform, plus the versions that affect the numbers."""
    return {
        "python": sys.version.split()[0],
        "implementation": platform.python_implementation(),
        "platform": platform.platform(),
        "machine": platform.machine(),
        "packages": package_versions(),
    }


# ── Source version ────────────────────────────────────────────────────────


def _git(*args: str, repo: Path) -> str | None:
    try:
        out = subprocess.run(
            ["git", *args],
            cwd=repo,
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    return out.stdout.strip() or None


def collect_source_version() -> dict[str, Any]:
    """
    Which commit produced this, and whether the tree was clean at the time.

    ``dirty: true`` is not a failure - it is the honest statement that the
    working tree carried uncommitted changes, so the commit hash alone does not
    identify the code that ran.
    """
    repo = Path(__file__).resolve().parents[2]
    commit = _git("rev-parse", "HEAD", repo=repo)
    if commit is None:
        return {"available": False, "reason": "not a git checkout, or git is unavailable"}

    status = _git("status", "--porcelain", repo=repo)
    return {
        "available": True,
        "commit": commit,
        "commit_short": commit[:12],
        "branch": _git("rev-parse", "--abbrev-ref", "HEAD", repo=repo),
        "dirty": bool(status),
        "describe": _git("describe", "--tags", "--always", "--dirty", repo=repo),
    }


# ── Configuration capture ─────────────────────────────────────────────────


def _plain(value: Any) -> Any:
    """Recursively convert dataclasses and tuples into JSON-safe values."""
    if is_dataclass(value) and not isinstance(value, type):
        return {k: _plain(v) for k, v in asdict(value).items()}
    if isinstance(value, dict):
        return {str(k): _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return repr(value)


def capture_parameters(material_config: Any, run_config: Any) -> dict[str, Any]:
    """
    The complete input state of a run, as plain JSON.

    Both config objects are frozen dataclasses, so this is a faithful record
    rather than a hand-maintained subset that can fall behind the code.
    """
    from dataclasses import asdict

    from .run_overrides import active_overrides

    overrides = active_overrides()
    return {
        "material": _plain(material_config),
        "run": _plain(run_config),
        # Physics overrides are part of the input state even though they live
        # in thread-local storage rather than in either config object. Leaving
        # them out made the digest claim that two runs with different physics
        # were the same run - which is exactly the guarantee it exists to give.
        "overrides": asdict(overrides) if overrides is not None else None,
    }


def parameters_digest(parameters: dict[str, Any]) -> str:
    """
    Stable SHA-256 over the parameter block.

    Sorted keys and a compact separator make the digest depend on the values
    alone, not on dictionary ordering or formatting.
    """
    canonical = json.dumps(parameters, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# ── The coefficients that decide the answer ───────────────────────────────


def audit_coefficients() -> dict[str, Any]:
    """
    The constants under audit, read live from the modules that define them.

    Copying the numbers into this file would let them drift; importing them
    means the record is generated from the same object the physics uses. Each
    entry states what it is, where it lives, and what is unresolved about it, so
    a plot made from this file carries its own caveat.
    """
    from .chemistry import constants as chem
    from .radiation.radionuclide_model import gamma as gamma_mod
    from .run_overrides import (
        active_overrides,
        effective_gcr_attenuation_k_m2_kg,
        effective_hydrolysis_a_s_inv,
        effective_hydrolysis_ea_j_mol,
        effective_hydrolysis_surv_coeff,
        effective_radiation_surv_coeff,
    )

    # Read through the same accessors the physics reads through.
    #
    # Ensemble and sensitivity runs can override these constants in
    # thread-local state. Reporting the module constant instead of the value
    # actually used meant a file produced under an override asserted a cited,
    # resolved calibration for numbers the run never touched - the audit block
    # misreporting the very thing it exists to report.
    overrides = active_overrides()

    entries: dict[str, Any] = {}

    entries["internal_dose_coefficients"] = {
        "values": {
            "gamma_gy_per_year_per_ppm_u": gamma_mod.GAMMA_DOSE_PER_PPM_U,
            "gamma_gy_per_year_per_ppm_th": gamma_mod.GAMMA_DOSE_PER_PPM_TH,
            "gamma_gy_per_year_per_percent_k": gamma_mod.GAMMA_DOSE_PER_PERCENT_K,
            "alpha_gy_per_year_per_ppm_u": gamma_mod.ALPHA_DOSE_PER_PPM_U,
            "alpha_gy_per_year_per_ppm_th": gamma_mod.ALPHA_DOSE_PER_PPM_TH,
            "beta_gy_per_year_per_ppm_u": gamma_mod.BETA_DOSE_PER_PPM_U,
            "beta_gy_per_year_per_ppm_th": gamma_mod.BETA_DOSE_PER_PPM_TH,
            "beta_gy_per_year_per_percent_k": gamma_mod.BETA_DOSE_PER_PERCENT_K,
            "gamma_mass_attenuation_cm2_g": gamma_mod.GAMMA_MASS_ATTENUATION_CM2_G,
        },
        "module": "radiation.radionuclide_model.gamma",
        "status": "resolved",
        "source": (
            "Cresswell, Carter & Sanderson (2018), Radiation Measurements "
            "120:195-201, doi:10.1016/j.radmeas.2018.02.007, Table 5 "
            "(infinite-matrix conversion factors). Finite-size gamma "
            "correction calibrated to Riedesel & Autzen (2020), Radiation "
            "Measurements 133:106295."
        ),
        "note": (
            "These replaced an uncited table that overstated the dose by 4e4 "
            "to 6e5 across the rock catalog. Residual uncertainty is the ~7% "
            "the source itself reports for the underlying nuclear data, which "
            "is smaller than the spread between rock compositions."
        ),
    }

    entries["hydrolysis"] = {
        "pre_exponential_s_inv": effective_hydrolysis_a_s_inv(),
        "activation_energy_j_mol": effective_hydrolysis_ea_j_mol(),
        "freezing_cutoff_k": chem.FREEZING_TEMPERATURE_K,
        "module": "chemistry.constants",
        "status": "resolved",
        "source": (
            "Lindahl, T., & Nyberg, B. (1972), Biochemistry 11(19):3610-3618, "
            "doi:10.1021/bi00769a018. Ea ≈ 130 kJ/mol, A ≈ 2.3e11 1/s for DNA "
            "depurination at pH 7.4. Supported by Allentoft et al. (2012), "
            "Proc. R. Soc. B 279:4724, doi:10.1098/rspb.2012.1745 (Ea 130-155 "
            "kJ/mol in fossil matrices)."
        ),
        "note": (
            "Half-life still depends on strand length and water activity; the "
            "Arrhenius constants themselves are now cited rather than free."
        ),
    }

    from .biology.constants import (
        DEFAULT_RADIATION_SURV_COEFF_PER_GY,
        HYDROLYSIS_SURV_COEFF,
        LITERATURE_RADIATION_SURV_COEFF_MAX_PER_GY,
        LITERATURE_RADIATION_SURV_COEFF_MIN_PER_GY,
        RADIATION_SURV_COEFF_MAX_PER_GY,
        RADIATION_SURV_COEFF_MIN_PER_GY,
    )

    entries["hydrolysis_survival_coefficient"] = {
        "value": effective_hydrolysis_surv_coeff(),
        "module": "biology.constants",
        "status": "unresolved",
        "issue": (
            "Hard-coded as 1.2/0.001 = 1200 with no cited source. Literature "
            "models depurination via Arrhenius and genome size, not this scale "
            "factor. Kept as an audit / sensitivity parameter until replaced."
        ),
    }

    entries["radiation_survival_coefficient"] = {
        "default_value_per_gy": (
            effective_radiation_surv_coeff() or DEFAULT_RADIATION_SURV_COEFF_PER_GY
        ),
        "sampled_range_per_gy": [
            RADIATION_SURV_COEFF_MIN_PER_GY,
            RADIATION_SURV_COEFF_MAX_PER_GY,
        ],
        "acute_low_let_band_not_used": [
            LITERATURE_RADIATION_SURV_COEFF_MIN_PER_GY,
            LITERATURE_RADIATION_SURV_COEFF_MAX_PER_GY,
        ],
        "module": "biology.constants",
        "status": "resolved",
        "source": (
            "Mileikowsky, C. et al. (2000), Icarus 145(2), 391-427, "
            "doi:10.1006/icar.1999.6317, table 'Effects of GCR and Natural "
            "Radioactivity', as (kill frequency per year) / (dose rate in "
            "Gy/yr). The kill-frequency columns carry header multipliers of "
            "1e-5 (B. subtilis) and 1e-6 (D. radiodurans) and the dose column "
            "is in cGy/yr; the reading is confirmed by the table's own "
            "arithmetic, e.g. ln(1e6)/2.1e-5 = 0.66 Ma against a tabulated "
            "0.66. Cross-checks against Valtonen et al. (2009), ApJ 690:210, "
            "natural-radioactivity term 0.075/Myr, to within a factor of two."
        ),
        "note": (
            "Runtime previously sampled 1e-6 to 1e-5, 11x to 250x too small, "
            "described in-code as an engineering under-tune for demo "
            "timescales. An earlier note in this file blamed the discrepancy "
            "on the regression slopes in analysis/radiation_to_survival.R "
            "being per Myr; that was wrong. They are per year, but the script "
            "drops the header multiplier and the cGy conversion, which is why "
            "they read 1e3 to 1e4 too high. c_rad is not truly constant: it "
            "varies about 4x with shielding depth and about 3x between "
            "species, so a single value carries a factor-of-2 systematic."
        ),
    }

    from .simulation.config import (
        DEFAULT_GCR_ATTENUATION_K_M2_KG,
        DEFAULT_ROCK_ATTENUATION_K_M2_KG,
    )

    entries["cosmic_ray_attenuation"] = {
        "photon_coefficient_m2_kg": DEFAULT_ROCK_ATTENUATION_K_M2_KG,
        "cosmic_ray_coefficient_m2_kg": effective_gcr_attenuation_k_m2_kg(),
        "module": "simulation.config",
        "status": "resolved",
        "source": (
            "Gosse & Phillips (2001), Quaternary Science Reviews 20:1475. "
            "Attenuation length for the hadronic component in silicate rock is "
            "about 160 g/cm^2, i.e. 1600 kg/m^2, so k = 1/1600 m^2/kg."
        ),
        "note": (
            "Cosmic rays were previously attenuated with the photon "
            "coefficient, which is sixteen times larger and made fragments "
            "look far more protective than they are. The published value is "
            "calibrated for spallation-nuclide production rather than absorbed "
            "dose - very close, but not identical, so this carries a residual "
            "systematic."
        ),
    }

    if overrides is not None:
        from dataclasses import asdict

        # Flag only the entries an override can actually reach. Marking every
        # entry claimed that constants outside RunOverrides had been replaced,
        # which is its own false statement about calibration.
        touched = {k for k, v in asdict(overrides).items() if v is not None}
        affected = {
            "hydrolysis": {"hydrolysis_ea_j_mol", "hydrolysis_a_s_inv"},
            "hydrolysis_survival_coefficient": {"hydrolysis_surv_coeff"},
            "radiation_survival_coefficient": {"radiation_surv_coeff"},
            "cosmic_ray_attenuation": {"gcr_attenuation_k_m2_kg"},
        }
        for name, entry in entries.items():
            if affected.get(name, set()) & touched:
                entry["overridden_run"] = True
                # A cited status describes the published value, not a value
                # this run substituted for it.
                if entry.get("status") == "resolved":
                    entry["status"] = "overridden"
                    entry["overridden_note"] = (
                        "This run replaced the cited value. The source below "
                        "documents the published constant, not what was used."
                    )
        entries["_overrides"] = {
            "values": asdict(overrides),
            "note": (
                "A sensitivity or ensemble run replaced one or more physics "
                "constants. The values above are the ones this run used, not "
                "the module defaults."
            ),
        }

    return {
        "note": (
            "These coefficients are not settled. Trends and relative "
            "comparisons in this file are meaningful; absolute doses and "
            "survival fractions are provisional."
        ),
        "unresolved_count": sum(
            1 for e in entries.values() if e.get("status") == "unresolved"
        ),
        "entries": entries,
    }


# ── Reproduction command ──────────────────────────────────────────────────


def reproduce_command(material_config: Any, run_config: Any) -> str:
    """
    The CLI invocation that reproduces this run.

    Emitted from the resolved configuration, so it reflects what actually ran
    rather than what was typed.
    """
    impact = run_config.impact
    # (n_steps - 1) integrations: frame 0 is the initial state.
    years = run_config.dt_yr * (run_config.n_steps - 1)
    parts = [
        "python -m microbe_radiation_model",
        f"--asteroids {impact.n_asteroids}",
        f"--years {years:g}",
        f"--dt {run_config.dt_yr:g}",
        f"--substeps {run_config.integration_substeps}",
        f"--seed {impact.seed}",
        f"--v-min {impact.v_min_kms:g}",
        f"--v-max {impact.v_max_kms:g}",
        f"--cone-angle {impact.cone_half_angle:g}",
        f"--fragment-radius {material_config.rock_radius:g}",
        f"--bio-fraction {material_config.bio_mass_fraction:g}",
    ]
    if run_config.dust_erosion.enabled:
        parts.append(f"--dust-flux {run_config.dust_erosion.dust_mass_flux_kg_m2_s:g}")
    else:
        parts.append("--no-erosion")
    if not run_config.radiation_pressure.enabled:
        parts.append("--no-radiation-pressure")
    if not run_config.solar_system.use_planets:
        parts.append("--no-planets")
    if not run_config.thermal.enabled:
        parts.append("--no-thermal")
    return " ".join(parts)


# ── The block itself ──────────────────────────────────────────────────────


def build_provenance(
    material_config: Any,
    run_config: Any,
    *,
    scenario: str,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Assemble the provenance block for an export.

    @param scenario  Which pipeline produced the file, e.g. "mars_ejecta_pipeline".
    @param extra     Anything scenario-specific worth recording alongside.
    """
    seed = run_config.impact.seed
    if seed is None:
        # Enforced here rather than trusted from the caller. A block recording
        # "seed: null" would describe a run nobody can repeat, which defeats
        # the point of writing it down at all; resolving it here instead would
        # be worse, since the drawn value would not be the one the run used.
        raise ValueError(
            "cannot build provenance for an unresolved seed: call "
            "provenance.resolve_seed() before the run samples anything, and "
            "pass the resolved config here"
        )

    parameters = capture_parameters(material_config, run_config)
    block: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "scenario": scenario,
        "seed": seed,
        "source": collect_source_version(),
        "environment": collect_environment(),
        "parameters": parameters,
        "parameters_sha256": parameters_digest(parameters),
        "reproduce": reproduce_command(material_config, run_config),
        "coefficients_under_audit": audit_coefficients(),
        "field_notes": {
            "seed": "Resolved before the run; there is no unseeded run.",
            "parameters_sha256": "Equal digests mean identical inputs.",
            "source.dirty": "True means the working tree had uncommitted changes.",
            "reproduce": "Run this to regenerate the file.",
        },
    }
    if extra:
        block["scenario_details"] = _plain(extra)
    return block


__all__ = [
    "SCHEMA_VERSION",
    "TRACKED_PACKAGES",
    "audit_coefficients",
    "build_provenance",
    "capture_parameters",
    "collect_environment",
    "collect_source_version",
    "package_versions",
    "parameters_digest",
    "reproduce_command",
    "resolve_seed",
]
