import { describe, it, expect, beforeEach } from 'vitest';
import sim from '../public/data/cosmos_visualizer_simulation.json';
import {
  SUN_R,
  DEFAULT_RATIO_EXPONENT,
  getRatioExponent,
  setRatioExponent,
  displayHelioDistanceAU,
  displayHelioOffset,
  displayWorldPosition,
  sunRadiusAU,
  drawRadiusRelativeToSun,
  sunRadiusMetres,
  applyRatioExpFromSearch,
} from '../src/sceneScale.js';

describe('sceneScale distances', () => {
  beforeEach(() => setRatioExponent(DEFAULT_RATIO_EXPONENT));

  const sunRAU = sunRadiusAU(sim.objects);
  const frame = sim.frames[0];
  const sunPos = frame.positions.find(p => p.id === 'sun');
  const mercury = frame.positions.find(p => p.id === 'planet_mercury');
  const jupiter = frame.positions.find(p => p.id === 'planet_jupiter');

  it('maps heliocentric AU with the same cube-root exponent as sizes', () => {
    const exp = getRatioExponent();
    const dMer = Math.hypot(
      mercury.x - sunPos.x, mercury.y - sunPos.y, mercury.z - sunPos.z,
    );
    const dJup = Math.hypot(
      jupiter.x - sunPos.x, jupiter.y - sunPos.y, jupiter.z - sunPos.z,
    );
    const visMer = displayHelioDistanceAU(dMer, sunRAU);
    const visJup = displayHelioDistanceAU(dJup, sunRAU);
    expect(SUN_R / visMer).toBeCloseTo((sunRAU / dMer) ** exp, 6);
    expect(SUN_R / visJup).toBeCloseTo((sunRAU / dJup) ** exp, 6);
    expect(visJup / visMer).toBeCloseTo((dJup / dMer) ** exp, 6);
  });

  it('keeps direction while rescaling offset magnitude', () => {
    const off = {
      x: mercury.x - sunPos.x,
      y: mercury.y - sunPos.y,
      z: mercury.z - sunPos.z,
    };
    const vis = displayHelioOffset(off, sunRAU);
    const d = Math.hypot(off.x, off.y, off.z);
    const dv = Math.hypot(vis.x, vis.y, vis.z);
    expect(dv).toBeCloseTo(displayHelioDistanceAU(d, sunRAU), 9);
    expect(vis.x / off.x).toBeCloseTo(vis.y / off.y, 6);
    expect(vis.x / off.x).toBeCloseTo(vis.z / off.z, 6);
  });

  it('leaves the Sun on the linear drift scale only', () => {
    const linear = sim.meta.positionScale;
    const w = displayWorldPosition(sunPos, sunPos, sunRAU, linear, 1);
    expect(w.x).toBeCloseTo(sunPos.x * linear, 9);
    expect(w.y).toBeCloseTo(sunPos.y * linear, 9);
  });

  it('pulls Jupiter inward compared with the old linear map', () => {
    const dJup = Math.hypot(
      jupiter.x - sunPos.x, jupiter.y - sunPos.y, jupiter.z - sunPos.z,
    );
    const linear = dJup * sim.meta.positionScale;
    const compressed = displayHelioDistanceAU(dJup, sunRAU);
    expect(compressed).toBeLessThan(linear);
    expect(compressed).toBeGreaterThan(SUN_R * 3);
  });
});

describe('sceneScale sizes', () => {
  beforeEach(() => setRatioExponent(DEFAULT_RATIO_EXPONENT));

  it('matches the cube-root law relative to the Sun', () => {
    const exp = getRatioExponent();
    const sunR = sunRadiusMetres(sim.objects);
    const jupR = sim.objects.find(o => o.id === 'planet_jupiter').info.Radius.value;
    const merR = sim.objects.find(o => o.id === 'planet_mercury').info.Radius.value;
    const jup = drawRadiusRelativeToSun(jupR, sunR);
    const mer = drawRadiusRelativeToSun(merR, sunR);
    expect(jup / mer).toBeCloseTo((jupR / merR) ** exp, 6);
    expect(jup).toBeLessThan(SUN_R);
  });
});

describe('ratio exponent switching', () => {
  beforeEach(() => setRatioExponent(DEFAULT_RATIO_EXPONENT));

  it('reads ?root=N from the URL', () => {
    expect(applyRatioExpFromSearch(new URLSearchParams('root=4'))).toBeCloseTo(0.25, 9);
    expect(applyRatioExpFromSearch(new URLSearchParams('root=3'))).toBeCloseTo(1 / 3, 9);
  });

  it('reads ?ratioExp= directly', () => {
    expect(applyRatioExpFromSearch(new URLSearchParams('ratioExp=0.2'))).toBeCloseTo(0.2, 9);
  });
});
