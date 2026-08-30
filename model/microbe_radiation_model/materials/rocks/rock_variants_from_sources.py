"""
Automatycznie wygenerowane obiekty Rock.
Source priority: NASA/JPL SBDB -> fallback to the scientific literature.
Note: radius_m is the radius of the reference asteroid, not a material constant.
"""

from .types import Rock


BASALT_VTYPE = Rock(
    name="basalt_vtype",
    radius_m=261385.0,
    density_kg_m3=3460.0,
    albedo=0.4228,
    water_mass_fraction=0.0002,
    porosity=0.03,
    thermal_conductivity_w_mk=2.0,
    probability=0.07,
    uranium238_ppm=0.15,
    thorium232_ppm=0.6,
    potassium_percent=0.05,
    notes="Material=basalt_vtype. Reference asteroid=4 Vesta (V-type). radius_m from JPL diameter; note: this is the radius of the reference body, not an intrinsic material constant. density source: NASA/JPL SBDB: Park, R.S. et al. 2025, Nat Astron, DOI: 10.1038/s41550-025-02533-7 albedo source: NASA/JPL SBDB: IRAS-A-FPA-3-RDR-IMPS-V6.0 rotation period source: NASA/JPL SBDB: Park, R.S. et al. 2025, Nat Astron, DOI: 10.1038/s41550-025-02533-7 porosity source: Macke et al. 2011, MAPS 46(3):311-326. thermal conductivity source: Model assumption (basaltic/achondrite scale). water fraction source: Dry basaltic achondrite assumption. U-238 source: Schmitt et al. 1963, GCA 27:577-622. Th-232 source: Schmitt et al. 1963, GCA 27:577-622. K source: Representative eucritic scale (literature).",
)


CI_CHONDRITE = Rock(
    name="ci_chondrite",
    radius_m=448.0,
    density_kg_m3=1190.0,
    albedo=0.045,
    water_mass_fraction=0.18,
    # Was 0.11. Macke, Consolmagno & Britt (2011), MAPS 46(12):1842-1862,
    # measure CI (type 1) carbonaceous chondrite porosity near 35%, and the
    # reference body Ryugu is above 50% (Watanabe et al. 2019: bulk density
    # 1.19 g/cm3 against an Orgueil grain density of 2.42 gives 51%). 0.11
    # matched neither the meteorite class nor the body it names.
    porosity=0.35,
    thermal_conductivity_w_mk=0.5,
    probability=0.15,
    uranium238_ppm=0.012,
    thorium232_ppm=0.045,
    potassium_percent=0.055,
    notes="Material=ci_chondrite. Reference asteroid=162173 Ryugu (C-type / CI-like analog). radius_m from JPL diameter; note: this is the radius of the reference body, not an intrinsic material constant. density source: NASA/JPL SBDB: Watanabe, S.; Hirabayashi, M.; Hirata, N.; Hirata, Na.; et al. (2019) Science 364, 267-272. albedo source: NASA/JPL SBDB: Sugita, S.; Honda, R.; Morota, T.; et al. (2019) Science 364, 6437. rotation period source: NASA/JPL SBDB: Watanabe, S.; Hirabayashi, M.; Hirata, N.; Hirata, Na; et al. (2019) Science 364, 267-272. porosity source: Macke et al. 2011b, MAPS MAPS 46(12):1842-1862. thermal conductivity source: Low-conductivity primitive estimate. water fraction source: CI ~18 wt% H2O eq. (Zolensky et al. 1993). U-238 source: Chondritic U scale (Lovering 1964). Th-232 source: Chondritic Th scale (Lovering 1964). K source: Representative CI K abundance (literature).",
)


