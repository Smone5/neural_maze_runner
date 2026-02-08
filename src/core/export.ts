import { EpisodeMetrics, avg, episodesToFirstSuccess, rollingAvgSteps, rollingSuccess } from "./metrics";

export interface RawRow {
  algorithm: string;
  maze_name: string;
  trial: number;
  seed: number;
  episode: number;
  steps: number;
  success: 0 | 1;
  episode_return: number;
}

export interface SummaryRow {
  algorithm: string;
  maze_name: string;
  trials: number;
  episodes: number;
  avg_success_last10: number;
  avg_steps_last10: number;
  avg_return_last10: number;
  avg_episodes_to_first_success: number;
}

export function toCsv<T extends object>(headers: string[], rows: T[]): string {
  const escaped = (value: string | number): string => {
    const text = String(value);
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.split("\"").join("\"\"")}"`;
    }
    return text;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    const item = row as Record<string, string | number | undefined>;
    lines.push(headers.map((header) => escaped(item[header] ?? "")).join(","));
  }
  return lines.join("\n");
}

function clickDownloadLink(filename: string, href: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  (document.body ?? document.documentElement).appendChild(a);
  a.click();
  a.remove();
}

export function triggerDownload(filename: string, text: string, mime = "text/plain"): boolean {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    clickDownloadLink(filename, url);
    return true;
  } catch (error) {
    console.error("Download failed:", error);
    return false;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }
}

export function canvasToOpaquePngDataUrl(canvas: HTMLCanvasElement): string {
  const flattened = document.createElement("canvas");
  flattened.width = canvas.width;
  flattened.height = canvas.height;

  const ctx = flattened.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available for PNG export.");
  }

  // Flatten transparency so charts remain readable in PDF print pipelines.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, flattened.width, flattened.height);
  ctx.drawImage(canvas, 0, 0);
  return flattened.toDataURL("image/png");
}

export function triggerPngDownload(filename: string, canvas: HTMLCanvasElement): boolean {
  if (canvas.width === 0 || canvas.height === 0) {
    console.warn(`PNG export skipped for ${filename}: canvas has no size.`);
    return false;
  }
  try {
    const url = canvasToOpaquePngDataUrl(canvas);
    clickDownloadLink(filename, url);
    return true;
  } catch (error) {
    console.error("PNG export failed:", error);
    return false;
  }
}

export function summarizeExperiment(
  mazeName: string,
  episodes: number,
  trials: number,
  metricsByAlgorithm: Map<string, EpisodeMetrics[][]>
): SummaryRow[] {
  const rows: SummaryRow[] = [];

  for (const [algorithm, trialsData] of metricsByAlgorithm) {
    const successLast10 = trialsData.map((trialMetrics) => rollingSuccess(trialMetrics, 10));
    const stepsLast10 = trialsData.map((trialMetrics) => rollingAvgSteps(trialMetrics, 10));
    const returnLast10 = trialsData.map((trialMetrics) => avg(trialMetrics.slice(-10).map((m) => m.episodeReturn)));
    const firstSuccess = trialsData.map((trialMetrics) => episodesToFirstSuccess(trialMetrics));

    rows.push({
      algorithm,
      maze_name: mazeName,
      trials,
      episodes,
      avg_success_last10: Number(avg(successLast10).toFixed(3)),
      avg_steps_last10: Number(avg(stepsLast10).toFixed(3)),
      avg_return_last10: Number(avg(returnLast10).toFixed(3)),
      avg_episodes_to_first_success: Number(avg(firstSuccess).toFixed(3)),
    });
  }

  return rows;
}
