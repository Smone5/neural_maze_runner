import { Chart, registerables } from "chart.js";
import { EpisodeMetrics } from "../core/metrics";
import { SummaryRow, triggerDownload, triggerPngDownload } from "../core/export";

Chart.register(...registerables);

const ALGORITHM_COLORS = ["#8b8b8b", "#ff5a36", "#3f8cff", "#2bb673", "#9f7aea", "#f6ad55", "#00a3a3"];

export interface ExperimentChartsData {
  successByEpisode: Map<string, number[]>;
  stepsByEpisode: Map<string, number[]>;
  summaryRows: SummaryRow[];
}

export class ExperimentPanel {
  readonly runnerRoot: HTMLElement;
  readonly chartsRoot: HTMLElement;
  private status: HTMLParagraphElement;
  private progressLabel: HTMLParagraphElement;
  private progressBar: HTMLProgressElement;
  private c1: HTMLCanvasElement;
  private c2: HTMLCanvasElement;
  private c3: HTMLCanvasElement;
  private chart1: Chart | null = null;
  private chart2: Chart | null = null;
  private chart3: Chart | null = null;
  private rawCsv: string | null = null;
  private summaryCsv: string | null = null;
  private downloadChartsBtn: HTMLButtonElement;
  private downloadRawBtn: HTMLButtonElement;
  private downloadSummaryBtn: HTMLButtonElement;
  private downloadAllBtn: HTMLButtonElement;

