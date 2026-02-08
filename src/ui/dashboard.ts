import { Chart, registerables } from "chart.js";
import { formatDisplayPoints, toDisplayPoints } from "./points_display";

Chart.register(...registerables);

export interface DashboardStep {
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

export class Dashboard {
  readonly root: HTMLElement;
  private metricsList: HTMLUListElement;
  private kidGuide: HTMLDivElement;
  private returnChart: Chart;
  private compactMode = false;

  constructor() {
    const hint = (text: string): HTMLSpanElement => {
      const el = document.createElement("span");
      el.className = "hint-icon";
      el.textContent = "?";
      el.title = text;
      el.dataset.tip = text;
      el.setAttribute("aria-label", text);
      el.tabIndex = 0;
      return el;
    };

    this.root = document.createElement("section");
    this.root.className = "panel dashboard-panel";

    const heading = document.createElement("h2");
    heading.textContent = "RL Dashboard ";
    heading.append(hint("These live numbers show what the robot is doing while it learns."));

    this.metricsList = document.createElement("ul");
    this.metricsList.className = "metrics-list";

    this.kidGuide = document.createElement("div");
    this.kidGuide.className = "dashboard-kid-guide";
    this.kidGuide.innerHTML = [
      `<p><strong>What this means (Mission 1):</strong></p>`,
      `<ul>`,
      `<li><strong>Try</strong> = one full robot attempt (start to finish).</li>`,
      `<li><strong>Move</strong> = how many moves it has made in this try.</li>`,
      `<li><strong>Points now</strong> = points from this one move.</li>`,
      `<li><strong>Total points this try</strong> = running total for this try.</li>`,
      `<li><strong>Robot mode</strong> = Explore (try new move) or Exploit (use best known move).</li>`,
      `<li><strong>Win rate (last 10)</strong> = how often it reached the goal in the last 10 completed tries.</li>`,
      `<li><strong>Last 10</strong> = only the most recent 10 tries, not all tries ever.</li>`,
      `<li><strong>AI guess scores (F/L/R)</strong> = how good forward/left/right looks right now (bigger is better).</li>`,
      `<li><strong>Note:</strong> Dashboard points are shown in easy scale (reward x 100). This does not change learning.</li>`,
      `</ul>`,
    ].join("");

    const returnCanvas = document.createElement("canvas");
    returnCanvas.className = "dashboard-return-chart";
    returnCanvas.height = 220;

    this.root.append(heading, this.kidGuide, this.metricsList, returnCanvas);

    this.returnChart = new Chart(returnCanvas, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Episode points",
            data: [],
            borderColor: "#ff5a36",
            backgroundColor: "rgba(255, 90, 54, 0.2)",
            tension: 0.2,
          },
        ],
      },
      options: {
        animation: false,
        scales: {
          x: {
            title: { display: true, text: "Episode" },
          },
          y: {
            title: { display: true, text: "Points" },
          },
        },
      },
    });
  }

  reset(): void {
    this.metricsList.innerHTML = "";
    this.returnChart.data.labels = [];
    this.returnChart.data.datasets[0].data = [];
    this.returnChart.update();
  }

  private lastStats = { successRate: 0, episodes: 0 };

  private formatQValue(value: number): string {
    const normalized = Math.abs(value) < 0.005 ? 0 : value;
    return normalized.toFixed(2);
  }

  updateStep(step: DashboardStep, _explain: string): void {
    const qSummary = `AI guess scores (F/L/R): ${step.qValues.map((v) => this.formatQValue(v)).join(" / ")}`;
    const robotMode = step.explored ? "Explore" : "Exploit";
    const items = this.compactMode
      ? [
        `Try: ${step.episode}`,
        `Move: ${step.step}`,
        `Robot chose: ${step.actionName}`,
        `Points now: ${formatDisplayPoints(step.reward)}`,
        `Total points this try: ${formatDisplayPoints(step.episodeReturn)}`,
        `Robot mode: ${robotMode}`,
        `Win rate (last 10 completed tries): ${step.rollingSuccessLast10.toFixed(1)}%`,
        qSummary,
      ]
      : [
        `Episode: ${step.episode}`,
        `Step: ${step.step}`,
        `Action: ${step.actionName}`,
        `Instant points: ${formatDisplayPoints(step.reward)}`,
        `Episode total points: ${formatDisplayPoints(step.episodeReturn)}`,
        `Randomness level (epsilon): ${step.epsilon.toFixed(3)}`,
        `Robot mode: ${robotMode}`,
        `Win rate (last 10 completed tries): ${step.rollingSuccessLast10.toFixed(1)}%`,
        `Average moves on wins (last 10): ${step.rollingAvgStepsLast10.toFixed(1)}`,
        qSummary,
      ];

    this.lastStats = {
      successRate: step.rollingSuccessLast10 / 100, // convert % to decimal
      episodes: step.episode
    };

    this.metricsList.innerHTML = "";
    for (const item of items) {
      const li = document.createElement("li");
      li.textContent = item;
      this.metricsList.appendChild(li);
    }
  }

  getStats() {
    return this.lastStats;
  }

  setCompactMode(enabled: boolean): void {
    this.compactMode = enabled;
    this.root.classList.toggle("dashboard-compact", enabled);
  }

  pushEpisodeReturn(episode: number, episodeReturn: number): void {
    this.lastStats.episodes = episode;
    this.returnChart.data.labels?.push(String(episode));
    (this.returnChart.data.datasets[0].data as number[]).push(toDisplayPoints(episodeReturn));
    this.returnChart.update();
  }

  hasData(): boolean {
    const labels = this.returnChart.data.labels ?? [];
    const points = this.returnChart.data.datasets[0]?.data ?? [];
    return this.metricsList.children.length > 0 || labels.length > 0 || points.length > 0;
  }
}
