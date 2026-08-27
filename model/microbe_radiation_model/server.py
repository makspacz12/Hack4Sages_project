"""
Local HTTP API that runs the simulation for the visualizer.

    python -m microbe_radiation_model.server

The browser posts a parameter set, the server runs the real REBOUND pipeline in
a worker thread and reports progress; the browser polls until the replay is
ready. Runs take seconds to minutes, so this is deliberately job-based rather
than a blocking request - a synchronous endpoint would time out and give the
page nothing to show meanwhile.

Built on the standard library on purpose. Adding FastAPI or Flask to
requirements.txt to serve four endpoints on localhost is not a trade worth
making, and the model's own dependencies are already heavy.

Endpoints
---------
GET  /api/health                 is the server up, and is REBOUND importable
GET  /api/parameters             parameter schema and defaults for the UI
POST /api/runs                   start a run; body is a parameter object
GET  /api/runs                   list known runs
GET  /api/runs/<id>              status, progress and any error
GET  /api/runs/<id>/replay       the visualizer replay JSON (when finished)
DELETE /api/runs/<id>            forget a finished run
"""

from __future__ import annotations

import argparse
import json
import threading
import traceback
import uuid
from dataclasses import replace
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.util import find_spec
from typing import Any
from urllib.parse import urlparse

from .simulation.config import default_material_config

# ── Parameter schema ──────────────────────────────────────────────────────
#
# One entry per control the browser renders. Keeping the schema here rather
# than duplicating it in JavaScript means the UI cannot drift from what the
# model actually accepts.

PARAMETERS: list[dict[str, Any]] = [
    {"key": "asteroids", "label": "Fragments", "type": "int",
     "min": 1, "max": 500, "step": 1, "default": 25,
     "help": "How many ejecta fragments the impact launches."},
    {"key": "years", "label": "Simulated time", "type": "float",
     "min": 0.25, "max": 2000, "step": 0.25, "default": 2.5, "unit": "yr",
     "help": "Total time to propagate. Frame count is years / output step."},
    {"key": "dt", "label": "Output step", "type": "float",
     "min": 0.005, "max": 2.0, "step": 0.005, "default": 0.025, "unit": "yr",
     "help": "How often a frame is written. This sets replay size, not accuracy."},
    {"key": "substeps", "label": "Substeps per frame", "type": "int",
     "min": 1, "max": 400, "step": 1, "default": 10,
     "help": "Integrator steps inside each frame. Accuracy depends on "
             "dt/substeps, so raise this with the output step to keep fidelity."},
    {"key": "v_min", "label": "Ejection speed (min)", "type": "float",
     "min": 1, "max": 60, "step": 0.1, "default": 5.03, "unit": "km/s",
     "help": "Lower bound of ejection speed. Default is Mars escape velocity."},
    {"key": "v_max", "label": "Ejection speed (max)", "type": "float",
     "min": 1, "max": 60, "step": 0.1, "default": 20.0, "unit": "km/s",
     "help": "Upper bound of the power-law velocity distribution."},
    {"key": "cone_angle", "label": "Ejecta cone", "type": "float",
     "min": 5, "max": 180, "step": 5, "default": 60.0, "unit": "deg",
     "help": "Half-angle of the cone the fragments are launched into."},
    {"key": "radius_min", "label": "Fragment radius (min)", "type": "float",
     "min": 0.001, "max": 5.0, "step": 0.001, "default": 0.001, "unit": "m",
     "help": "Lower bound of the power-law fragment size distribution."},
    {"key": "radius_max", "label": "Fragment radius (max)", "type": "float",
     "min": 0.001, "max": 5.0, "step": 0.001, "default": 5.0, "unit": "m",
     "help": "Upper bound of the power-law fragment size distribution."},
    {"key": "bio_fraction", "label": "Biological core", "type": "float",
     "min": 0.001, "max": 0.5, "step": 0.001, "default": 0.01,
     "help": "Mass fraction of the fragment occupied by the microbial payload."},
    {"key": "dust_flux", "label": "Dust flux", "type": "float",
     "min": 0.0, "max": 1e-9, "step": 1e-13, "default": 1e-12, "unit": "kg/m²/s",
     "help": "Incident dust mass flux that drives erosion."},
    {"key": "seed", "label": "Random seed", "type": "int",
     "min": 0, "max": 999999, "step": 1, "default": 42,
     "help": "Same seed gives the same swarm. Change it to resample."},
    {"key": "radiation_pressure", "label": "Radiation pressure", "type": "bool",
     "default": True, "help": "REBOUNDx radiation force on each fragment."},
    {"key": "erosion", "label": "Dust erosion", "type": "bool",
     "default": True, "help": "Shrink fragments as they sweep up dust."},
    {"key": "planets", "label": "Planets", "type": "bool",
     "default": True, "help": "Include the eight planets in the N-body system."},
]

_DEFAULTS = {p["key"]: p["default"] for p in PARAMETERS}


class ParameterError(ValueError):
    """A parameter the caller sent is missing, mistyped or out of range."""


