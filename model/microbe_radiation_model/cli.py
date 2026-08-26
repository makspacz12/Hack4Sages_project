"""
Command-line interface for the Mars ejecta pipeline.

Before this existed the only way to change a simulation parameter was to edit
``_default_mars_pipeline_run_config()`` in ``simulation/scenarios.py``, which
meant every run either used the defaults or left an uncommitted diff behind.

    python -m microbe_radiation_model --asteroids 50 --years 20 --seed 42

Every option maps onto exactly one field of the frozen config dataclasses, so
``--dry-run`` shows you the resolved configuration without running anything.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import replace
from pathlib import Path
from typing import Any

from .simulation.config import (
    ImpactSimulationConfig,
    OutputConfig,
    SimulationMaterialConfig,
    SimulationRunConfig,
    default_material_config,
)


# ── Argument parsing ──────────────────────────────────────────────────────


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m microbe_radiation_model",
        description="Run the Mars ejecta pipeline and export a replay for the 3D visualizer.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""examples:
  # short smoke run
  python -m microbe_radiation_model --asteroids 10 --years 2.5

  # the default scenario, reproducible
  python -m microbe_radiation_model --asteroids 100 --years 50 --seed 42

  # slow ejecta only, no radiation pressure
  python -m microbe_radiation_model --v-max 8 --no-radiation-pressure

  # see the resolved configuration without running
  python -m microbe_radiation_model --asteroids 500 --years 100 --dry-run

  # save and reuse a scenario
  python -m microbe_radiation_model --asteroids 50 --save-scenario runs/wide.json
  python -m microbe_radiation_model --scenario runs/wide.json
""",
    )

    time_group = parser.add_argument_group("time")
    time_group.add_argument("--dt", type=float, metavar="YEARS",
                            help="time step per output frame [yr] (default 0.025)")
    span = time_group.add_mutually_exclusive_group()
    span.add_argument("--years", type=float, metavar="Y",
                      help="total simulated time [yr]; frame count is years/dt")
    span.add_argument("--steps", type=int, metavar="N",
                      help="number of output frames (default 2000)")
    time_group.add_argument("--substeps", type=int, metavar="N",
                            help="integrator substeps per output frame (default 10)")

    swarm = parser.add_argument_group("ejecta swarm")
    swarm.add_argument("--asteroids", type=int, metavar="N",
                       help="number of fragments to launch (default 100)")
    swarm.add_argument("--v-min", type=float, metavar="KMS",
                       help="minimum ejection speed [km/s] (default 5.03, Mars escape)")
    swarm.add_argument("--v-max", type=float, metavar="KMS",
                       help="maximum ejection speed [km/s] (default 20)")
    swarm.add_argument("--cone-angle", type=float, metavar="DEG",
                       help="ejecta cone half-angle [deg] (default 60)")
    swarm.add_argument("--alpha-v", type=float, metavar="A",
                       help="power-law index of the velocity distribution (default 2.5)")
    swarm.add_argument("--seed", type=int, metavar="S",
                       help="random seed; omit for a different swarm every run")

    frag = parser.add_argument_group("fragment")
    frag.add_argument("--fragment-radius", type=float, metavar="M",
                      help="radius of the tracked fragment [m] (default 0.5)")
    frag.add_argument("--bio-fraction", type=float, metavar="F",
                      help="biological core mass fraction, 0..1 (default 0.01)")

    physics = parser.add_argument_group("physics toggles")
    physics.add_argument("--dust-flux", type=float, metavar="KG_M2_S",
                         help="dust mass flux driving erosion (default 1e-12)")
    physics.add_argument("--no-erosion", action="store_true",
                         help="disable dust erosion")
    physics.add_argument("--no-radiation-pressure", action="store_true",
                         help="disable REBOUNDx radiation pressure")
    physics.add_argument("--no-planets", action="store_true",
                         help="build the system without planets")
    physics.add_argument("--no-thermal", action="store_true",
                         help="skip temperature and hydrolysis post-processing")

    output = parser.add_argument_group("output")
    output.add_argument("--out", metavar="PATH",
                        help="visualizer replay path "
                             "(default microbe_radiation_model/data/cosmos_visualizer_simulation.json)")
    output.add_argument("--no-export", action="store_true",
                        help="run the simulation but write no JSON")

    scenario = parser.add_argument_group("scenarios")
    scenario.add_argument("--scenario", metavar="FILE",
                          help="load options from a JSON file; explicit flags still win")
    scenario.add_argument("--save-scenario", metavar="FILE",
                          help="write the resolved options to a JSON file")
    scenario.add_argument("--dry-run", action="store_true",
                          help="print the resolved configuration and exit")

    return parser


