import { Chart, registerables } from "chart.js";
import { EpisodeMetrics, rollingAvgReturn, rollingAvgSteps, rollingSuccess } from "../core/metrics";
import { ExperimentPanel } from "./experiment_panel";
import { ConfettiSystem } from "./confetti";

Chart.register(...registerables);

interface JournalEntry {
  id: string;
  prompt: string;
  note: string;
  createdAt: string;
  source?: "manual" | "checkpoint";
  trial?: number;
  episode?: number;
  expert?: string;
}

interface Expectation {
  id: string;
  role: string;
  name: string;
  icon: string;
  color: string;
  message: string;
}

const EXPERTS: Expectation[] = [
  { id: "lead", name: "Commander Logic", role: "Mission Leader", color: "#d69aff", icon: "🧠", message: "Analyze the mission data to proceed." },
  { id: "plan", name: "Tech Architect", role: "Hypothesis", color: "#66d9ef", icon: "📐", message: "Does this match our blueprints?" },
  { id: "ops", name: "System Ops", role: "Configuration", color: "#ffd700", icon: "⚡", message: "Systems performance within parameters." },
  { id: "scan", name: "Scan Officer", role: "Observation", color: "#a6e22e", icon: "👁️", message: "Report visual anomalies." },
  { id: "judge", name: "Data Marshall", role: "Evidence", color: "#f92672", icon: "⚖️", message: "The numbers don't lie." },
  { id: "data", name: "Cyber Analyst", role: "Numbers", color: "#72d6ff", icon: "🔎", message: "Crunching the telemetry now." },
  { id: "trend", name: "Pattern Scout", role: "Trends", color: "#7cfcc4", icon: "📈", message: "Detecting learning trajectory." },
  { id: "bug", name: "Glitch Hunter", role: "Errors", color: "#ff8a8a", icon: "🧭", message: "Is the agent stuck in a loop?" },
  { id: "future", name: "Prophet Bot", role: "Predictions", color: "#ffbf69", icon: "🛰️", message: "Calculating future outcomes..." },
  { id: "next", name: "Upgrade Architect", role: "Next Steps", color: "#9fa7ff", icon: "🛠️", message: "Prepare for iteration." },
];

const TREE_PROMPTS = [
  "Mission Report: What did the agent do?",
  "Technical Analysis: Why did it behave this way?",
  "Strategic Forecast: What will happen next episode?",
] as const;

interface ScienceNotebookDraft {
  version: number;
  currentStep: number;
  scienceEpisodes: string;
  scienceTrials: string;
  compareRandom: boolean;
  compareQLearn: boolean;
  compareSarsa: boolean;
  compareExpectedSarsa: boolean;
  compareDoubleQ: boolean;
  compareDynaQ: boolean;
  comparePpo: boolean;
  topic1: string;
  topic2: string;
  sources: string;
  purpose: string;
  hypothesis: string;
  hypothesisWhy: string;
  variable: string;
  variableWhy: string;
  control: string;
  prediction: string;
  fairOneChange: boolean;
  fairConstants: boolean;
  fairHypothesis: boolean;
  observationLog: string;
  resultsSummary: string;
  conclusion: string;
  lifeConnection: string;
  chartWinner: string;
  chartEvidence: string;
  surprise: string;
  journalEntries: JournalEntry[];

  // New Overlay State
  overlayObserveDraft: string;
  overlayWhyDraft: string;
  overlayNextDraft: string;
}


const NOTEBOOK_STORAGE_KEY = "ai-maze-lab-science-notebook-v2";





export interface EpisodeObservationSnapshot {
  algorithm: string;
  success: boolean;
  steps: number;
  episodeReturn: number;
}

export interface EpisodeHistory {
  algorithm: string;
  metrics: EpisodeMetrics[];
}

export interface EpisodeObservationRequest {
  trial: number;
  totalTrials: number;
  episode: number;
  totalEpisodes: number;
  snapshots: EpisodeObservationSnapshot[];
  history: EpisodeHistory[];
}

interface CheckpointQuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctOption: number;
}

type TrendDirection = "improving" | "steady" | "worse";

interface AlgorithmTrendSummary {
  success: number;
  avgReturn: number;
  avgSteps: number;
  successTrend: TrendDirection;
  returnTrend: TrendDirection;
  stepsTrend: TrendDirection;
}

interface DataLogCardInputs {
  episode: HTMLInputElement;
  steps: HTMLInputElement;
  return: HTMLInputElement;
  didWin: HTMLSelectElement;
  successTrend: HTMLSelectElement;
  returnTrend: HTMLSelectElement;
  stepsTrend: HTMLSelectElement;
}

export class ScienceFairPanel {
  readonly root: HTMLElement;
  private confetti: ConfettiSystem;

  // Inputs (Public for read access or internal use)
  public scienceEpisodesInput!: HTMLInputElement;
  public scienceTrialsInput!: HTMLInputElement;
  public compareRandomCheck!: HTMLInputElement;
  public compareQLearnCheck!: HTMLInputElement;
  public compareSarsaCheck!: HTMLInputElement;
  public compareExpectedSarsaCheck!: HTMLInputElement;
  public compareDoubleQCheck!: HTMLInputElement;
  public compareDynaQCheck!: HTMLInputElement;
  public comparePpoCheck!: HTMLInputElement;

  // Research
  private topic1Input!: HTMLTextAreaElement;
  private topic2Input!: HTMLTextAreaElement;
  private sourcesInput!: HTMLTextAreaElement;

  // Plan
  private purposeInput!: HTMLTextAreaElement;
  private hypothesisInput!: HTMLTextAreaElement;
  private hypothesisWhyInput!: HTMLTextAreaElement;
  private variableSelect!: HTMLSelectElement;
  private variableWhyInput!: HTMLTextAreaElement;
  private controlSelect!: HTMLSelectElement;
  private predictionInput!: HTMLTextAreaElement;
  private fairOneChangeCheck!: HTMLInputElement;
  private fairConstantsCheck!: HTMLInputElement;
  private fairHypothesisCheck!: HTMLInputElement;

  // Observation
  // Observation (Notebook)
  private journalEntryInput!: HTMLTextAreaElement;
  private journalEntriesList!: HTMLUListElement;
  private journalEntries: JournalEntry[] = [];

  // Episode Overlay Components
  // Debrief Components
  private overlaySnapshots!: HTMLUListElement; // Reusing name
  private overlayObserveInput!: HTMLTextAreaElement;
  private overlayWhyInput!: HTMLTextAreaElement;
  private overlayNextInput!: HTMLTextAreaElement;
  private overlaySaveBtn!: HTMLButtonElement;

  // Data Log Components
  private dataLogInputs: DataLogCardInputs[] = [];

  // Chart Components
  private progressCanvas!: HTMLCanvasElement;
  private returnCanvas!: HTMLCanvasElement;
  private stepsCanvas!: HTMLCanvasElement;
  private progressChart: Chart | null = null;
  private returnChart: Chart | null = null;
  private stepsChart: Chart | null = null;

  // Guided Quiz
  private quizContainer!: HTMLElement;
  private quizStatus!: HTMLParagraphElement;
  private quizQuestions: CheckpointQuizQuestion[] = [];
  private quizResponses = new Map<string, number>();

  private checkpointResolver: ((value: boolean) => void) | null = null;
  private currentRequest: EpisodeObservationRequest | null = null;

  // Mission Control Loop State
  private step4Mode: 'setup' | 'running' | 'debrief' = 'setup';
  private runContainer!: HTMLElement;
  private debriefContainer!: HTMLElement;
  private wizardContent!: HTMLDivElement;
  private missionStatus!: HTMLParagraphElement;
  private debriefExperts!: HTMLElement;
  private arcadeXpLabel!: HTMLSpanElement;
  private arcadeStreakLabel!: HTMLSpanElement;
  private arcadeBestStreakLabel!: HTMLSpanElement;
  private arcadeRankLabel!: HTMLSpanElement;
  private arcadeHypeLabel!: HTMLParagraphElement;
  private arcadeXp = 0;
  private arcadeStreak = 0;
  private arcadeBestStreak = 0;
  private clearedCheckpoints = 0;

  // Conclusion
  private conclusionSelect!: HTMLSelectElement;
  private resultsSummaryInput!: HTMLTextAreaElement;
  private lifeConnectionInput!: HTMLTextAreaElement;
  private chartWinnerInput!: HTMLTextAreaElement;
  private chartEvidenceInput!: HTMLTextAreaElement;
  private surpriseInput!: HTMLTextAreaElement;

  // Wizard State
  private currentStep = 1;
  private totalSteps = 5;
  private steps: HTMLElement[] = [];
  private navDots: HTMLElement[] = [];
  private expertSpeech!: HTMLElement;
  private expertAvatar!: HTMLElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
  private finishBtn!: HTMLButtonElement;
  private progressStatus!: HTMLParagraphElement;
  private gateStatus!: HTMLParagraphElement;
  private gateList!: HTMLUListElement;
  private gateMessage = "";
  private isRestoringDraft = false;

  // Dependencies
  private experimentPanel: ExperimentPanel;

  constructor(experimentPanel: ExperimentPanel) {
    this.experimentPanel = experimentPanel;

    // Root Container
    this.root = document.createElement("div");
    this.root.className = "science-wizard-container";
    this.confetti = new ConfettiSystem();

    // Initialize Inputs
    this.initInputs();

    // Build UI
    this.buildWizardUI();
    this.restoreNotebookDraft();
    this.renderJournalEntries();
    this.goToStep(this.currentStep);
    this.updateArcadeHud("Arcade ready. Start your first checkpoint.");
  }

