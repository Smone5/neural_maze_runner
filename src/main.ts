import "./styles.css";

import { ACTION_NAMES, Action, MazeEnv, stateToKey } from "./core/env";
import { analyzeMaze } from "./core/maze_analyze";
import { RawRow, summarizeExperiment, toCsv } from "./core/export";
import { decodeMazeFromUrl, encodeMazeToShareUrl, loadBuiltinMazes } from "./core/maze_io";
import { cloneMaze, MazeLayout } from "./core/maze_types";
import { EpisodeMetrics, rollingAvgReturn, rollingAvgSteps, rollingSuccess } from "./core/metrics";
import { makeRng } from "./core/rng";
import { TopDownCanvasRenderer } from "./render/topdown_canvas";
import { ThreeMazeViewer, ThreeViewMode } from "./render/three_viewer";
import { AlgorithmType, RLAgent } from "./rl/agent_types";
import { DoubleQLearningAgent } from "./rl/double_q_learning";
import { ExpectedSarsaAgent } from "./rl/expected_sarsa";
import { QLearningAgent } from "./rl/q_learning";
import { RandomAgent } from "./rl/random_agent";
import { SarsaAgent } from "./rl/sarsa";
import { RunSpeed, createControls, speedToDashboardStride, speedToDelay } from "./ui/controls";
import { Dashboard } from "./ui/dashboard";
import {
  aggregateEpisodeMeans,
  ExperimentPanel,
  LiveEpisodeSnapshot,
  LiveStepSnapshot,
} from "./ui/experiment_panel";
import { explainText } from "./ui/explain_box";
import { MazeEditor } from "./ui/maze_editor";
import { EpisodeHistory, EpisodeObservationSnapshot, ScienceFairPanel } from "./ui/science_fair_panel";
import { LearnPanel } from "./ui/learn_panel";
import { TutorialSystem } from "./ui/tutorial";
import { ConfettiSystem } from "./ui/confetti";
import { LEVELS, loadLevel, LevelDef } from "./core/levels";
import { ProgressionManager } from "./core/progression";
import { AdaptiveMissionCoach } from "./core/adaptive_coach";
import { AcademyHUD } from "./ui/academy_hud";
import { LandingPage } from "./ui/landing_page";
type RunMode = "idle" | "demo" | "experiment" | "race";
type AppMode = "LEARN" | "LAB" | "ARCADE" | "SCIENCE" | "CHALLENGE";
const KID_HEADSTART_MS = 1500;

import { SoundFx } from "./core/sound_fx";

interface StepInfo {
  step: ReturnType<MazeEnv["step"]>;
  explored: boolean;
  stateKey: string;
  qValues: number[];
  epsilon: number;
}

interface EpisodeRunOptions {
  token: number;
  env: MazeEnv;
  agent: RLAgent;
  rngSeed: number;
  episodeIndex: number;
  totalEpisodes: number;
  onReset?: () => void;
  onStep?: (info: StepInfo) => Promise<void> | void;
}

interface RaceState {
  token: number;
  active: boolean;
  kidEnv: MazeEnv;
  aiEnv: MazeEnv;
  policyAgent: RLAgent;
  aiRng: ReturnType<typeof makeRng>;
  startAt: number;
  kidSteps: number;
  aiSteps: number;
  kidBumps: number;
  aiBumps: number;
  kidSuccess: boolean;
  aiSuccess: boolean;
  kidDone: boolean;
  aiDone: boolean;
  kidFinishTimeMs: number | null;
  aiFinishTimeMs: number | null;
  round: number;
  totalRounds: number;
  kidWins: number;
  aiWins: number;
  ties: number;
  roundResults: Array<{ round: number; winner: "Kid" | "AI" | "Tie" | "None"; kidTimeMs: number | null; aiTimeMs: number | null }>;
  betweenRounds: boolean;
  countdownActive: boolean;
}

interface RacePolicyEval {
  evalEpisodes: number;
  successRate: number;
  avgStepsOnSuccess: number;
  avgStepsAll: number;
  successCount: number;
}

interface RacePolicySnapshot {
  key: string;
  algorithm: AlgorithmType;
  mazeName: string;
  trainEpisodes: number;
  trainedAt: number;
  eval: RacePolicyEval;
  agent: RLAgent;
  source: "demo" | "race";
}

