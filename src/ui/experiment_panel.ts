import { Chart, registerables } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { EpisodeMetrics } from "../core/metrics";
import { canvasToOpaquePngDataUrl, SummaryRow, triggerDownload, triggerPngDownload } from "../core/export";

Chart.register(...registerables, ChartDataLabels);

const ALGORITHM_COLORS = ["#6b7280", "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#06b6d4"];
const CHART_EXPORT_WIDTH = 1200;
const CHART_EXPORT_HEIGHT = 680;

export interface ExperimentChartsData {
  successByEpisode: Map<string, number[]>;
  stepsByEpisode: Map<string, number[]>;
  summaryRows: SummaryRow[];
}

export interface LiveEpisodeSnapshot {
  algorithm: string;
  trial: number;
  episode: number;
  success: boolean;
  steps: number;
  episodeReturn: number;
}

export interface LiveStepSnapshot {
  algorithm: string;
  trial: number;
  episode: number;
  step: number;
  actionName: string;
  reward: number;
  episodeReturn: number;
  epsilon: number;
  explored: boolean;
  rollingSuccessLast10: number;
  rollingAvgStepsLast10: number;
  qValues: number[];
}

interface LiveComparisonCard {
  root: HTMLElement;
  title: HTMLHeadingElement;
  metrics: HTMLParagraphElement;
  canvas: HTMLCanvasElement;
  dashboard: HTMLUListElement;
}

export class ExperimentPanel {
  readonly runnerRoot: HTMLElement;
  readonly chartsRoot: HTMLElement;
  private status: HTMLParagraphElement;
  private progressLabel: HTMLParagraphElement;
  private progressBar: HTMLProgressElement;
  private liveCompareRoot: HTMLElement;
  private liveCards: LiveComparisonCard[] = [];
  private c1: HTMLCanvasElement;
  private c2: HTMLCanvasElement;
  private c3: HTMLCanvasElement;
  private chart1: Chart | null = null;
  private chart2: Chart | null = null;
  private chart3: Chart | null = null;
  private rawCsv: string | null = null;
  private summaryCsv: string | null = null;
  private lastSummaryRows: SummaryRow[] = [];
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

    this.liveCompareRoot = document.createElement("section");
    this.liveCompareRoot.className = "experiment-live-grid";

    for (let index = 0; index < 3; index += 1) {
      const card = document.createElement("article");
      card.className = "experiment-live-card";
      const title = document.createElement("h3");
      title.textContent = `Live AI ${index + 1}`;
      const metrics = document.createElement("p");
      metrics.className = "experiment-live-metrics";
      metrics.textContent = "Waiting for run setup.";
      const canvas = document.createElement("canvas");
      canvas.className = "experiment-live-canvas";
      const dashboard = document.createElement("ul");
      dashboard.className = "experiment-live-dashboard";
      card.append(title, metrics, canvas, dashboard);
      this.liveCompareRoot.append(card);
      this.liveCards.push({ root: card, title, metrics, canvas, dashboard });
      this.renderLiveDashboard(index, [
        "Episode: -",
        "Step: -",
        "Action: -",
        "Reward: -",
        "Return: -",
        "Epsilon: -",
        "Mode: -",
        "Win rate (last 10): -",
        "Avg steps on wins (last 10): -",
        "Q-values (F/L/R): -",
      ]);
    }

    this.runnerRoot.append(runnerHeader, this.status, this.progressLabel, this.progressBar, this.liveCompareRoot);

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
    this.configureChartCanvas(this.c1);
    this.configureChartCanvas(this.c2);
    this.configureChartCanvas(this.c3);

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

  configureLiveComparison(algorithms: string[]): void {
    this.liveCards.forEach((card, index) => {
      const algorithm = algorithms[index];
      const active = Boolean(algorithm);
      card.root.classList.toggle("inactive", !active);
      card.title.textContent = active ? `${algorithm} (Live 2D)` : `Open Slot ${index + 1}`;
      card.metrics.textContent = active
        ? "Waiting for first episode..."
        : "Select at least three algorithms for full side-by-side comparison.";
      if (!active) {
        this.renderLiveDashboard(index, [
          "Episode: -",
          "Step: -",
          "Action: -",
          "Reward: -",
          "Return: -",
          "Epsilon: -",
          "Mode: -",
          "Win rate (last 10): -",
          "Avg steps on wins (last 10): -",
          "Q-values (F/L/R): -",
        ]);
      }
    });
  }

  getLiveComparisonCanvas(index: number): HTMLCanvasElement | null {
    return this.liveCards[index]?.canvas ?? null;
  }

