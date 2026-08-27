/** Dual-range helpers. Positions are in [0, 1]. */

export const MIN_RANGE_RATIO = 1.01;

export function valueToPos(value, absMin, absMax) {
  const lo = Math.log10(absMin);
  const hi = Math.log10(absMax);
  if (hi === lo) return 0;
  return Math.min(1, Math.max(0, (Math.log10(value) - lo) / (hi - lo)));
}

export function posToValue(pos, absMin, absMax) {
  const lo = Math.log10(absMin);
  const hi = Math.log10(absMax);
  const t = Math.min(1, Math.max(0, pos));
  return 10 ** (lo + t * (hi - lo));
}

export function valueToPosLinear(value, absMin, absMax) {
  if (absMax === absMin) return 0;
  return Math.min(1, Math.max(0, (value - absMin) / (absMax - absMin)));
}

export function posToValueLinear(pos, absMin, absMax) {
  const t = Math.min(1, Math.max(0, pos));
  return absMin + t * (absMax - absMin);
}

export function clampMin(proposed, max, absMin, absMax) {
  return Math.min(Math.max(proposed, absMin), Math.min(max / MIN_RANGE_RATIO, absMax));
}

export function clampMax(proposed, min, absMin, absMax) {
  return Math.max(Math.min(proposed, absMax), Math.max(min * MIN_RANGE_RATIO, absMin));
}

export function formatRadius(v) {
  if (v < 0.01) return v.toExponential(0);
  if (v < 1) return v.toFixed(3);
  return v.toFixed(2);
}
