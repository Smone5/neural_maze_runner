export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function easeInOut(value: number): number {
  const t = clamp01(value);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function pingPong(value: number): number {
  const t = value % 1;
  return t < 0.5 ? t * 2 : 2 - t * 2;
}