  setLiveComparisonMessage(index: number, text: string): void {
    const card = this.liveCards[index];
    if (!card) return;
    card.metrics.textContent = text;
  }

  updateLiveEpisodeSnapshot(index: number, snapshot: LiveEpisodeSnapshot): void {
    const card = this.liveCards[index];
    if (!card) return;
    const outcome = snapshot.success ? "Success" : "No goal";
    card.metrics.textContent = `Trial ${snapshot.trial} | Episode ${snapshot.episode} | ${outcome} | Steps ${snapshot.steps} | Return ${snapshot.episodeReturn.toFixed(2)}`;
  }

  updateLiveStepSnapshot(index: number, snapshot: LiveStepSnapshot): void {
    const card = this.liveCards[index];
    if (!card) return;
    card.metrics.textContent = `Trial ${snapshot.trial} | Episode ${snapshot.episode} | Step ${snapshot.step} | ${snapshot.actionName}`;
    this.renderLiveDashboard(index, [
      `Episode: ${snapshot.episode}`,
      `Step: ${snapshot.step}`,
      `Action: ${snapshot.actionName}`,
      `Reward: ${snapshot.reward.toFixed(2)}`,
      `Return: ${snapshot.episodeReturn.toFixed(2)}`,
      `Epsilon: ${snapshot.epsilon.toFixed(3)}`,
      `Mode: ${snapshot.explored ? "Explore" : "Exploit"}`,
      `Win rate (last 10): ${snapshot.rollingSuccessLast10.toFixed(1)}%`,
      `Avg steps on wins (last 10): ${snapshot.rollingAvgStepsLast10.toFixed(1)}`,
      `Q-values (F/L/R): ${snapshot.qValues.map((value) => this.formatLiveQ(value)).join(" / ")}`,
    ]);
  }

  private renderLiveDashboard(index: number, lines: string[]): void {
    const card = this.liveCards[index];
    if (!card) return;
    card.dashboard.innerHTML = "";
    for (const line of lines) {
      const item = document.createElement("li");
      item.textContent = line;
      card.dashboard.append(item);
    }
  }

  private formatLiveQ(value: number): string {
    const normalized = Math.abs(value) < 0.005 ? 0 : value;
    return normalized.toFixed(2);
  }

  render(data: ExperimentChartsData): void {
    this.chart1?.destroy();
    this.chart2?.destroy();
    this.chart3?.destroy();
    this.lastSummaryRows = data.summaryRows;

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
    const text = "#1e293b";
    const gridColor = "rgba(15, 23, 42, 0.18)";
    const algorithmLabels = data.summaryRows.map((row) => this.breakLabel(row.algorithm));

    const titleFont = { size: 26, weight: "bold" as const };
    const axisLabelFont = { size: 16, weight: "bold" as const };
    const tickFont = { size: 14 };
    const legendFont = { size: 15 };

    [this.c1, this.c2, this.c3].forEach((c) => this.configureChartCanvas(c));

    this.chart1 = new Chart(this.c1, {
      type: "line",
      data: {
        labels: [...labels],
        datasets: [...data.successByEpisode.entries()].map(([algorithm, values], idx) => ({
          label: algorithm,
          data: values,
          borderColor: colorByAlgorithm.get(algorithm) ?? ALGORITHM_COLORS[idx % ALGORITHM_COLORS.length],
          backgroundColor: "rgba(17, 24, 39, 0.04)",
          borderWidth: 3,
          pointRadius: 3,
          pointHoverRadius: 6,
          tension: 0.25,
        })),
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { top: 10, right: 20, bottom: 10, left: 10 } },
        plugins: {
          datalabels: { display: false },
          legend: {
            position: "top",
            labels: {
              color: text,
              boxWidth: 20,
              padding: 20,
              font: legendFont,
              usePointStyle: true,
              pointStyle: "circle",
            },
          },
          title: {
            display: true,
            text: "Learning Curve: Success Rate by Episode",
            color: text,
            font: titleFont,
            padding: { bottom: 16 },
          },
        },
        scales: {
          x: {
            ticks: { color: text, maxTicksLimit: 20, font: tickFont },
            grid: { color: gridColor },
            title: { display: true, text: "Episode", color: text, font: axisLabelFont },
          },
          y: {
            ticks: { color: text, font: tickFont, callback: (v) => `${v}%` },
            grid: { color: gridColor },
            title: { display: true, text: "Success Rate (%)", color: text, font: axisLabelFont },
            min: 0,
            max: 100,
          },
        },
      },
    });

    const barDataLabelsConfig = {
      display: true,
      anchor: "end" as const,
      align: "top" as const,
      color: text,
      font: { size: 16, weight: "bold" as const },
      formatter: (value: number) => Math.round(value).toString(),
      offset: 4,
    };