function makeAgent(algorithm: AlgorithmType): RLAgent {
  if (algorithm === "Random") return new RandomAgent();
  if (algorithm === "Q-learning") return new QLearningAgent();
  if (algorithm === "SARSA") return new SarsaAgent();
  if (algorithm === "Expected SARSA") return new ExpectedSarsaAgent();
  return new DoubleQLearningAgent();
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {

  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("App root not found");

  const mazes = await loadBuiltinMazes();
  const sharedMaze = decodeMazeFromUrl(new URL(window.location.href).searchParams.get("maze"));
  if (sharedMaze) {
    mazes.unshift({ ...sharedMaze, name: `${sharedMaze.name} (Shared)` });
  }

  let currentMaze = cloneMaze(mazes[0]);
  let editor = new MazeEditor(currentMaze);

  // --- LAYOUT ENGINE ---
  let currentMode: AppMode = "LEARN";

  const tutorial = new TutorialSystem();

  const hintIcon = (text: string): HTMLSpanElement => {
    const el = document.createElement("span");
    el.className = "hint-icon";
    el.textContent = "?";
    el.title = text;
    el.dataset.tip = text;
    el.setAttribute("aria-label", text);
    el.tabIndex = 0;
    return el;
  };

  // 1. Navbar
  const header = document.createElement("header");
  header.className = "app-header";
  const title = document.createElement("h1");
  title.textContent = "Neural Maze Runner";

  const schoolBtn = document.createElement("button");
  schoolBtn.className = "action-btn small";
  schoolBtn.textContent = "❓ Help";
  schoolBtn.title = "Open help and walkthrough";
  schoolBtn.onclick = () => tutorial.start();

  const privacyLink = document.createElement("a");
  privacyLink.className = "header-link";
  privacyLink.href = "/privacy.html";
  privacyLink.target = "_blank";
  privacyLink.rel = "noopener noreferrer";
  privacyLink.textContent = "Privacy & Safety";
  privacyLink.setAttribute("aria-label", "Open privacy and safety notice in a new tab");

  const subtitle = document.createElement("div");
  subtitle.className = "header-extras";
  subtitle.append(schoolBtn, privacyLink);

  header.append(title, subtitle);

  const navBar = document.createElement("nav");
  navBar.className = "mode-nav";
  navBar.setAttribute("aria-label", "Main app sections");
  navBar.setAttribute("role", "tablist");

  const modes: { key: AppMode; label: string; desc: string }[] = [
    { key: "LEARN", label: "MISSIONS", desc: "Academy" },
    // LAB and ARCADE are now merged into MISSIONS
    { key: "SCIENCE", label: "SCIENCE", desc: "Experiment" },
    { key: "CHALLENGE", label: "CHALLENGE", desc: "Race AI" },
  ];

  const panelByMode: Record<AppMode, string> = {
    LEARN: "learn-panel",
    LAB: "lab-panel",
    ARCADE: "arcade-panel",
    SCIENCE: "science-panel",
    CHALLENGE: "challenge-panel",
  };

  const modeOrder = modes.map((mode) => mode.key);
  const modeTabs = new Map<AppMode, HTMLButtonElement>();
  modes.forEach(m => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = `${m.key.toLowerCase()}-tab`;
    tab.className = "nav-tab";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panelByMode[m.key]);
    tab.setAttribute("aria-selected", m.key === currentMode ? "true" : "false");
    tab.tabIndex = m.key === currentMode ? 0 : -1;
    if (m.key === currentMode) tab.classList.add("active");

    const label = document.createElement("strong");
    label.textContent = m.label;
    const desc = document.createElement("span");
    desc.textContent = m.desc;

    tab.append(label, desc);
    tab.onclick = () => setAppMode(m.key);
    tab.onkeydown = (event) => {
      const idx = modeOrder.indexOf(m.key);
      if (idx < 0) return;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const nextMode = modeOrder[(idx + 1) % modeOrder.length];
        const nextTab = modeTabs.get(nextMode);
        if (!nextTab) return;
        setAppMode(nextMode);
        nextTab.focus();
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const nextMode = modeOrder[(idx - 1 + modeOrder.length) % modeOrder.length];
        const nextTab = modeTabs.get(nextMode);
        if (!nextTab) return;
        setAppMode(nextMode);
        nextTab.focus();
      }
    };
    navBar.append(tab);
    modeTabs.set(m.key, tab);
  });

  // 2. Mode Containers
  const learnContainer = document.createElement("div");
  learnContainer.id = panelByMode.LEARN;
  learnContainer.className = "mode-container layout-learn active";
  learnContainer.setAttribute("role", "tabpanel");
  learnContainer.setAttribute("aria-labelledby", "learn-tab");

  const labContainer = document.createElement("div");
  labContainer.id = panelByMode.LAB;
  labContainer.className = "mode-container layout-lab";
  labContainer.style.display = "none"; // Merged into Learn
  labContainer.setAttribute("role", "tabpanel");

  const arcadeContainer = document.createElement("div");
  arcadeContainer.id = panelByMode.ARCADE;
  arcadeContainer.className = "mode-container";
  arcadeContainer.style.display = "none"; // Merged into Learn
  arcadeContainer.setAttribute("role", "tabpanel");

  const scienceContainer = document.createElement("div");
  scienceContainer.id = panelByMode.SCIENCE;
  scienceContainer.className = "mode-container layout-data";
  scienceContainer.setAttribute("role", "tabpanel");
  scienceContainer.setAttribute("aria-labelledby", "science-tab");

  const challengeContainer = document.createElement("div");
  challengeContainer.id = panelByMode.CHALLENGE;
  challengeContainer.className = "mode-container layout-race";
  challengeContainer.setAttribute("role", "tabpanel");
  challengeContainer.setAttribute("aria-labelledby", "challenge-tab");

  // We append them all to keep logic working, but some are hidden
  app.append(header, navBar, learnContainer, labContainer, arcadeContainer, scienceContainer, challengeContainer);

  // --- UNIFIED DASHBOARD SETUP (Mission Control) ---
  const unifiedContainer = document.createElement("div");
  unifiedContainer.className = "layout-unified";

  const areaMain = document.createElement("div");
  areaMain.className = "unified-main";

  const arcadePlayback = document.createElement("div");
  arcadePlayback.className = "unified-playback";

  const areaMap = document.createElement("div");
  areaMap.className = "unified-map";
  const mapLabel = document.createElement("div");
  mapLabel.textContent = "TACTICAL MAP";
  mapLabel.style.cssText = "position: absolute; top: 5px; left: 10px; font-size: 0.7rem; color: #aaa; pointer-events: none; z-index: 10;";
  areaMap.append(mapLabel);

  const areaCharts = document.createElement("div");
  areaCharts.className = "unified-charts";

  unifiedContainer.append(areaMain, areaMap, areaCharts);
  // unifiedContainer is now injected into LearnPanel via threeViewer argument logic if needed, 
  // or we need to ensure threeViewer.root is the right element.
  // Actually, threeViewer.root is the specific viewer. 

  // We need to ensure the controls are NOT appended to 'control-panel' directly if we want to move them.
  // The ControlsPanel class appends itself to 'controls-panel' by ID? 
  // Let's check ControlsPanel implementation later if needed. For now, we pass the root.

  // -- LEARN MODE (MISSIONS) --
  const threeWrap = document.createElement("div");
  threeWrap.className = "three-wrap";
  const threeViewer = new ThreeMazeViewer(threeWrap, currentMaze);

  // Shared 2D Canvas (Used in Lab and Mission Cockpit)
  const viewerPanel = document.createElement("section");
  viewerPanel.className = "panel viewer-panel";
  const canvas = document.createElement("canvas");
  viewerPanel.append(canvas);

  const controls = createControls(mazes);
  const dashboard = new Dashboard();
  dashboard.setCompactMode(true);

  const progression = new ProgressionManager();
  const adaptiveCoach = new AdaptiveMissionCoach(LEVELS);
  const academyHud = new AcademyHUD(adaptiveCoach);
  app.append(academyHud.root);

  // -- STORY MODE DEFAULT --
  document.body.classList.add("story-mode");

  const learnPanel = new LearnPanel(
    progression,
    adaptiveCoach,
    (id: number) => {
      // Use the new data-only loader so we stay in LEARN mode (Cockpit)
      loadMissionData(id);
    },
    (levelId: number) => {
      const plan = adaptiveCoach.chooseCoachPlan(levelId);
      loadMissionData(plan.levelId);
      controls.algorithmSelect.value = plan.algorithm;
      controls.episodesInput.value = String(plan.episodes);
      controls.speedSelect.value = plan.speed;
      updateRaceButtonState();
      setStatus(
        `Coach plan ready: ${plan.algorithm}, ${plan.episodes} episodes, ${plan.speed} speed. Press Watch Learning.`
      );
    },
    (levelId: number) => {
      const plan = adaptiveCoach.chooseCoachPlan(levelId);
      loadMissionData(levelId);
      controls.algorithmSelect.value = plan.algorithm;
      controls.episodesInput.value = String(plan.episodes);
      controls.speedSelect.value = plan.speed;
      updateRaceButtonState();
      setStatus(`Starting guided lesson demo: ${plan.algorithm}, ${plan.episodes} episodes.`);
      void runDemo();
    },
    () => {
      academyHud.setMission(null);
    },
    controls,
    threeWrap,
    viewerPanel,
    dashboard,
    (levelId: number, badge: string) => {
      refreshChallengeMazeOptions();
      sound.play("levelComplete");
      confetti.fire();
      setStatus(`Mission ${levelId} complete. Arcade award unlocked.`);
      showMissionComplete(badge);
    }
  );
  learnContainer.append(learnPanel.root);

  // New helper: Loads data but stays in current view (for Cockpit)
  function loadMissionData(id: number) {
    const level = LEVELS.find(l => l.id === id);
    if (!level) return;
    currentLevelId = id;
    academyHud.setMission(level);
    const layout = loadLevel(id);
    applyMaze(layout);
  }

  // Old helper: Loads data AMD switches to LAB view
  function loadMissionIntoLab(id: number) {
    loadMissionData(id);
    setAppMode("LAB");
  }

  // -- LAB MODE --
  const labLeft = document.createElement("div");
  const labCenter = document.createElement("div");
  const labRight = document.createElement("div");
  labContainer.append(labLeft, labCenter, labRight);

  // Editor Panel
  const editorPanel = document.createElement("section");
  editorPanel.className = "panel";

  const editorTitle = document.createElement("h3");
  editorTitle.textContent = "Maze Editor ";
  editorTitle.append(hintIcon("Pick a tool, then click maze squares to edit."));
  const toolRow = document.createElement("div");
  toolRow.className = "editor-tools";

  const wallTool = document.createElement("button");
  wallTool.textContent = "Toggle Wall";
  const startTool = document.createElement("button");
  startTool.textContent = "Place Start";
  const goalTool = document.createElement("button");
  goalTool.textContent = "Place Goal";
  const saveMazeBtn = document.createElement("button");
  saveMazeBtn.textContent = "Save Edited Maze";

  toolRow.append(wallTool, startTool, goalTool, saveMazeBtn);
  const editorStatus = document.createElement("div");
  editorStatus.className = "editor-status";
  const shareRow = document.createElement("div");
  shareRow.className = "share-row";
  const shareInput = document.createElement("input");
  shareInput.readOnly = true;
  const copyShare = document.createElement("button");
  copyShare.textContent = "Copy Link";
  shareRow.append(shareInput, copyShare);
  editorPanel.append(editorTitle, toolRow, editorStatus, shareRow);

  labLeft.append(controls.root);
  labRight.append(editorPanel);

  // -- ARCADE MODE --

  const threeControls = document.createElement("div");
  threeControls.className = "three-controls";
  // (3D controls population logic moved here)

  const viewModeLabel = document.createElement("label");
  viewModeLabel.className = "field";
  const viewModeTitle = document.createElement("span");
  viewModeTitle.textContent = "3D View Mode ";
  const viewModeSelect = document.createElement("select");
  ["orbit", "top", "first"].forEach((mode) => {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = mode === "first" ? "first person" : mode;
    viewModeSelect.append(option);
  });
  viewModeLabel.append(viewModeTitle, viewModeSelect);

  const zoomLabel = document.createElement("label");
  zoomLabel.className = "field";
  const zoomTitle = document.createElement("span");
  zoomTitle.textContent = "Zoom ";
  const zoomRange = document.createElement("input");
  zoomRange.type = "range";
  zoomRange.min = "0";
  zoomRange.max = "100";
  zoomRange.value = "35";
  zoomLabel.append(zoomTitle, zoomRange);

  const autoOrbitLabel = document.createElement("label");
  autoOrbitLabel.className = "inline-toggle";
  const autoOrbitToggle = document.createElement("input");
  autoOrbitToggle.type = "checkbox";
  autoOrbitToggle.checked = true;
  autoOrbitLabel.append(autoOrbitToggle, document.createTextNode("Auto Orbit "));

  threeControls.append(viewModeLabel, zoomLabel, autoOrbitLabel);

  let currentLevelId: number | null = null;
  const arcadeHero = document.createElement("section");
  arcadeHero.className = "panel";
  arcadeHero.append(threeWrap, threeControls);
  // Append unifiedContainer to arcadeContainer so it is part of the DOM
  arcadeContainer.append(arcadeHero, unifiedContainer);

  // -- DATA MODE --
  // Use the new ScienceFairPanel (Wizard)
  const experimentPanel = new ExperimentPanel();
  const sciencePanel = new ScienceFairPanel(experimentPanel);

  // Start button inside Step 4 (Runner) - logic moved to ScienceFairPanel construction?
  // No, ExperimentPanel has the runnerRoot. We need to hook up the start button logic if it's not self-contained.
  // ExperimentPanel creates runnerRoot but doesn't have the button? 
  // Wait, looking at main.ts lines 481-487, it was manually adding button to runnerRoot.
  // I should recreate that logic here or inside ExperimentPanel.
  // Ideally ExperimentPanel should own the button, but main.ts was injecting it.
  // Let's keep the injection here for now.

  const dataRunBtn = document.createElement("button");
  dataRunBtn.className = "btn-experiment big-run-btn";
  dataRunBtn.textContent = "🚀 START SCIENCE TEST";
  dataRunBtn.onclick = () => {
    // This button starts the experiment
    // We need to trigger the experiment run logic.
    // previously it was seemingly handled by `experimentPanel`? 
    // Wait, main.ts had logic for starting experiment? 
    // No, checking main.ts again... I might need to see where runExperiment logic is.
    // Ah, I missed where `dataRunBtn.onclick` was defined in the previous view. 
    // It wasn't defined in the snippet I saw! It just created the button.
    // I need to find the click handler for starting experiment.
  };

  experimentPanel.runnerRoot.append(dataRunBtn);

  // Append just the wizard root
  scienceContainer.append(sciencePanel.root);



  // -- RACE MODE --
  const raceViewPanel = document.createElement("section");
  raceViewPanel.className = "panel race-view-panel";
  const raceViewTitle = document.createElement("h3");
  raceViewTitle.textContent = "Race View";
  const raceViewGrid = document.createElement("div");
  raceViewGrid.className = "race-view-grid";
  const raceThreeSlot = document.createElement("div");
  raceThreeSlot.className = "race-three-slot";
  const raceMapSlot = document.createElement("div");
  raceMapSlot.className = "race-map-slot";
  raceViewGrid.append(raceThreeSlot, raceMapSlot);
  raceViewPanel.append(raceViewTitle, raceViewGrid);

  const racePanel = document.createElement("section");
  racePanel.className = "panel race-panel";
  const raceTitle = document.createElement("h3");
  raceTitle.textContent = "Race Challenge (Best of 3)";
  const raceHint = document.createElement("p");
  raceHint.textContent =
    "Use W/ArrowUp to go, A/ArrowLeft to turn left, D/ArrowRight to turn right. Kid gets a 1.5-second head start.";
  const raceMissionField = document.createElement("label");
  raceMissionField.className = "race-mission-field";
  const raceMissionLabel = document.createElement("span");
  raceMissionLabel.textContent = "Challenge Maze";
  const raceMissionSelect = document.createElement("select");
  raceMissionSelect.className = "race-mission-select";
  raceMissionField.append(raceMissionLabel, raceMissionSelect);
  const raceActions = document.createElement("div");
  raceActions.className = "race-actions";
  const raceStartBtn = document.createElement("button");
  raceStartBtn.className = "btn-race";
  raceStartBtn.textContent = "TRAIN + CHALLENGE AI";
  raceActions.append(raceStartBtn);
  const racePolicyInfo = document.createElement("p");
  racePolicyInfo.className = "race-policy-info";
  const raceCountdown = document.createElement("div");
  raceCountdown.className = "race-countdown";
  const raceScore = document.createElement("div");
  raceScore.className = "race-score";
  racePanel.append(raceTitle, raceHint, raceMissionField, raceActions, racePolicyInfo, raceCountdown, raceScore);
  challengeContainer.append(raceViewPanel, racePanel);



  // Shared 2D Canvas (Used in Lab)
  // viewerPanel and canvas defined early for LearnPanel access
  labCenter.append(viewerPanel);




  // Hook up run button to switch mode
  const originalRunDemo = controls.runDemoBtn.onclick;
  controls.runDemoBtn.onclick = (e) => {
    setAppMode("ARCADE");
    // Snap to grid/viewer on mobile
    unifiedContainer.scrollIntoView({ behavior: "smooth" });
    if (originalRunDemo) originalRunDemo.call(controls.runDemoBtn, e);
  };


  const topRenderer = new TopDownCanvasRenderer(canvas, currentMaze);
  const resizeTopRenderer = () => {
    topRenderer.resize(canvas.clientWidth || 800, canvas.clientHeight || 520);
  };
  resizeTopRenderer();


  if (!threeViewer.ready) {
    controls.threeToggle.checked = false;
    controls.threeToggle.disabled = true;
    viewModeSelect.disabled = true;
    zoomRange.disabled = true;
    autoOrbitToggle.disabled = true;
    controls.statusLine.textContent = "3D disabled on this browser/GPU. 2D mode still works.";
  } else {
    threeViewer.setViewMode("orbit");
    threeViewer.setZoomPercent(0.35);
    threeViewer.setAutoOrbit(true);
  }

  function setAppMode(mode: AppMode) {
    currentMode = mode;
    modeTabs.forEach((tab, key) => {
      const isActive = key === mode;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.tabIndex = isActive ? 0 : -1;
    });

    learnContainer.classList.toggle("active", mode === "LEARN");
    labContainer.classList.toggle("active", mode === "LAB");
    arcadeContainer.classList.toggle("active", mode === "ARCADE");
    scienceContainer.classList.toggle("active", mode === "SCIENCE");
    challengeContainer.classList.toggle("active", mode === "CHALLENGE");
    learnContainer.setAttribute("aria-hidden", mode === "LEARN" ? "false" : "true");
    labContainer.setAttribute("aria-hidden", mode === "LAB" ? "false" : "true");
    arcadeContainer.setAttribute("aria-hidden", mode === "ARCADE" ? "false" : "true");
    scienceContainer.setAttribute("aria-hidden", mode === "SCIENCE" ? "false" : "true");
    challengeContainer.setAttribute("aria-hidden", mode === "CHALLENGE" ? "false" : "true");

    // --- BUTTON VISIBILITY MANAGEMENT ---
    // Default: Reset everything
    controls.pauseBtn.style.display = "none";
    controls.resetBtn.style.display = "none";
    controls.runExperimentBtn.style.display = "none";
    controls.raceBtn.style.display = "none";
    controls.runDemoBtn.style.display = "none";
    controls.editToggle.style.display = "none";

    if (mode === "LEARN") {
      controls.runDemoBtn.textContent = "▶ Start Watch Learning";
      dashboard.setCompactMode(true);
    } else if (mode === "LAB") {
      controls.runDemoBtn.style.display = "inline-block";
      controls.editToggle.style.display = "inline-block";
      controls.runDemoBtn.textContent = "Watch Learning";
      dashboard.setCompactMode(false);
      const heading = controls.root.querySelector("h2");
      if (heading) heading.textContent = "Arcade Setup & Build ";
    } else if (mode === "ARCADE") {
      controls.pauseBtn.style.display = "inline-block";
      controls.resetBtn.style.display = "inline-block";
      controls.runDemoBtn.style.display = "inline-block"; // Allow restart
      controls.runDemoBtn.textContent = "Restart Learning";
      dashboard.setCompactMode(false);
    } else if (mode === "CHALLENGE") {
      controls.raceBtn.style.display = "inline-block";
      controls.runDemoBtn.style.display = "inline-block";
      controls.runDemoBtn.textContent = "Watch Learning First";
      dashboard.setCompactMode(false);
    } else if (mode === "SCIENCE") {
      dashboard.setCompactMode(true);
    }

    // --- REPARENTING LOGIC ---
    if (mode === "ARCADE") {
      // Move 3D View to Main
      areaMain.append(threeWrap, arcadePlayback);
      arcadeHero.append(threeControls);
      // Move 2D Canvas to Map
      areaMap.append(canvas);
      // Move Dashboard to Charts
      areaCharts.append(dashboard.root);

      // Add playback buttons to Arcade
      arcadePlayback.append(controls.pauseBtn, controls.resetBtn, controls.speedSelect);

      // Trigger Resizes
      setTimeout(() => {
        if (threeViewer.ready) threeViewer.resize(areaMain.clientWidth, areaMain.clientHeight);
        topRenderer.resize(areaMap.clientWidth, areaMap.clientHeight);
      }, 50);

    } else if (mode === "LAB") {
      // Restore 2D Canvas
      viewerPanel.append(canvas);
      arcadeHero.append(threeControls);
      resizeTopRenderer();
    } else if (mode === "CHALLENGE") {
      // Keep Challenge visuals aligned with the selected mission option.
      if (runMode !== "race") {
        applySelectedChallengeMaze(false);
      }

      // Background: 3D View (Full Cockpit Backdrop)
      raceThreeSlot.append(threeWrap);
      // HUD Top-Right: Tactical Minimap
      raceMapSlot.append(canvas);
      // [ZERO DISTRATION]: We don't append threeControls here anymore.
      // Racing only needs the first-person view.

      // The racePanel (Scoreboard) is already in dom, we just ensure it's visible or placed

      if (threeViewer.ready) {
        threeViewer.setViewMode("first");
      }

      setTimeout(() => {
        // High priority: Hero 3D immersive view
        if (threeViewer.ready) {
          threeViewer.resize(raceThreeSlot.clientWidth, raceThreeSlot.clientHeight);
        }
        // HUD Resize
        topRenderer.resize(raceMapSlot.clientWidth, raceMapSlot.clientHeight);
      }, 80);
    }

    applyLearnActionButtons();
    updateLearnLivePanels();
  }

  let runMode: RunMode = "idle";
  // Legacy journey vars removed
  let activeToken = 0;
  let paused = false;
  let raceState: RaceState | null = null;

  const sound = new SoundFx();

  // --- LANDING PAGE ---
  const landing = new LandingPage(async () => {
    console.log("Mission Initialized");
    await sound.resume();
    // Play a cool start sound
    sound.startAmbient();
    sound.bell();
  });
  app.appendChild(landing.root);
  const confetti = new ConfettiSystem();
  sound.setEnabled(controls.soundToggle.checked);

  const racePolicyCache = new Map<string, RacePolicySnapshot>();
  const RACE_EVAL_EPISODES = 20;
  const RACE_MIN_SUCCESS_RATE = 70;

  function selectedRaceAlgorithm(): AlgorithmType {
    const selected = controls.algorithmSelect.value;
    if (
      selected === "Q-learning" ||
      selected === "SARSA" ||
      selected === "Expected SARSA" ||
      selected === "Double Q-learning"
    ) {
      return selected;
    }
    return "Q-learning";
  }

  function mazeFingerprint(layout: MazeLayout): string {
    const grid = layout.grid.map((row) => row.join("")).join("|");
    return `${layout.size}:${layout.start.row},${layout.start.col}:${layout.goal.row},${layout.goal.col}:${grid}`;
  }

  function racePolicyKey(layout: MazeLayout, algorithm: AlgorithmType): string {
    return `${algorithm}:${mazeFingerprint(layout)}`;
  }

  function currentRacePolicy(): RacePolicySnapshot | null {
    const snapshot = racePolicyCache.get(racePolicyKey(currentMaze, selectedRaceAlgorithm())) ?? null;
    if (!snapshot) return null;
    if (snapshot.source === "demo") {
      return snapshot;
    }
    const minTrainEpisodes = currentMaze.size === 11 ? 220 : 120;
    const requiredTrainEpisodes = Math.max(minTrainEpisodes, getEpisodes());
    if (snapshot.trainEpisodes < requiredTrainEpisodes) {
      return null;
    }
    return snapshot;
  }

  function raceStepThreshold(layout: MazeLayout): number {
    const env = new MazeEnv(layout);
    const shortest = analyzeMaze(layout).shortestPathLength;
    if (shortest == null) {
      return env.maxSteps * 0.9;
    }
    return Math.min(env.maxSteps * 0.9, shortest * 2.8 + 6);
  }

  function formatRacePolicySummary(snapshot: RacePolicySnapshot): string {
    return [
      `${snapshot.algorithm} ready`,
      `success ${snapshot.eval.successRate.toFixed(0)}%`,
      `avg steps ${snapshot.eval.avgStepsOnSuccess.toFixed(1)}`,
    ].join(" | ");
  }

  function setRacePolicyInfo(text: string): void {
    racePolicyInfo.textContent = text;
  }

  function raceNeedsMissionTraining(): boolean {
    return !progression.isCleared(1);
  }

  function getNextRaceJourneyMission(): LevelDef {
    const unlocked = progression.getUnlockedLevels().sort((a, b) => a - b);
    const targetLevelId = unlocked.find((id) => !progression.isCleared(id)) ?? unlocked[0] ?? LEVELS[0]?.id ?? 1;
    return LEVELS.find((level) => level.id === targetLevelId) ?? LEVELS[0];
  }

  function showRaceJourneyModal(): void {
    const existing = document.querySelector(".race-journey-overlay");
    if (existing) {
      existing.remove();
    }

    const mission = getNextRaceJourneyMission();
    const coachPlan = adaptiveCoach.chooseCoachPlan(mission.id);
    const recommendedAlgorithm = coachPlan.algorithm === "Random" ? "Q-learning" : coachPlan.algorithm;
    const recommendedEpisodes = Math.max(50, coachPlan.episodes);
    const recommendedSpeed: RunSpeed = "slow";

    const overlay = document.createElement("div");
    overlay.className = "mission-overlay race-journey-overlay";
    const modal = document.createElement("div");
    modal.className = "mission-modal race-journey-modal";
    overlay.append(modal);

    const title = document.createElement("h1");
    title.textContent = "Race Locked: Train Your AI First";
    const subtitle = document.createElement("p");
    subtitle.className = "race-journey-subtitle";
    subtitle.textContent =
      "Before Challenge mode, complete one mission where you watch the AI learn and improve.";

    const steps = document.createElement("ol");
    steps.className = "race-journey-steps";
    const stepTexts = [
      `Open Mission ${mission.id}: ${mission.title}.`,
      `Run Watch Learning with ${recommendedAlgorithm} for ${recommendedEpisodes} episodes at slow speed.`,
      "Come back to Challenge and press Race Trained AI.",
    ];
    for (const text of stepTexts) {
      const item = document.createElement("li");
      item.textContent = text;
      steps.append(item);
    }

    const coachTip = document.createElement("p");
    coachTip.className = "race-journey-coach-tip";
    coachTip.textContent = "Coach tip: write one observation while the AI trains so the student stays engaged.";

    const actions = document.createElement("div");
    actions.className = "race-journey-actions";
    const goBtn = document.createElement("button");
    goBtn.className = "btn-primary-action";
    goBtn.textContent = `Go To Mission ${mission.id}`;
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Maybe Later";
    actions.append(goBtn, closeBtn);

    const close = () => overlay.remove();
    closeBtn.onclick = close;
    overlay.onclick = (event) => {
      if (event.target === overlay) {
        close();
      }
    };

    goBtn.onclick = () => {
      close();
      setAppMode("LEARN");
      const opened = learnPanel.openMission(mission.id);
      if (!opened) {
        learnPanel.returnToSagaMap();
      }
      controls.algorithmSelect.value = recommendedAlgorithm;
      controls.episodesInput.value = String(recommendedEpisodes);
      controls.speedSelect.value = recommendedSpeed;
      updateRaceButtonState();
      setStatus(
        `Mission ${mission.id} loaded. Complete the Try It checklist and press Start Watch Learning, then return to Challenge to race.`
      );
      setTimeout(() => controls.runDemoBtn.focus(), 0);
    };

    modal.append(title, subtitle, steps, coachTip, actions);
    document.body.append(overlay);
  }

  function updateRaceButtonState(): void {
    if (raceNeedsMissionTraining()) {
      const mission = getNextRaceJourneyMission();
      controls.raceBtn.textContent = "Unlock Race In Mission";
      raceStartBtn.textContent = "Unlock Race In Mission";
      controls.raceBtn.title = `Complete Mission ${mission.id} and train an AI before racing.`;
      raceStartBtn.title = controls.raceBtn.title;
      setRacePolicyInfo(
        `Race is locked until a mission is completed. Next step: Mission ${mission.id} (${mission.lesson}).`
      );
      return;
    }

    const snapshot = currentRacePolicy();
    if (snapshot) {
      const readyLabel = snapshot.source === "demo" ? "Race Demo AI" : "Race Trained AI";
      controls.raceBtn.textContent = readyLabel;
      raceStartBtn.textContent = readyLabel;
      controls.raceBtn.title =
        snapshot.source === "demo"
          ? "Race the AI policy trained in your demo run."
          : "AI policy is ready. Start race.";
      raceStartBtn.title = controls.raceBtn.title;
      setRacePolicyInfo(
        `AI racer ready (${snapshot.source === "demo" ? "from Watch Learning" : "from Race training"}): ${formatRacePolicySummary(snapshot)}`
      );
      return;
    }

    controls.raceBtn.textContent = "Train + Challenge AI";
    raceStartBtn.textContent = "Train + Challenge AI";
    controls.raceBtn.title = "Train a policy first, then race.";
    raceStartBtn.title = controls.raceBtn.title;
    const selected = controls.algorithmSelect.value;
    if (selected === "Random") {
      setRacePolicyInfo("Random is guessing. Press Train + Race to build a smart AI racer.");
    } else if (selected === "All") {
      setRacePolicyInfo("Race uses one learning AI. Press Train + Race to start.");
    } else {
      setRacePolicyInfo(`No trained AI racer yet. Press Train + Race.`);
    }
  }

  function refreshChallengeMazeOptions(): void {
    const previousValue = raceMissionSelect.value;
    const unlockedIds = progression.getUnlockedLevels().sort((a, b) => a - b);
    const unlocked = new Set<number>(unlockedIds);
    const missionTrainingRequired = raceNeedsMissionTraining();
    raceMissionSelect.innerHTML = "";

    const availableLevels = missionTrainingRequired
      ? LEVELS.filter((level) => level.id === 1)
      : LEVELS.filter((level) => unlocked.has(level.id));

    for (const level of availableLevels) {
      const option = document.createElement("option");
      option.value = String(level.id);
      option.textContent = `Mission ${level.id}: ${level.maze.name}`;
      raceMissionSelect.append(option);
    }

    if (currentLevelId != null && availableLevels.some((level) => level.id === currentLevelId)) {
      raceMissionSelect.value = String(currentLevelId);
      return;
    }

    const hasPrevious = Array.from(raceMissionSelect.options).some((option) => option.value === previousValue);
    if (hasPrevious) {
      raceMissionSelect.value = previousValue;
      return;
    }

    const defaultMissionId = missionTrainingRequired
      ? 1
      : availableLevels[0]?.id ?? unlockedIds[0] ?? LEVELS[0]?.id;
    if (defaultMissionId != null) {
      raceMissionSelect.value = String(defaultMissionId);
    }
  }

  function applySelectedChallengeMaze(showStatus = true): boolean {
    const missionId = Number(raceMissionSelect.value);
    const level = LEVELS.find((item) => item.id === missionId);
    const missionAllowed = missionId === 1 || progression.isUnlocked(missionId);
    if (!level || !missionAllowed) {
      refreshChallengeMazeOptions();
      setStatus("That mission is locked. Clear earlier missions first.");
      return false;
    }

    const needsLoad = currentLevelId !== missionId || currentMaze.name !== level.maze.name;
    currentLevelId = missionId;
    editor.setEnabled(false);
    topRenderer.setEditorEnabled(false);
    controls.editToggle.textContent = "Edit Maze";
    if (needsLoad) {
      applyMaze(loadLevel(missionId));
    }
    if (showStatus) {
      setStatus(`Challenge maze set to Mission ${missionId}: ${level.maze.name}.`);
    }
    return true;
  }

  function getEpisodes(): number {
    return clampInt(Number(controls.episodesInput.value || 50), 1, 500);
  }

  function getTrials(): number {
    return clampInt(Number(controls.trialsInput.value || 3), 3, 20);
  }

  function getScienceAlgorithms(): AlgorithmType[] {
    const selected: AlgorithmType[] = [];
    if (sciencePanel.compareRandomCheck.checked) selected.push("Random");
    if (sciencePanel.compareQLearnCheck.checked) selected.push("Q-learning");
    if (sciencePanel.compareSarsaCheck.checked) selected.push("SARSA");
    if (sciencePanel.compareExpectedSarsaCheck.checked) selected.push("Expected SARSA");
    if (sciencePanel.compareDoubleQCheck.checked) selected.push("Double Q-learning");
    return selected;
  }

  function setStatus(text: string): void {
    controls.statusLine.textContent = text;
  }

  function updateTurboBadge(): void {
    const turboRunning = runMode === "demo" && controls.speedSelect.value === "turbo";
    controls.turboBadge.classList.toggle("active", turboRunning);
  }


  // setJourney removed

  function applyLearnActionButtons(): void {
    if (currentMode !== "LEARN") {
      controls.resetBtn.textContent = "Reset";
      controls.resetBtn.title = "Stop now and reset the maze view.";
      return;
    }

    if (runMode === "demo") {
      controls.runDemoBtn.style.display = "none";
      controls.pauseBtn.style.display = "inline-block";
      controls.resetBtn.style.display = "inline-block";
      controls.resetBtn.textContent = "Stop";
      controls.resetBtn.title = "Stop the current learning run.";
      return;
    }

    controls.runDemoBtn.style.display = "block";
    controls.pauseBtn.style.display = "none";
    controls.resetBtn.style.display = "none";
    controls.resetBtn.textContent = "Reset";
    controls.resetBtn.title = "Stop now and reset the maze view.";
  }

  function updateLearnLivePanels(): void {
    if (currentMode !== "LEARN") {
      controls.root.classList.remove("mission-running");
      controls.root.style.display = "block";
      dashboard.root.style.display = "block";
      return;
    }

    if (runMode === "demo") {
      controls.root.classList.add("mission-running");
      dashboard.root.style.display = "block";
      controls.root.style.display = "block";
      return;
    }

    controls.root.classList.remove("mission-running");
    controls.root.style.display = "block";
    dashboard.root.style.display = dashboard.hasData() ? "block" : "none";
  }

  function setRunningUi(mode: RunMode): void {
    const running = mode !== "idle";
    controls.runDemoBtn.disabled = running;
    controls.runExperimentBtn.disabled = running;
    controls.raceBtn.disabled = running;
    dataRunBtn.disabled = running;
    raceStartBtn.disabled = running;
    raceMissionSelect.disabled = running;
    controls.editToggle.disabled = running;
    controls.mazeSelect.disabled = running;
    controls.algorithmSelect.disabled = running;
    controls.episodesInput.disabled = running;
    controls.trialsInput.disabled = running;
    controls.speedSelect.disabled = false; // Always allow speed changes
    controls.pauseBtn.disabled = !running;
    controls.pauseBtn.textContent = paused ? "Resume" : "Pause";
    applyLearnActionButtons();
    updateLearnLivePanels();
    updateTurboBadge();
  }

  // switchTab logic removed - ScienceFairPanel handles wizard navigation internally.


  function updateShareUrl(): void {
    shareInput.value = encodeMazeToShareUrl(currentMaze);
  }

  function renderEditorSummary(): void {
    const status = editor.status();
    const parts = [
      `Valid: ${status.valid ? "Yes" : "No"}`,
      `Shortest path: ${status.analysis.shortestPathLength ?? "none"}`,
      `Dead ends: ${status.analysis.deadEnds}`,
      `Intersections: ${status.analysis.intersections}`,
      `Wall density: ${status.analysis.wallDensityPercent.toFixed(1)}%`,
    ];
    if (status.errors.length > 0) {
      parts.push(`Errors: ${status.errors.join(" | ")}`);
    }
    editorStatus.textContent = parts.join(" | ");
  }

  function setEditorToolUi(tool: "wall" | "start" | "goal"): void {
    editor.setTool(tool);
    wallTool.classList.toggle("tool-active", tool === "wall");
    startTool.classList.toggle("tool-active", tool === "start");
    goalTool.classList.toggle("tool-active", tool === "goal");
  }

  function syncRenderersToMaze(maze: MazeLayout): void {
    const startState = { row: maze.start.row, col: maze.start.col, dir: 1 } as const;
    topRenderer.setLayout(maze);
    topRenderer.setAgentState(startState);
    topRenderer.clearGhost();

    if (threeViewer.ready) {
      threeViewer.setLayout(maze);
      threeViewer.setAgentState(startState);
      threeViewer.clearGhost();
    }
  }

  function applyMaze(maze: MazeLayout): void {
    currentMaze = cloneMaze(maze);
    editor.setMaze(currentMaze);
    syncRenderersToMaze(currentMaze);
    dashboard.reset();
    updateShareUrl();
    renderEditorSummary();
    updateRaceButtonState();
    refreshChallengeMazeOptions();
  }

  updateShareUrl();
  setEditorToolUi("wall");
  renderEditorSummary();
  refreshChallengeMazeOptions();
  updateRaceButtonState();

  copyShare.onclick = async () => {
    try {
      await navigator.clipboard.writeText(shareInput.value);
      setStatus("Share link copied.");
    } catch {
      shareInput.select();
      document.execCommand("copy");
      setStatus("Share link copied.");
    }
  };

  function cancelRun(): void {
    activeToken += 1;
    sciencePanel.cancelPendingEpisodeObservation();
    sound.stopAmbient();
    raceCountdown.textContent = "";
    runMode = "idle";
    paused = false;
    raceState = null;
    setRunningUi(runMode);
  }

  async function gate(token: number): Promise<boolean> {
    while (paused && token === activeToken) {
      await sleep(65);
    }
    return token === activeToken;
  }

  async function runEpisode(options: EpisodeRunOptions): Promise<EpisodeMetrics | null> {
    const { token, env, agent, episodeIndex, totalEpisodes, onReset, onStep } = options;
    const rng = makeRng(options.rngSeed);

    agent.startEpisode(episodeIndex, totalEpisodes);
    const firstObs = env.reset();
    onReset?.();

    let stateKey = stateToKey(firstObs);
    let decision = agent.selectAction(stateKey, rng);

    for (let s = 0; s < env.maxSteps; s += 1) {
      if (!(await gate(token))) {
        return null;
      }

      const step = env.step(decision.action);
      const nextKey = stateToKey(step.observation);
      const nextDecision = step.done ? undefined : agent.selectAction(nextKey, rng);

      agent.update({
        stateKey,
        action: decision.action,
        reward: step.reward,
        nextStateKey: nextKey,
        done: step.done,
        nextAction: nextDecision?.action,
      });

      if (onStep) {
        await onStep({
          step,
          explored: decision.explored,
          stateKey,
          qValues: agent.qValues(stateKey),
          epsilon: agent.epsilon(),
        });
      }

      if (step.done) {
        return {
          episode: episodeIndex + 1,
          steps: step.stepCount,
          success: step.success,
          episodeReturn: step.episodeReturn,
        };
      }

      stateKey = nextKey;
      decision = nextDecision!;
    }

    return {
      episode: episodeIndex + 1,
      steps: env.stepCount,
      success: false,
      episodeReturn: env.episodeReturn,
    };
  }

  async function runDemo(): Promise<void> {
    cancelRun();
    const token = activeToken;
    runMode = "demo";
    setRunningUi(runMode);
    await sound.resume();

    const selected = controls.algorithmSelect.value;
    const algorithm = selected === "All" ? "Q-learning" : (selected as AlgorithmType);
    const episodes = getEpisodes();

    const agent = makeAgent(algorithm);
    const env = new MazeEnv(currentMaze);
    const demoSeed = 202601;
    agent.startTrial(demoSeed);

    setStatus(`Running demo: ${algorithm} for ${episodes} episodes.`);
    setStatus(`Learning mode: ${algorithm} live training for ${episodes} episodes.`);

    // Only switch to ARCADE if we are NOT in the Mission Cockpit (LEARN mode)
    if (currentMode !== "LEARN") {
      setAppMode("ARCADE");
    }

    // Keep visual worlds aligned with the active mission maze before training starts.
    syncRenderersToMaze(currentMaze);

    experimentPanel.setStatus("Learning mode is active: one algorithm, live visuals, step-by-step explain box.");
    dashboard.reset();

    const completed: EpisodeMetrics[] = [];
    const plateauWindow = 10;
    const autoStopEnabled = episodes >= 30;
    const autoStopMinEpisodes = Math.min(episodes, Math.max(18, plateauWindow * 2));
    const autoStopPatience = Math.max(8, Math.floor(episodes * 0.24));
    const minSuccessImprovement = 0.5; // percentage points
    const minReturnImprovement = 0.01; // environment return units
    let bestRollingSuccess = Number.NEGATIVE_INFINITY;
    let bestRollingReturn = Number.NEGATIVE_INFINITY;
    let stagnantEpisodes = 0;
    let earlyStopped = false;
    let earlyStopMessage = "";
    let lastAction: Action | null = null;
    let lastReward = 0;
    let lastExplored = false;
    let totalDecisionSteps = 0;
    let exploredDecisionSteps = 0;
    let bumpSteps = 0;
    let lastRunSpeed = controls.speedSelect.value as RunSpeed;

    for (let ep = 0; ep < episodes; ep += 1) {
      const speed = controls.speedSelect.value as RunSpeed;
      lastRunSpeed = speed;
      const delay = speedToDelay(speed);
      const stride = speedToDashboardStride(speed);
      const turbo = speed === "turbo";
      lastAction = null;
      lastReward = 0;
      lastExplored = false;
      const metrics = await runEpisode({
        token,
        env,
        agent,
        rngSeed: demoSeed + ep,
        episodeIndex: ep,
        totalEpisodes: episodes,
        onReset: () => {
          topRenderer.setAgentState(env.state);
          if (threeViewer.ready) {
            threeViewer.setAgentState(env.state);
          }
        },
        onStep: turbo
          ? (info) => {
            lastAction = info.step.action;
            lastReward = info.step.reward;
            lastExplored = info.explored;
            totalDecisionSteps += 1;
            if (info.explored) {
              exploredDecisionSteps += 1;
            }
            if (info.step.bump) {
              bumpSteps += 1;
            }
          }
          : async (info) => {
            lastAction = info.step.action;
            lastReward = info.step.reward;
            lastExplored = info.explored;
            totalDecisionSteps += 1;
            if (info.explored) {
              exploredDecisionSteps += 1;
            }
            if (info.step.bump) {
              bumpSteps += 1;
            }
            const speedMs = delay === 0 ? 70 : Math.max(70, delay);
            topRenderer.stepTransition(info.step, speedMs);
            if (threeViewer.ready && controls.threeToggle.checked) {
              threeViewer.stepTransition(info.step, speedMs);
            }

            if (info.step.action === 0 && !info.step.bump) sound.step();
            if (info.step.action !== 0) sound.turn();
            if (info.step.reward > 0.5) sound.reward();
            if (info.step.success) {
              sound.goal();
              confetti.explode(window.innerWidth / 2, window.innerHeight / 2);
            }

            if (info.step.stepCount % stride === 0 || info.step.done) {
              const stepView = {
                episode: ep + 1,
                step: info.step.stepCount,
                actionName: ACTION_NAMES[info.step.action],
                reward: info.step.reward,
                episodeReturn: info.step.episodeReturn,
                epsilon: info.epsilon,
                explored: info.explored,
                rollingSuccessLast10: rollingSuccess(completed, 10),
                rollingAvgStepsLast10: rollingAvgSteps(completed, 10),
                qValues: info.qValues,
              };
              dashboard.updateStep(
                stepView,
                explainText({
                  explored: info.explored,
                  reward: info.step.reward,
                  bump: info.step.bump,
                  goal: info.step.success,
                  maxSteps: info.step.maxStepsReached,
                })
              );
            }

            if (delay > 0) {
              await sleep(delay);
            }
          },
      });

      if (metrics == null) {
        return;
      }

      completed.push(metrics);
      dashboard.pushEpisodeReturn(ep + 1, metrics.episodeReturn);
      if (turbo) {
        topRenderer.setAgentState(env.state);
        if (threeViewer.ready && controls.threeToggle.checked) {
          threeViewer.setAgentState(env.state);
        }

        const qValues = agent.qValues(stateToKey(env.observation()));
        dashboard.updateStep(
          {
            episode: ep + 1,
            step: metrics.steps,
            actionName: lastAction == null ? "-" : ACTION_NAMES[lastAction],
            reward: lastReward,
            episodeReturn: metrics.episodeReturn,
            epsilon: agent.epsilon(),
            explored: lastExplored,
            rollingSuccessLast10: rollingSuccess(completed, 10),
            rollingAvgStepsLast10: rollingAvgSteps(completed, 10),
            qValues,
          },
          "Turbo mode: animations and per-step explain updates are disabled for faster training."
        );

        setStatus(`Turbo learning: ${algorithm} episode ${ep + 1}/${episodes}...`);
        // Let the browser paint between turbo episodes so mission mode visibly updates.
        await sleep(0);
      }
      if (!(await gate(token))) {
        return;
      }

      const rollingSuccessNow = rollingSuccess(completed, plateauWindow);
      const rollingReturnNow = rollingAvgReturn(completed, plateauWindow);
      let improved = false;
      if (rollingSuccessNow > bestRollingSuccess + minSuccessImprovement) {
        bestRollingSuccess = rollingSuccessNow;
        improved = true;
      }
      if (rollingReturnNow > bestRollingReturn + minReturnImprovement) {
        bestRollingReturn = rollingReturnNow;
        improved = true;
      }
      stagnantEpisodes = improved ? 0 : stagnantEpisodes + 1;

      if (autoStopEnabled && completed.length >= autoStopMinEpisodes && stagnantEpisodes >= autoStopPatience) {
        earlyStopped = true;
        earlyStopMessage = `Auto-stop: no clear improvement for ${stagnantEpisodes} episodes (${completed.length}/${episodes}).`;
        setStatus(`${earlyStopMessage} Tune settings or maze and run again.`);
        break;
      }
    }

    if (token !== activeToken) return;

    if (currentLevelId !== null) {
      adaptiveCoach.recordMissionRun(currentLevelId, {
        algorithm,
        episodes: completed.length,
        speed: lastRunSpeed,
        metrics: completed,
        exploreRate: totalDecisionSteps === 0 ? 0 : exploredDecisionSteps / totalDecisionSteps,
        bumpRate: totalDecisionSteps === 0 ? 0 : bumpSteps / totalDecisionSteps,
      });
      learnPanel.refresh();
    }

    if (!earlyStopped && algorithm !== "Random") {
      setStatus(`Demo complete. Checking ${algorithm} policy for race...`);
      const evalEpisodes = 10;
      const evaluation = await evaluateGreedyPolicy(token, agent, evalEpisodes, demoSeed + 80000);
      if (evaluation == null) {
        return;
      }
      const snapshot: RacePolicySnapshot = {
        key: racePolicyKey(currentMaze, algorithm),
        algorithm,
        mazeName: currentMaze.name,
        trainEpisodes: episodes,
        trainedAt: Date.now(),
        eval: evaluation,
        agent,
        source: "demo",
      };
      racePolicyCache.set(snapshot.key, snapshot);
      updateRaceButtonState();
      setStatus(`Demo complete. You can now race this ${algorithm} AI.`);
    } else if (!earlyStopped) {
      updateRaceButtonState();
      setStatus("Demo complete. Random does not learn, so race still needs a trained AI.");
    } else {
      updateRaceButtonState();
      setStatus(earlyStopMessage);
    }

    runMode = "idle";
    setRunningUi(runMode);
  }

  async function runExperiment(): Promise<void> {
    if (editor.isEnabled()) {
      setStatus("Finish editing first. Save Edited Maze (or stop editing) before Run Experiment.");
      setAppMode("LAB");
      return;
    }

    // Prerequisite check removed - Wizard handles flow.
    // If we wanted to re-add it, we'd add it to ScienceFairPanel.

    cancelRun();
    const token = activeToken;
    runMode = "experiment";
    setRunningUi(runMode);

    const useScienceInputs = currentMode === "SCIENCE";
    const episodes = useScienceInputs
      ? clampInt(Number(sciencePanel.scienceEpisodesInput.value || 15), 1, 500)
      : getEpisodes();
    const trials = useScienceInputs
      ? clampInt(Number(sciencePanel.scienceTrialsInput.value || 3), 1, 20)
      : getTrials();
    const algorithms: AlgorithmType[] = useScienceInputs
      ? getScienceAlgorithms()
      : ["Random", "Q-learning", "SARSA", "Expected SARSA", "Double Q-learning"];
    if (algorithms.length === 0) {
      setStatus("Select at least one algorithm in Science Setup before starting the test.");
      runMode = "idle";
      setRunningUi(runMode);
      return;
    }
    if (useScienceInputs && algorithms.length < 3) {
      setStatus("Select at least 3 algorithms in Science Setup before starting the test.");
      runMode = "idle";
      setRunningUi(runMode);
      return;
    }

    controls.episodesInput.value = String(episodes);
    controls.trialsInput.value = String(trials);
    const totalWork = algorithms.length * trials * episodes;
    let completedWork = 0;

    setStatus(`Running experiment: ${algorithms.join(", ")} | ${trials} trials x ${episodes} episodes with episode logs.`);
    setAppMode("SCIENCE");
    experimentPanel.clearCsvExports();
    experimentPanel.setStatus(
      "Running fair test with required student checkpoints each episode."
    );
    experimentPanel.setProgress(0, totalWork, "Starting...");

    const rawRows: RawRow[] = [];
    const metricsByAlgorithm = new Map<string, EpisodeMetrics[][]>();
    for (const algorithm of algorithms) {
      metricsByAlgorithm.set(algorithm, []);
    }
    const algorithmSeedOffsets = new Map(
      algorithms.map((algorithm, idx) => [algorithm, (idx + 1) * 100_003] as const)
    );
    const scienceStepDelayMs = 180;
    const scienceAnimMs = 260;

    const seedBase = 8800;
    const liveAlgorithms = algorithms.slice(0, 3);
    experimentPanel.configureLiveComparison(liveAlgorithms);
    sciencePanel.beginEpisodeObservationSession(trials * episodes);
    const liveRenderers = liveAlgorithms.map((algorithm, index) => {
      const canvas = experimentPanel.getLiveComparisonCanvas(index);
      if (!canvas) return null;
      const renderer = new TopDownCanvasRenderer(canvas, currentMaze);
      const width = canvas.clientWidth || canvas.width || 300;
      const height = canvas.clientHeight || canvas.height || 300;
      renderer.resize(width, height);
      renderer.setLayout(currentMaze);
      renderer.setAgentState({ row: currentMaze.start.row, col: currentMaze.start.col, dir: 1 });
      experimentPanel.setLiveComparisonMessage(index, `${algorithm}: waiting for trial 1.`);
      return renderer;
    });

    const resizeLiveRenderers = () => {
      for (const renderer of liveRenderers) {
        if (!renderer) continue;
        const width = renderer.canvas.clientWidth || renderer.canvas.width || 300;
        const height = renderer.canvas.clientHeight || renderer.canvas.height || 300;
        renderer.resize(width, height);
      }
    };
    setTimeout(resizeLiveRenderers, 0);

    try {
      for (let trial = 1; trial <= trials; trial += 1) {
        const seed = seedBase + trial;
        setStatus(`Experiment: trial ${trial}/${trials} setup complete. Running side-by-side episode ${1}/${episodes}.`);

        const contexts = algorithms.map((algorithm) => {
          const algorithmSeed = seed + (algorithmSeedOffsets.get(algorithm) ?? 0);
          const agent = makeAgent(algorithm);
          const env = new MazeEnv(currentMaze);
          agent.startTrial(algorithmSeed);
          const displayIndex = liveAlgorithms.indexOf(algorithm);
          if (displayIndex >= 0) {
            const renderer = liveRenderers[displayIndex];
            renderer?.setLayout(currentMaze);
            renderer?.setAgentState({ row: currentMaze.start.row, col: currentMaze.start.col, dir: 1 });
            experimentPanel.setLiveComparisonMessage(displayIndex, `${algorithm}: trial ${trial}/${trials} ready.`);
          }
          return {
            algorithm,
            agent,
            env,
            displayIndex,
            metricsForTrial: [] as EpisodeMetrics[],
            algorithmSeed,
          };
        });

        for (let ep = 0; ep < episodes; ep += 1) {
          if (!(await gate(token))) {
            experimentPanel.setStatus("Experiment canceled.");
            experimentPanel.setProgress(completedWork, totalWork, "Canceled");
            return;
          }

          const detail = `trial ${trial}/${trials} | episode ${ep + 1}/${episodes}`;
          experimentPanel.setStatus(`Running ${detail} (three 2D views live)...`);
          setStatus(`Science mode running ${detail}.`);

          const episodeResults = await Promise.all(
            contexts.map(async (ctx) => {
              const displayIndex = ctx.displayIndex;
              const renderer = displayIndex >= 0 ? liveRenderers[displayIndex] : null;
              const metrics = await runEpisode({
                token,
                env: ctx.env,
                agent: ctx.agent,
                rngSeed: ctx.algorithmSeed + ep * 31,
                episodeIndex: ep,
                totalEpisodes: episodes,
                onReset: () => {
                  renderer?.setAgentState(ctx.env.state);
                },
                onStep: renderer
                  ? async (info) => {
                    renderer.stepTransition(info.step, scienceAnimMs);
                    const stepSnapshot: LiveStepSnapshot = {
                      algorithm: ctx.algorithm,
                      trial,
                      episode: ep + 1,
                      step: info.step.stepCount,
                      actionName: ACTION_NAMES[info.step.action],
                      reward: info.step.reward,
                      episodeReturn: info.step.episodeReturn,
                      epsilon: info.epsilon,
                      explored: info.explored,
                      rollingSuccessLast10: rollingSuccess(ctx.metricsForTrial, 10),
                      rollingAvgStepsLast10: rollingAvgSteps(ctx.metricsForTrial, 10),
                      qValues: info.qValues,
                    };
                    experimentPanel.updateLiveStepSnapshot(displayIndex, stepSnapshot);
                    await sleep(scienceStepDelayMs);
                  }
                  : undefined,
              });
              return { ctx, metrics };
            })
          );

          const snapshots: EpisodeObservationSnapshot[] = [];

          for (const result of episodeResults) {
            const { ctx, metrics } = result;
            if (metrics == null) {
              experimentPanel.setStatus("Experiment canceled.");
              experimentPanel.setProgress(completedWork, totalWork, "Canceled");
              return;
            }

            ctx.metricsForTrial.push(metrics);
            rawRows.push({
              algorithm: ctx.algorithm,
              maze_name: currentMaze.name,
              trial,
              seed: ctx.algorithmSeed,
              episode: ep + 1,
              steps: metrics.steps,
              success: metrics.success ? 1 : 0,
              episode_return: Number(metrics.episodeReturn.toFixed(4)),
            });

            completedWork += 1;

            if (ctx.displayIndex >= 0) {
              const liveSnapshot: LiveEpisodeSnapshot = {
                algorithm: ctx.algorithm,
                trial,
                episode: ep + 1,
                success: metrics.success,
                steps: metrics.steps,
                episodeReturn: metrics.episodeReturn,
              };
              experimentPanel.updateLiveEpisodeSnapshot(ctx.displayIndex, liveSnapshot);
            }
            snapshots.push({
              algorithm: ctx.algorithm,
              success: metrics.success,
              steps: metrics.steps,
              episodeReturn: metrics.episodeReturn,
            });
          }

          experimentPanel.setStatus(`Paused for student observation: ${detail}`);
          experimentPanel.setProgress(completedWork, totalWork, detail);
          setStatus(`Science mode paused at ${detail}. Write the episode checkpoint to continue.`);

          const history: EpisodeHistory[] = episodeResults.map(r => ({
            algorithm: r.ctx.algorithm,
            metrics: r.ctx.metricsForTrial
          }));

          const checkpointSaved = await sciencePanel.waitForEpisodeObservation({
            trial,
            totalTrials: trials,
            episode: ep + 1,
            totalEpisodes: episodes,
            snapshots,
            history,
          });

          if (!checkpointSaved || !(await gate(token))) {
            experimentPanel.setStatus("Experiment canceled.");
            experimentPanel.setProgress(completedWork, totalWork, "Canceled");
            return;
          }
        }

        for (const ctx of contexts) {
          metricsByAlgorithm.get(ctx.algorithm)?.push(ctx.metricsForTrial);
        }
      }
    } finally {
      for (const renderer of liveRenderers) {
        renderer?.destroy();
      }
    }

    const summaryRows = summarizeExperiment(currentMaze.name, episodes, trials, metricsByAlgorithm);
    const summaryByAlg = new Map(summaryRows.map((row) => [row.algorithm, row]));

    const successByEpisode = new Map<string, number[]>();
    const stepsByEpisode = new Map<string, number[]>();

    for (const [algorithm, trialsData] of metricsByAlgorithm.entries()) {
      successByEpisode.set(
        algorithm,
        aggregateEpisodeMeans(trialsData, (m) => (m.success ? 100 : 0)).map((v) => Number(v.toFixed(2)))
      );
      stepsByEpisode.set(
        algorithm,
        aggregateEpisodeMeans(trialsData, (m) => m.steps).map((v) => Number(v.toFixed(2)))
      );
    }

    experimentPanel.render({ successByEpisode, stepsByEpisode, summaryRows });

    const rawCsv = toCsv(
      ["algorithm", "maze_name", "trial", "seed", "episode", "steps", "success", "episode_return"],
      rawRows
    );
    const summaryCsv = toCsv(
      [
        "algorithm",
        "maze_name",
        "trials",
        "episodes",
        "avg_success_last10",
        "avg_steps_last10",
        "avg_return_last10",
        "avg_episodes_to_first_success",
      ],
      summaryRows
    );

    experimentPanel.setCsvExports(rawCsv, summaryCsv);
    sciencePanel.goToStep(5);

    const random = summaryByAlg.get("Random");
    const q = summaryByAlg.get("Q-learning");
    const sarsa = summaryByAlg.get("SARSA");
    const fullComparison =
      algorithms.includes("Random") && algorithms.includes("Q-learning") && algorithms.includes("SARSA");
    const improvementPass =
      fullComparison &&
      !!random &&
      !!q &&
      !!sarsa &&
      q.avg_success_last10 >= random.avg_success_last10 + 10 &&
      sarsa.avg_success_last10 >= random.avg_success_last10 + 10;

    if (token !== activeToken) return;
    experimentPanel.setProgress(totalWork, totalWork, "Complete");
    if (improvementPass) {
      // setJourney("experiment", "Experiment complete. Great data collected. Try Race vs AI next.");
      setStatus(
        "Experiment complete. Exports are ready in Step 5. Milestone check PASS: Q-learning and SARSA beat Random on success-last10."
      );
    } else if (fullComparison) {
      // setJourney("experiment", "Experiment complete. You can tweak maze/settings and run again.");
      setStatus(
        "Experiment complete. Exports are ready in Step 5. Milestone check WARN: improvement over Random was smaller than expected."
      );
    } else {
      setStatus(
        "Experiment complete. Exports are ready in Step 5. Milestone check skipped because not all baseline algorithms (Random, Q-learning, SARSA) were selected."
      );
    }
    runMode = "idle";
    setRunningUi(runMode);
  }

  async function evaluateGreedyPolicy(
    token: number,
    agent: RLAgent,
    episodes: number,
    seedBase: number
  ): Promise<RacePolicyEval | null> {
    const env = new MazeEnv(currentMaze);
    let successCount = 0;
    let totalSteps = 0;
    let stepsOnSuccess = 0;

    for (let ep = 0; ep < episodes; ep += 1) {
      if (!(await gate(token))) {
        return null;
      }

      env.reset();
      const rng = makeRng(seedBase + ep * 97);

      for (let stepIndex = 0; stepIndex < env.maxSteps; stepIndex += 1) {
        if (!(await gate(token))) {
          return null;
        }

        const stateKey = stateToKey(env.observation());
        const qValues = agent.qValues(stateKey);
        const allEqual = Math.max(...qValues) - Math.min(...qValues) < 1e-9;
        const action = allEqual ? rng.pick<Action>([0, 1, 2]) : agent.greedyAction(stateKey);
        const step = env.step(action);

        if (!step.done) {
          continue;
        }

        totalSteps += step.stepCount;
        if (step.success) {
          successCount += 1;
          stepsOnSuccess += step.stepCount;
        }
        break;
      }
    }

    return {
      evalEpisodes: episodes,
      successRate: (successCount / Math.max(1, episodes)) * 100,
      avgStepsOnSuccess: successCount === 0 ? Number.POSITIVE_INFINITY : stepsOnSuccess / successCount,
      avgStepsAll: totalSteps / Math.max(1, episodes),
      successCount,
    };
  }

  async function getOrTrainRacePolicy(token: number): Promise<RacePolicySnapshot | null> {
    const raceAlgorithm = selectedRaceAlgorithm();
    const key = racePolicyKey(currentMaze, raceAlgorithm);
    const minTrainEpisodes = currentMaze.size === 11 ? 220 : 120;
    const requestedTrainEpisodes = Math.max(minTrainEpisodes, getEpisodes());
    const cached = racePolicyCache.get(key);
    if (cached && (cached.source === "demo" || cached.trainEpisodes >= requestedTrainEpisodes)) {
      const srcText = cached.source === "demo" ? "Demo" : "Race";
      setRacePolicyInfo(`AI Ready (${srcText}): ${formatRacePolicySummary(cached)}`);
      if (cached.source === "demo") {
        setStatus("Using AI policy from your latest demo run.");
      }
      return cached;
    }
    if (cached) {
      setStatus(
        `Existing policy trained for ${cached.trainEpisodes} episodes. Retraining to ${requestedTrainEpisodes} episodes.`
      );
    }

    const trainEpisodes = requestedTrainEpisodes;
    const trainSeed = 1977;
    const agent = makeAgent(raceAlgorithm);
    const trainEnv = new MazeEnv(currentMaze);
    agent.startTrial(trainSeed);

    const selected = controls.algorithmSelect.value;
    if (selected === "Random") {
      setStatus("Race mode uses Q-learning because Random does not learn a policy.");
    } else if (selected === "All") {
      setStatus("Race mode uses Q-learning policy from the selected maze.");
    } else {
      setStatus(`Training ${raceAlgorithm} policy for race (${trainEpisodes} episodes)...`);
    }
    raceScore.innerHTML = `<p><strong>AI Training:</strong> ${raceAlgorithm}, ${trainEpisodes} episodes</p>`;
    setRacePolicyInfo("AI is practicing this maze before race starts.");

    for (let ep = 0; ep < trainEpisodes; ep += 1) {
      const metrics = await runEpisode({
        token,
        env: trainEnv,
        agent,
        rngSeed: trainSeed + ep * 17,
        episodeIndex: ep,
        totalEpisodes: trainEpisodes,
      });
      if (metrics == null) {
        return null;
      }
      if (ep === 0 || (ep + 1) % 15 === 0 || ep + 1 === trainEpisodes) {
        setStatus(`Training race policy... ${ep + 1}/${trainEpisodes}`);
        raceScore.innerHTML = `<p><strong>AI Training:</strong> episode ${ep + 1}/${trainEpisodes}</p>`;
      }
    }

    const evalEpisodes = currentMaze.size === 11 ? 24 : RACE_EVAL_EPISODES;
    setStatus(`Checking if AI policy is race-ready (${evalEpisodes} test runs)...`);
    raceScore.innerHTML = `<p><strong>Validating:</strong> running ${evalEpisodes} fair test episodes...</p>`;
    const evaluation = await evaluateGreedyPolicy(token, agent, evalEpisodes, trainSeed + 50000);
    if (evaluation == null) {
      return null;
    }

    const stepCap = raceStepThreshold(currentMaze);
    const reasons: string[] = [];
    if (evaluation.successRate < RACE_MIN_SUCCESS_RATE) {
      reasons.push(`success ${evaluation.successRate.toFixed(0)}% is below ${RACE_MIN_SUCCESS_RATE}%`);
    }
    if (evaluation.successCount === 0 || evaluation.avgStepsOnSuccess > stepCap) {
      const stepsText = Number.isFinite(evaluation.avgStepsOnSuccess)
        ? evaluation.avgStepsOnSuccess.toFixed(1)
        : "n/a";
      reasons.push(`avg successful steps ${stepsText} is above ${stepCap.toFixed(1)}`);
    }

    if (reasons.length > 0) {
      const nextEpisodes = Math.min(
        500,
        Math.max(
          requestedTrainEpisodes + (currentMaze.size === 11 ? 90 : 60),
          Math.ceil(requestedTrainEpisodes * 1.4)
        )
      );
      controls.episodesInput.value = String(nextEpisodes);
      if (controls.algorithmSelect.value === "Random" || controls.algorithmSelect.value === "All") {
        controls.algorithmSelect.value = "Q-learning";
      }
      updateRaceButtonState();

      setRacePolicyInfo("AI needs more practice. Moving you to LAB so you can train and watch.");
      raceScore.innerHTML = `<p><strong>AI still learning. Moving to LAB mode for training.</strong></p>`;
      setStatus(
        `AI needs more practice. I set Episodes to ${nextEpisodes}. In LAB, press Watch Learning, then come back and press Train AI + Race.`
      );
      setAppMode("LAB");
      setTimeout(() => controls.runDemoBtn.focus(), 0);
      return null;
    }

    const snapshot: RacePolicySnapshot = {
      key,
      algorithm: raceAlgorithm,
      mazeName: currentMaze.name,
      trainEpisodes,
      trainedAt: Date.now(),
      eval: evaluation,
      agent,
      source: "race",
    };
    racePolicyCache.set(key, snapshot);
    updateRaceButtonState();
    setStatus(`AI ready for race: ${formatRacePolicySummary(snapshot)}.`);
    return snapshot;
  }

  function raceCloseness(env: MazeEnv): number {
    const distance =
      Math.abs(env.state.row - env.layout.goal.row) + Math.abs(env.state.col - env.layout.goal.col);
    const maxDistance = env.layout.size * 2;
    return 1 - Math.min(1, distance / maxDistance);
  }

  function raceScoreHtml(state: RaceState, winnerText: string): string {
    const kidTime = state.kidFinishTimeMs == null ? "-" : `${(state.kidFinishTimeMs / 1000).toFixed(2)}s`;
    const aiTime = state.aiFinishTimeMs == null ? "-" : `${(state.aiFinishTimeMs / 1000).toFixed(2)}s`;
    const roundLog = state.roundResults
      .map((result) => {
        let winnerDesc = result.winner === "None" ? "No winner" : `${result.winner} won`;
        if (result.winner === "Kid") winnerDesc = "Student won";
        if (result.winner === "AI") winnerDesc = "Teacher won";

        const kid = result.kidTimeMs == null ? "-" : `${(result.kidTimeMs / 1000).toFixed(2)}s`;
        const ai = result.aiTimeMs == null ? "-" : `${(result.aiTimeMs / 1000).toFixed(2)}s`;
        return `R${result.round}: ${winnerDesc} (St ${kid} / Te ${ai})`;
      })
      .join("<br/>");

    return [
      `<div class="badge kid"><strong>The Student</strong><br/>steps: ${state.kidSteps}<br/>bumps: ${state.kidBumps}<br/>time: ${kidTime}</div>`,
      `<div class="badge ai"><strong>The Teacher Bot</strong><br/>steps: ${state.aiSteps}<br/>bumps: ${state.aiBumps}<br/>time: ${aiTime}</div>`,
      `<p><strong>Round ${state.round}/${state.totalRounds}${state.betweenRounds ? " (next soon)" : ""}</strong></p>`,
      `<p><strong>Tournament score:</strong> Student ${state.kidWins} - Teacher ${state.aiWins} (ties ${state.ties})</p>`,
      roundLog ? `<p class="round-log">${roundLog}</p>` : "",
      `<p><strong>${winnerText}</strong></p>`,
    ].join("");
  }

  function setRaceTension(state: RaceState): void {
    sound.setAmbientTension(Math.max(raceCloseness(state.kidEnv), raceCloseness(state.aiEnv)));
  }

  function raceProgressMessage(state: RaceState): string {
    if (state.kidDone && !state.aiDone) {
      return state.kidSuccess
        ? "Student finished. Waiting for Teacher Bot to finish for time comparison..."
        : "Student reached step limit. Waiting for Teacher Bot to finish...";
    }
    if (state.aiDone && !state.kidDone) {
      return state.aiSuccess
        ? "Teacher finished. Keep moving to set your time for comparison."
        : "Teacher reached step limit. Keep moving to finish your run.";
    }
    return "Race in progress...";
  }

  function resolveRoundWinner(state: RaceState): { winner: "Kid" | "AI" | "Tie" | "None"; message: string } {
    if (state.kidSuccess && state.aiSuccess) {
      const kidT = state.kidFinishTimeMs ?? Number.MAX_SAFE_INTEGER;
      const aiT = state.aiFinishTimeMs ?? Number.MAX_SAFE_INTEGER;
      if (Math.abs(kidT - aiT) < 0.01) {
        return { winner: "Tie", message: "Round tie: both reached goal at the same speed." };
      }
      if (kidT < aiT) {
        return { winner: "Kid", message: "CLASS DISMISSED! You beat the teacher to the exit!" };
      }
      return { winner: "AI", message: "HOMEWORK TIME! The Teacher Bot reached the exit first." };
    }
    if (state.kidSuccess) {
      return { winner: "Kid", message: "FREEDOM! You escaped school before the teacher." };
    }
    if (state.aiSuccess) {
      return { winner: "AI", message: "HALL PASS REVOKED! The teacher caught you." };
    }
    return { winner: "None", message: "No one found the exit. The school is on lockdown!" };
  }

  function endTournament(state: RaceState): void {
    sound.stopAmbient();
    raceCountdown.textContent = "";
    const finalText =
      state.kidWins > state.aiWins
        ? "FINAL RESULT: Student wins the Great Escape! Best-of-3."
        : state.aiWins > state.kidWins
          ? "FINAL RESULT: Teacher wins. Extra homework for everyone!"
          : "FINAL RESULT: A tie. Back to the principal's office!";

    raceScore.innerHTML = raceScoreHtml(state, finalText);
    setStatus(finalText);

    runMode = "idle";
    paused = false;
    raceState = null;
    setRunningUi(runMode);
  }

  async function startRaceRound(state: RaceState): Promise<void> {
    state.kidEnv = new MazeEnv(currentMaze);
    state.aiEnv = new MazeEnv(currentMaze);
    state.kidEnv.reset();
    state.aiEnv.reset();

    state.active = false;
    state.betweenRounds = false;
    state.countdownActive = true;
    state.startAt = performance.now();
    state.kidSteps = 0;
    state.aiSteps = 0;
    state.kidBumps = 0;
    state.aiBumps = 0;
    state.kidSuccess = false;
    state.aiSuccess = false;
    state.kidDone = false;
    state.aiDone = false;
    state.kidFinishTimeMs = null;
    state.aiFinishTimeMs = null;

    topRenderer.setAgentState(state.kidEnv.state);
    topRenderer.setGhostState(state.aiEnv.state);
    if (threeViewer.ready) {
      threeViewer.setAgentState(state.kidEnv.state);
      threeViewer.setGhostState(state.aiEnv.state);
    }

    // setJourney("race", `Race round ${state.round}/${state.totalRounds} is starting.`);

    for (const count of [3, 2, 1]) {
      if (state.token !== activeToken || runMode !== "race" || raceState !== state) {
        return;
      }
      raceCountdown.textContent = `${count}`;
      sound.bell();
      raceScore.innerHTML = raceScoreHtml(state, `School Bell in ${count}...`);
      setStatus(`The School Escape: Round ${state.round} starts in ${count}...`);
      await sleep(700);
    }
    raceCountdown.textContent = "GO!";
    await sleep(250);
    raceCountdown.textContent = "";

    state.active = true;
    state.countdownActive = false;
    state.startAt = performance.now();
    setRaceTension(state);
    raceScore.innerHTML = raceScoreHtml(
      state,
      `Round started. Kid head start: ${(KID_HEADSTART_MS / 1000).toFixed(1)}s. Move now!`
    );
    setStatus(
      `Race round ${state.round}/${state.totalRounds} started. Kid head start ${(KID_HEADSTART_MS / 1000).toFixed(1)}s.`
    );

    setTimeout(() => {
      if (state.token !== activeToken || runMode !== "race" || raceState !== state || !state.active) {
        return;
      }
      void raceAiLoop(state);
    }, KID_HEADSTART_MS);
  }

  function finishRaceRound(state: RaceState): void {
    state.active = false;
    state.countdownActive = false;
    const result = resolveRoundWinner(state);
    if (result.winner === "Kid") state.kidWins += 1;
    if (result.winner === "AI") state.aiWins += 1;
    if (result.winner === "Tie") state.ties += 1;
    state.roundResults.push({
      round: state.round,
      winner: result.winner,
      kidTimeMs: state.kidFinishTimeMs,
      aiTimeMs: state.aiFinishTimeMs,
    });

    if (state.round < state.totalRounds && state.token === activeToken && runMode === "race") {
      state.betweenRounds = true;
      raceScore.innerHTML = raceScoreHtml(state, `${result.message} Next round in 2 seconds.`);
      setStatus(`Round ${state.round} complete. Next round loading...`);
      setTimeout(() => {
        if (state.token !== activeToken || runMode !== "race" || raceState !== state) {
          return;
        }
        state.round += 1;
        void startRaceRound(state);
      }, 2000);
      return;
    }

    endTournament(state);
  }

  async function raceAiLoop(state: RaceState): Promise<void> {
    let lastStateKey = "";
    let repeatedStateCount = 0;

    while (state.active && state.token === activeToken) {
      if (!(await gate(state.token))) return;

      const ob = state.aiEnv.observation();
      const stateKey = stateToKey(ob);
      if (stateKey === lastStateKey) {
        repeatedStateCount += 1;
      } else {
        repeatedStateCount = 0;
        lastStateKey = stateKey;
      }
      const qValues = state.policyAgent.qValues(stateKey);
      const allEqual = Math.max(...qValues) - Math.min(...qValues) < 1e-9;
      const forceEscape = repeatedStateCount >= 8;
      const action = forceEscape
        ? state.aiRng.pick<Action>([0, 1, 2])
        : allEqual
          ? state.aiRng.pick<Action>([0, 1, 2])
          : state.policyAgent.greedyAction(stateKey);
      if (forceEscape) {
        repeatedStateCount = 0;
      }
      const step = state.aiEnv.step(action);
      state.aiSteps = step.stepCount;
      if (step.bump) state.aiBumps += 1;

      const raceSpeed = 150;
      topRenderer.stepGhostTransition(step, raceSpeed);
      if (threeViewer.ready && controls.threeToggle.checked) {
        threeViewer.stepGhostTransition(step, raceSpeed);
      }

      if (step.success && !state.aiSuccess) {
        state.aiSuccess = true;
        state.aiFinishTimeMs = performance.now() - state.startAt;
      }
      if (step.success || step.maxStepsReached) {
        state.aiDone = true;
      }

      setRaceTension(state);
      const message = raceProgressMessage(state);
      raceScore.innerHTML = raceScoreHtml(state, message);

      if (state.aiDone) {
        if (state.kidDone) {
          finishRaceRound(state);
        } else {
          setStatus(message);
        }
        return;
      }

      await sleep(170);
    }
  }

  async function startRaceMode(): Promise<void> {
    if (editor.isEnabled()) {
      setStatus("Finish editing first. Save Edited Maze (or stop editing) before race.");
      setAppMode("LAB");
      return;
    }

    if (!applySelectedChallengeMaze(false)) {
      return;
    }

    if (raceNeedsMissionTraining()) {
      setAppMode("CHALLENGE");
      showRaceJourneyModal();
      setStatus("Race is locked until one mission is completed with AI training.");
      return;
    }

    cancelRun();
    const token = activeToken;
    runMode = "race";
    paused = false;
    setAppMode("CHALLENGE");
    setRunningUi(runMode);
    await sound.resume();
    const policySnapshot = await getOrTrainRacePolicy(token);
    if (token !== activeToken) return;
    if (!policySnapshot) {
      runMode = "idle";
      setRunningUi(runMode);
      return;
    }

    raceState = {
      token,
      active: false,
      kidEnv: new MazeEnv(currentMaze),
      aiEnv: new MazeEnv(currentMaze),
      policyAgent: policySnapshot.agent,
      aiRng: makeRng(2888),
      startAt: 0,
      kidSteps: 0,
      aiSteps: 0,
      kidBumps: 0,
      aiBumps: 0,
      kidSuccess: false,
      aiSuccess: false,
      kidDone: false,
      aiDone: false,
      kidFinishTimeMs: null,
      aiFinishTimeMs: null,
      round: 1,
      totalRounds: 3,
      kidWins: 0,
      aiWins: 0,
      ties: 0,
      roundResults: [],
      betweenRounds: false,
      countdownActive: false,
    };
    raceScore.innerHTML = `<p><strong>AI Ready:</strong> ${formatRacePolicySummary(policySnapshot)}</p>`;
    setRacePolicyInfo(`Racing ${policySnapshot.algorithm} policy on ${policySnapshot.mazeName}.`);
    sound.startAmbient();
    void startRaceRound(raceState);
  }

  function onKidAction(action: Action): void {
    const state = raceState;
    if (!state || !state.active || state.kidDone) return;

    const step = state.kidEnv.step(action);
    state.kidSteps = step.stepCount;
    if (step.bump) state.kidBumps += 1;

    if (action === 0 && !step.bump) sound.step();
    if (action !== 0) sound.turn();
    if (step.bump) sound.bump();
    if (step.success) {
      sound.goal();
      confetti.explode(window.innerWidth / 2, window.innerHeight / 2);
    }

    const speed = 120;
    topRenderer.stepTransition(step, speed);
    if (threeViewer.ready && controls.threeToggle.checked) {
      threeViewer.stepTransition(step, speed);
    }

    if (step.success && !state.kidSuccess) {
      state.kidSuccess = true;
      state.kidFinishTimeMs = performance.now() - state.startAt;
    }
    if (step.success || step.maxStepsReached) {
      state.kidDone = true;
    }

    setRaceTension(state);
    const message = raceProgressMessage(state);
    raceScore.innerHTML = raceScoreHtml(state, message);

    if (state.kidDone && state.aiDone) {
      finishRaceRound(state);
    } else if (state.kidDone) {
      setStatus(message);
    }
  }

  window.addEventListener("keydown", (event) => {
    if (!raceState || !raceState.active || paused) return;
    if (event.repeat) return;

    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
      event.preventDefault();
      onKidAction(0);
    }
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      event.preventDefault();
      onKidAction(1);
    }
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      event.preventDefault();
      onKidAction(2);
    }
  });

  topRenderer.onCellClick = (row, col) => {
    if (!editor.isEnabled()) return;
    if (row === 0 || col === 0 || row === currentMaze.size - 1 || col === currentMaze.size - 1) {
      setStatus("Border walls are locked so experiments stay fair and repeatable.");
      return;
    }
    editor.applyAt(row, col);
    const editingMaze = editor.getMaze();
    topRenderer.setLayout(editingMaze);
    if (threeViewer.ready) {
      threeViewer.setLayout(editingMaze);
    }
    renderEditorSummary();
  };

  controls.mazeSelect.onchange = () => {
    const selected = mazes.find((m) => m.name === controls.mazeSelect.value);
    if (!selected) return;
    currentLevelId = null;
    editor.setEnabled(false);
    controls.editToggle.textContent = "Edit Maze";
    applyMaze(selected);
    setAppMode("LAB");
    setStatus(`Loaded ${selected.name}.`);
  };

  raceMissionSelect.onchange = () => {
    applySelectedChallengeMaze(true);
  };

  // Legacy tab events removed

  controls.episodesInput.onchange = () => {
    updateRaceButtonState();
  };

  controls.editToggle.onclick = () => {
    const next = !editor.isEnabled();
    editor.setEnabled(next);
    topRenderer.setEditorEnabled(next);
    controls.editToggle.textContent = next ? "Stop Editing" : "Edit Maze";
    if (next) {
      editor.setMaze(currentMaze);
      setEditorToolUi("wall");
      topRenderer.setLayout(editor.getMaze());
      if (threeViewer.ready) {
        threeViewer.setLayout(editor.getMaze());
      }
      setStatus("Editor enabled. Use tool buttons and click cells.");
    } else {
      topRenderer.setLayout(currentMaze);
      if (threeViewer.ready) {
        threeViewer.setLayout(currentMaze);
      }
      setStatus("Editor disabled.");
    }
    renderEditorSummary();
  };

  wallTool.onclick = () => {
    setEditorToolUi("wall");
    setStatus("Editor tool: Toggle Wall");
  };
  startTool.onclick = () => {
    setEditorToolUi("start");
    setStatus("Editor tool: Place Start");
  };
  goalTool.onclick = () => {
    setEditorToolUi("goal");
    setStatus("Editor tool: Place Goal");
  };

  saveMazeBtn.onclick = () => {
    const status = editor.status();
    if (!status.valid) {
      setStatus(`Cannot save maze: ${status.errors[0]}`);
      renderEditorSummary();
      return;
    }
    applyMaze(editor.getMaze());
    editor.setEnabled(false);
    topRenderer.setEditorEnabled(false);
    controls.editToggle.textContent = "Edit Maze";
    setStatus("Edited maze saved.");
  };

  controls.threeToggle.onchange = () => {
    if (!threeViewer.ready) return;
    // threePanel.style.display = controls.threeToggle.checked ? "block" : "none";
    threeViewer.setEnabled(controls.threeToggle.checked);
  };

  viewModeSelect.onchange = () => {
    if (!threeViewer.ready) return;
    const mode = viewModeSelect.value as ThreeViewMode;
    threeViewer.setViewMode(mode);
    const firstPerson = mode === "first";
    zoomRange.disabled = firstPerson;
    autoOrbitToggle.disabled = firstPerson;
  };

  zoomRange.oninput = () => {
    if (!threeViewer.ready) return;
    threeViewer.setZoomPercent(Number(zoomRange.value) / 100);
  };

  autoOrbitToggle.onchange = () => {
    if (!threeViewer.ready) return;
    threeViewer.setAutoOrbit(autoOrbitToggle.checked);
  };

  controls.soundToggle.onchange = () => {
    sound.setEnabled(controls.soundToggle.checked);
    if (controls.soundToggle.checked && runMode === "race") {
      void sound.resume().then(() => sound.startAmbient());
    }
    setStatus(controls.soundToggle.checked ? "Sound enabled." : "Sound muted.");
  };

  controls.speedSelect.onchange = () => {
    updateTurboBadge();
  };

  controls.runDemoBtn.onclick = () => {
    void runDemo();
  };

  controls.runExperimentBtn.onclick = () => {
    // legacy check removed
    void runExperiment();
  };

  dataRunBtn.onclick = () => {
    // legacy check removed
    void runExperiment();
  };

  controls.raceBtn.onclick = () => {
    void startRaceMode();
  };

  raceStartBtn.onclick = () => {
    void startRaceMode();
  };

  controls.helpBtn.onclick = () => {
    // const showing = helpPanel.style.display !== "none";
    // helpPanel.style.display = showing ? "none" : "block";
    // controls.helpBtn.textContent = showing ? "Help" : "Hide Help";
    setStatus(
      "Watch Learning = one AI with live visuals. Science Test = all AIs, fair trials, charts + CSV for science fair."
    );
  };

  controls.pauseBtn.onclick = () => {
    if (runMode === "idle") return;
    paused = !paused;
    if (runMode === "race") {
      if (paused) {
        sound.stopAmbient();
      } else {
        sound.startAmbient();
      }
    }
    controls.pauseBtn.textContent = paused ? "Resume" : "Pause";
    updateLearnLivePanels();
    setStatus(paused ? "Paused." : "Resumed.");
  };

  controls.resetBtn.onclick = () => {
    cancelRun();
    applyMaze(currentMaze);
    raceScore.innerHTML = "";
    setAppMode(currentMode === "LEARN" ? "LEARN" : "LAB");
    setStatus("Reset complete.");
  };

  window.addEventListener("resize", () => {
    resizeTopRenderer();
  });

  function showMissionComplete(badge: string) {
    const overlay = document.createElement("div");
    overlay.className = "mission-overlay";
    overlay.innerHTML = `
      <div class="mission-modal">
        <h1>🏆 MISSION ACCOMPLISHED!</h1>
        <p>You earned the Badge:</p>
        <div class="badge-award big">🏅 ${badge}</div>
        <p>Training Complete. Mission Unlocked!</p>
        <button class="action-btn gold-btn">Continue to Academy</button>
      </div>
    `;
    document.body.append(overlay);
    const btn = overlay.querySelector("button") as HTMLButtonElement;
    btn.onclick = () => {
      overlay.remove();
      learnPanel.returnToSagaMap();
      academyHud.setMission(null);
      setAppMode("LEARN");
    };
  }

  setRunningUi(runMode);
  setStatus("Ready.");

  window.addEventListener("resize", () => {
    // Re-trigger Mode logic to force canvas resizes
    setAppMode(currentMode);
  });
}

void main().catch((err) => {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (app) {
    app.innerHTML = `<pre>App failed to start: ${String(err)}</pre>`;
  }
  console.error(err);
});
