export interface EpisodeMetrics {
  episode: number;
  steps: number;
  success: boolean;
  episodeReturn: number;
}

export function rollingSuccess(metrics: EpisodeMetrics[], windowSize: number): number {
  const slice = metrics.slice(Math.max(0, metrics.length - windowSize));
  if (slice.length === 0) {
    return 0;
  }
  const successCount = slice.reduce((sum, m) => sum + (m.success ? 1 : 0), 0);
  return (successCount / slice.length) * 100;
}

export function rollingAvgSteps(metrics: EpisodeMetrics[], windowSize: number): number {
  const slice = metrics.slice(Math.max(0, metrics.length - windowSize)).filter((m) => m.success);
  if (slice.length === 0) {
    return 0;
  }
  return slice.reduce((sum, m) => sum + m.steps, 0) / slice.length;
}

export function rollingAvgReturn(metrics: EpisodeMetrics[], windowSize: number): number {
  const slice = metrics.slice(Math.max(0, metrics.length - windowSize));
  if (slice.length === 0) {
    return 0;
  }
  return slice.reduce((sum, m) => sum + m.episodeReturn, 0) / slice.length;
}

export function avg(arr: number[]): number {
  if (arr.length === 0) {
    return 0;
  }
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

export function episodesToFirstSuccess(metrics: EpisodeMetrics[]): number {
  const idx = metrics.findIndex((m) => m.success);
  return idx >= 0 ? idx + 1 : metrics.length;
}