CM_CHONDRITE = Rock(
    name="cm_chondrite",
    radius_m=242.22,
    density_kg_m3=1194.0,
    albedo=0.044,
    water_mass_fraction=0.1,
    porosity=0.22,
    thermal_conductivity_w_mk=0.7,
    probability=0.15,
    uranium238_ppm=0.01,
    thorium232_ppm=0.038,
    potassium_percent=0.04,
    notes="Material=cm_chondrite. Reference asteroid=101955 Bennu (B/C-type / CM-like analog). radius_m from JPL diameter; note: this is the radius of the reference body, not an intrinsic material constant. density source: NASA/JPL SBDB: Daly, M.G., et al., Sci. Adv. 6, eabd3649 (2020) albedo source: NASA/JPL SBDB: Hergenrother, M.C., et al., Nat. Commun. 10, 1291 (2019) rotation period source: NASA/JPL SBDB: Hergenrother, M.C., et al., Nat. Commun. 10, 1291 (2019) porosity source: Macke et al. 2011b, MAPS MAPS 46(12):1842-1862. thermal conductivity source: Low-conductivity primitive estimate. water fraction source: CM ~10 wt% H2O eq. (Zolensky et al. 1993). U-238 source: Chondritic U abundance (Lovering 1964). Th-232 source: Chondritic Th abundance (Lovering 1964). K source: Representative CM K abundance (literature).",
)


ORDINARY_CHONDRITE = Rock(
    name="ordinary_chondrite",
    radius_m=8420.0,
    density_kg_m3=2670.0,
    albedo=0.25,
    water_mass_fraction=0.002,
    porosity=0.08,
    thermal_conductivity_w_mk=3.0,
    probability=0.18,
    uranium238_ppm=0.0083,
    thorium232_ppm=0.028,
    potassium_percent=0.081,
    notes="Material=ordinary_chondrite. Reference asteroid=433 Eros (S-type). radius_m from JPL diameter; note: this is the radius of the reference body, not an intrinsic material constant. density source: NASA/JPL SBDB: Yeomans et al. (2000) Science v.289,pp.2085-2088 albedo source: NASA/JPL SBDB: Veverka et al. (2000) Science v.289,pp.2088-2097 rotation period source: NASA/JPL SBDB: LCDB (Rev. 2023-October); Warner et al., 2009 porosity source: Britt & Consolmagno 2003, MAPS 38(8):1161-1180. thermal conductivity source: Representative compact silicate conductivity. water fraction source: Dry ordinary chondrite assumption. U-238 source: Ordinary chondrite U scale (Lovering 1964). Th-232 source: Ordinary chondrite Th scale (Lovering 1964). K source: Representative OC K abundance (literature).",
)


OLIVINE_DOMINATED = Rock(
    name="olivine",
    radius_m=25445.5,
    density_kg_m3=3440.4,
    albedo=0.193,
    water_mass_fraction=0.0005,
    porosity=0.05,
    thermal_conductivity_w_mk=3.2,
    probability=0.06,
    uranium238_ppm=0.004,
    thorium232_ppm=0.015,
    potassium_percent=0.01,
    notes="Material=olivine. Reference asteroid=246 Asporina (A-type). radius_m from JPL diameter; note: this is the radius of the reference body, not an intrinsic material constant. albedo source: NASA/JPL SBDB: urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M) rotation period source: NASA/JPL SBDB: LCDB (Rev. 2023-October); Warner et al., 2009 porosity source: Low-porosity olivine-rich assumption. thermal conductivity source: Representative olivine-rich conductivity. water fraction source: Very dry olivine-rich assumption. U-238 source: Low incompatible-element abundance assumption. Th-232 source: Low incompatible-element abundance assumption. K source: Low-K olivine-rich assumption.",
)


ENSTATITE_CHONDRITE = Rock(
    name="enstatite",
    radius_m=35320.0,
    density_kg_m3=3555.0,
    albedo=0.482,
    water_mass_fraction=0.0005,
    porosity=0.05,
    thermal_conductivity_w_mk=3.8,
    probability=0.06,
    uranium238_ppm=0.006,
    thorium232_ppm=0.022,
    potassium_percent=0.07,
    notes="Material=enstatite. Reference asteroid=44 Nysa (E-type). radius_m from JPL diameter; note: this is the radius of the reference body, not an intrinsic material constant. albedo source: NASA/JPL SBDB: urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M) rotation period source: NASA/JPL SBDB: LCDB (Rev. 2023-October); Warner et al., 2009 porosity source: Britt & Consolmagno 2003 (EH/EL porosity scale). thermal conductivity source: Dense enstatite-rich conductivity (assumed). water fraction source: Very dry enstatite chondrite assumption. U-238 source: E-group U abundance scale (Lovering 1964). Th-232 source: E-group Th abundance scale (Lovering 1964). K source: Representative enstatite K abundance (literature).",
)