    this.chart2 = new Chart(this.c2, {
      type: "bar",
      data: {
        labels: algorithmLabels,
        datasets: [
          {
            label: "Average Success (Last 10 Episodes)",
            data: data.summaryRows.map((row) => row.avg_success_last10),
            backgroundColor: data.summaryRows.map(
              (row, idx) => colorByAlgorithm.get(row.algorithm) ?? ALGORITHM_COLORS[idx % ALGORITHM_COLORS.length]
            ),
            borderColor: "#1e293b",
            borderWidth: 2,
            borderRadius: 6,
            barPercentage: 0.7,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { top: 30, right: 20, bottom: 10, left: 10 } },
        plugins: {
          datalabels: { ...barDataLabelsConfig, formatter: (v: number) => `${Math.round(v)}%` },
          legend: {
            display: true,
            labels: { color: text, font: legendFont, boxWidth: 20, padding: 20 },
          },
          title: {
            display: true,
            text: "Algorithm Comparison: Success Rate",
            color: text,
            font: titleFont,
            padding: { bottom: 16 },
          },
        },
        scales: {
          x: {
            ticks: {
              color: text,
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 15, weight: "bold" as const },
            },
            grid: { display: false },
          },
          y: {
            ticks: { color: text, font: tickFont, callback: (v) => `${v}%` },
            grid: { color: gridColor },
            title: { display: true, text: "Success Rate (%)", color: text, font: axisLabelFont },
            min: 0,
            max: 110,
          },
        },
      },
    });

    this.chart3 = new Chart(this.c3, {
      type: "bar",
      data: {
        labels: algorithmLabels,
        datasets: [
          {
            label: "Average Steps (Last 10 Episodes)",
            data: data.summaryRows.map((row) => row.avg_steps_last10),
            backgroundColor: data.summaryRows.map(
              (row, idx) => colorByAlgorithm.get(row.algorithm) ?? ALGORITHM_COLORS[idx % ALGORITHM_COLORS.length]
            ),
            borderColor: "#1e293b",
            borderWidth: 2,
            borderRadius: 6,
            barPercentage: 0.7,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { top: 30, right: 20, bottom: 10, left: 10 } },
        plugins: {
          datalabels: barDataLabelsConfig,
          legend: {
            display: true,
            labels: { color: text, font: legendFont, boxWidth: 20, padding: 20 },
          },
          title: {
            display: true,
            text: "Algorithm Comparison: Steps to Solve",
            color: text,
            font: titleFont,
            padding: { bottom: 16 },
          },
        },
        scales: {
          x: {
            ticks: {
              color: text,
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 15, weight: "bold" as const },
            },
            grid: { display: false },
          },
          y: {
            ticks: { color: text, font: tickFont },
            grid: { color: gridColor },
            title: { display: true, text: "Average Steps", color: text, font: axisLabelFont },
            beginAtZero: true,
          },
        },
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
    if (!this.chart1 || !this.chart2 || !this.chart3) {
      this.setStatus("Charts have not been rendered yet. Run the experiment first.");
      return false;
    }
    const ok1 = triggerPngDownload("learning_curve_success.png", this.c1);
    const ok2 = triggerPngDownload("compare_success_last10.png", this.c2);
    const ok3 = triggerPngDownload("compare_steps_last10.png", this.c3);
    const allOk = ok1 && ok2 && ok3;
    this.setStatus(allOk ? "All chart PNGs saved." : "Some chart PNGs could not be exported. Check that charts are visible.");
    return allOk;
  }

  private downloadAllExports(): void {
    const csvOk = this.downloadRawCsv() && this.downloadSummaryCsv();
    const pngOk = this.downloadAllPngs();
    if (csvOk && pngOk) {
      this.setStatus("All exports saved (CSV + PNG).");
    }
  }

  private configureChartCanvas(canvas: HTMLCanvasElement): void {
    canvas.width = CHART_EXPORT_WIDTH;
    canvas.height = CHART_EXPORT_HEIGHT;
    canvas.style.width = "100%";
    canvas.style.height = "auto";
  }

  private breakLabel(label: string): string | string[] {
    if (label.length < 12 || !label.includes(" ")) return label;
    return label.split(" ");
  }

  private canvasPngDataUrl(canvas: HTMLCanvasElement): string | null {
    if (canvas.width === 0 || canvas.height === 0) return null;
    try {
      return canvasToOpaquePngDataUrl(canvas);
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

  hasRenderedResults(): boolean {
    return Boolean(this.chart1 && this.chart2 && this.chart3);
  }

  getSummaryRows(): SummaryRow[] {
    return this.lastSummaryRows;
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
