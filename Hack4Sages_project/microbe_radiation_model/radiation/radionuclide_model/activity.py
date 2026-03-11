from dataclasses import dataclass

from materials.rocks import Rock, get_rock_param

from .constants import (
    K40_BQ_PER_KG_PER_PERCENT_K,
    TH232_BQ_PER_KG_PER_PPM,
    U238_BQ_PER_KG_PER_PPM,
)


@dataclass(frozen=True)
class RadionuclideActivity:
    """
    Specific radionuclide activity of a rock material.

    All values are expressed in Bq/kg.
    """

    u238_bq_kg: float
    th232_bq_kg: float
    k40_bq_kg: float
    total_bq_kg: float


def activity_from_rock(
    rock: Rock,
    uranium238_ppm: float | None = None,
    thorium232_ppm: float | None = None,
    potassium_percent: float | None = None,
    uranium_hook=None,
    thorium_hook=None,
    potassium_hook=None,
) -> RadionuclideActivity:
    """
    Compute radionuclide activity from rock composition.

    Resolution priority for each parameter:
    explicit value > hook value > rock default value
    """

    u_ppm = get_rock_param(
        rock,
        "uranium238_ppm",
        value=uranium238_ppm,
        hook=uranium_hook,
        default=0.0,
    )

    th_ppm = get_rock_param(
        rock,
        "thorium232_ppm",
        value=thorium232_ppm,
        hook=thorium_hook,
        default=0.0,
    )

    k_percent = get_rock_param(
        rock,
        "potassium_percent",
        value=potassium_percent,
        hook=potassium_hook,
        default=0.0,
    )

    u_activity = u_ppm * U238_BQ_PER_KG_PER_PPM
    th_activity = th_ppm * TH232_BQ_PER_KG_PER_PPM
    k_activity = k_percent * K40_BQ_PER_KG_PER_PERCENT_K

    total_activity = u_activity + th_activity + k_activity

    return RadionuclideActivity(
        u238_bq_kg=u_activity,
        th232_bq_kg=th_activity,
        k40_bq_kg=k_activity,
        total_bq_kg=total_activity,
    )


def volumetric_activity_bq_m3(
    rock: Rock,
    total_bq_kg: float | None = None,
    density_kg_m3: float | None = None,
    density_hook=None,
) -> float:
    """
    Convert specific activity [Bq/kg] into volumetric activity [Bq/m^3].
    """

    density = get_rock_param(
        rock,
        "density_kg_m3",
        value=density_kg_m3,
        hook=density_hook,
        required=True,
    )

    if total_bq_kg is None:
        total_bq_kg = activity_from_rock(rock).total_bq_kg

    return total_bq_kg * density