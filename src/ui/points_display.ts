const DISPLAY_POINT_SCALE = 100;

export function toDisplayPoints(rewardValue: number): number {
  return Math.round(rewardValue * DISPLAY_POINT_SCALE);
}

export function formatDisplayPoints(rewardValue: number): string {
  const points = toDisplayPoints(rewardValue);
  if (points > 0) {
    return `+${points}`;
  }
  return String(points);
}
