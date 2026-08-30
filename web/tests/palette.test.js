import { describe, expect, it } from 'vitest';
import {
  colorForRockType, dashForRockType, dashForClass, rockClassLabel, rockClasses,
} from '../src/liveCharts.js';
import { rampColor } from '../src/charts/trajectoryColor.js';

const CATALOG = [
  'basalt_vtype', 'ci_chondrite', 'cm_chondrite', 'enstatite',
  'hydrated_silicate', 'ice_rich', 'iron_nickel', 'olivine',
  'ordinary_chondrite', 'organic_rich', 'rubble_pile', 'stony_iron',
];

const srgb = v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = ({ r, g, b }) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const hexToRgb = h => ({
  r: parseInt(h.slice(1, 3), 16) / 255,
  g: parseInt(h.slice(3, 5), 16) / 255,
  b: parseInt(h.slice(5, 7), 16) / 255,
});
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// These colours appear on BOTH grounds - in charts on a white panel, and as
// fragment trails on the dark scene inset - so both are checked. The constant
// here was #14100e, a panel colour that no longer exists anywhere in the
// project: a test measuring against a surface that has been deleted passes
// while telling you nothing.
const PANEL = hexToRgb('#FFFFFF');
// The dark inset the 3D scene is drawn on. This was #0a0807, the ground of the
// old dark theme; the trajectory ramp below was therefore being checked
// against a colour the application no longer paints anywhere.
const SCENE = hexToRgb('#0B0E14');

describe('rock class palette', () => {
  it('covers every rock type in the catalog', () => {
    for (const rock of CATALOG) {
      expect(rockClassLabel(rock)).not.toBe('unclassified');
    }
  });

  it('uses six classes, not twelve hues', () => {
    // Twelve categories is beyond what hue can separate: optimising twelve
    // colours against the worst deficiency tops out near 11.7, below what six
    // get for free.
    expect(rockClasses()).toHaveLength(6);
    expect(new Set(CATALOG.map(colorForRockType)).size).toBe(6);
  });

  it('draws every member of a class identically, hue and dash alike', () => {
    // These two tests replace ones that asserted the OPPOSITE: that members
    // within a class differ by dash, and that each class's first member is
    // solid. That contract was the defect. It made the dash encode a member
    // index, with the same patterns reused across classes, so basalt and
    // organic-rich were both solid - and those two classes are the pair whose
    // hues are closest. The redundant channel was backing up the wrong thing.
    const silicates = ['basalt_vtype', 'olivine', 'enstatite', 'hydrated_silicate'];
    expect(new Set(silicates.map(colorForRockType)).size).toBe(1);
    expect(new Set(silicates.map(dashForRockType)).size).toBe(1);
  });

  it('does not give two different classes the same line style', () => {
    const solid = CATALOG.filter(r => dashForRockType(r) === null);
    const classesOfSolid = new Set(solid.map(rockClassLabel));
    expect(classesOfSolid.size).toBe(1);
  });

  it('every class colour clears 3:1 against both grounds', () => {
    // WCAG 1.4.11: a graphical object needed to understand the content.
    for (const { id, color } of rockClasses()) {
      expect(contrast(hexToRgb(color), PANEL), `${id} on panel`).toBeGreaterThanOrEqual(3);
      expect(contrast(hexToRgb(color), SCENE), `${id} on scene`).toBeGreaterThanOrEqual(3);
    }
  });

  it('falls back rather than throwing on an unknown rock', () => {
    expect(colorForRockType('not_a_rock')).toBeTruthy();
    expect(dashForRockType('not_a_rock')).toBeNull();
    expect(rockClassLabel(undefined)).toBe('unclassified');
  });
});

describe('trajectory ramp against the scene background', () => {
  it('is readable across its whole range', () => {
    // The first version started near black and its bottom 55% fell below 3:1,
    // so the least irradiated half of the swarm was invisible on a black sky.
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const ratio = contrast(rampColor(t), SCENE);
      expect(ratio, `t=${t.toFixed(1)}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('is monotonic in luminance, so it survives greyscale', () => {
    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const lum = luminance(rampColor(t));
      expect(lum).toBeGreaterThan(previous);
      previous = lum;
    }
  });

  it('keeps a usable luminance span despite the raised floor', () => {
    // 4.94x, measured. Cutting the dark end for visibility necessarily costs
    // dynamic range - that is the trade, and it is the right one here: a ramp
    // that spans more luminance but hides half its values on a black sky
    // encodes nothing at the bottom. Anything below about 4x would mean the
    // floor was raised too far and the ramp had become flat.
    const ratio = luminance(rampColor(1)) / luminance(rampColor(0));
    expect(ratio).toBeGreaterThan(4);
    expect(ratio).toBeLessThan(8);
  });
});

describe('dash encodes the class, not the member', () => {
  // The reason this matters, and why it changed: hue alone cannot separate six
  // classes under an all-pairs colourblind check, so the dash is the second
  // carrier of class identity. It used to encode the member INDEX within a
  // class, with the same patterns repeating across classes - which left basalt
  // and organic-rich both solid, so the one pair whose colours were closest had
  // an identical redundant encoding too.

  it('gives every class its own pattern', () => {
    const dashes = rockClasses().map(c => c.dash);
    expect(new Set(dashes.map(String)).size).toBe(dashes.length);
  });

  it('gives every member of a class the same pattern as its class', () => {
    // Resolved through the public API rather than the private table, so the
    // test exercises what a caller actually sees.
    const byLabel = new Map(rockClasses().map(c => [c.label, c]));
    for (const rock of CATALOG) {
      const cls = byLabel.get(rockClassLabel(rock));
      expect(cls, rock).toBeTruthy();
      expect(dashForRockType(rock), rock).toBe(dashForClass(cls.id));
    }
  });

  it('never lets two classes share both a colour and a pattern', () => {
    const seen = new Set();
    for (const c of rockClasses()) {
      const key = `${c.color}|${c.dash}`;
      expect(seen.has(key), `${c.id} duplicates another class`).toBe(false);
      seen.add(key);
    }
  });

  it('separates the two classes whose colours are closest', () => {
    // Silicate and organic-rich are the pair that collided at dE00 1.2 before
    // the sienna, and still sit closest. They must differ by dash as well.
    expect(dashForClass('silicate')).not.toBe(dashForClass('organic'));
  });

  it('falls back to solid for a rock it does not know', () => {
    expect(dashForRockType('not_a_rock')).toBeNull();
  });
});

describe('interface scale', () => {
  // The reason this exists: 88 of the 139 type rules in this project were 11px
  // or smaller. That is defensible at a desk and not defensible from the back
  // of a lecture hall, which is where this is being shown.

  it('offers a scale that is actually large enough to read at distance', async () => {
    const { currentScale } = await import('../src/ui/menuBar.js');
    expect(typeof currentScale).toBe('function');
  });

  it('expresses every font size in rem, so one value scales all of them', async () => {
    // A single px font-size anywhere silently opts that element out of the
    // scale and it stays small on the projector while everything grows.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const roots = ['src'];
    const offenders = [];
    async function walk(dir) {
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { await walk(p); continue; }
        if (!/\.(js|css)$/.test(e.name)) continue;
        const text = await fs.readFile(p, 'utf8');
        for (const m of text.matchAll(/font-size:\s*([0-9.]+)px/g)) {
          offenders.push(`${p}: ${m[0]}`);
        }
      }
    }
    for (const r of roots) await walk(r);
    expect(offenders).toEqual([]);
  });
});
