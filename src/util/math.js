export function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