IRON_NICKEL = Rock(
    name="iron_nickel",
    radius_m=111000.0,
    density_kg_m3=4172.0,
    albedo=0.1203,
    water_mass_fraction=0.0001,
    # Was 0.01, which contradicted the density beside it. 4172 kg/m3 is 16
    # Psyche's BULK density (Farnocchia et al. 2024), and Psyche is not solid
    # metal: Elkins-Tanton et al. (2020), JGR Planets, put it at 30-60 vol%
    # metal, so its low bulk density implies large macroporosity. An iron
    # meteorite is ~7800 kg/m3 at ~1% porosity (Consolmagno & Britt 2013,
    # measured 7.47-7.96 g/cm3). Carrying a rubbly body's density with solid
    # metal's porosity implied a grain density of 4214 kg/m3, which is no
    # material at all.
    #
    # The entry is kept as PSYCHE - a real, measured, metal-rich body - rather
    # than switched to an iron meteorite, because the density is the quantity
    # that drives shielding depth and beta, and 4172 is the one that is
    # actually cited. The porosity now agrees with it.
    porosity=0.45,
    # Was 50, roughly wrought iron. Opeil, Consolmagno & Britt (2010), Icarus
    # 208:449, measured Campo del Cielo directly: 15 W/(m K) at 100 K rising
    # to 27 at 300 K. 27 is the value at the warm end of what this model sees.
    thermal_conductivity_w_mk=27.0,
    probability=0.05,
    uranium238_ppm=0.001,
    thorium232_ppm=0.003,
    potassium_percent=0.001,
    notes="Material=iron_nickel. Reference asteroid=16 Psyche (M-type). radius_m from JPL diameter; note: this is the radius of the reference body, not an intrinsic material constant. density source: NASA/JPL SBDB: Farnocchia et al. (2024), AJ 168, 21 albedo source: NASA/JPL SBDB: IRAS-A-FPA-3-RDR-IMPS-V6.0 rotation period source: NASA/JPL SBDB: LCDB (Rev. 2023-October); Warner et al., 2009 porosity source: Very low porosity for metal-rich material (assumed). thermal conductivity source: High conductivity for Fe-Ni metal (assumed). water fraction source: Essentially dry metallic material. U-238 source: Trace U in metal-rich material (assumed). Th-232 source: Trace Th in metal-rich material (assumed). K source: Very low K in metallic material.",
)


HYDRATED_SILICATE = Rock(
    name="hydrated_silicate",
    radius_m=256500.0,
    density_kg_m3=2890.0,
    albedo=0.155,
    water_mass_fraction=0.12,
    porosity=0.22,
    thermal_conductivity_w_mk=0.8,
    probability=0.10,
    uranium238_ppm=0.01,
    thorium232_ppm=0.038,
    potassium_percent=0.045,
    notes="Material=hydrated_silicate. Reference asteroid=2 Pallas (B-type). radius_m from JPL diameter; note: this is the radius of the reference body, not an intrinsic material constant. density source: NASA/JPL SBDB: Marsset et al., Nature Astronomy 4, 569-576 (2020) albedo source: NASA/JPL SBDB: Vernazza et al., A&A 654, A56 (2021) rotation period source: NASA/JPL SBDB: Carry et al., Icarus 205, 460-472 (2010) porosity source: Primitive hydrated silicate porosity estimate. thermal conductivity source: Low-conductivity hydrated estimate. water fraction source: Hydrated phyllosilicate-rich estimate. U-238 source: Primitive U scale (assumed carbonaceous-like). Th-232 source: Primitive Th scale (assumed carbonaceous-like). K source: Representative primitive K abundance estimate.",
)


ORGANIC_RICH = Rock(
    name="organic_rich",
    radius_m=118630.0,
    density_kg_m3=2386.0,
    albedo=0.0706,
    water_mass_fraction=0.08,
    porosity=0.55,
    thermal_conductivity_w_mk=0.3,
    probability=0.10,
    uranium238_ppm=0.005,
    thorium232_ppm=0.018,
    potassium_percent=0.025,
    notes="Material=organic_rich. Reference asteroid=65 Cybele (P-type). radius_m from JPL diameter; note: this is the radius of the reference body, not an intrinsic material constant. albedo source: NASA/JPL SBDB: IRAS-A-FPA-3-RDR-IMPS-V6.0 rotation period source: NASA/JPL SBDB: LCDB (Rev. 2023-October); Warner et al., 2009 porosity source: High-porosity outer-belt primitive estimate. thermal conductivity source: Low-conductivity porous primitive estimate. water fraction source: Primitive volatile-rich estimate. U-238 source: Low radiogenic trace abundance estimate. Th-232 source: Low radiogenic trace abundance estimate. K source: Primitive K abundance estimate.",
)


