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
* **The coefficients are read live from the modules that define them**, not
  copied here. A constant cannot drift away from its record, because the record
  is generated from the constant.
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
    return {
        "material": _plain(material_config),
        "run": _plain(run_config),
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

    entries: dict[str, Any] = {}

    entries["gamma_dose_coefficients"] = {
        "values_gy_per_year_per_ppm": {
            "k40": gamma_mod._GAMMA_DOSE_COEFF_K40_PPM,
            "th232": gamma_mod._GAMMA_DOSE_COEFF_TH232_PPM,
            "u238": gamma_mod._GAMMA_DOSE_COEFF_U238_PPM,
            "u235": gamma_mod._GAMMA_DOSE_COEFF_U235_PPM,
        },
        "module": "radiation.radionuclide_model.gamma",
        "status": "unresolved",
        "issue": (
            "Uncited. For basalt these give 46.6 Gy/yr against 1.07e-3 Gy/yr "
            "computed from activity times decay-chain energy in an infinite "
            "medium - a factor of ~4.4e4, reaching ~6.2e5 across the catalog. "
            "The K-40 term supplies 99.8% of the inflated total."
        ),
    }

    entries["hydrolysis"] = {
        "pre_exponential_s_inv": chem.HYDROLYSIS_A_S_INV,
        "activation_energy_j_mol": chem.HYDROLYSIS_EA_J_MOL,
        "freezing_cutoff_k": chem.FREEZING_TEMPERATURE_K,
        "module": "chemistry.constants",
        "status": "unresolved",
        "issue": (
            "A=1e12 1/s with Ea=60 kJ/mol gives 3.08e1 1/s at 298 K, a 23 ms "
            "DNA half-life, against a measured depurination rate near 3e-11 1/s "
            "(~700 yr). Ea near 130 kJ/mol reproduces the literature."
        ),
    }

    entries["radiation_survival_coefficient"] = {
        "default_value": 5e-6,
        "documented_range": [0.15, 0.5],
        "fitted_range": [0.157, 0.441],
        "module": "simulation.scenarios",
        "status": "unresolved",
        "issue": (
            "The default is five orders of magnitude below the range its own "
            "docstring gives, and below the slopes fitted in "
            "analysis/radiation_to_survival.R from Mileikowsky et al. (2000). "
            "It very nearly cancels the inflated gamma dose above, so the two "
            "must be corrected together or not at all."
        ),
        "source_of_range": (
            "Mileikowsky, C. et al. (2000), Icarus 145(2), 391-427, "
            "doi:10.1006/icar.1999.6317"
        ),
    }

    entries["cosmic_ray_attenuation"] = {
        "module": "radiation.shielding_model",
        "status": "unresolved",
        "issue": (
            "Galactic cosmic rays are attenuated with the photon mass "
            "attenuation coefficient. Charged particles have an attenuation "
            "depth near 100 g/cm^2, roughly ten times larger, which changes the "
            "dose reaching a 0.5 m fragment's core by about 4e4."
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
    years = run_config.dt_yr * run_config.n_steps
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
    parameters = capture_parameters(material_config, run_config)
    block: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "scenario": scenario,
        "seed": run_config.impact.seed,
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
