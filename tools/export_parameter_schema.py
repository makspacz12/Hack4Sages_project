#!/usr/bin/env python3
"""
Freeze the solver's parameter schema into the web bundle.

The control panel used to fetch its parameter list from the local solver API.
That is fine when the solver is running, and it is running for almost nobody:
open the page without it and `boot()` took the offline branch, which wiped the
panel body and left a 340-pixel column containing one sentence and a disabled
button. An application whose whole claim is "this is the panel where you can
type anything in and launch it" showed, by default, not one parameter.

The schema is small, changes rarely, and is already the single source of truth
for validation. Writing it into the bundle at build time lets the panel render
the full set of controls with no solver at all - editable, explained, and with
every effect that can be recomputed in the browser still live. Only the button
that needs a solver knows the solver is missing.

The version field lets the running solver's schema be compared against the
frozen one, so a drift is reported rather than silently ignored.

Run from the repository root:
    python tools/export_parameter_schema.py
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "model"))

from microbe_radiation_model.server import PARAMETERS  # noqa: E402

OUT = ROOT / "web" / "src" / "paramSchema.json"


def build() -> dict:
    parameters = json.loads(json.dumps(PARAMETERS))  # plain JSON types only
    defaults = {p["key"]: p["default"] for p in parameters}
    # A digest over the schema itself, so the panel can tell a live solver's
    # schema apart from the frozen one without comparing field by field.
    canonical = json.dumps(parameters, sort_keys=True, separators=(",", ":"))
    return {
        "generated_by": "tools/export_parameter_schema.py",
        "schema_sha256": hashlib.sha256(canonical.encode()).hexdigest()[:16],
        "parameters": parameters,
        "defaults": defaults,
    }


def main() -> int:
    payload = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} — {len(payload['parameters'])} parameters, "
          f"schema {payload['schema_sha256']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