ICE_RICH = Rock(
    name="ice_rich",
    radius_m=469700.0,
    density_kg_m3=2162.0,
    albedo=0.09,
    water_mass_fraction=0.35,
    porosity=0.1,
    thermal_conductivity_w_mk=1.0,
    probability=0.03,
    uranium238_ppm=0.001,
    thorium232_ppm=0.002,
    potassium_percent=0.01,
    notes="Material=ice_rich. Reference asteroid=1 Ceres (C/G-type). radius_m from JPL diameter; note: this is the radius of the reference body, not an intrinsic material constant. density source: NASA/JPL SBDB: Nature vol. 537, pp515-517 (22 September 2016) albedo source: NASA/JPL SBDB: Li et al. (2006) Icarus v182:pp143-160 rotation period source: NASA/JPL SBDB: Nature vol. 537, pp515-517 (22 September 2016) porosity source: Moderate porosity for ice-rich material (assumed). thermal conductivity source: Mixed ice-rock conductivity estimate. water fraction source: Ice-rich hydrated body assumption. U-238 source: Low radiogenic abundance in volatile-rich bulk. Th-232 source: Low radiogenic abundance in volatile-rich bulk. K source: Low K in volatile-rich ice-rock mixture.",
)


RUBBLE_PILE = Rock(
    name="rubble_pile",
    radius_m=165.0,
    density_kg_m3=1900.0,
    albedo=0.283,
    water_mass_fraction=0.02,
    porosity=0.41,
    thermal_conductivity_w_mk=0.1,
    probability=0.02,
    uranium238_ppm=0.0083,
    thorium232_ppm=0.028,
    potassium_percent=0.06,
    notes="Material=rubble_pile. Reference asteroid=25143 Itokawa (rubble pile). radius_m from JPL diameter; note: this is the radius of the reference body, not an intrinsic material constant. density source: NASA/JPL SBDB: Science 312:1330-1334 rotation period source: NASA/JPL SBDB: LCDB (Rev. 2023-October); Warner et al., 2009 porosity source: Itokawa bulk porosity ~41% (Science 312:1330-1334). thermal conductivity source: Very low conductivity for macro-porous regolith. water fraction source: Dry S-type rubble-pile assumption. U-238 source: OC-like U fallback for S-type aggregate. Th-232 source: OC-like Th fallback for S-type aggregate. K source: OC-like K fallback for S-type aggregate.",
)


STONY_IRON = Rock(
    name="stony_iron",
    radius_m=69885.0,
    density_kg_m3=4760.0,
    albedo=0.384,
    water_mass_fraction=0.005,
    porosity=0.03,
    thermal_conductivity_w_mk=12.0,
    probability=0.03,
    uranium238_ppm=0.008,
    thorium232_ppm=0.025,
    potassium_percent=0.015,
    notes="Material=stony_iron. Reference asteroid=349 Dembowska (R-type / stony-iron analog). radius_m from JPL diameter; note: this is the radius of the reference body, not an intrinsic material constant. albedo source: NASA/JPL SBDB: IRAS-A-FPA-3-RDR-IMPS-V6.0 rotation period source: NASA/JPL SBDB: LCDB (Rev. 2023-October); Warner et al., 2009 porosity source: Low porosity mixed silicate-metal assumption. thermal conductivity source: Intermediate conductivity for stony-iron mixture. water fraction source: Very dry mixed silicate-metal assumption. U-238 source: Mixed silicate-metal trace U estimate. Th-232 source: Mixed silicate-metal trace Th estimate. K source: Mixed silicate-metal K estimate.",
)


DEFAULT_ROCK_VARIANTS = [
    BASALT_VTYPE,
    CI_CHONDRITE,
    CM_CHONDRITE,
    ORDINARY_CHONDRITE,
    OLIVINE_DOMINATED,
    ENSTATITE_CHONDRITE,
    IRON_NICKEL,
    HYDRATED_SILICATE,
    ORGANIC_RICH,
    ICE_RICH,
    RUBBLE_PILE,
    STONY_IRON,
]

