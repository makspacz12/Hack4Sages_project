import { describe, expect, it } from 'vitest';
import {
  colorForRockType, dashForRockType, rockClassLabel, rockClasses,
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

const PANEL = hexToRgb('#14100e');
const SCENE = hexToRgb('#0a0807');

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

  it('separates members within a class by dash instead of hue', () => {
    const silicates = ['basalt_vtype', 'olivine', 'enstatite', 'hydrated_silicate'];
    const colors = new Set(silicates.map(colorForRockType));
    expect(colors.size).toBe(1);                     // one hue
    const dashes = new Set(silicates.map(dashForRockType));
    expect(dashes.size).toBe(silicates.length);      // four distinct styles
  });

  it('gives the first member of each class a solid line', () => {
    expect(dashForRockType('basalt_vtype')).toBeNull();
    expect(dashForRockType('ordinary_chondrite')).toBeNull();
    expect(dashForRockType('iron_nickel')).toBeNull();
  });

  it('every class colour clears 3:1 against the panel', () => {
    // WCAG 1.4.11: a graphical object needed to understand the content.
    for (const { id, color } of rockClasses()) {
      expect(contrast(hexToRgb(color), PANEL), id).toBeGreaterThanOrEqual(3);
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