  constructor() {
    // --- STEP 4: RUNNER ---
    this.runnerRoot = document.createElement("section");
    this.runnerRoot.className = "panel experiment-panel runner-view";

    const runnerHeader = document.createElement("header");
    runnerHeader.className = "science-header";
    const runnerTitle = document.createElement("h2");
    runnerTitle.textContent = "Step 4: Test & Observe";
    const runnerSubtitle = document.createElement("p");
    runnerSubtitle.textContent = "Press start to run all AI brain types through fair trials.";
    runnerHeader.append(runnerTitle, runnerSubtitle);

    this.status = document.createElement("p");
    this.status.className = "experiment-status";
    this.status.textContent = "Ready to start.";

    this.progressLabel = document.createElement("p");
    this.progressLabel.className = "experiment-progress-label";
    this.progressLabel.textContent = "Progress: 0%";

    this.progressBar = document.createElement("progress");
    this.progressBar.className = "experiment-progress";
    this.progressBar.max = 100;
    this.progressBar.value = 0;

    this.runnerRoot.append(runnerHeader, this.status, this.progressLabel, this.progressBar);

    // --- STEP 5: RESULTS ---
    this.chartsRoot = document.createElement("section");
    this.chartsRoot.className = "panel experiment-charts";

    const chartsHeader = document.createElement("header");
    chartsHeader.className = "science-header";
    const chartsTitle = document.createElement("h2");
    chartsTitle.textContent = "Step 5: Analyze Results";
    const chartsSubtitle = document.createElement("p");
    chartsSubtitle.textContent = "Compare how the different AIs performed.";
    chartsHeader.append(chartsTitle, chartsSubtitle);

    this.c1 = document.createElement("canvas");
    this.c2 = document.createElement("canvas");
    this.c3 = document.createElement("canvas");

    const downloads = document.createElement("div");
    downloads.className = "button-row center";

    this.downloadChartsBtn = document.createElement("button");
    this.downloadChartsBtn.textContent = "💾 Save All Charts (.png)";
    this.downloadChartsBtn.disabled = true;
    this.downloadChartsBtn.onclick = () => this.downloadAllPngs();

    this.downloadRawBtn = document.createElement("button");
    this.downloadRawBtn.textContent = "📄 Save Raw CSV";
    this.downloadRawBtn.disabled = true;
    this.downloadRawBtn.onclick = () => this.downloadRawCsv();

    this.downloadSummaryBtn = document.createElement("button");
    this.downloadSummaryBtn.textContent = "📊 Save Summary CSV";
    this.downloadSummaryBtn.disabled = true;
    this.downloadSummaryBtn.onclick = () => this.downloadSummaryCsv();

    this.downloadAllBtn = document.createElement("button");
    this.downloadAllBtn.textContent = "📦 Save All Results";
    this.downloadAllBtn.disabled = true;
    this.downloadAllBtn.onclick = () => this.downloadAllExports();

    downloads.append(this.downloadChartsBtn, this.downloadRawBtn, this.downloadSummaryBtn, this.downloadAllBtn);

    this.chartsRoot.append(chartsHeader, this.c1, this.c2, this.c3, downloads);
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  setProgress(current: number, total: number, detail?: string): void {
    const safeTotal = Math.max(1, total);
    const clamped = Math.max(0, Math.min(current, safeTotal));
    const percent = Math.round((clamped / safeTotal) * 100);
    this.progressBar.max = safeTotal;
    this.progressBar.value = clamped;
    this.progressLabel.textContent = detail ? `Progress: ${percent}% | ${detail}` : `Progress: ${percent}%`;
  }

  render(data: ExperimentChartsData): void {
    this.chart1?.destroy();
    this.chart2?.destroy();
    this.chart3?.destroy();

    const labels = new Set<string>();
    for (const arr of data.successByEpisode.values()) {
      for (let i = 0; i < arr.length; i += 1) {
        labels.add(String(i + 1));
      }
    }

    const orderedAlgorithms = [...data.successByEpisode.keys()];
    const colorByAlgorithm = new Map(
      orderedAlgorithms.map((algorithm, idx) => [algorithm, ALGORITHM_COLORS[idx % ALGORITHM_COLORS.length]])
    );

    this.chart1 = new Chart(this.c1, {
      type: "line",
      data: {
        labels: [...labels],
        datasets: [...data.successByEpisode.entries()].map(([algorithm, values], idx) => ({
          label: `${algorithm} success %`,
          data: values,
          borderColor: colorByAlgorithm.get(algorithm) ?? ALGORITHM_COLORS[idx % ALGORITHM_COLORS.length],
          tension: 0.2,
        })),
      },
      options: {
        animation: false,
        plugins: { title: { display: true, text: "Learning Curve: Success by Episode" } },
      },
    });

    this.chart2 = new Chart(this.c2, {
      type: "bar",
      data: {
        labels: data.summaryRows.map((row) => row.algorithm),
        datasets: [
          {
            label: "Average success last 10 (%)",
            data: data.summaryRows.map((row) => row.avg_success_last10),
            backgroundColor: data.summaryRows.map(
              (row, idx) => colorByAlgorithm.get(row.algorithm) ?? ALGORITHM_COLORS[idx % ALGORITHM_COLORS.length]
            ),
          },
        ],
      },
      options: {
        animation: false,
        plugins: { title: { display: true, text: "Compare Success Last 10" } },
      },
    });

    this.chart3 = new Chart(this.c3, {
      type: "bar",
      data: {
        labels: data.summaryRows.map((row) => row.algorithm),
        datasets: [
          {
            label: "Average steps last 10",
            data: data.summaryRows.map((row) => row.avg_steps_last10),
            backgroundColor: data.summaryRows.map(
              (row, idx) => colorByAlgorithm.get(row.algorithm) ?? ALGORITHM_COLORS[idx % ALGORITHM_COLORS.length]
            ),
          },
        ],
      },
      options: {
        animation: false,
        plugins: { title: { display: true, text: "Compare Steps Last 10" } },
      },
    });

    this.status.textContent = "Mission complete! Analysis ready.";
    this.downloadChartsBtn.disabled = false;
    this.setProgress(1, 1, "Complete");
  }

  setCsvExports(rawCsv: string, summaryCsv: string): void {
    this.rawCsv = rawCsv;
    this.summaryCsv = summaryCsv;
    this.downloadRawBtn.disabled = false;
    this.downloadSummaryBtn.disabled = false;
    this.downloadAllBtn.disabled = false;
  }

  clearCsvExports(): void {
    this.rawCsv = null;
    this.summaryCsv = null;
    this.downloadChartsBtn.disabled = true;
    this.downloadRawBtn.disabled = true;
    this.downloadSummaryBtn.disabled = true;
    this.downloadAllBtn.disabled = true;
  }

  private downloadRawCsv(): boolean {
    if (!this.rawCsv) return false;
    return triggerDownload("raw_episodes.csv", `\uFEFF${this.rawCsv}`, "text/csv;charset=utf-8");
  }

  private downloadSummaryCsv(): boolean {
    if (!this.summaryCsv) return false;
    return triggerDownload("summary.csv", `\uFEFF${this.summaryCsv}`, "text/csv;charset=utf-8");
  }

  downloadAllPngs(): boolean {
    const ok1 = triggerPngDownload("learning_curve_success.png", this.c1);
    const ok2 = triggerPngDownload("compare_success_last10.png", this.c2);
    const ok3 = triggerPngDownload("compare_steps_last10.png", this.c3);
    return ok1 && ok2 && ok3;
  }

  private downloadAllExports(): void {
    this.downloadRawCsv();
    this.downloadSummaryCsv();
    this.downloadAllPngs();
  }

  private canvasPngDataUrl(canvas: HTMLCanvasElement): string | null {
    if (canvas.width === 0 || canvas.height === 0) return null;
    try {
      return canvas.toDataURL("image/png");
    } catch (error) {
      console.error("Chart image export failed:", error);
      return null;
    }
  }

  getChartImageDataUrls(): string[] {
    return [this.c1, this.c2, this.c3]
      .map((canvas) => this.canvasPngDataUrl(canvas))
      .filter((url): url is string => Boolean(url));
  }
}

export function aggregateEpisodeMeans(metrics: EpisodeMetrics[][], pick: (m: EpisodeMetrics) => number): number[] {
  if (metrics.length === 0) {
    return [];
  }
  const episodes = metrics[0].length;
  const out = Array(episodes).fill(0);
  for (const trial of metrics) {
    for (let i = 0; i < episodes; i += 1) {
      out[i] += pick(trial[i]);
    }
  }
  for (let i = 0; i < out.length; i += 1) {
    out[i] /= metrics.length;
  }
  return out;
}
