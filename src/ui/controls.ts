import { AlgorithmType } from "../rl/agent_types";
import { MazeLayout } from "../core/maze_types";

export type RunSpeed = "slow" | "normal" | "fast" | "turbo";

export interface ControlsRefs {
  root: HTMLElement;
  mazeSelect: HTMLSelectElement;
  editToggle: HTMLButtonElement;
  algorithmSelect: HTMLSelectElement;
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
  statusLine: HTMLElement;
}

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
  ["Random", "Q-learning", "SARSA", "Expected SARSA", "Double Q-learning", "All"].forEach((alg) => {
    const option = document.createElement("option");
    option.value = alg;
    option.textContent = alg;
    algorithmSelect.appendChild(option);
  });
  algorithmSelect.value = "Q-learning";

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
  runExperimentBtn.title = "Science mode: all algorithms train in fair trials, then create charts and CSV.";
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

  /* --- Inputs & Toggles --- */
  const fields: Array<{ label: string; hint: string; el: HTMLElement }> = [
    { label: "Select Maze", hint: "Pick which maze map to use.", el: mazeSelect },
    {
      label: "Algorithm",
      hint: "Random means guessing. Q-learning, SARSA, Expected SARSA, and Double Q-learning all learn from points. All tests every algorithm.",
      el: algorithmSelect,
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

  root.append(heading, fieldWrap, toggles, buttons, runDemoBtn, statusLine);

  return {
    root,
    mazeSelect,
    editToggle,
    algorithmSelect,
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
    statusLine,
  };
}

export function selectedAlgorithms(value: string): AlgorithmType[] {
  if (value === "All") {
    return ["Random", "Q-learning", "SARSA", "Expected SARSA", "Double Q-learning"];
  }
  if (
    value === "Random" ||
    value === "Q-learning" ||
    value === "SARSA" ||
    value === "Expected SARSA" ||
    value === "Double Q-learning"
  ) {
    return [value];
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