def validate(payload: dict[str, Any]) -> dict[str, Any]:
    """Coerce and bounds-check a parameter object against PARAMETERS."""
    if not isinstance(payload, dict):
        raise ParameterError("expected a JSON object")

    known = {p["key"] for p in PARAMETERS}
    unknown = sorted(set(payload) - known)
    if unknown:
        raise ParameterError(f"unknown parameter(s): {', '.join(unknown)}")

    values = dict(_DEFAULTS)
    for spec in PARAMETERS:
        key = spec["key"]
        if key not in payload:
            continue
        raw = payload[key]
        if spec["type"] == "bool":
            if not isinstance(raw, bool):
                raise ParameterError(f"{key}: expected true or false")
            values[key] = raw
            continue
        try:
            value = int(raw) if spec["type"] == "int" else float(raw)
        except (TypeError, ValueError):
            raise ParameterError(f"{key}: expected a number, got {raw!r}") from None
        if value < spec["min"] or value > spec["max"]:
            raise ParameterError(
                f"{key}: {value} is outside the allowed range "
                f"{spec['min']}..{spec['max']}"
            )
        values[key] = value

    if values["v_min"] >= values["v_max"]:
        raise ParameterError(
            f"min ejection speed ({values['v_min']}) must be below "
            f"max ({values['v_max']})"
        )

    if values["radius_min"] >= values["radius_max"]:
        raise ParameterError(
            f"fragment radius min ({values['radius_min']}) must be below "
            f"max ({values['radius_max']})"
        )
    if values["radius_max"] / values["radius_min"] < 1.01:
        raise ParameterError(
            "fragment radius range is too narrow; keep max / min >= 1.01"
        )

    steps = round(values["years"] / values["dt"]) + 1
    if steps < 2:
        raise ParameterError("simulated time is shorter than two time steps")
    if steps > 20000:
        raise ParameterError(
            f"that is {steps} frames; keep years / dt under 20000 "
            f"or the replay will be too large to send"
        )
    return values


def build_configs(values: dict[str, Any]):
    """Turn a validated parameter object into the two frozen config objects."""
    from .simulation.scenarios import _default_mars_pipeline_run_config

    run = _default_mars_pipeline_run_config()
    # Report/provenance radius only; the swarm samples [radius_min, radius_max].
    material = default_material_config(
        rock_radius_m=(values["radius_min"] * values["radius_max"]) ** 0.5
    )
    material = replace(material, bio_mass_fraction=values["bio_fraction"])

    run = replace(
        run,
        dt_yr=values["dt"],
        n_steps=max(2, round(values["years"] / values["dt"]) + 1),
        integration_substeps=int(values["substeps"]),
        impact=replace(
            run.impact,
            n_asteroids=values["asteroids"],
            v_min_kms=values["v_min"],
            v_max_kms=values["v_max"],
            cone_half_angle=values["cone_angle"],
            radius_min_m=values["radius_min"],
            radius_max_m=values["radius_max"],
            seed=values["seed"],
        ),
        dust_erosion=replace(
            run.dust_erosion,
            enabled=values["erosion"],
            dust_mass_flux_kg_m2_s=values["dust_flux"],
        ),
        radiation_pressure=replace(
            run.radiation_pressure, enabled=values["radiation_pressure"]
        ),
        solar_system=replace(run.solar_system, use_planets=values["planets"]),
    )
    return material, run


# ── Run registry ──────────────────────────────────────────────────────────


