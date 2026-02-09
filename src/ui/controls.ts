import { AlgorithmType } from "../rl/agent_types";
import { MazeLayout } from "../core/maze_types";

export type RunSpeed = "slow" | "normal" | "fast" | "turbo";

export interface ControlsRefs {
  root: HTMLElement;
  mazeSelect: HTMLSelectElement;
  editToggle: HTMLButtonElement;
  algorithmSelect: HTMLSelectElement;
  compareSelect: HTMLSelectElement;
  episodesInput: HTMLInputElement;
  trialsInput: HTMLInputElement;
  speedSelect: HTMLSelectElement;
  runDemoBtn: HTMLButtonElement;
  runExperimentBtn: HTMLButtonElement;
  raceBtn: HTMLButtonElement;
  helpBtn: HTMLButtonElement;
  pauseBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  threeToggle: HTMLInputElement;
  soundToggle: HTMLInputElement;
  turboBadge: HTMLSpanElement;
  statusLine: HTMLElement;
}

interface KidGuideEntry {
  algorithm: AlgorithmType;
  nickname: string;
  whatItDoes: string;
  goodFor: string;
  watchOutFor: string;
}

const ALGORITHM_OPTIONS: AlgorithmType[] = [
  "Random",
  "Q-learning",
  "SARSA",
  "Expected SARSA",
  "Double Q-learning",
  "Dyna-Q",
  "PPO (Tabular)",
];

const KID_ALGO_GUIDE: KidGuideEntry[] = [
  {
    algorithm: "Random",
    nickname: "The Wild Explorer",
    whatItDoes: "Bravely tries anything! It doesn't use a map, but sometimes wild guesses lead to great discoveries.",
    goodFor: "Finding surprises. If your specialized AI beats this explorer, you know it's truly learning!",
    watchOutFor: "It gets lost easily and takes the long way home.",
  },
  {
    algorithm: "Q-learning",
    nickname: "The Treasure Hunter",
    whatItDoes: "Builds a legendary treasure map! It remembers exactly where the biggest rewards are and rushes to the gold.",
    goodFor: "A fast learner that loves high scores. Great for solving mazes quickly.",
    watchOutFor: "Can get over-excited by one lucky win and ignore safer paths.",
  },
  {
    algorithm: "SARSA",
    nickname: "The Careful Adventurer",
    whatItDoes: "Learns by doing, but watches its step! It learns from the path it *actually* takes, keeping safe from traps.",
    goodFor: "Exploring dangerous places without getting hurt. Safety first!",
    watchOutFor: "Might learn a bit slower because it worries about risks.",
  },
  {
    algorithm: "Expected SARSA",
    nickname: "The Master Strategist",
    whatItDoes: "Thinks ahead! Instead of just reacting, it calculates the average result of all possible future moves. Big brain energy.",
    goodFor: "Smooth, smart learning. It doesn't panic when things get noisy or random.",
    watchOutFor: "Takes time to think. Needs practice to show its true genius.",
  },
  {
    algorithm: "Double Q-learning",
    nickname: "The Double-Check Detective",
    whatItDoes: "Uses two brains instead of one! It double-checks every clue to make sure it's not being tricked by a lucky win.",
    goodFor: "Avoiding 'fake news' rewards. Very honest about how good a move really is.",
    watchOutFor: "Needs to write down twice as many notes, so it starts a little slower.",
  },
  {
    algorithm: "Dyna-Q",
    nickname: "The Dreamer",
    whatItDoes: "Learns while awake AND while sleeping! It practices moves in its imagination to get smarter even when it's not moving.",
    goodFor: "Learning super fast! It solves puzzles in its head before trying them.",
    watchOutFor: "If it imagines the wrong thing, it might make silly mistakes.",
  },
  {
    algorithm: "PPO (Tabular)",
    nickname: "The Steady Climber",
    whatItDoes: "Improves step-by-step! It never rushes, making sure every new skill is solid before moving to the next level.",
    goodFor: "Tough challenges where one bad move ruins everything. Slow and steady wins the race.",
    watchOutFor: "Needs a lot of practice sessions to reach the top of the mountain.",
  },
];

