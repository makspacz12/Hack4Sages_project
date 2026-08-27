"""
CLI for ensembles: seed scatter, 2D parameter grid, or OAT sensitivity.

    python -m microbe_radiation_model.ensembles --seeds 0,1,2,3,4
    python -m microbe_radiation_model.ensembles --grid --v-steps 3 --radius-steps 3
    python -m microbe_radiation_model.ensembles --tornado --quick --seeds 0,1
"""

from __future__ import annotations

import argparse
import json
import sys


def _parse_seeds(text: str) -> list[int]:
    parts = [p.strip() for p in text.split(",") if p.strip()]
    if not parts:
        raise argparse.ArgumentTypeError("need at least one seed")
    return [int(p) for p in parts]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Ensemble runs: seeds, velocity×radius grid, or OAT tornado.",
    )
    parser.add_argument(
        "--seeds",
        type=_parse_seeds,
        default=[0, 1, 2, 3, 4],
        help="comma-separated seeds per cell (default: 0,1,2,3,4)",
    )
    parser.add_argument(
        "--grid",
        action="store_true",
        help="2D grid over velocity and radius (default: seed-only ensemble)",
    )
    parser.add_argument("--asteroids", type=int, default=8)
    parser.add_argument("--years", type=float, default=1.0)
    parser.add_argument("--dt", type=float, default=0.05)
    parser.add_argument("--v-min", type=float, default=5.03)
    parser.add_argument("--v-max", type=float, default=20.0)
    parser.add_argument("--v-steps", type=int, default=3)
    parser.add_argument("--radius-min", type=float, default=0.01)
    parser.add_argument("--radius-max", type=float, default=1.0)
    parser.add_argument("--radius-steps", type=int, default=3)
    parser.add_argument(
        "--tornado",
        action="store_true",
        help="OAT ±10%% sensitivity (tornado ordering)",
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="with --tornado: only key knobs (faster demo)",
    )
    parser.add_argument(
        "--fraction",
        type=float,
        default=0.10,
        help="OAT perturbation fraction (default: 0.10)",
    )
    parser.add_argument("--out", type=str, default=None)
    args = parser.parse_args(argv)

    from .grid import linspace_values
    from .runner import (
        cheap_ensemble_run_config,
        run_parameter_grid,
        run_seed_ensemble,
        write_ensemble_json,
    )
    from .sensitivity import baseline_parameter_values, run_oat_sensitivity, select_knob_specs

    modes = int(args.grid) + int(args.tornado)
    if modes > 1:
        parser.error("use only one of --grid or --tornado")

    if args.dt <= 0 or args.years <= 0 or args.asteroids < 1:
        parser.error("invalid --dt, --years, or --asteroids")
    if args.grid and (args.v_steps < 1 or args.radius_steps < 1):
        parser.error("--v-steps and --radius-steps must be at least 1")
    if args.tornado and not (0.0 < args.fraction < 1.0):
        parser.error("--fraction must be between 0 and 1")
    if args.v_min >= args.v_max:
        parser.error("--v-min must be below --v-max")
    if args.radius_min >= args.radius_max:
        parser.error("--radius-min must be below --radius-max")

    n_steps = max(2, round(args.years / args.dt) + 1)
    run = cheap_ensemble_run_config(
        dt_yr=args.dt,
        n_steps=n_steps,
        n_asteroids=args.asteroids,
    )

    def _progress(done: int, total: int) -> None:
        print(f"ensemble progress: {done}/{total}", file=sys.stderr)

    if args.grid:
        velocities = linspace_values(args.v_min, args.v_max, args.v_steps)
        radii = linspace_values(args.radius_min, args.radius_max, args.radius_steps)
        result = run_parameter_grid(
            args.seeds,
            velocity_kms=velocities,
            radius_m=radii,
            run_config=run,
            progress=_progress,
        )
    elif args.tornado:
        base_values = baseline_parameter_values(
            years=args.years,
            dt=args.dt,
            asteroids=args.asteroids,
        )
        result = run_oat_sensitivity(
            args.seeds,
            fraction=args.fraction,
            base_values=base_values,
            knob_specs=select_knob_specs(None, quick=args.quick),
            progress=_progress,
        )
    else:
        result = run_seed_ensemble(args.seeds, run_config=run, progress=_progress)

    if args.out:
        write_ensemble_json(result, args.out)
        print(f"wrote {args.out}", file=sys.stderr)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