# ── Scenario files ────────────────────────────────────────────────────────

# argparse dest names that may appear in a scenario file.
_SCENARIO_KEYS = (
    "dt", "years", "steps", "substeps",
    "asteroids", "v_min", "v_max", "cone_angle", "alpha_v", "seed",
    "fragment_radius", "bio_fraction",
    "dust_flux", "no_erosion", "no_radiation_pressure", "no_planets", "no_thermal",
    "out", "no_export",
)


def load_scenario(path: str) -> dict[str, Any]:
    """Read a scenario file, rejecting unknown keys rather than ignoring them."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path}: expected a JSON object at the top level")
    unknown = sorted(set(data) - set(_SCENARIO_KEYS))
    if unknown:
        raise ValueError(
            f"{path}: unknown option(s) {', '.join(unknown)}.\n"
            f"Valid keys: {', '.join(_SCENARIO_KEYS)}"
        )
    return data


def scenario_from_args(args: argparse.Namespace) -> dict[str, Any]:
    """The subset of args worth persisting, skipping defaults and meta flags."""
    out: dict[str, Any] = {}
    for key in _SCENARIO_KEYS:
        value = getattr(args, key, None)
        if value in (None, False):
            continue
        out[key] = value
    return out


def merge_scenario(args: argparse.Namespace, parser: argparse.ArgumentParser) -> argparse.Namespace:
    """Apply scenario-file values under any option the user passed explicitly."""
    if not args.scenario:
        return args
    scenario = load_scenario(args.scenario)
    explicit = _explicitly_passed(parser, sys.argv[1:])
    for key, value in scenario.items():
        if key in explicit:
            continue
        setattr(args, key, value)
    return args


def _explicitly_passed(parser: argparse.ArgumentParser, argv: list[str]) -> set[str]:
    """Which dests appear on the command line (so scenario values don't clobber them)."""
    lookup: dict[str, str] = {}
    for action in parser._actions:  # noqa: SLF001 - argparse exposes no public equivalent
        for option in action.option_strings:
            lookup[option] = action.dest
    passed = set()
    for token in argv:
        name = token.split("=", 1)[0]
        if name in lookup:
            passed.add(lookup[name])
    return passed


# ── Config assembly ───────────────────────────────────────────────────────


def build_configs(args: argparse.Namespace) -> tuple[SimulationMaterialConfig, SimulationRunConfig]:
    """Turn parsed arguments into the two frozen config objects the pipeline takes."""
    from .simulation.scenarios import _default_mars_pipeline_run_config

    run = _default_mars_pipeline_run_config()
    material = default_material_config(rock_radius_m=args.fragment_radius)

    if args.bio_fraction is not None:
        if not 0.0 <= args.bio_fraction <= 1.0:
            raise ValueError("--bio-fraction must be between 0 and 1")
        material = replace(material, bio_mass_fraction=args.bio_fraction)

    dt = args.dt if args.dt is not None else run.dt_yr
    if dt <= 0:
        raise ValueError("--dt must be positive")

    if args.years is not None:
        if args.years <= 0:
            raise ValueError("--years must be positive")
        steps = max(1, round(args.years / dt))
    elif args.steps is not None:
        if args.steps < 1:
            raise ValueError("--steps must be at least 1")
        steps = args.steps
    else:
        steps = run.n_steps

    run = replace(run, dt_yr=dt, n_steps=steps)

    if args.substeps is not None:
        if args.substeps < 1:
            raise ValueError("--substeps must be at least 1")
        run = replace(run, integration_substeps=args.substeps)

    impact_changes: dict[str, Any] = {}
    if args.asteroids is not None:
        if args.asteroids < 1:
            raise ValueError("--asteroids must be at least 1")
        impact_changes["n_asteroids"] = args.asteroids
    if args.v_min is not None:
        impact_changes["v_min_kms"] = args.v_min
    if args.v_max is not None:
        impact_changes["v_max_kms"] = args.v_max
    if args.cone_angle is not None:
        if not 0.0 < args.cone_angle <= 180.0:
            raise ValueError("--cone-angle must be in (0, 180]")
        impact_changes["cone_half_angle"] = args.cone_angle
    if args.alpha_v is not None:
        impact_changes["alpha_v"] = args.alpha_v
    if args.seed is not None:
        impact_changes["seed"] = args.seed

    v_min = impact_changes.get("v_min_kms", run.impact.v_min_kms)
    v_max = impact_changes.get("v_max_kms", run.impact.v_max_kms)
    if v_min >= v_max:
        raise ValueError(f"--v-min ({v_min}) must be below --v-max ({v_max})")

    if impact_changes:
        run = replace(run, impact=replace(run.impact, **impact_changes))

    if args.dust_flux is not None:
        if args.dust_flux < 0:
            raise ValueError("--dust-flux must be non-negative")
        run = replace(run, dust_erosion=replace(run.dust_erosion,
                                                dust_mass_flux_kg_m2_s=args.dust_flux))
    if args.no_erosion:
        run = replace(run, dust_erosion=replace(run.dust_erosion, enabled=False))
    if args.no_radiation_pressure:
        run = replace(run, radiation_pressure=replace(run.radiation_pressure, enabled=False))
    if args.no_planets:
        run = replace(run, solar_system=replace(run.solar_system, use_planets=False))
    if args.no_thermal:
        run = replace(run, thermal=replace(run.thermal, enabled=False))

    output_changes: dict[str, Any] = {}
    if args.out is not None:
        output_changes["visualizer_output_path"] = args.out
    if args.no_export:
        output_changes.update(export_json=False, export_visualizer_json=False,
                              export_star_uv_profile=False)
    if output_changes:
        run = replace(run, output=replace(run.output, **output_changes))

    return material, run


def describe(material: SimulationMaterialConfig, run: SimulationRunConfig) -> str:
    """Human-readable summary of what is about to run."""
    impact: ImpactSimulationConfig = run.impact
    output: OutputConfig = run.output
    total_years = run.dt_yr * run.n_steps
    lines = [
        "Resolved configuration",
        "──────────────────────",
        f"  time              {run.n_steps} frames x {run.dt_yr} yr = {total_years:g} yr",
        f"  substeps          {run.integration_substeps} per frame",
        f"  fragments         {impact.n_asteroids}",
        f"  ejection speed    {impact.v_min_kms}-{impact.v_max_kms} km/s "
        f"(power-law index {impact.alpha_v})",
        f"  cone half-angle   {impact.cone_half_angle} deg",
        f"  seed              {impact.seed if impact.seed is not None else 'random'}",
        f"  fragment radius   {material.rock_radius} m",
        f"  bio mass fraction {material.bio_mass_fraction}",
        f"  rock              {material.rock_material.name} "
        f"({material.rock_material.density} kg/m^3)",
        f"  planets           {'on' if run.use_planets else 'off'}",
        f"  radiation press.  {'on' if run.radiation_pressure.enabled else 'off'}",
        f"  dust erosion      {'on' if run.dust_erosion.enabled else 'off'}"
        + (f" (flux {run.dust_erosion.dust_mass_flux_kg_m2_s:g} kg/m^2/s)"
           if run.dust_erosion.enabled else ""),
        f"  thermal           {'on' if run.thermal.enabled else 'off'}",
        f"  replay output     {output.visualizer_output_path if output.export_visualizer_json else 'disabled'}",
    ]
    return "\n".join(lines)


# ── Entry point ───────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        args = merge_scenario(args, parser)
        material, run = build_configs(args)
    except (ValueError, OSError, json.JSONDecodeError) as error:
        parser.error(str(error))
        return 2  # unreachable; argparse.error exits

    if args.save_scenario:
        path = Path(args.save_scenario)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(scenario_from_args(args), indent=2) + "\n",
                        encoding="utf-8")
        print(f"Scenario written to {path}")

    print(describe(material, run))

    if args.dry_run:
        print("\n--dry-run: nothing was executed.")
        return 0

    from .demos.console import configure_utf8_output
    from .simulation.scenarios import format_demo_report, run_mars_ejecta_pipeline_demo

    configure_utf8_output()
    print()
    report = run_mars_ejecta_pipeline_demo(material_config=material, run_config=run)
    print(format_demo_report(report))

    if not report.used_rebound:
        print("\nREBOUND is not installed, so nothing was integrated. See RUNNING.md.",
              file=sys.stderr)
        return 1

    if report.visualizer_export_path:
        print(f"\nNext: python tools/export_simulation_to_web.py    "
              f"# copy the replay into the visualizer")
    return 0