  private initInputs() {
    // --- Step 3 Setup Inputs ---
    this.scienceEpisodesInput = this.createInput("number", "15");
    this.scienceEpisodesInput.min = "1";
    this.scienceEpisodesInput.max = "500";
    this.scienceTrialsInput = this.createInput("number", "3");
    this.scienceTrialsInput.min = "1";
    this.scienceTrialsInput.max = "20";

    this.compareRandomCheck = this.createCheckbox(true);
    this.compareQLearnCheck = this.createCheckbox(true);
    this.compareSarsaCheck = this.createCheckbox(true);
    this.compareExpectedSarsaCheck = this.createCheckbox(false);
    this.compareDoubleQCheck = this.createCheckbox(false);
    this.compareDynaQCheck = this.createCheckbox(false);
    this.comparePpoCheck = this.createCheckbox(false);

    this.fairOneChangeCheck = this.createCheckbox(false);
    this.fairConstantsCheck = this.createCheckbox(false);
    this.fairHypothesisCheck = this.createCheckbox(false);

    // --- Step 1 Research Inputs ---
    this.topic1Input = this.createTextArea(
      "Example: I learned that robots use rewards to know if they did a good job..."
    );
    this.topic2Input = this.createTextArea(
      "Example: I learned that the shortest path is not always the easiest to find..."
    );
    this.sourcesInput = this.createTextArea(
      "1. Website: www.ai-for-kids.com\n2. Expert: My Science Teacher",
      2
    );

    // --- Step 2 Plan Inputs ---
    this.purposeInput = this.createTextArea("The purpose of this project is to find out if...");
    this.hypothesisInput = this.createTextArea("If I use [Brain Type], then the robot will...");
    this.hypothesisWhyInput = this.createTextArea("I chose this because my research says...");
    this.variableWhyInput = this.createTextArea("I am changing this because...");
    this.predictionInput = this.createTextArea(
      "Before running the test, I predict that ____ will perform best because ____."
    );

    this.variableSelect = this.trackField(document.createElement("select"));
    ["The Algorithm (Brain Type)", "The Maze Layout", "The Reward Values"].forEach((option) =>
      this.variableSelect.add(new Option(option, option))
    );

    this.controlSelect = this.trackField(document.createElement("select"));
    ["Random Agent (No Brain)", "Q-Learning (Normal Brain)"].forEach((option) =>
      this.controlSelect.add(new Option(option, option))
    );



    // --- Step 5 Conclusion ---
    this.resultsSummaryInput = this.createTextArea(
      "Summarize the chart results and compare at least two algorithms..."
    );
    this.lifeConnectionInput = this.createTextArea("How could this learning method help in real life?");
    this.chartWinnerInput = this.createTextArea(
      "Which algorithm performed best overall, and what makes you think so?"
    );
    this.chartEvidenceInput = this.createTextArea(
      "Use at least one number from the charts (example: 90% success, 24 average steps).",
      4
    );
    this.surpriseInput = this.createTextArea("What surprised you, and what would you test next time?");

    this.conclusionSelect = this.trackField(document.createElement("select"));
    [
      "-- Select One --",
      "Yes, the data supported my hypothesis.",
      "No, the data did NOT support my hypothesis.",
      "The results were mixed.",
    ].forEach((option) => this.conclusionSelect.add(new Option(option, option)));
  }

  private trackField<T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(field: T): T {
    field.addEventListener("input", () => this.handleNotebookInput());
    field.addEventListener("change", () => this.handleNotebookInput());
    return field;
  }

  private createInput(type: string, value: string): HTMLInputElement {
    const input = document.createElement("input");
    input.type = type;
    input.value = value;
    return this.trackField(input);
  }