class Run:
    """One simulation, executed on a worker thread."""

    def __init__(self, run_id: str, values: dict[str, Any]):
        self.id = run_id
        self.values = values
        self.status = "queued"          # queued | running | done | error | cancelled
        self.step = 0
        self.total = max(2, round(values["years"] / values["dt"]) + 1)
        self.error: str | None = None
        self.replay: dict[str, Any] | None = None
        self.message: str | None = None
        self.started = datetime.now(timezone.utc).isoformat(timespec="seconds")
        self.finished: str | None = None
        self._lock = threading.Lock()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "id": self.id,
                "status": self.status,
                "step": self.step,
                "total": self.total,
                "progress": (self.step / self.total) if self.total else 0.0,
                "error": self.error,
                "message": self.message,
                "started": self.started,
                "finished": self.finished,
                "parameters": self.values,
            }

    def _set(self, **fields: Any) -> None:
        with self._lock:
            for key, value in fields.items():
                setattr(self, key, value)

    def execute(self) -> None:
        from .simulation.scenarios import run_mars_ejecta_pipeline_demo

        self._set(status="running")
        try:
            material, run_config = build_configs(self.values)

            def on_progress(step: int, total: int) -> None:
                self._set(step=step, total=total)

            report = run_mars_ejecta_pipeline_demo(
                material_config=material,
                run_config=run_config,
                progress=on_progress,
            )

            if not report.used_rebound:
                self._set(status="error", error=report.message,
                          finished=_now())
                return

            path = report.visualizer_export_path
            if not path:
                self._set(status="error",
                          error="the run produced no visualizer export",
                          finished=_now())
                return

            with open(path, encoding="utf-8") as handle:
                replay = json.load(handle)

            self._set(status="done", step=self.total, replay=replay,
                      message=report.message, finished=_now())
        except Exception as error:                      # noqa: BLE001 - reported to the client
            traceback.print_exc()
            self._set(status="error", error=f"{type(error).__name__}: {error}",
                      finished=_now())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Registry:
    """Keeps runs in memory. Only one executes at a time - REBOUND runs hot."""

    def __init__(self, keep: int = 12):
        self._runs: dict[str, Run] = {}
        self._order: list[str] = []
        self._keep = keep
        self._lock = threading.Lock()
        self._worker_lock = threading.Lock()

    def start(self, values: dict[str, Any]) -> Run:
        run = Run(uuid.uuid4().hex[:12], values)
        with self._lock:
            self._runs[run.id] = run
            self._order.append(run.id)
            while len(self._order) > self._keep:
                stale = self._order.pop(0)
                self._runs.pop(stale, None)

        def worker() -> None:
            # Serialised: two concurrent REBOUND integrations on one machine
            # only make each other slower, and both write the same export path.
            with self._worker_lock:
                run.execute()

        threading.Thread(target=worker, name=f"run-{run.id}", daemon=True).start()
        return run

    def get(self, run_id: str) -> Run | None:
        with self._lock:
            return self._runs.get(run_id)

    def drop(self, run_id: str) -> bool:
        with self._lock:
            if run_id not in self._runs:
                return False
            self._runs.pop(run_id)
            self._order.remove(run_id)
            return True

    def list(self) -> list[dict[str, Any]]:
        with self._lock:
            runs = [self._runs[i] for i in reversed(self._order)]
        return [r.snapshot() for r in runs]


REGISTRY = Registry()


# ── HTTP layer ────────────────────────────────────────────────────────────


class Handler(BaseHTTPRequestHandler):
    server_version = "MicrobeRadiationModel/1.0"
    protocol_version = "HTTP/1.1"

    # -- helpers --

    def _send(self, status: int, payload: Any) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _cors(self) -> None:
        # The Vite dev server is a different origin (localhost:3000).
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _read_json(self) -> Any:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        if length > 1_000_000:
            raise ParameterError("request body too large")
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ParameterError(f"malformed JSON: {error}") from None

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"  {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}")

    # -- routes --

    def do_OPTIONS(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler naming
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"

        if path == "/api/health":
            self._send(200, {
                "ok": True,
                "rebound": find_spec("rebound") is not None,
                "reboundx": find_spec("reboundx") is not None,
            })
            return

        if path == "/api/parameters":
            self._send(200, {"parameters": PARAMETERS, "defaults": _DEFAULTS})
            return

        if path == "/api/runs":
            self._send(200, {"runs": REGISTRY.list()})
            return

        if path.startswith("/api/runs/"):
            rest = path[len("/api/runs/"):]
            run_id, _, tail = rest.partition("/")
            run = REGISTRY.get(run_id)
            if run is None:
                self._send(404, {"error": f"no such run: {run_id}"})
                return
            if tail == "":
                self._send(200, run.snapshot())
                return
            if tail == "replay":
                if run.status != "done" or run.replay is None:
                    self._send(409, {"error": f"run is {run.status}, not done"})
                    return
                self._send(200, run.replay)
                return

        self._send(404, {"error": f"no such endpoint: {path}"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path != "/api/runs":
            self._send(404, {"error": f"no such endpoint: {path}"})
            return
        try:
            values = validate(self._read_json())
        except ParameterError as error:
            self._send(400, {"error": str(error)})
            return
        if find_spec("rebound") is None:
            self._send(503, {
                "error": "REBOUND is not installed in this environment, so no "
                         "orbital run is possible. See RUNNING.md."
            })
            return
        run = REGISTRY.start(values)
        self._send(202, run.snapshot())

    def do_DELETE(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path.startswith("/api/runs/"):
            run_id = path[len("/api/runs/"):]
            self._send(200 if REGISTRY.drop(run_id) else 404, {"dropped": run_id})
            return
        self._send(404, {"error": f"no such endpoint: {path}"})


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m microbe_radiation_model.server",
        description="Local API that runs the simulation for the 3D visualizer.",
    )
    parser.add_argument("--host", default="127.0.0.1",
                        help="bind address (default 127.0.0.1, local only)")
    parser.add_argument("--port", type=int, default=8000, help="port (default 8000)")
    args = parser.parse_args(argv)

    if find_spec("rebound") is None:
        print("WARNING: REBOUND is not importable here, so /api/runs will refuse "
              "to start a run. See RUNNING.md.\n")

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Simulation API listening on http://{args.host}:{args.port}")
    print("  GET  /api/health")
    print("  GET  /api/parameters")
    print("  POST /api/runs")
    print("\nOpen the visualizer with `npm run dev` in web/ and use the RUN panel.")
    print("Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
