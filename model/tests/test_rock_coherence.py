"""
Every rock entry must describe a material that could exist.

Bulk density and porosity are not independent: together they imply a grain
density, and that number has to be one a real mineral assemblage has. Two
entries in this catalogue failed that check at different times - iron_nickel
carried an asteroid's bulk density beside solid metal's porosity, implying
4214 kg/m3, and CI chondrite carried a body's density beside the meteorite
class's porosity, implying 1831. Neither is any material.

The failure mode is quiet: nothing throws, the run completes, and the numbers
are wrong only in the places density and porosity are read separately.
"""

import unittest

from microbe_radiation_model.materials.rocks import rock_variants_from_sources as cat
from microbe_radiation_model.materials.rocks.types import Rock


def catalogue_rocks():
    return [v for v in vars(cat).values() if isinstance(v, Rock)]


class TestRockCoherence(unittest.TestCase):
    def test_the_catalogue_is_not_empty(self):
        self.assertGreater(len(catalogue_rocks()), 5)

    def test_grain_density_is_physically_possible(self):
        """
        Grain density = bulk / (1 - porosity). Solar System solids run from
        about 1500 kg/m3 for the most volatile-rich material to 8000 for
        iron-nickel metal; anything outside that is an entry describing two
        different objects at once.
        """
        for rock in catalogue_rocks():
            with self.subTest(rock=rock.name):
                self.assertGreaterEqual(rock.porosity, 0.0)
                self.assertLess(rock.porosity, 0.95)
                grain = rock.density_kg_m3 / (1.0 - rock.porosity)
                self.assertGreater(
                    grain, 1500.0,
                    f"{rock.name}: bulk {rock.density_kg_m3} at porosity "
                    f"{rock.porosity} implies grain density {grain:.0f}, "
                    "lighter than any Solar System solid",
                )
                self.assertLess(
                    grain, 8100.0,
                    f"{rock.name}: implies grain density {grain:.0f}, "
                    "denser than iron-nickel metal",
                )

    def test_the_metal_rich_entry_implies_metal(self):
        grain = cat.IRON_NICKEL.density_kg_m3 / (1.0 - cat.IRON_NICKEL.porosity)
        # Iron meteorites measure 7470-7960 kg/m3 (Consolmagno & Britt 2013).
        self.assertGreater(grain, 7000.0)
        self.assertLess(grain, 8100.0)

    def test_the_ci_entry_implies_ci_material(self):
        grain = cat.CI_CHONDRITE.density_kg_m3 / (1.0 - cat.CI_CHONDRITE.porosity)
        # Orgueil's measured grain density is 2420 kg/m3 (Macke et al. 2011).
        self.assertAlmostEqual(grain, 2420.0, delta=120.0)

    def test_notes_do_not_contradict_the_values_they_describe(self):
        """
        The notes string is exported into the result files as the citation for
        each property, so a stale note ships a claim the numbers disprove.
        """
        for rock in catalogue_rocks():
            with self.subTest(rock=rock.name):
                note = (rock.notes or "").lower()
                if "very low porosity" in note:
                    self.assertLess(
                        rock.porosity, 0.05,
                        f"{rock.name} notes claim very low porosity but carry "
                        f"{rock.porosity}",
                    )


if __name__ == "__main__":
    unittest.main()