  private createCheckbox(checked: boolean): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    return this.trackField(input);
  }

  private createTextArea(placeholder: string, rows = 3): HTMLTextAreaElement {
    const area = document.createElement("textarea");
    area.placeholder = placeholder;
    area.rows = rows;
    return this.trackField(area);
  }

  private buildWizardUI() {
    // 1. Tree of Thought Header (Progress)
    const treeHeader = document.createElement("div");
    treeHeader.className = "wizard-tree-header";
    this.root.append(treeHeader);

    // Nodes
    const nodes = [
      { id: 1, label: "Research", icon: "🧠" },
      { id: 2, label: "Plan", icon: "📐" },
      { id: 3, label: "Setup", icon: "⚡" },
      { id: 4, label: "Test", icon: "👁️" },
      { id: 5, label: "Results", icon: "⚖️" },
    ];

    nodes.forEach((nodeDef, idx) => {
      const node = document.createElement("div");
      node.className = "wizard-node";
      node.innerHTML = `<div class="node-icon">${nodeDef.icon}</div><div class="node-label">${nodeDef.id}. ${nodeDef.label}</div>`;
      node.onclick = () => this.goToStep(nodeDef.id);
      treeHeader.append(node);
      this.navDots.push(node);

      if (idx < nodes.length - 1) {
        const line = document.createElement("div");
        line.className = "wizard-line";
        treeHeader.append(line);
      }
    });

    // 2. Expert Banner
    const expertBanner = document.createElement("div");
    expertBanner.className = "expert-banner";
    this.expertAvatar = document.createElement("div");
    this.expertAvatar.className = "expert-avatar-large";
    this.expertSpeech = document.createElement("div");
    this.expertSpeech.className = "expert-message-box";
    expertBanner.append(this.expertAvatar, this.expertSpeech);
    this.root.append(expertBanner);

    // 3. Wizard Content Area
    const contentArea = document.createElement("div");
    contentArea.className = "wizard-content";
    this.wizardContent = contentArea;
    this.root.append(contentArea);

    // --- Build Steps ---

    // Step 1: Research
    const step1 = this.createStep("Research Report");
    step1.append(
      this.createCard("Topic #1: Reinforcement Learning", "How do robots learn?", this.topic1Input),
      this.createCard("Topic #2: The Maze Challenge", "What makes pathfinding hard?", this.topic2Input),
      this.createCard("Sources", "Where did you get this info?", this.sourcesInput)
    );

    // Step 2: Plan
    const step2 = this.createStep("Mission Plan");
    const varForm = document.createElement("div");
    varForm.className = "wizard-form-grid";
    varForm.append(
      this.createField("Independent Variable", "What changes?", this.variableSelect),
      this.createField("Reasoning", "Why change this?", this.variableWhyInput),
      this.createField("Control Group", "Baseline to compare?", this.controlSelect),
      this.createConstantsDisplay()
    );

    step2.append(
      this.createCard("Mission Purpose", "Why are we doing this?", this.purposeInput),
      this.createCard("Hypothesis", "What do you think will happen?", this.hypothesisInput),
      this.createCard("Justification", "Why do you think that?", this.hypothesisWhyInput),
      this.createCard("Before-Run Prediction", "Write your prediction before running the test.", this.predictionInput),
      this.createCard("Variables", "Defining the experiment", varForm)
    );

    // Step 3: Setup
    const step3 = this.createStep("Configuration");
    const paramGrid = document.createElement("div");
    paramGrid.className = "wizard-form-grid";
    paramGrid.append(
      this.createField("Episodes per Trial", "How many attempts?", this.scienceEpisodesInput),
      this.createField("Trials", "Repeats for fairness?", this.scienceTrialsInput)
    );

    const brainRow = document.createElement("div");
    brainRow.className = "science-check-row";
    brainRow.append(
      this.createCheckField("Random Agent", this.compareRandomCheck),
      this.createCheckField("Q-Learning", this.compareQLearnCheck),
      this.createCheckField("SARSA", this.compareSarsaCheck),
      this.createCheckField("Expected SARSA", this.compareExpectedSarsaCheck),
      this.createCheckField("Double Q-learning", this.compareDoubleQCheck),
      this.createCheckField("Dyna-Q", this.compareDynaQCheck),
      this.createCheckField("PPO (Tabular)", this.comparePpoCheck)
    );

    const checklistRow = document.createElement("div");
    checklistRow.className = "science-checklist";
    checklistRow.append(
      this.createCheckField("I decided on my hypothesis before running.", this.fairHypothesisCheck),
      this.createCheckField("I am changing only one main variable.", this.fairOneChangeCheck),
      this.createCheckField("I will keep constants the same in all trials.", this.fairConstantsCheck)
    );

    step3.append(
      this.createCard("Parameters", "Set the rules of the simulation.", paramGrid),
      this.createCard("Contestants", "Who is competing?", brainRow),
      this.createCard("Fair-Test Checklist", "Check each rule before moving forward.", checklistRow)
    );

    // Step 4: Test & Observe (Mission Control Loop)
    const step4 = this.createStep("Test & Observe");

    // 4a. Run Container (Visible during 'running')
    this.runContainer = document.createElement("div");
    this.runContainer.className = "mission-run-container";

    // Header for Run Mode
    const runHeader = document.createElement("div");
    runHeader.className = "mission-header";
    this.missionStatus = document.createElement("div");
    this.missionStatus.className = "mission-status-display";
    this.missionStatus.innerHTML = `
      <span class="status-indicator running"></span>
      <span class="status-text">Mission in Progress...</span>
      <span class="telemetry-data">Initializing...</span>
    `;

    const abortBtn = document.createElement("button");
    abortBtn.type = "button";
    abortBtn.className = "btn-secondary-action btn-mission-abort";
    abortBtn.textContent = "🛑 Abort Mission";
    abortBtn.onclick = () => this.cancelPendingEpisodeObservation();

    runHeader.append(this.missionStatus, abortBtn);

    // Runner Area
    const runnerArea = document.createElement("div");
    runnerArea.className = "mission-runner-area";
    runnerArea.append(this.experimentPanel.runnerRoot);

    this.runContainer.append(runHeader, runnerArea);

    // 4b. Debrief Container (Visible during 'debrief')
    this.debriefContainer = document.createElement("div");
    this.debriefContainer.className = "mission-debrief-container";
    this.debriefContainer.style.display = "none";

    // Debrief Header
    const debriefHeader = document.createElement("div");
    debriefHeader.className = "debrief-header";
    debriefHeader.innerHTML = `
      <h2>📋 Mission Debrief (Checkpoint)</h2>
      <p>The mission has paused for your analysis.</p>
    `;

    const arcadeHud = document.createElement("div");
    arcadeHud.className = "arcade-hud";

    const statsRow = document.createElement("div");
    statsRow.className = "arcade-stats-row";

    const xpChip = document.createElement("div");
    xpChip.className = "arcade-chip";
    xpChip.innerHTML = `<span class="chip-label">XP</span> <span class="arcade-chip-value">0</span>`;
    this.arcadeXpLabel = xpChip.querySelector(".arcade-chip-value") as HTMLSpanElement;

    const streakChip = document.createElement("div");
    streakChip.className = "arcade-chip";
    streakChip.innerHTML = `<span class="chip-label">STREAK</span> <span class="arcade-chip-value">0</span>`;
    this.arcadeStreakLabel = streakChip.querySelector(".arcade-chip-value") as HTMLSpanElement;

    const rankChip = document.createElement("div");
    rankChip.className = "arcade-chip";
    rankChip.innerHTML = `<span class="chip-label">RANK</span> <span class="arcade-chip-value">Rookie</span>`;
    this.arcadeRankLabel = rankChip.querySelector(".arcade-chip-value") as HTMLSpanElement;

    const bestChip = document.createElement("div");
    bestChip.className = "arcade-chip";
    bestChip.innerHTML = `<span class="chip-label">BEST</span> <span class="arcade-chip-value">0</span>`;
    this.arcadeBestStreakLabel = bestChip.querySelector(".arcade-chip-value") as HTMLSpanElement;

    statsRow.append(xpChip, streakChip, rankChip, bestChip);

    this.arcadeHypeLabel = document.createElement("p");
    this.arcadeHypeLabel.className = "arcade-hype";
    this.arcadeHypeLabel.textContent = "Arcade mode: lock in data and build your streak.";

    arcadeHud.append(statsRow, this.arcadeHypeLabel);
    debriefHeader.append(arcadeHud);

    // Debrief Grid
    const debriefGrid = document.createElement("div");
    debriefGrid.className = "debrief-grid";

    // Column 1: Evidence Panel & Data Log
    const evidencePanel = document.createElement("div");
    evidencePanel.className = "debrief-panel evidence-panel";

    evidencePanel.innerHTML = `<h3>🔍 The Evidence</h3>`;
    this.overlaySnapshots = document.createElement("ul"); // Reusing this property name
    this.overlaySnapshots.className = "evidence-list";

    // Progress Charts (overlay trends for all selected algorithms)
    const chartDeck = document.createElement("div");
    chartDeck.className = "progress-chart-grid";

    const successChartContainer = document.createElement("div");
    successChartContainer.className = "progress-chart-container";
    const successTitle = document.createElement("h4");
    successTitle.textContent = "Learning Trend (Success %)";
    successTitle.append(
      this.createHelpIcon("Success % means how often the bot reaches the goal. Higher is better.")
    );
    this.progressCanvas = document.createElement("canvas");
    successChartContainer.append(successTitle, this.progressCanvas);

    const returnChartContainer = document.createElement("div");
    returnChartContainer.className = "progress-chart-container";
    const returnTitle = document.createElement("h4");
    returnTitle.textContent = "Learning Trend (Return)";
    returnTitle.append(
      this.createHelpIcon(
        "Return is total reward for an episode. Higher is better. If values are negative, the one closer to zero is better."
      )
    );
    this.returnCanvas = document.createElement("canvas");
    returnChartContainer.append(returnTitle, this.returnCanvas);

    const stepsChartContainer = document.createElement("div");
    stepsChartContainer.className = "progress-chart-container";
    const stepsTitle = document.createElement("h4");
    stepsTitle.textContent = "Learning Trend (Steps)";
    stepsTitle.append(
      this.createHelpIcon("Steps means number of moves to finish. Fewer steps is usually better.")
    );
    this.stepsCanvas = document.createElement("canvas");
    stepsChartContainer.append(stepsTitle, this.stepsCanvas);
    chartDeck.append(successChartContainer, returnChartContainer, stepsChartContainer);

    const dataLogSection = document.createElement("div");
    dataLogSection.className = "data-log-section";
    dataLogSection.innerHTML = `<h3>📝 Data Log</h3><p class="data-log-hint">Copy the numbers from the Evidence panel into the Agent Cards.</p>`;


    evidencePanel.append(this.overlaySnapshots, chartDeck, dataLogSection);

    // Column 2: Analysis Panel (Tree of Thought)
    const analysisPanel = document.createElement("div");
    analysisPanel.className = "debrief-panel analysis-panel";

    const analysisHeader = document.createElement("div");
    analysisHeader.className = "analysis-header";
    analysisHeader.innerHTML = `<h3>🧠 Tree of Thought</h3>`;

    // Tree Grid
    const treeGrid = document.createElement("div");
    treeGrid.className = "tree-input-grid";

    this.overlayObserveInput = document.createElement("textarea");
    this.overlayWhyInput = document.createElement("textarea");
    this.overlayNextInput = document.createElement("textarea");

    // Helper to create branded input boxes
    const createBox = (label: string, input: HTMLTextAreaElement, icon: string) => {
      const box = document.createElement("div");
      box.className = "thought-box";
      box.innerHTML = `<div class="box-label"><span class="box-icon">${icon}</span> ${label}</div>`;
      box.append(input);
      return box;
    };

    treeGrid.append(
      createBox("OBSERVE (What happened?)", this.overlayObserveInput, "👀"),
      createBox("EXPLAIN (Why?)", this.overlayWhyInput, "🤔"),
      createBox("PREDICT (Next?)", this.overlayNextInput, "🔮")
    );

    // Save Button
    this.overlaySaveBtn = document.createElement("button");
    this.overlaySaveBtn.type = "button";
    this.overlaySaveBtn.className = "btn-primary-action btn-submit-debrief";
    this.overlaySaveBtn.innerHTML = "💾 Save Analysis & Resume Mission →";
    this.overlaySaveBtn.onclick = () => this.submitCheckpoint();

    this.quizContainer = document.createElement("section");
    this.quizContainer.className = "checkpoint-quiz";
    const quizTitle = document.createElement("h4");
    quizTitle.textContent = "Quick Check (Evidence-Based)";
    this.quizStatus = document.createElement("p");
    this.quizStatus.className = "checkpoint-quiz-status";
    this.quizStatus.textContent = "Answer the checkpoint questions before continuing.";
    this.quizContainer.append(quizTitle, this.quizStatus);

    analysisPanel.append(analysisHeader, treeGrid, this.quizContainer, this.overlaySaveBtn);

    debriefGrid.append(evidencePanel, analysisPanel);
    this.debriefContainer.append(debriefHeader, debriefGrid);

    // Assembly
    const layout = document.createElement("div");
    layout.className = "mission-layout";
    // Sidebar removed as per new design
    layout.append(this.runContainer, this.debriefContainer);

    step4.append(layout);

    // Step 5: Results
    const step5 = this.createStep("Analysis");
    step5.append(
      this.createCard("Results Data", "", this.experimentPanel.chartsRoot), // Embed Charts
      this.createCard(
        "Chart Reflection",
        "Write your interpretation before final conclusion.",
        this.chartWinnerInput
      ),
      this.createCard(
        "Chart Evidence",
        "Use at least one chart number in your explanation.",
        this.chartEvidenceInput
      ),
      this.createCard("Data Analysis", "Summarize the chart data.", this.resultsSummaryInput),
      this.createCard("What Surprised You?", "Reflect on unexpected outcomes.", this.surpriseInput),
      this.createField("Conclusion", "Did it match your hypothesis?", this.conclusionSelect),
      this.createCard("Real World", "How does this apply to life?", this.lifeConnectionInput)
    );

    this.finishBtn = document.createElement("button");
    this.finishBtn.type = "button";
    this.finishBtn.textContent = "🖨️ Print Final Report";
    this.finishBtn.className = "btn-primary-action btn-finish";
    this.finishBtn.onclick = () => this.printProject();
    step5.append(this.finishBtn);

    this.steps = [step1, step2, step3, step4, step5];
    contentArea.append(...this.steps);

    // Validation + Progress
    const gateBox = document.createElement("div");
    gateBox.className = "wizard-gate-box";
    this.progressStatus = document.createElement("p");
    this.progressStatus.className = "wizard-progress-status";
    this.gateStatus = document.createElement("p");
    this.gateStatus.className = "wizard-gate-status";
    this.gateList = document.createElement("ul");
    this.gateList.className = "wizard-gate-list";
    gateBox.append(this.progressStatus, this.gateStatus, this.gateList);
    this.root.append(gateBox);

    // 4. Navigation Footer
    const navFooter = document.createElement("div");
    navFooter.className = "wizard-footer";

    this.prevBtn = document.createElement("button");
    this.prevBtn.type = "button";
    this.prevBtn.textContent = "← Back";
    this.prevBtn.onclick = () => this.goToStep(this.currentStep - 1);

    this.nextBtn = document.createElement("button");
    this.nextBtn.type = "button";
    this.nextBtn.textContent = "Next Step →";
    this.nextBtn.className = "btn-primary-action";
    this.nextBtn.onclick = () => this.goToStep(this.currentStep + 1);

    navFooter.append(this.prevBtn, this.nextBtn);
    this.root.append(navFooter);

    this.installMissionScrollGuard();
  }

  private installMissionScrollGuard(): void {
    const preserveMissionScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest(".mission-layout")) return;
      if (!this.wizardContent) return;

      const panelTop = this.wizardContent.scrollTop;
      const panelLeft = this.wizardContent.scrollLeft;
      const pageTop = window.scrollY;
      const pageLeft = window.scrollX;

      requestAnimationFrame(() => {
        this.wizardContent.scrollTop = panelTop;
        this.wizardContent.scrollLeft = panelLeft;
        if (window.scrollY !== pageTop || window.scrollX !== pageLeft) {
          window.scrollTo(pageLeft, pageTop);
        }
      });
    };

    this.root.addEventListener("click", preserveMissionScroll, true);
    this.root.addEventListener("change", preserveMissionScroll, true);
  }

  private createStep(_title: string): HTMLElement {
    const step = document.createElement("div");
    step.className = "wizard-step";
    step.style.display = "none";
    return step;
  }

  private createCard(title: string, subtitle: string, content: HTMLElement): HTMLElement {
    const card = document.createElement("div");
    card.className = "wizard-card";
    card.innerHTML = `<h4>${title}</h4>${subtitle ? `<p class="card-subtitle">${subtitle}</p>` : ""}`;
    card.append(content);
    return card;
  }

  private createField(label: string, sub: string, input: HTMLElement): HTMLElement {
    const field = document.createElement("label");
    field.className = "wizard-field";
    field.innerHTML = `<strong>${label}</strong><span>${sub}</span>`;
    field.append(input);
    return field;
  }

  private createCheckField(label: string, input: HTMLElement): HTMLElement {
    const wrapper = document.createElement("label");
    wrapper.className = "wizard-check-field";
    const text = document.createElement("span");
    text.textContent = label;
    wrapper.append(input, text);
    return wrapper;
  }

  private createConstantsDisplay(): HTMLElement {
    const display = document.createElement("div");
    display.className = "constants-box";
    display.innerHTML = "<strong>Constants:</strong> Maze Size, Start Position, Goal Position";
    return display;
  }





  public goToStep(step: number) {
    if (step < 1 || step > this.totalSteps) return;

    if (this.checkpointResolver && step !== 4) {
      this.currentStep = 4;
      this.gateMessage = "Finish the current episode checkpoint before leaving Step 4.";
      this.steps.forEach((section, idx) => {
        section.style.display = idx + 1 === this.currentStep ? "grid" : "none";
      });
      this.updateExpert(this.currentStep);
      this.refreshNotebookState();
      this.saveNotebookDraft();
      return;
    }

    const blocker = this.blockedByPriorStep(step);
    if (blocker != null) {
      this.currentStep = blocker;
      this.gateMessage = `Step ${step} is locked. Complete Step ${blocker} first.`;
    } else {
      this.currentStep = step;
      this.gateMessage = "";
    }

    // Update Visibility
    this.steps.forEach((section, idx) => {
      section.style.display = idx + 1 === this.currentStep ? "grid" : "none";
    });

    // Update Expert
    this.updateExpert(this.currentStep);
    this.refreshNotebookState();
    this.saveNotebookDraft();
  }

  private updateExpert(step: number) {
    const leadIndex = ((step - 1) * 2) % EXPERTS.length;
    const supportIndex = (leadIndex + 1) % EXPERTS.length;
    const lead = EXPERTS[leadIndex];
    const support = EXPERTS[supportIndex];
    this.expertAvatar.innerHTML = lead.icon;
    this.expertAvatar.style.background = lead.color;
    this.expertSpeech.innerHTML = `
      <span class="expert-name-tag">${lead.name} (${lead.role})</span>
      <p class="expert-message-text">${lead.message} Support: ${support.name}.</p>
    `;
  }

  public beginEpisodeObservationSession(totalCheckpoints: number): void {
    this.journalEntries = this.journalEntries.filter((entry) => entry.source !== "checkpoint");
    this.arcadeXp = 0;
    this.arcadeStreak = 0;
    this.arcadeBestStreak = 0;
    this.clearedCheckpoints = 0;
    this.updateArcadeHud(`Mission launched: ${totalCheckpoints} checkpoints to clear.`);
    this.renderJournalEntries();
    this.refreshNotebookState();
    this.saveNotebookDraft();
  }

  public cancelPendingEpisodeObservation(): void {
    if (this.checkpointResolver) {
      const resolve = this.checkpointResolver;
      this.checkpointResolver = null;
      resolve(false);
    }
    this.arcadeStreak = 0;
    this.updateArcadeHud("Mission aborted. Streak reset. Relaunch to keep earning XP.");
    // Switch back to setup or handling abort state if needed
    this.step4Mode = 'setup';
    this.missionStatus.querySelector(".status-text")!.textContent = "Mission Aborted";
  }

  public waitForEpisodeObservation(request: EpisodeObservationRequest): Promise<boolean> {
    this.currentRequest = request;

    // Switch to Debrief Mode
    this.step4Mode = 'debrief';
    this.runContainer.style.display = "none";
    this.debriefContainer.style.display = "block";

    // Update Header
    const statusText = `Mission Log: Trial ${request.trial} / Ep ${request.episode}`;
    this.missionStatus.querySelector(".telemetry-data")!.textContent = statusText;
    this.updateArcadeHud(`Checkpoint ${request.episode}/${request.totalEpisodes}. Keep the streak alive.`);

    // Populate Evidence & Data Log Inputs
    this.overlaySnapshots.innerHTML = "";
    this.dataLogInputs = []; // Reset inputs
    this.quizQuestions = [];
    this.quizResponses.clear();

    const trendByAlgorithm = new Map<string, AlgorithmTrendSummary>();
    for (const item of request.history) {
      const currentSuccess = rollingSuccess(item.metrics, 10);
      const prevSuccess = item.metrics.length > 1 ? rollingSuccess(item.metrics.slice(0, -1), 10) : currentSuccess;
      const currentReturn = rollingAvgReturn(item.metrics, 10);
      const prevReturn = item.metrics.length > 1 ? rollingAvgReturn(item.metrics.slice(0, -1), 10) : currentReturn;
      const currentSteps = rollingAvgSteps(item.metrics, 10);
      const prevSteps = item.metrics.length > 1 ? rollingAvgSteps(item.metrics.slice(0, -1), 10) : currentSteps;

      trendByAlgorithm.set(item.algorithm, {
        success: currentSuccess,
        avgReturn: currentReturn,
        avgSteps: currentSteps,
        successTrend: this.directionFromDelta(currentSuccess - prevSuccess, 0.2),
        returnTrend: this.directionFromDelta(currentReturn - prevReturn, 0.05),
        stepsTrend: this.directionFromDelta(currentSteps - prevSteps, 0.2, true),
      });
    }

    // Redesign: Agent Cards Wizard
    const wizardContainer = document.createElement("div");
    wizardContainer.className = "data-log-wizard";

    const cardsContainer = document.createElement("div");
    cardsContainer.className = "wizard-cards-container";

    const allCards: HTMLElement[] = [];

    request.snapshots.forEach((s, idx) => {
      const trend = trendByAlgorithm.get(s.algorithm);
      // Snapshot Item (Left Panel)
      const li = document.createElement("li");
      li.className = s.success ? "success-snapshot" : "fail-snapshot";
      const meta = document.createElement("div");
      meta.className = "snap-meta";
      const name = document.createElement("strong");
      name.textContent = s.algorithm;
      const outcome = document.createElement("span");
      outcome.className = "snap-outcome";
      outcome.textContent = s.success ? "MISSION COMPLETE" : "MISSION FAILED";
      meta.append(name, outcome);

      const data = document.createElement("div");
      data.className = "snap-data";
      data.textContent = `TRIAL ${request.trial} | EP ${request.episode} | TIME ${s.steps} | SCORE ${s.episodeReturn.toFixed(1)}`;

      const trendLine = document.createElement("div");
      trendLine.className = "snap-trend";
      trendLine.append(
        `LAST 10: WIN RATE ${trend ? `${trend.success.toFixed(0)}%` : "--"} `,
        this.createHelpIcon("Win rate is how often the bot reaches the goal in the last 10 episodes."),
        ` | RETURN SCORE ${trend ? trend.avgReturn.toFixed(1) : "--"} `,
        this.createHelpIcon(
          "Return score is average total reward over the last 10 episodes. Higher is better (example: -1.8 is better than -2.7)."
        ),
        ` | STEPS TREND ${trend ? this.trendLabel(trend.stepsTrend) : "--"} `,
        this.createHelpIcon("Steps trend: improving means fewer steps over time.")
      );

      li.append(meta, data, trendLine);
      this.overlaySnapshots.append(li);

      // Data Log Agent Card (Right Panel)
      const card = this.createAgentCard(s, idx, request.episode, trend);
      // Initially hide all except first
      card.element.style.display = idx === 0 ? "flex" : "none";
      allCards.push(card.element);
      cardsContainer.append(card.element);
      this.dataLogInputs.push(card.inputs);
    });

    wizardContainer.append(cardsContainer);

    // Wizard Controls
    const controls = document.createElement("div");
    controls.className = "data-log-wizard-controls";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "wizard-nav-btn";
    prevBtn.textContent = "← Prev Agent";
    prevBtn.disabled = true;

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "wizard-nav-btn";
    nextBtn.textContent = "Next Agent →";
    nextBtn.disabled = allCards.length <= 1;

    const dotsContainer = document.createElement("div");
    dotsContainer.className = "wizard-dots";
    allCards.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.className = `wizard-dot ${i === 0 ? "active" : ""}`;
      dotsContainer.append(dot);
    });

    let currentCardIndex = 0;
    const updateWizard = () => {
      allCards.forEach((c, i) => c.style.display = i === currentCardIndex ? "flex" : "none");
      prevBtn.disabled = currentCardIndex === 0;
      nextBtn.disabled = currentCardIndex === allCards.length - 1;

      Array.from(dotsContainer.children).forEach((d, i) => {
        d.classList.toggle("active", i === currentCardIndex);
      });
    };

    prevBtn.onclick = () => {
      if (currentCardIndex > 0) {
        currentCardIndex--;
        updateWizard();
      }
    };

    nextBtn.onclick = () => {
      if (currentCardIndex < allCards.length - 1) {
        currentCardIndex++;
        updateWizard();
      }
    };

    controls.append(prevBtn, dotsContainer, nextBtn);
    wizardContainer.append(controls);

    if (request.snapshots.length === 0) {
      const empty = document.createElement("li");
      empty.className = "fail-snapshot";
      empty.textContent = "No telemetry captured. System Abort.";
      this.overlaySnapshots.append(empty);
    }

    // Clear and append new grid to Data Log Section
    const dataLogContainer = this.debriefContainer.querySelector(".data-log-section");
    if (dataLogContainer) {
      // Clean up old elements
      dataLogContainer.innerHTML = "";

      // Add Expert Header
      const expert = EXPERTS.find(e => e.id === "data")!; // Cyber Analyst
      const header = document.createElement("div");
      header.className = "panel-section-title";
      header.innerHTML = `<span class="expert-icon">${expert.icon}</span> Decrypt Data Log`;

      const hint = document.createElement("p");
      hint.className = "data-log-hint";
      hint.textContent = "Log episode #, steps, score, goal, and trend direction (success/return/steps) from the evidence.";

      dataLogContainer.append(header, hint, wizardContainer);
    }

    // Generate Dynamic Questions
    const prompts = this.generateReflectionPrompts(request.snapshots);

    this.updateThoughtHeader(this.overlayObserveInput, "OBSERVE", prompts[0], "👀");
    this.updateThoughtHeader(this.overlayWhyInput, "EXPLAIN", prompts[1], "🤔");
    this.updateThoughtHeader(this.overlayNextInput, "PREDICT", prompts[2], "🔮");

    // Reset Inputs
    this.overlayObserveInput.value = "";
    this.overlayWhyInput.value = "";
    this.overlayNextInput.value = "";
    this.overlayObserveInput.placeholder = "Type your observation here...";
    this.overlayWhyInput.placeholder = "Explain the logic here...";
    this.overlayNextInput.placeholder = "Forecast the next outcome here...";
    this.renderCheckpointQuiz(request);

    // Update Chart
    requestAnimationFrame(() => {
      this.updateProgressCharts(request.history);
    });

    return new Promise((resolve) => {
      this.checkpointResolver = resolve;
    });
  }

  private createAgentCard(
    s: EpisodeObservationSnapshot,
    idx: number,
    episode: number,
    trend?: AlgorithmTrendSummary
  ): { element: HTMLElement; inputs: DataLogCardInputs } {
    const card = document.createElement("div");
    card.className = `agent-card ${s.success ? 'status-success' : 'status-fail'}`;
    if (s.success && s.episodeReturn > 0) card.classList.add("winner");

    // Header
    const header = document.createElement("div");
    header.className = "agent-card-header";
    header.innerHTML = `
        <div class="agent-name">${s.algorithm}</div>
        <div class="agent-status-badge ${s.success ? 'success' : 'fail'}">${s.success ? 'SUCCESS' : 'FAIL'}</div>
    `;

    // Inputs Container
    // We want the students to copy the data from the left panel.
    // We will validate it.

    const mkInput = (
      label: string,
      type: "number" | "text",
      correctVal: string | number,
      helpText: string
    ) => {
      const row = document.createElement("div");
      row.className = "agent-stat-row";

      const lbl = document.createElement("span");
      lbl.textContent = label;
      lbl.append(this.createHelpIcon(helpText));

      const inp = document.createElement("input");
      inp.type = type === "number" ? "text" : "text"; // Use text for better control
      inp.className = "data-entry-input";
      inp.placeholder = "?";
      inp.oninput = () => {
        const val = inp.value.trim();
        if (val === String(correctVal)) {
          if (!inp.classList.contains("correct")) {
            inp.classList.add("correct");
            inp.disabled = true; // Lock it in
            this.awardArcadePoints(5, `${label} locked. +5 XP`);
            // Small burst of confetti
            const rect = inp.getBoundingClientRect();
            this.confetti.explode(rect.left + rect.width / 2, rect.top + rect.height / 2);
          }
        }
      };

      row.append(lbl, inp);
      return { row, inp };
    };

    const episodeField = mkInput(
      "EPISODE #",
      "number",
      episode,
      "Episode number means which round this is in the trial."
    );
    const steps = mkInput(
      "TIME (Steps)",
      "number",
      s.steps,
      "Steps are how many moves the bot made this episode."
    );
    const score = mkInput(
      "SCORE (Return)",
      "number",
      s.episodeReturn.toFixed(1),
      "Return score is the total reward for this episode. Higher is better; less negative is better."
    );

    // For Win/Loss, let's use a dropdown or simple text? Text "YES"/"NO" is fun.
    // Let's stick to dropdown for clarity but style it.
    const winRow = document.createElement("div");
    winRow.className = "agent-stat-row";
    const winLbl = document.createElement("span");
    winLbl.textContent = "GOAL?";
    winLbl.append(this.createHelpIcon("Goal = did the bot reach the yellow finish tile?"));
    const winSelect = document.createElement("select");
    winSelect.className = "data-entry-input";
    winSelect.add(new Option("?", ""));
    winSelect.add(new Option("YES", "yes"));
    winSelect.add(new Option("NO", "no"));
    const correctWin = s.success ? "yes" : "no";
    winSelect.onchange = () => {
      if (winSelect.value === correctWin) {
        winSelect.classList.add("correct");
        winSelect.disabled = true;
        this.awardArcadePoints(6, "Goal check confirmed. +6 XP");
        const rect = winSelect.getBoundingClientRect();
        this.confetti.explode(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    };
    winRow.append(winLbl, winSelect);

    const mkTrendSelect = (
      label: string,
      correct: TrendDirection,
      helpText: string
    ): { row: HTMLDivElement; select: HTMLSelectElement } => {
      const row = document.createElement("div");
      row.className = "agent-stat-row";
      const trendLbl = document.createElement("span");
      trendLbl.textContent = label;
      trendLbl.append(this.createHelpIcon(helpText));
      const select = document.createElement("select");
      select.className = "data-entry-input";
      select.add(new Option("?", ""));
      select.add(new Option("IMPROVING", "improving"));
      select.add(new Option("STEADY", "steady"));
      select.add(new Option("GETTING WORSE", "worse"));
      select.onchange = () => {
        if (select.value === correct) {
          select.classList.add("correct");
          select.disabled = true;
          this.awardArcadePoints(7, `${label} trend solved. +7 XP`);
          const rect = select.getBoundingClientRect();
          this.confetti.explode(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
      };
      row.append(trendLbl, select);
      return { row, select };
    };

    const successTrend = mkTrendSelect(
      "SUCCESS TREND",
      trend?.successTrend ?? "steady",
      "Success trend: improving means goals are being reached more often."
    );
    const returnTrend = mkTrendSelect(
      "RETURN TREND",
      trend?.returnTrend ?? "steady",
      "Return trend: improving means average score is going up."
    );
    const stepsTrend = mkTrendSelect(
      "STEPS TREND",
      trend?.stepsTrend ?? "steady",
      "Steps trend: improving means average steps are going down."
    );

    card.append(
      header,
      episodeField.row,
      steps.row,
      score.row,
      winRow,
      successTrend.row,
      returnTrend.row,
      stepsTrend.row
    );

    return {
      element: card,
      inputs: {
        episode: episodeField.inp,
        steps: steps.inp,
        return: score.inp,
        didWin: winSelect,
        successTrend: successTrend.select,
        returnTrend: returnTrend.select,
        stepsTrend: stepsTrend.select,
      }
    };
  }

  private updateProgressCharts(history: EpisodeHistory[]) {
    if (!this.progressCanvas || !this.returnCanvas || !this.stepsCanvas) return;

    this.progressChart?.destroy();
    this.returnChart?.destroy();
    this.stepsChart?.destroy();

    const maxEpisodes = history.reduce((max, item) => Math.max(max, item.metrics.length), 0);
    if (maxEpisodes === 0) return;

    const labels = Array.from({ length: maxEpisodes }, (_, i) => `${i + 1}`);
    const colors = ["#ff5a36", "#3f8cff", "#2bb673", "#9f7aea", "#f6ad55", "#00d4ff"];

    const successDatasets = history.map((item, idx) => {
      const raw = item.metrics.map((m) => (m.success ? 100 : 0));
      const rolling = this.rollingMean(raw, 10);
      return this.buildTrendDataset(item.algorithm, rolling, colors[idx % colors.length]);
    });

    const returnDatasets = history.map((item, idx) => {
      const raw = item.metrics.map((m) => m.episodeReturn);
      const rolling = this.rollingMean(raw, 10);
      return this.buildTrendDataset(item.algorithm, rolling, colors[idx % colors.length]);
    });

    const stepsDatasets = history.map((item, idx) => {
      const raw = item.metrics.map((m) => m.steps);
      const rolling = this.rollingMean(raw, 10);
      return this.buildTrendDataset(item.algorithm, rolling, colors[idx % colors.length]);
    });

    this.progressChart = this.buildTrendChart(this.progressCanvas, labels, successDatasets, "Success Rate (%)", 0, 100);
    this.returnChart = this.buildTrendChart(this.returnCanvas, labels, returnDatasets, "Average Return (Last 10)");
    this.stepsChart = this.buildTrendChart(this.stepsCanvas, labels, stepsDatasets, "Average Steps (Last 10)");
  }

  private rollingMean(values: number[], windowSize: number): number[] {
    return values.map((_, index, arr) => {
      const start = Math.max(0, index - (windowSize - 1));
      const window = arr.slice(start, index + 1);
      const sum = window.reduce((total, value) => total + value, 0);
      return sum / window.length;
    });
  }

  private buildTrendDataset(label: string, data: number[], color: string) {
    return {
      label,
      data,
      borderColor: color,
      backgroundColor: `${color}33`,
      borderWidth: 2.2,
      pointRadius: 2,
      pointHoverRadius: 3,
      tension: 0.28,
      fill: false,
    };
  }

  private buildTrendChart(
    canvas: HTMLCanvasElement,
    labels: string[],
    datasets: ReturnType<ScienceFairPanel["buildTrendDataset"]>[],
    yTitle: string,
    yMin?: number,
    yMax?: number
  ): Chart {
    return new Chart(canvas, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 450,
          easing: "easeOutCubic",
        },
        plugins: {
          legend: {
            labels: { color: "#fff", font: { size: 11 } },
          },
          title: { display: false },
        },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,0.08)" },
            ticks: { color: "#a8c3d9", maxTicksLimit: 10 },
            title: { display: true, text: "Episode #", color: "#7fa6c6" },
          },
          y: {
            min: yMin,
            max: yMax,
            grid: { color: "rgba(255,255,255,0.08)" },
            ticks: { color: "#a8c3d9" },
            title: { display: true, text: yTitle, color: "#7fa6c6" },
          },
        },
      },
    });
  }

  private directionFromDelta(delta: number, threshold: number, lowerIsBetter = false): TrendDirection {
    const adjusted = lowerIsBetter ? -delta : delta;
    if (adjusted > threshold) return "improving";
    if (adjusted < -threshold) return "worse";
    return "steady";
  }

  private trendLabel(direction: TrendDirection): string {
    if (direction === "improving") return "IMPROVING";
    if (direction === "worse") return "GETTING WORSE";
    return "STEADY";
  }

  private rankFromXp(xp: number): string {
    if (xp >= 1400) return "Arcade Legend";
    if (xp >= 900) return "Turbo Captain";
    if (xp >= 550) return "Maze Pro";
    if (xp >= 250) return "Path Scout";
    return "Rookie";
  }

  private awardArcadePoints(points: number, hype: string): void {
    this.arcadeXp += Math.max(0, Math.floor(points));
    this.updateArcadeHud(hype);
  }

  private updateArcadeHud(hype: string): void {
    if (!this.arcadeXpLabel || !this.arcadeStreakLabel || !this.arcadeRankLabel || !this.arcadeBestStreakLabel || !this.arcadeHypeLabel) {
      return;
    }
    this.arcadeXpLabel.textContent = String(this.arcadeXp);
    this.arcadeStreakLabel.textContent = String(this.arcadeStreak);
    this.arcadeBestStreakLabel.textContent = String(this.arcadeBestStreak);
    const rank = this.rankFromXp(this.arcadeXp);
    const previousRank = this.arcadeRankLabel.textContent || "Rookie";
    this.arcadeRankLabel.textContent = rank;
    if (rank !== previousRank && this.arcadeXp > 0) {
      this.arcadeHypeLabel.textContent = `Level up! New rank: ${rank}. ${hype}`;
      this.arcadeHypeLabel.classList.add("rank-up");
      setTimeout(() => this.arcadeHypeLabel.classList.remove("rank-up"), 1400);
      return;
    }
    this.arcadeHypeLabel.textContent = hype;
  }

  private createHelpIcon(text: string): HTMLSpanElement {
    const icon = document.createElement("span");
    icon.className = "term-help";
    icon.textContent = "ⓘ";
    icon.title = text;
    icon.setAttribute("aria-label", text);
    icon.tabIndex = 0;
    return icon;
  }

  private submitCheckpoint(): void {
    if (!this.checkpointResolver) return;

    // Validate Manual Data Entry
    const dataLogComplete = this.dataLogInputs.every(
      (d) => d.episode.classList.contains("correct") &&
        d.steps.classList.contains("correct") &&
        d.return.classList.contains("correct") &&
        d.didWin.classList.contains("correct") &&
        d.successTrend.classList.contains("correct") &&
        d.returnTrend.classList.contains("correct") &&
        d.stepsTrend.classList.contains("correct")
    );
    if (!dataLogComplete) {
      alert("Please complete all Data Log checks: episode #, steps, score, goal, and all three trend directions.");
      return;
    }

    const unansweredQuiz = this.quizQuestions.some((question) => !this.quizResponses.has(question.id));
    if (unansweredQuiz) {
      alert("Please answer all Quick Check questions using the evidence and graphs.");
      return;
    }

    if (this.wordCount(this.overlayObserveInput.value) < 5 ||
      this.wordCount(this.overlayWhyInput.value) < 5 ||
      this.wordCount(this.overlayNextInput.value) < 5) {
      alert("Please complete all Tree of Thought fields with at least 5 words each.");
      return;
    }

    const quizCorrect = this.quizQuestions.reduce((count, question) => {
      const selected = this.quizResponses.get(question.id);
      return count + (selected === question.correctOption ? 1 : 0);
    }, 0);
    const perfectQuiz = this.quizQuestions.length > 0 && quizCorrect === this.quizQuestions.length;
    this.arcadeStreak += 1;
    this.clearedCheckpoints += 1;
    this.arcadeBestStreak = Math.max(this.arcadeBestStreak, this.arcadeStreak);

    let checkpointBonus = 30 + this.dataLogInputs.length * 8;
    if (perfectQuiz) {
      checkpointBonus += 25;
    }
    if (this.arcadeStreak > 0 && this.arcadeStreak % 3 === 0) {
      checkpointBonus += 40;
    }
    this.awardArcadePoints(
      checkpointBonus,
      perfectQuiz
        ? `Checkpoint cleared. Perfect Quick Check! +${checkpointBonus} XP`
        : `Checkpoint cleared. +${checkpointBonus} XP`
    );
    if (perfectQuiz || this.arcadeStreak % 3 === 0) {
      this.confetti.fire();
    }

    const entry: JournalEntry = {
      id: Date.now().toString(),
      prompt: "Episode Checkpoint",
      note: `Observe: ${this.overlayObserveInput.value}\nExplain: ${this.overlayWhyInput.value}\nPredict: ${this.overlayNextInput.value}`,
      createdAt: new Date().toLocaleTimeString(),
      source: "checkpoint",
      trial: this.currentRequest?.trial,
      episode: this.currentRequest?.episode,
      expert: "Student"
    };

    // Append Data Log to Note
    const dataLogStr = this.dataLogInputs.map((d, i) => {
      const algo = this.currentRequest?.snapshots[i].algorithm || "Unknown";
      return `${algo}: episode ${d.episode.value}, ${d.steps.value} steps, ${d.return.value} return, Goal: ${d.didWin.value}, success trend: ${d.successTrend.value}, return trend: ${d.returnTrend.value}, steps trend: ${d.stepsTrend.value}`;
    }).join("\n");

    entry.note += `\n\n[Data Log]\n${dataLogStr}`;

    const quizStr = this.quizQuestions
      .map((question, index) => {
        const selectedIndex = this.quizResponses.get(question.id);
        const selected = selectedIndex == null ? "No answer" : question.options[selectedIndex];
        return `Q${index + 1}: ${question.prompt}\n- Student answer: ${selected}`;
      })
      .join("\n");
    entry.note += `\n\n[Quick Check]\n${quizStr}`;
    entry.note += `\n\n[Arcade Progress]\nXP: ${this.arcadeXp}\nStreak: ${this.arcadeStreak}\nBest streak: ${this.arcadeBestStreak}`;

    this.journalEntries.push(entry);
    this.renderJournalEntries();

    // Resume Mission
    this.step4Mode = 'running';
    this.debriefContainer.style.display = "none";
    this.runContainer.style.display = "block";

    // Update Mission Status
    this.missionStatus.querySelector(".status-text")!.textContent = "Mission Resumed";

    const resolve = this.checkpointResolver;
    this.checkpointResolver = null;
    this.handleNotebookInput();
    resolve(true);
  }

  private addManualEntry(): void {
    const note = this.journalEntryInput.value.trim();
    if (!note) return;

    const entry: JournalEntry = {
      id: Date.now().toString(),
      prompt: "Manual Note",
      note,
      createdAt: new Date().toLocaleTimeString(),
      source: "manual"
    };
    this.journalEntries.push(entry);
    this.journalEntryInput.value = "";
    this.renderJournalEntries();
    this.handleNotebookInput();
  }

  private removeJournalEntry(id: string): void {
    this.journalEntries = this.journalEntries.filter((entry) => entry.id !== id);
    this.renderJournalEntries();
    this.handleNotebookInput();
  }

  private renderJournalEntries(): void {
    if (!this.journalEntriesList) return;
    this.journalEntriesList.innerHTML = "";

    const reversed = this.journalEntries.slice().reverse();

    if (reversed.length === 0) {
      this.journalEntriesList.innerHTML = "<li class='empty-note'>No entries yet. Add notes or run experiments to see logs here.</li>";
      return;
    }

    for (const entry of reversed) {
      const item = document.createElement("li");
      item.className = `notebook-entry ${entry.source || ""}`;

      const header = document.createElement("div");
      header.className = "entry-header";
      header.innerHTML = `<span class="entry-expert" style="background:${this.getExpertColor(entry.expert)}">${entry.expert || "Note"}</span> <span class="entry-time">${entry.createdAt}</span>`;

      const content = document.createElement("div");
      content.className = "entry-content";
      content.innerHTML = entry.note.replace(/\n/g, "<br>");

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "entry-delete";
      delBtn.textContent = "×";
      delBtn.onclick = () => this.removeJournalEntry(entry.id);

      item.append(header, content, delBtn);
      this.journalEntriesList.append(item);
    }
  }

  private getExpertColor(name?: string): string {
    return "#3f8cff"; // Default student color
  }



  private handleNotebookInput(): void {
    if (this.isRestoringDraft) return;
    this.gateMessage = "";
    this.refreshNotebookState();
    this.saveNotebookDraft();
  }

  private refreshNotebookState(): void {
    const unmet = this.getStepRequirements(this.currentStep);
    const completed = this.getCompletedStepsCount();

    this.progressStatus.textContent = `Notebook progress: ${completed}/${this.totalSteps} steps complete`;

    if (this.gateMessage) {
      this.gateStatus.textContent = this.gateMessage;
    } else if (unmet.length > 0) {
      this.gateStatus.textContent = "Before moving on, complete these items:";
    } else {
      this.gateStatus.textContent = "Step complete. You can move to the next step.";
    }

    this.gateList.innerHTML = "";
    if (unmet.length > 0) {
      for (const item of unmet) {
        const li = document.createElement("li");
        li.textContent = item;
        this.gateList.append(li);
      }
    } else {
      const li = document.createElement("li");
      li.textContent = "All required notebook entries for this step are complete.";
      this.gateList.append(li);
    }

    this.prevBtn.disabled = this.currentStep === 1;
    const atLastStep = this.currentStep === this.totalSteps;
    this.nextBtn.disabled = atLastStep || unmet.length > 0;
    this.nextBtn.textContent = atLastStep ? "Final Step" : "Next Step →";

    this.finishBtn.disabled = !this.isNotebookReadyForPrint();

    this.navDots.forEach((node, idx) => {
      const step = idx + 1;
      node.classList.toggle("active", step === this.currentStep);
      node.classList.toggle("completed", this.isStepComplete(step));
      node.classList.toggle("locked", this.blockedByPriorStep(step) != null);
    });
  }

  private blockedByPriorStep(targetStep: number): number | null {
    for (let step = 1; step < targetStep; step += 1) {
      if (!this.isStepComplete(step)) {
        return step;
      }
    }
    return null;
  }

  private getCompletedStepsCount(): number {
    let count = 0;
    for (let step = 1; step <= this.totalSteps; step += 1) {
      if (this.isStepComplete(step)) count += 1;
    }
    return count;
  }

  private isStepComplete(step: number): boolean {
    return this.getStepRequirements(step).length === 0;
  }

  private isNotebookReadyForPrint(): boolean {
    for (let step = 1; step <= this.totalSteps; step += 1) {
      if (!this.isStepComplete(step)) return false;
    }
    return true;
  }

  private firstIncompleteStep(): number {
    for (let step = 1; step <= this.totalSteps; step += 1) {
      if (!this.isStepComplete(step)) return step;
    }
    return this.totalSteps;
  }

  private getStepRequirements(step: number): string[] {
    const unmet: string[] = [];

    if (step === 1) {
      if (this.wordCount(this.topic1Input.value) < 18) {
        unmet.push("Write at least 18 words for Topic #1.");
      }
      if (this.wordCount(this.topic2Input.value) < 18) {
        unmet.push("Write at least 18 words for Topic #2.");
      }
      if (this.nonEmptyLineCount(this.sourcesInput.value) < 2) {
        unmet.push("List at least 2 sources.");
      }
      return unmet;
    }

    if (step === 2) {
      if (this.wordCount(this.purposeInput.value) < 12) {
        unmet.push("Write at least 12 words in Mission Purpose.");
      }
      if (this.wordCount(this.hypothesisInput.value) < 12) {
        unmet.push("Write at least 12 words in Hypothesis.");
      }
      if (this.wordCount(this.hypothesisWhyInput.value) < 12) {
        unmet.push("Write at least 12 words in Justification.");
      }
      if (this.wordCount(this.variableWhyInput.value) < 10) {
        unmet.push("Explain why you chose the variable in at least 10 words.");
      }
      if (this.wordCount(this.predictionInput.value) < 14) {
        unmet.push("Write a before-run prediction in at least 14 words.");
      }
      return unmet;
    }

    if (step === 3) {
      const episodes = Number(this.scienceEpisodesInput.value);
      const trials = Number(this.scienceTrialsInput.value);
      if (!Number.isInteger(episodes) || episodes < 1 || episodes > 500) {
        unmet.push("Set Episodes per Trial to a whole number between 1 and 500.");
      }
      if (!Number.isInteger(trials) || trials < 1 || trials > 20) {
        unmet.push("Set Trials to a whole number between 1 and 20.");
      }
      const selectedAlgorithms = [
        this.compareRandomCheck,
        this.compareQLearnCheck,
        this.compareSarsaCheck,
        this.compareExpectedSarsaCheck,
        this.compareDoubleQCheck,
        this.compareDynaQCheck,
        this.comparePpoCheck,
      ].filter((item) => item.checked).length;
      if (selectedAlgorithms < 2) {
        unmet.push("Select at least 2 algorithms. The first few appear in live 2D; all selected algorithms appear in trend graphs.");
      }
      if (!this.fairHypothesisCheck.checked || !this.fairOneChangeCheck.checked || !this.fairConstantsCheck.checked) {
        unmet.push("Complete the Fair-Test Checklist.");
      }
      return unmet;
    }

    if (step === 4) {
      if (!this.experimentPanel.hasRenderedResults()) {
        unmet.push("Run the Science Test so results charts are generated.");
      }
      // Require at least one journal entry (checkpoint or manual)
      if (this.journalEntries.length === 0) {
        unmet.push("Use the Scientist's Notebook to record at least one observation.");
      }
      return unmet;
    }

    if (step === 5) {
      if (!this.experimentPanel.hasRenderedResults()) {
        unmet.push("Run the Science Test before final analysis.");
      }
      if (this.wordCount(this.chartWinnerInput.value) < 12) {
        unmet.push("Explain the chart winner in at least 12 words.");
      }
      if (this.wordCount(this.chartEvidenceInput.value) < 16 || !/\d/.test(this.chartEvidenceInput.value)) {
        unmet.push("Use at least 16 words and include one number in Chart Evidence.");
      }
      if (this.wordCount(this.resultsSummaryInput.value) < 30) {
        unmet.push("Write at least 30 words in Data Analysis.");
      }
      if (this.conclusionSelect.selectedIndex <= 0) {
        unmet.push("Select a Conclusion option.");
      }
      if (this.wordCount(this.surpriseInput.value) < 12) {
        unmet.push("Write at least 12 words for What Surprised You.");
      }
      if (this.wordCount(this.lifeConnectionInput.value) < 18) {
        unmet.push("Write at least 18 words for Real World connection.");
      }
      return unmet;
    }

    return unmet;
  }

  private wordCount(text: string): number {
    const tokens = text.trim().match(/[A-Za-z0-9'-]+/g);
    return tokens ? tokens.length : 0;
  }

  private nonEmptyLineCount(text: string): number {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0).length;
  }

  private saveNotebookDraft(): void {
    if (this.isRestoringDraft) return;

    const draft: ScienceNotebookDraft = {
      version: 4,
      currentStep: this.currentStep,
      scienceEpisodes: this.scienceEpisodesInput.value,
      scienceTrials: this.scienceTrialsInput.value,
      compareRandom: this.compareRandomCheck.checked,
      compareQLearn: this.compareQLearnCheck.checked,
      compareSarsa: this.compareSarsaCheck.checked,
      compareExpectedSarsa: this.compareExpectedSarsaCheck.checked,
      compareDoubleQ: this.compareDoubleQCheck.checked,
      compareDynaQ: this.compareDynaQCheck.checked,
      comparePpo: this.comparePpoCheck.checked,
      topic1: this.topic1Input.value,
      topic2: this.topic2Input.value,
      sources: this.sourcesInput.value,
      purpose: this.purposeInput.value,
      hypothesis: this.hypothesisInput.value,
      hypothesisWhy: this.hypothesisWhyInput.value,
      variable: this.variableSelect.value,
      variableWhy: this.variableWhyInput.value,
      control: this.controlSelect.value,
      prediction: this.predictionInput.value,
      fairOneChange: this.fairOneChangeCheck.checked,
      fairConstants: this.fairConstantsCheck.checked,
      fairHypothesis: this.fairHypothesisCheck.checked,
      resultsSummary: this.resultsSummaryInput.value,
      conclusion: this.conclusionSelect.value,
      lifeConnection: this.lifeConnectionInput.value,
      chartWinner: this.chartWinnerInput.value,
      chartEvidence: this.chartEvidenceInput.value,
      surprise: this.surpriseInput.value,
      journalEntries: this.journalEntries,

      // New Overlay
      overlayObserveDraft: this.overlayObserveInput.value,
      overlayWhyDraft: this.overlayWhyInput.value,
      overlayNextDraft: this.overlayNextInput.value,
      // Deprecated fields mapped to empty
      observationLog: "",
    };

    try {
      window.localStorage.setItem(NOTEBOOK_STORAGE_KEY, JSON.stringify(draft));
    } catch (error) {
      console.warn("Notebook autosave failed:", error);
    }
  }

  private restoreNotebookDraft(): void {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(NOTEBOOK_STORAGE_KEY);
    } catch (error) {
      console.warn("Notebook restore skipped:", error);
      return;
    }

    if (!raw) return;

    try {
      const draft = JSON.parse(raw) as Partial<ScienceNotebookDraft>;
      this.isRestoringDraft = true;

      this.assignValue(this.scienceEpisodesInput, draft.scienceEpisodes);
      this.assignValue(this.scienceTrialsInput, draft.scienceTrials);
      this.assignChecked(this.compareRandomCheck, draft.compareRandom);
      this.assignChecked(this.compareQLearnCheck, draft.compareQLearn);
      this.assignChecked(this.compareSarsaCheck, draft.compareSarsa);
      this.assignChecked(this.compareExpectedSarsaCheck, draft.compareExpectedSarsa);
      this.assignChecked(this.compareDoubleQCheck, draft.compareDoubleQ);
      this.assignChecked(this.compareDynaQCheck, draft.compareDynaQ);
      this.assignChecked(this.comparePpoCheck, draft.comparePpo);
      this.assignValue(this.topic1Input, draft.topic1);
      this.assignValue(this.topic2Input, draft.topic2);
      this.assignValue(this.sourcesInput, draft.sources);
      this.assignValue(this.purposeInput, draft.purpose);
      this.assignValue(this.hypothesisInput, draft.hypothesis);
      this.assignValue(this.hypothesisWhyInput, draft.hypothesisWhy);
      this.assignSelectValue(this.variableSelect, draft.variable);
      this.assignValue(this.variableWhyInput, draft.variableWhy);
      this.assignSelectValue(this.controlSelect, draft.control);
      this.assignValue(this.predictionInput, draft.prediction);
      this.assignChecked(this.fairOneChangeCheck, draft.fairOneChange);
      this.assignChecked(this.fairConstantsCheck, draft.fairConstants);
      this.assignChecked(this.fairHypothesisCheck, draft.fairHypothesis);
      this.assignValue(this.resultsSummaryInput, draft.resultsSummary);
      this.assignSelectValue(this.conclusionSelect, draft.conclusion);
      this.assignValue(this.lifeConnectionInput, draft.lifeConnection);
      this.assignValue(this.chartWinnerInput, draft.chartWinner);
      this.assignValue(this.chartEvidenceInput, draft.chartEvidence);
      this.assignValue(this.surpriseInput, draft.surprise);

      this.assignValue(this.overlayObserveInput, draft.overlayObserveDraft);
      this.assignValue(this.overlayWhyInput, draft.overlayWhyDraft);
      this.assignValue(this.overlayNextInput, draft.overlayNextDraft);

      if (Array.isArray(draft.journalEntries)) {
        this.journalEntries = draft.journalEntries
          .filter((entry): entry is JournalEntry => this.isJournalEntry(entry))
          .map((entry) => {
            const source: JournalEntry["source"] = entry.source === "checkpoint" ? "checkpoint" : "manual";
            return {
              id: entry.id,
              prompt: entry.prompt,
              note: entry.note.trim(),
              createdAt: entry.createdAt,
              source,
              trial: typeof entry.trial === "number" ? entry.trial : undefined,
              episode: typeof entry.episode === "number" ? entry.episode : undefined,
              expert: typeof entry.expert === "string" ? entry.expert : undefined,
            };
          })
          .filter((entry) => entry.note.length > 0);
      }

      if (typeof draft.currentStep === "number" && Number.isFinite(draft.currentStep)) {
        this.currentStep = Math.max(1, Math.min(this.totalSteps, Math.floor(draft.currentStep)));
      }
    } catch (error) {
      console.warn("Notebook restore failed:", error);
    } finally {
      this.renderJournalEntries(); // Re-render logic
      this.isRestoringDraft = false;
    }
  }

  private assignValue(
    field: HTMLInputElement | HTMLTextAreaElement,
    value: string | undefined
  ): void {
    if (typeof value === "string") {
      field.value = value;
    }
  }

  private assignChecked(field: HTMLInputElement, checked: boolean | undefined): void {
    if (typeof checked === "boolean") {
      field.checked = checked;
    }
  }

  private assignSelectValue(field: HTMLSelectElement, value: string | undefined): void {
    if (typeof value !== "string") return;
    const hasValue = [...field.options].some((option) => option.value === value);
    if (hasValue) {
      field.value = value;
    }
  }

  private isJournalEntry(entry: unknown): entry is JournalEntry {
    if (!entry || typeof entry !== "object") return false;
    const candidate = entry as Partial<JournalEntry>;
    const sourceValid =
      candidate.source == null || candidate.source === "manual" || candidate.source === "checkpoint";
    return (
      typeof candidate.id === "string" &&
      typeof candidate.prompt === "string" &&
      typeof candidate.note === "string" &&
      typeof candidate.createdAt === "string" &&
      sourceValid
    );
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private asReportHtml(value: string, fallback = "N/A"): string {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    return this.escapeHtml(trimmed).replace(/\n/g, "<br/>");
  }

  private printProject() {
    if (!this.isNotebookReadyForPrint()) {
      const firstIncomplete = this.firstIncompleteStep();
      this.goToStep(firstIncomplete);
      alert(`Finish Step ${firstIncomplete} notebook entries before printing.`);
      return;
    }

    const win = window.open("", "_blank");
    if (!win) {
      alert("Please allow popups!");
      return;
    }

    const chartTitles = [
      "Learning Curve: Success by Episode",
      "Compare Success Last 10",
      "Compare Steps Last 10",
    ];
    const chartImages = this.experimentPanel.getChartImageDataUrls();
    const chartsHtml = chartImages.length
      ? chartImages
        .map(
          (src, index) => `
          <figure class="chart">
            <img src="${src}" alt="Experiment chart ${index + 1}" />
            <figcaption>${chartTitles[index] ?? `Chart ${index + 1}`}</figcaption>
          </figure>
        `
        )
        .join("")
      : `<p>No chart images are available yet. Run the Science Test first.</p>`;

    const journalHtml = this.journalEntries.length
      ? `<ol>${this.journalEntries
        .map(
          (entry) =>
            `<li><strong>${this.escapeHtml(entry.prompt)}</strong> <em>(${this.escapeHtml(
              entry.createdAt
            )})</em><br/>${this.asReportHtml(entry.note)}</li>`
        )
        .join("")}</ol>`
      : "<p>No journal entries recorded.</p>";

    const content = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Science Fair Project: AI Maze Lab</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; padding: 50px; line-height: 1.6; color: #333; }
          h1 { border-bottom: 3px solid #00adef; padding-bottom: 10px; color: #004a7c; }
          h2 { color: #00adef; margin-top: 30px; border-left: 5px solid #00adef; padding-left: 15px; }
          .section { margin-bottom: 25px; background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #eee; }
          strong { color: #004a7c; }
          .page-break { page-break-after: always; }
          .meta { font-style: italic; color: #666; margin-bottom: 40px; }
          .chart-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
          .chart { margin: 0; border: 1px solid #ddd; background: #fff; padding: 12px; border-radius: 8px; }
          .chart img { width: 100%; max-width: 900px; height: auto; display: block; margin: 0 auto 8px auto; }
          .chart figcaption { text-align: center; color: #444; font-size: 14px; }
          @media print {
            body { padding: 20px; }
            .chart { break-inside: avoid; }
          }
        </style>
        <script>
          window.addEventListener("load", () => {
            setTimeout(() => {
              window.focus();
              window.print();
            }, 150);
          });
        </script>
      </head>
      <body>
        <h1>My Science Fair Project: AI Learning</h1>
        <div class="meta">Student Project Notebook | Created with AI Maze Lab</div>

        <h2>I. RESEARCH REPORT</h2>
        <div class="section">
          <strong>Topic #1 (Reinforcement Learning):</strong><br/>
          ${this.asReportHtml(this.topic1Input.value)}
        </div>
        <div class="section">
          <strong>Topic #2 (Maze Navigation):</strong><br/>
          ${this.asReportHtml(this.topic2Input.value)}
        </div>
        <div class="section">
          <strong>Bibliography:</strong><br/>
          ${this.asReportHtml(this.sourcesInput.value)}
        </div>

        <div class="page-break"></div>

        <h2>II. THE PLAN</h2>
        <div class="section">
          <strong>Mission Purpose:</strong><br/>
          ${this.asReportHtml(this.purposeInput.value)}
        </div>
        <div class="section">
          <strong>Hypothesis:</strong> ${this.asReportHtml(this.hypothesisInput.value)}<br/>
          <strong>Justification:</strong> ${this.asReportHtml(this.hypothesisWhyInput.value)}
        </div>
        <div class="section">
          <strong>Before-Run Prediction:</strong><br/>
          ${this.asReportHtml(this.predictionInput.value)}
        </div>
        <div class="section">
          <strong>Independent Variable:</strong> ${this.escapeHtml(this.variableSelect.value)}<br/>
          <strong>Justification:</strong> ${this.asReportHtml(this.variableWhyInput.value)}<br/>
          <strong>Control Group:</strong> ${this.escapeHtml(this.controlSelect.value)}<br/>
          <strong>Constants:</strong> Maze size, Start pos, Goal pos.
        </div>

        <div class="page-break"></div>

        <h2>III. OBSERVATION LOG</h2>
        <div class="section">
          <strong>Science Journal Entries:</strong><br/>
          ${journalHtml}
        </div>

        <h2>IV. RESULTS CHARTS</h2>
        <div class="section chart-grid">
          ${chartsHtml}
        </div>

        <h2>V. CONCLUSION & ANALYSIS</h2>
        <div class="section">
          <strong>Chart Reflection:</strong><br/>
          ${this.asReportHtml(this.chartWinnerInput.value)}
        </div>
        <div class="section">
          <strong>Chart Evidence:</strong><br/>
          ${this.asReportHtml(this.chartEvidenceInput.value)}
        </div>
        <div class="section">
          <strong>Data Analysis:</strong><br/>
          ${this.asReportHtml(this.resultsSummaryInput.value)}
        </div>
        <div class="section">
          <strong>Conclusion:</strong> ${this.escapeHtml(this.conclusionSelect.value)}
        </div>
        <div class="section">
          <strong>What Surprised Me:</strong><br/>
          ${this.asReportHtml(this.surpriseInput.value)}
        </div>
        <div class="section">
          <strong>Life Connection:</strong><br/>
          ${this.asReportHtml(this.lifeConnectionInput.value)}
        </div>
      </body>
      </html>
    `;

    win.document.open();
    win.document.write(content);
    win.document.close();
  }

  private renderCheckpointQuiz(request: EpisodeObservationRequest): void {
    if (!this.quizContainer || !this.quizStatus) return;

    const oldQuestions = this.quizContainer.querySelectorAll(".checkpoint-question");
    oldQuestions.forEach((node) => node.remove());

    this.quizQuestions = this.generateCheckpointQuiz(request);
    this.quizResponses.clear();
    this.updateQuizStatus();

    for (const question of this.quizQuestions) {
      const card = document.createElement("article");
      card.className = "checkpoint-question";

      const title = document.createElement("p");
      title.className = "checkpoint-question-text";
      title.textContent = question.prompt;

      const options = document.createElement("div");
      options.className = "checkpoint-options";

      question.options.forEach((option, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "checkpoint-option";
        btn.textContent = option;
        btn.onclick = () => {
          this.quizResponses.set(question.id, index);
          const siblings = options.querySelectorAll(".checkpoint-option");
          siblings.forEach((node) => node.classList.remove("selected"));
          btn.classList.add("selected");
          this.updateQuizStatus();
        };
        options.append(btn);
      });

      card.append(title, options);
      this.quizContainer.append(card);
    }
  }

  private updateQuizStatus(): void {
    const total = this.quizQuestions.length;
    if (total === 0) {
      this.quizStatus.textContent = "Quick Check unavailable until evidence is captured.";
      return;
    }
    const answered = this.quizResponses.size;
    const correct = this.quizQuestions.reduce((count, question) => {
      const selected = this.quizResponses.get(question.id);
      return count + (selected === question.correctOption ? 1 : 0);
    }, 0);
    if (answered < total) {
      this.quizStatus.textContent = `Quick Check: ${answered}/${total} answered.`;
      return;
    }
    this.quizStatus.textContent = `Quick Check complete: ${correct}/${total} matched the evidence.`;
  }

  private generateCheckpointQuiz(request: EpisodeObservationRequest): CheckpointQuizQuestion[] {
    const algorithms = request.snapshots.map((snapshot) => snapshot.algorithm);
    if (algorithms.length === 0) return [];

    const bestReturn = request.snapshots.reduce((best, current) =>
      current.episodeReturn > best.episodeReturn ? current : best
    );
    const fewestSteps = request.snapshots.reduce((best, current) =>
      current.steps < best.steps ? current : best
    );

    let bestTrendAlgorithm = algorithms[0];
    let bestTrendSuccess = -Infinity;
    for (const item of request.history) {
      const success = rollingSuccess(item.metrics, 10);
      if (success > bestTrendSuccess) {
        bestTrendSuccess = success;
        bestTrendAlgorithm = item.algorithm;
      }
    }

    const optionList = [...algorithms];
    const returnAnswer = Math.max(0, optionList.indexOf(bestReturn.algorithm));
    const stepsAnswer = Math.max(0, optionList.indexOf(fewestSteps.algorithm));
    const trendAnswer = Math.max(0, optionList.indexOf(bestTrendAlgorithm));

    return [
      {
        id: "highest-return",
        prompt: "Which algorithm had the highest return in this episode?",
        options: optionList,
        correctOption: returnAnswer,
      },
      {
        id: "fewest-steps",
        prompt: "Which algorithm used the fewest steps in this episode?",
        options: optionList,
        correctOption: stepsAnswer,
      },
      {
        id: "best-trend",
        prompt: "Which algorithm has the strongest current success trend (last 10)?",
        options: optionList,
        correctOption: trendAnswer,
      },
    ];
  }

  private updateThoughtHeader(input: HTMLTextAreaElement, label: string, prompt: string, icon: string) {
    const box = input.closest(".thought-box");
    if (box) {
      const labelEl = box.querySelector(".box-label");
      if (labelEl) {
        labelEl.innerHTML = `
          <div class="box-header-group">
            <span class="box-icon">${icon}</span> <span>${label}</span>
          </div>
          <div class="box-prompt">${prompt}</div>
        `;
      }
    }
  }

  private generateReflectionPrompts(snapshots: EpisodeObservationSnapshot[]): [string, string, string] {
    if (snapshots.length === 0) {
      return [
        "What evidence is missing, and how can you verify the next run?",
        "Why might the data not have appeared this episode?",
        "What should happen next if the run captures data correctly?",
      ];
    }

    // 1. Analyze Result
    const successCount = snapshots.filter(s => s.success).length;
    const failCount = snapshots.length - successCount;

    // 2. Observe Prompt
    let observe = "What happened specifically in this episode?";
    if (successCount === snapshots.length) {
      observe = "All agents reached the goal. How many steps did they take?";
    } else if (failCount === snapshots.length) {
      observe = "None of the agents reached the goal. Was there a specific problem?";
    } else {
      observe = "Some agents succeeded while others failed. What was the difference?";
    }

    // 3. Explain Prompt
    let explain = "Why did you get this result?";
    // Find if Q-learning beat Random
    const qAgent = snapshots.find(s => s.algorithm.includes("Q"));
    const randomAgent = snapshots.find(s => s.algorithm.includes("Random"));

    if (qAgent && randomAgent) {
      if (qAgent.episodeReturn > randomAgent.episodeReturn) {
        explain = "Why did the AI agent get a higher return than Random?";
      } else {
        explain = "Why is the AI agent struggling to beat Random right now?";
      }
    }

    // 4. Predict Prompt
    const predict = "Based on this, what do you expect in the next episode?";

    return [observe, explain, predict];
  }
}
