"""
Project runner and diagnostic helper.

What this script does:
1) Audits srodowisko.ipynb for key import/runtime patterns.
2) Runs current microbe_radiation_model pipeline demos.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from microbe_radiation_model.demos.console import configure_utf8_output
from microbe_radiation_model.simulation.scenarios import (
    format_demo_report,
    run_connected_demo,
    run_static_radiation_demo,
)


def _load_notebook_sources(notebook_path: Path) -> list[str]:
    if not notebook_path.exists():
        return []
    data = json.loads(notebook_path.read_text(encoding="utf-8"))
    lines: list[str] = []
    for cell in data.get("cells", []):
        for line in cell.get("source", []):
            lines.append(str(line))
    return lines


def notebook_audit(notebook_path: Path) -> dict[str, bool]:
    lines = _load_notebook_sources(notebook_path)
    text = "".join(lines)

    return {
        "has_import_rebound": bool(re.search(r"\bimport\s+rebound\b", text)),
        "has_import_reboundx": bool(re.search(r"\bimport\s+reboundx\b", text)),
        "has_microbe_import": bool(re.search(r"\bmicrobe_radiation_model\b", text)),
        "has_sim_assignment": bool(re.search(r"\bsim\s*=", text)),
        "has_sim_usage": bool(re.search(r"\bsim\.", text)),
        "has_nearest_50_gaia_csv": "nearest_50_gaia.csv" in text,
    }


def print_notebook_audit(audit: dict[str, bool], notebook_path: Path) -> None:
    print("=== Notebook audit ===")
    print(f"Notebook path: {notebook_path}")
    print(f"import rebound: {audit['has_import_rebound']}")
    print(f"import reboundx: {audit['has_import_reboundx']}")
    print(f"import microbe_radiation_model: {audit['has_microbe_import']}")
    print(f"sim assignment (sim = ...): {audit['has_sim_assignment']}")
    print(f"sim usage (sim.*): {audit['has_sim_usage']}")
    print(f"uses nearest_50_gaia.csv: {audit['has_nearest_50_gaia_csv']}")
    print()
    if audit["has_sim_usage"] and not audit["has_sim_assignment"]:
        print(
            "NOTE: notebook uses `sim`, but there is no explicit `sim = ...` assignment "
            "in the saved notebook source."
        )
        print()


def print_runtime_reports() -> None:
    print("=== Runtime report: static pipeline ===")
    print(format_demo_report(run_static_radiation_demo()))
    print()
    print("=== Runtime report: connected pipeline ===")
    print(format_demo_report(run_connected_demo()))
    print()


def main() -> None:
    configure_utf8_output()

    notebook_path = Path("srodowisko.ipynb")
    audit = notebook_audit(notebook_path)
    print_notebook_audit(audit, notebook_path)
    print_runtime_reports()


if __name__ == "__main__":
    main()
