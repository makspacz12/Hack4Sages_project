#!/usr/bin/env python3
"""
Copy the simulation output from the Python model into the web visualizer.

This is the link between the two halves of the project. The model writes JSON
into ``model/microbe_radiation_model/data/``; the Vite site serves whatever sits
in ``web/public/data/``. Until this script existed the handoff was manual, which
is how the site ended up showing data from a different run than the model had
produced.

Usage
-----
    python tools/export_simulation_to_web.py            # copy what exists
    python tools/export_simulation_to_web.py --check    # report only, copy nothing
    python tools/export_simulation_to_web.py --run      # run the Mars pipeline first

Run it from anywhere; paths are resolved relative to the repository root.
"""

from __future__ import annotations

import argparse
import filecmp
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = REPO_ROOT / "model"
SOURCE_DIR = MODEL_DIR / "microbe_radiation_model" / "data"
TARGET_DIR = REPO_ROOT / "web" / "public" / "data"

# Files produced by the model that the site consumes. "required" marks the ones
# the visualizer cannot start without.
EXPORTS = [
    ("cosmos_visualizer_simulation.json", True),
    ("gamma_radiation_timeseries.json", False),
    ("rock_radiation_summary.json", False),
    ("star_uv_profile.json", False),
]

# Hand-authored scene data that lives only in web/public/data and must never be
# overwritten by a model run.
WEB_ONLY = {"solar_system.json", "solar_simulation.json",
            "simulation_template.json", "test_replay.json"}


def human_size(num_bytes: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if num_bytes < 1024 or unit == "GB":
            return f"{num_bytes:.0f} {unit}" if unit == "B" else f"{num_bytes/1:.1f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f} GB"


def run_pipeline() -> int:
    """Run the full Mars pipeline so the exports are regenerated."""
    print("Running the Mars pipeline to regenerate the exports...")
    print(f"  cwd: {MODEL_DIR}")
    result = subprocess.run(
        [sys.executable, "-m", "microbe_radiation_model.demos.run_mars_pipeline"],
        cwd=MODEL_DIR,
    )
    if result.returncode != 0:
        print(f"\nThe pipeline exited with code {result.returncode}.", file=sys.stderr)
        print("REBOUND is required for the Mars pipeline; see RUNNING.md.", file=sys.stderr)
    return result.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true",
                        help="report what would be copied without writing anything")
    parser.add_argument("--run", action="store_true",
                        help="run the Mars pipeline first, then copy")
    args = parser.parse_args()

    if args.run:
        code = run_pipeline()
        if code != 0:
            return code
        print()

    if not SOURCE_DIR.is_dir():
        print(f"Model output directory not found: {SOURCE_DIR}", file=sys.stderr)
        return 1
    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    copied, skipped, missing = [], [], []

    for filename, required in EXPORTS:
        source = SOURCE_DIR / filename
        target = TARGET_DIR / filename

        if not source.exists():
            missing.append((filename, required))
            continue
        if target.exists() and filecmp.cmp(source, target, shallow=False):
            skipped.append(filename)
            continue
        if not args.check:
            shutil.copy2(source, target)
        copied.append((filename, source.stat().st_size))

    verb = "Would copy" if args.check else "Copied"
    if copied:
        print(f"{verb} {len(copied)} file(s) into web/public/data/:")
        for filename, size in copied:
            print(f"  + {filename:<40} {human_size(size)}")
    if skipped:
        print(f"Already up to date ({len(skipped)}): {', '.join(skipped)}")
    if missing:
        print("\nNot produced by the last model run:")
        for filename, required in missing:
            tag = "REQUIRED by the visualizer" if required else "optional"
            print(f"  - {filename:<40} ({tag})")
        print("\n  Generate them with:")
        print("    python tools/export_simulation_to_web.py --run")
        print("  or directly:")
        print("    cd model && python -m microbe_radiation_model.demos.run_mars_pipeline")

    if not copied and not missing:
        print("Nothing to do - the visualizer already has the current model output.")

    untouched = sorted(WEB_ONLY & {p.name for p in TARGET_DIR.glob("*.json")})
    if untouched:
        print(f"\nLeft alone (hand-authored scene data): {', '.join(untouched)}")

    return 1 if any(required for _, required in missing) else 0


if __name__ == "__main__":
    raise SystemExit(main())