export function createControls(mazes: MazeLayout[]): ControlsRefs {
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

  const root = document.createElement("section");
  root.className = "panel controls-panel";

  const heading = document.createElement("h2");
  heading.className = "controls-title";
  heading.textContent = "Maze Editor + Experiment Controls ";
  heading.append(hint("Use this area to set up the maze, run learning, and race the robot."));

  const mazeSelect = document.createElement("select");
  for (const maze of mazes) {
    const option = document.createElement("option");
    option.value = maze.name;
    option.textContent = `${maze.name} (${maze.size}x${maze.size})`;
    mazeSelect.appendChild(option);
  }

  const editToggle = document.createElement("button");
  editToggle.textContent = "Edit Maze";
  editToggle.title = "Turn maze editing mode on or off.";
  editToggle.className = "btn-edit ctrl-edit-toggle";

  const algorithmSelect = document.createElement("select");
  ALGORITHM_OPTIONS.forEach((alg) => {
    const option = document.createElement("option");
    option.value = alg;
    option.textContent = alg;
    algorithmSelect.appendChild(option);
  });
  algorithmSelect.value = "Q-learning";

  const compareSelect = document.createElement("select");
  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "None (auto pick)";
  compareSelect.appendChild(noneOption);
  ALGORITHM_OPTIONS.forEach((alg) => {
    const option = document.createElement("option");
    option.value = alg;
    option.textContent = alg;
    compareSelect.appendChild(option);
  });
  compareSelect.value = "";

  const episodesInput = document.createElement("input");
  episodesInput.type = "number";
  episodesInput.min = "1";
  episodesInput.max = "500";
  episodesInput.value = "50";

  const trialsInput = document.createElement("input");
  trialsInput.type = "number";
  trialsInput.min = "3";
  trialsInput.max = "20";
  trialsInput.value = "3";

  const speedSelect = document.createElement("select");
  const speeds: RunSpeed[] = ["slow", "normal", "fast", "turbo"];
  for (const speed of speeds) {
    const option = document.createElement("option");
    option.value = speed;
    option.textContent = speed[0].toUpperCase() + speed.slice(1);
    speedSelect.appendChild(option);
  }
  speedSelect.value = "normal";

  /* --- Primary Action --- */
  const runDemoBtn = document.createElement("button");
  runDemoBtn.textContent = "Start Watch Learning"; // Stronger verb
  runDemoBtn.title = "Learning mode: one AI learns live so you can watch every move.";
  runDemoBtn.className = "btn-demo btn-primary-action"; // Added primary class

  /* --- Secondary Actions --- */
  const runExperimentBtn = document.createElement("button");
  runExperimentBtn.textContent = "Science Test";
  runExperimentBtn.title = "Science mode: compare selected algorithms with fair trials, charts, and CSV.";
  runExperimentBtn.className = "btn-experiment btn-secondary-action";

  const raceBtn = document.createElement("button");
  raceBtn.textContent = "Race vs AI";
  raceBtn.title = "Race against a trained AI in 3D.";
  raceBtn.className = "btn-race btn-secondary-action";

  const helpBtn = document.createElement("button");
  helpBtn.textContent = "Help";
  helpBtn.title = "Show simple instructions.";
  helpBtn.className = "btn-help";

  const pauseBtn = document.createElement("button");
  pauseBtn.textContent = "Pause";
  pauseBtn.disabled = true;
  pauseBtn.title = "Pause or continue the current run.";

  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset";
  resetBtn.title = "Stop now and reset the maze view.";

  const threeToggle = document.createElement("input");
  threeToggle.type = "checkbox";
  threeToggle.checked = true;

  const soundToggle = document.createElement("input");
  soundToggle.type = "checkbox";
  soundToggle.checked = true;

  const statusLine = document.createElement("p");
  statusLine.className = "status-line";
  statusLine.textContent = "Ready.";
  const turboBadge = document.createElement("span");
  turboBadge.className = "controls-turbo-badge";
  turboBadge.textContent = "Turbo Active";
  turboBadge.setAttribute("aria-live", "polite");

  /* --- Inputs & Toggles --- */
  const fields: Array<{ label: string; hint: string; el: HTMLElement }> = [
    {
      label: "Select Maze",
      hint: "Pick which maze map to use. Obstacle maps use Ice (slides), Water/Fire (extra penalty), and Holes (run ends).",
      el: mazeSelect,
    },
    {
      label: "Algorithm",
      hint:
        "Pick the main learner. Random means guessing. Others try to improve over time.",
      el: algorithmSelect,
    },
    {
      label: "Compare To",
      hint: "Optional second learner for quick 2-way graph comparison in Science Test.",
      el: compareSelect,
    },
    {
      label: "Episodes",
      hint: "Episodes means tries. One episode is one full try from start to goal (or timeout).",
      el: episodesInput,
    },
    { label: "Trials", hint: "Trials means repeating the same test to keep it fair.", el: trialsInput },
    { label: "Speed", hint: "Slow is easiest to watch. Turbo is fastest and skips most animations.", el: speedSelect },
  ];

  const fieldWrap = document.createElement("div");
  fieldWrap.className = "control-grid controls-params";

  const guideDetails = document.createElement("details");
  guideDetails.className = "rl-guide";
  const guideSummary = document.createElement("summary");
  guideSummary.textContent = "Meet Your AI Teammates";
  const guideLead = document.createElement("p");
  guideLead.className = "rl-guide-lead";
  guideLead.textContent = "Pick a brain type to see its special powers and secret weaknesses.";
  const guideGrid = document.createElement("div");
  guideGrid.className = "rl-guide-grid";
  const guideCards = new Map<string, HTMLElement>();

  for (const entry of KID_ALGO_GUIDE) {
    const card = document.createElement("article");
    card.className = "rl-guide-card";
    card.dataset.algorithm = entry.algorithm;

    const title = document.createElement("h3");
    title.textContent = entry.algorithm;

    const nickname = document.createElement("p");
    nickname.className = "rl-guide-nickname";
    nickname.textContent = entry.nickname;

    const what = document.createElement("p");
    what.innerHTML = `<strong>How it learns:</strong> ${entry.whatItDoes}`;

    const goodFor = document.createElement("p");
    goodFor.innerHTML = `<strong>Good for:</strong> ${entry.goodFor}`;

    const watchOut = document.createElement("p");
    watchOut.innerHTML = `<strong>Watch out:</strong> ${entry.watchOutFor}`;

    card.append(title, nickname, what, goodFor, watchOut);
    guideGrid.append(card);
    guideCards.set(entry.algorithm, card);
  }

  guideDetails.append(guideSummary, guideLead, guideGrid);

  const syncGuideSelection = () => {
    for (const [algorithm, card] of guideCards.entries()) {
      card.classList.toggle("is-active", algorithm === algorithmSelect.value);
    }
  };
  algorithmSelect.addEventListener("change", () => {
    if (compareSelect.value === algorithmSelect.value) {
      compareSelect.value = "";
    }
    syncGuideSelection();
  });
  syncGuideSelection();

  // Helper to add specific classes based on label
  const getClassFor = (label: string) => {
    if (label.includes("Maze")) return "ctrl-maze";
    if (label.includes("Algorithm")) return "ctrl-algo";
    if (label.includes("Episodes")) return "ctrl-episodes";
    if (label.includes("Trials")) return "ctrl-trials";
    if (label.includes("Speed")) return "ctrl-speed";
    return "ctrl-generic";
  };

  for (const field of fields) {
    const label = document.createElement("label");
    label.className = `field ${getClassFor(field.label)}`;
    const span = document.createElement("span");
    span.textContent = `${field.label} `;
    span.append(hint(field.hint));
    label.append(span, field.el);
    if (field.label === "Algorithm") {
      const openGuideBtn = document.createElement("button");
      openGuideBtn.type = "button";
      openGuideBtn.className = "btn-guide-link";
      openGuideBtn.textContent = "Open kid guide";
      openGuideBtn.title = "Open the RL guide cards below.";
      openGuideBtn.onclick = () => {
        syncGuideSelection();
        guideDetails.open = true;
        const activeCard = guideCards.get(algorithmSelect.value);
        activeCard?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      };

      const helperRow = document.createElement("div");
      helperRow.className = "field-help-row";
      helperRow.append(openGuideBtn);
      label.append(helperRow);
    }
    fieldWrap.appendChild(label);
  }

  const toggles = document.createElement("div");
  toggles.className = "toggle-row controls-toggles";

  const thLabel = document.createElement("label");
  thLabel.className = "inline-toggle";
  thLabel.append(threeToggle, document.createTextNode("Show 3D Viewer "), hint("Turn the 3D maze world on or off."));

  const soundLabel = document.createElement("label");
  soundLabel.className = "inline-toggle";
  soundLabel.append(
    soundToggle,
    document.createTextNode("Sound On "),
    hint("Play move sounds, bump sounds, and race music.")
  );

  toggles.append(thLabel, soundLabel);

  /* --- Layout for Buttons --- */
  const buttons = document.createElement("div");
  buttons.className = "button-container controls-actions";

  // Top row: Edit Maze (now alone or with future buttons)
  const topRow = document.createElement("div");
  topRow.className = "button-row-primary";
  topRow.append(editToggle);

  // Bottom row: Secondary Actions + Utilities
  const bottomRow = document.createElement("div");
  bottomRow.className = "button-row-secondary";
  bottomRow.append(runExperimentBtn, raceBtn, pauseBtn, resetBtn);

  buttons.append(topRow, bottomRow);

  // Make Start Watch Learning very prominent at the bottom
  runDemoBtn.classList.remove("btn-primary-action", "btn-demo");
  runDemoBtn.classList.add("btn-start-large", "controls-start-btn");
  runDemoBtn.textContent = "▶ Start Watch Learning";

  statusLine.textContent = "Ready.";
  statusLine.classList.add("controls-status");

  root.append(heading, fieldWrap, guideDetails, toggles, buttons, runDemoBtn, turboBadge, statusLine);

  return {
    root,
    mazeSelect,
    editToggle,
    algorithmSelect,
    compareSelect,
    episodesInput,
    trialsInput,
    speedSelect,
    runDemoBtn,
    runExperimentBtn,
    raceBtn,
    helpBtn,
    pauseBtn,
    resetBtn,
    threeToggle,
    soundToggle,
    turboBadge,
    statusLine,
  };
}

export function selectedAlgorithms(value: string): AlgorithmType[] {
  if (ALGORITHM_OPTIONS.includes(value as AlgorithmType)) {
    return [value as AlgorithmType];
  }
  return ["Q-learning"];
}

export function speedToDelay(speed: RunSpeed): number {
  if (speed === "slow") return 260;
  if (speed === "normal") return 130;
  if (speed === "fast") return 55;
  return 0;
}

export function speedToDashboardStride(speed: RunSpeed): number {
  if (speed === "turbo") return 8;
  if (speed === "fast") return 2;
  return 1;
}
