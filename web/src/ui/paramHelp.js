/**
 * What each parameter actually is, in words a reader can use.
 *
 * The solver's schema carries a one-line `help` string, written for someone who
 * already knows the model. These are written for someone who does not: what the
 * quantity is, what happens if you move it, and - where the number is not
 * settled - the published range and where it comes from.
 *
 * A parameter with no `band` is one nobody is arguing about. That absence is
 * information, so it is left absent rather than padded out.
 */

export const PARAM_HELP = {
  q_size: {
    what: 'How steeply small fragments outnumber large ones.',
    effect:
      'Impact ejecta follow a power law. At 2 there are about a hundred times '
      + 'more 1 mm stones than 10 cm ones, so the median fragment is 2 mm and '
      + 'you expect 0.14 fragments above 10 cm in a swarm of fourteen. Raise it '
      + 'and the swarm becomes dust; lower it and large, well-shielded boulders '
      + 'start to appear.',
    def: '2.0',
    warn:
      'This is the parameter that decides whether anything in the swarm is big '
      + 'enough for rock to shield it at all.',
  },

  radius_min: {
    what: 'The smallest and largest stones the impact throws off.',
    effect:
      'Size matters because rock stops cosmic rays, and the attenuation length '
      + 'is about 0.46 m. A fragment has to be roughly that big before shielding '
      + 'does anything, so a swarm capped below about 20 cm shows essentially no '
      + 'protection - which is what the bundled run does.',
    unit: 'm',
    def: '0.001 to 5.0',
  },

  bio_fraction: {
    what: "What share of the fragment's mass is the living cargo, not rock.",
    effect:
      'It sets how deep inside the stone the microbes sit, and therefore how '
      + 'much rock shields them. At 1% the core is a small ball in the middle; '
      + 'at 50% the biology is most of the fragment and barely shielded at all.',
    def: '0.01',
  },

  asteroids: {
    what: 'How many stones to launch and track.',
    effect:
      'More fragments sample the spread of outcomes better and cost '
      + 'proportionally more compute. Below about twenty, the tails of the '
      + 'distribution are not sampled at all.',
    def: '25',
  },

  v_min: {
    what: 'The slowest stone that still leaves Mars.',
    effect:
      "The default is Mars's escape velocity: anything slower falls back and "
      + 'never becomes a candidate for transfer.',
    unit: 'km/s',
    def: '5.03',
  },

  v_max: {
    what: 'The fastest stone in the swarm.',
    effect:
      'Speeds this high come from the tip of the impact spall zone, where the '
      + 'shock has not yet crushed the rock. Raising it puts more fragments onto '
      + 'orbits that leave the inner Solar System.',
    unit: 'km/s',
    def: '20.0',
  },

  cone_angle: {
    what: 'How wide a fan the fragments are thrown into.',
    effect:
      'Measured from the impact normal. A narrow cone launches everything in '
      + 'nearly the same direction; a wide one spreads the swarm across many '
      + 'different orbits from the start.',
    unit: 'deg',
    def: '60',
  },

  seed: {
    what: 'The number that fixes the random draw.',
    effect:
      'The same seed always produces the same swarm - the same sizes, speeds '
      + 'and directions. Change it to draw a fresh sample from the same '
      + 'distributions. Type an exact number to reproduce a published run; every '
      + 'replay this project writes records the seed it used.',
    def: '42',
  },

  dust_flux: {
    what: 'How much interplanetary dust the fragment sweeps up.',
    effect:
      'Dust slowly grinds the stone away, which thins the shielding over the '
      + 'transfer. Over 3000 years this removes only parts per million of the '
      + 'radius, so it matters at megayear timescales, not here.',
    unit: 'kg/m²/s',
    def: '1e-12',
  },

  radiation_pressure: {
    what: 'The push sunlight exerts on each fragment.',
    effect:
      'Negligible for a boulder and significant for a millimetre grain, so '
      + 'switching it off mostly changes the fate of the smallest stones.',
    def: 'on',
  },

  erosion: {
    what: 'Whether fragments shrink as they sweep up dust.',
    effect:
      'Over this run it removes 0.058% of the swarm mass, so it changes nothing '
      + 'here. It is the millimetre fragments, over megayears, that it decides.',
    def: 'on',
  },

  planets: {
    what: 'Whether the eight planets gravitate.',
    effect:
      'Without them the fragments follow clean Keplerian orbits around the Sun. '
      + 'With them, close passes reshape the orbits over centuries - this is what '
      + 'drives the eccentricity pumping that spreads the perihelia from a tight '
      + 'cluster to a wide band.',
    def: 'on',
  },

  years: {
    what: 'How long to propagate the swarm.',
    effect:
      'This run covers 3000 years, which is between 0.03% and 0.3% of the time '
      + 'an interstellar transfer is thought to take. The survival numbers are '
      + 'extrapolated from it, not measured over it.',
    unit: 'yr',
    def: '2.5',
  },

  dt: {
    what: 'How often a frame is written to the replay.',
    effect:
      'This sets file size and how smooth the animation looks. It does NOT set '
      + 'accuracy - that is the substeps below.',
    unit: 'yr',
    def: '0.025',
    warn:
      'At a coarse output step a fragment can complete several orbits between '
      + 'frames. The scene draws the orbit each fragment is on rather than '
      + 'joining sampled points, so this stays honest, but a per-frame readout '
      + 'will still skip past events.',
  },

  substeps: {
    what: 'How many integration steps the solver takes inside each frame.',
    effect:
      'This is what sets accuracy. If you raise the output step, raise this too, '
      + 'or the orbits will drift.',
    def: '10',
  },
};

/**
 * The inactivation coefficient, which is not in the solver schema.
 *
 * It lives in the analysis dock because survival factorises exactly and the
 * browser can rescale it without a new run. It gets the fullest explanation in
 * the project, because it is the number the whole result rests on.
 */
export const C_RAD_HELP = {
  what: 'How fast radiation kills the microbes.',
  effect:
    'The fraction that dies per gray of absorbed dose. This is the least '
    + 'certain number in the model: published values for spores span a factor of '
    + 'seventeen, and this one coefficient accounts for 94% of the spread in the '
    + 'final answer. Moving it recomputes the survival curve exactly, in the '
    + 'browser, with no new simulation.',
  unit: '1/Gy',
  def: '2.5e-4',
  band: '2.5e-5 to 4.3e-4 (chronic)',
  source: 'Mileikowsky et al. (2000), Icarus 145(2):391-427',
  warn:
    'An acute laboratory band of 6.1e-4 to 1.5e-3 also exists and does NOT '
    + 'apply to cosmic rays: for heavy ions the action cross-section saturates, '
    + 'so per unit mean dose high-LET radiation is less efficient, not more.',
};

/**
 * Named organisms that write a value into the field.
 *
 * A coefficient is abstract; an organism is not. Selecting one types its number
 * into the box rather than switching to some other mode, so the field stays the
 * single place the value lives.
 */
export const C_RAD_PRESETS = [
  {
    label: 'D. radiodurans R1',
    value: 2.5e-5,
    note: 'the most radiation-resistant organism in the published table',
  },
  {
    label: 'B. subtilis spores, wild type',
    value: 2.5e-4,
    note: 'the cleanest single value in the source; the model default',
  },
  {
    label: 'B. subtilis at 600 g/cm²',
    value: 4.3e-4,
    note: 'deeply shielded, where the surviving spectrum is harder',
  },
  {
    label: 'acute low-LET D10',
    value: 6.1e-4,
    note: 'laboratory irradiation — does not transfer to cosmic rays',
  },
];
