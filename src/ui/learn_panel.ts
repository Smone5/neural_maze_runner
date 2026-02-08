import { LEVELS, LevelDef } from "../core/levels";
import { ProgressionManager } from "../core/progression";
import { AdaptiveMissionCoach, QuizGrade, QuizQuestion } from "../core/adaptive_coach";

interface LessonContent {
  title: string;
  image?: { src: string; alt: string; caption: string };
  hook: string;
  intro: string;
  bullets: string[];
  watchFor: string[];
  tryIt: string[];
  keyWords: Array<{ term: string; meaning: string }>;
  conceptIds: string[];
}

const LESSONS: Record<number, LessonContent> = {
  1: {
    title: "Mission 1 Lesson: Rewards",
    image: {
      src: "/academy/reward.svg",
      alt: "A trophy and star representing rewards.",
      caption: "Rewards are points that teach the AI what to do more often.",
    },
    hook: "You are training a robot with points. Points are called rewards.",
    intro:
      "In reinforcement learning, the robot tries actions and gets points. Over many tries, it learns which actions lead to the best total points.",
    bullets: [
      "A reward is a score the robot gets after each move.",
      "The goal gives a big reward, so the robot should learn to reach it.",
      "Small penalties for steps and bumps teach the robot to be efficient and avoid walls.",
      "One full try is called an episode (start → goal, or timeout).",
    ],
    watchFor: [
      "In the Dashboard, watch “Instant reward” change every step.",
      "Watch “Episode total reward” (return) go up when it reaches the goal.",
      "In the Explain Box, look for “Bump” messages when it hits a wall.",
    ],
    tryIt: [
      "Set Speed to Slow. Press Watch Learning. Watch rewards as it moves.",
      "Switch Algorithm to Random and run again. Does it improve over time?",
      "Switch back to Q-learning and run 50 episodes. Does success improve?",
    ],
    keyWords: [
      { term: "Reward", meaning: "Points earned after a move." },
      { term: "Penalty", meaning: "Negative points that teach what to avoid." },
      { term: "Episode", meaning: "One full attempt from start to finish." },
      { term: "Return", meaning: "Total points for an episode." },
    ],
    conceptIds: ["reward"],
  },
  2: {
    title: "Mission 2 Lesson: Exploration",
    image: {
      src: "/academy/explore.svg",
      alt: "A compass showing explore vs exploit.",
      caption: "Explore tries new moves. Exploit repeats the best move so far.",
    },
    hook: "To learn a maze, the robot must try new things before it can be smart.",
    intro:
      "The robot has two modes: explore (try something new) and exploit (use the best move it knows). Good learning uses both.",
    bullets: [
      "Exploring helps the robot discover new paths.",
      "Exploiting helps the robot use what it learned to win more often.",
      "Early on: more exploring. Later: more exploiting.",
    ],
    watchFor: [
      "In the Dashboard, watch “Explore vs exploit” flip between the two.",
      "Watch epsilon: it usually starts higher and slowly gets smaller.",
      "In the maze view, see if it repeats a good path more often later.",
    ],
    tryIt: [
      "Run 20 episodes and watch how often it explores.",
      "Run 50 episodes and see if it exploits more and succeeds more.",
      "Try SARSA and compare: does it feel more careful than Q-learning?",
    ],
    keyWords: [
      { term: "Explore", meaning: "Try a new move to learn more." },
      { term: "Exploit", meaning: "Use the best move you know." },
      { term: "Epsilon", meaning: "How often the robot explores (higher = more explore)." },
    ],
    conceptIds: ["explore"],
  },
  3: {
    title: "Mission 3 Lesson: Traps and Penalties",
    image: {
      src: "/academy/trap.svg",
      alt: "A warning sign showing a trap path in a maze.",
      caption: "Traps cause extra penalties (bumps, dead ends, wasted steps).",
    },
    hook: "Sometimes the path that looks best is a trap. Penalties help the robot learn that.",
    intro:
      "A trap is a path that looks good at first, but causes bumps, dead ends, or wasted steps. Negative rewards help the robot choose better routes later.",
    bullets: [
      "A short-looking path can still be worse if it causes penalties.",
      "The robot learns long-term value, not just the next step.",
      "As learning improves: success goes up and wasted steps go down.",
    ],
    watchFor: [
      "When it gets stuck, see if it eventually tries a different route.",
      "Watch for fewer wall bumps over time (Explain Box).",
      "Compare Episode total reward early vs late episodes.",
    ],
    tryIt: [
      "Run Q-learning for 60 episodes and watch if it stops choosing the trap route.",
      "Try SARSA for 60 episodes. Does it avoid bumps earlier?",
      "Pause mid-run and predict the next move. Then unpause and check.",
    ],
    keyWords: [
      { term: "Trap", meaning: "A choice that seems good but leads to bad outcomes." },
      { term: "Long-term", meaning: "Thinking about future rewards, not just the next point." },
    ],
    conceptIds: ["reward", "explore"],
  },
  4: {
    title: "Mission 4 Lesson: Q-Table Memory",
    image: {
      src: "/academy/qtable.svg",
      alt: "A table of action scores called a Q-table.",
      caption: "A Q-table stores scores for actions in each situation (state).",
    },
    hook: "Q-learning uses a memory table to remember good moves in each situation.",
    intro:
      "A Q-table is like a notebook of “best moves.” For each situation (state), it stores a score for each action (forward/left/right).",
    bullets: [
      "State = where the robot is + what it senses (like walls ahead/left/right).",
      "Q-values are the scores in the table. Higher score = better move.",
      "The table updates a tiny bit every step, over many episodes.",
    ],
    watchFor: [
      "Watch the Q-values bar chart change during training.",
      "When it repeats a good path, its Q-values for those moves are usually higher.",
      "If it explores less, it should repeat the highest-Q move more often.",
    ],
    tryIt: [
      "Run 50 episodes and watch Q-values become less “flat.”",
      "Try 80 episodes and see if the path becomes smoother and faster.",
      "Switch to Random and notice: Q-values do not meaningfully improve.",
    ],
    keyWords: [
      { term: "State", meaning: "The situation the robot is in right now." },
      { term: "Action", meaning: "A move choice (forward/left/right)." },
      { term: "Q-value", meaning: "A score for an action in a state." },
      { term: "Q-table", meaning: "The memory table of Q-values." },
    ],
    conceptIds: ["qtable"],
  },
  5: {
    title: "Mission 5 Lesson: Fair Science and Efficiency",
    image: {
      src: "/academy/science.svg",
      alt: "A beaker and chart representing fair science tests.",
      caption: "Science compares brains fairly by changing only one thing at a time.",
    },
    hook: "Now you become a scientist: compare brains fairly and prove learning happened.",
    intro:
      "A fair test changes one thing at a time (the brain type) and keeps everything else the same. That is how science comparisons work.",
    bullets: [
      "Independent variable: the algorithm (brain type).",
      "Control group: Random (no learning) to compare against.",
      "Keep constants the same: maze, rewards, max steps, episodes, trials.",
      "Good results: higher success with fewer steps (more efficient).",
    ],
    watchFor: [
      "In Science Test, watch the progress bar and algorithm-by-episode charts.",
      "Compare Random vs Q-learning vs SARSA success in the last 10 episodes.",
      "Look for consistency across trials (not just one lucky run).",
    ],
    tryIt: [
      "Run Science Test with default 50 episodes and 3 trials.",
      "Write one observation about what you saw while it ran.",
      "Answer: did the smart brains beat the control group?",
    ],
    keyWords: [
      { term: "Independent variable", meaning: "The thing you change on purpose." },
      { term: "Control group", meaning: "The baseline for comparison (Random)." },
      { term: "Trial", meaning: "A repeat of the same test for fairness." },
      { term: "Constant", meaning: "Something kept the same in every test." },
    ],
    conceptIds: ["control", "qtable"],
  },
  6: {
    title: "Mission 6 Lesson: Discount Factors",
    image: {
      src: "/academy/future.svg",
      alt: "A telescope looking at a distant goal.",
      caption: "Gamma (Discount) decides if the agent values now or later.",
    },
    hook: "Do you want one cookie now, or five cookies later? That's Gamma.",
    intro:
      "Discount factors (Gamma) tell the AI how much to care about future rewards. A high Gamma makes the AI patient, looking for the best path finish.",
    bullets: [
      "Low Gamma (e.g. 0.1): The AI is greedy for immediate points.",
      "High Gamma (e.g. 0.99): The AI plans for the long-term win.",
      "In big mazes, you need high Gamma to 'see' the goal from far away.",
    ],
    watchFor: [
      "Watch how long it takes for rewards near the goal to reach the start.",
      "See if the agent gets 'stuck' in loops if Gamma is too low.",
    ],
    tryIt: [
      "Run with standard settings. How does the agent handle the long corridor?",
      "Imagine if Gamma was 0. Would the agent ever reach the end?",
    ],
    keyWords: [
      { term: "Gamma", meaning: "The discount factor (0 to 1)." },
      { term: "Discounting", meaning: "Making future rewards worth less than current ones." },
    ],
    conceptIds: ["reward"],
  },
  7: {
    title: "Mission 7 Lesson: Learning Rate",
    image: {
      src: "/academy/learning_rate.svg",
      alt: "A dial turning from slow to fast learning.",
      caption: "Alpha (Learning Rate) is how much new info overwrites the old.",
    },
    hook: "How fast should you change your mind when you learn something new?",
    intro:
      "The Learning Rate (Alpha) controls how much the AI trusts new rewards versus its old memory. Too fast and it forgets, too slow and it never learns.",
    bullets: [
      "High Alpha: Quick to learn, but might be 'jittery' or unstable.",
      "Low Alpha: Stable and careful, but takes a long time to improve.",
      "In changing environments, higher Alpha helps the AI adapt faster.",
    ],
    watchFor: [
      "Watch the Q-values colors. Do they change rapidly or slowly?",
      "Does the agent solve the maze faster if you increase Alpha?",
    ],
    tryIt: [
      "Compare two runs. Does one 'lock in' a path faster than the other?",
    ],
    keyWords: [
      { term: "Alpha", meaning: "The learning rate (0 to 1)." },
      { term: "Stability", meaning: "How much the AI's behavior stays consistent." },
    ],
    conceptIds: ["qtable"],
  },
  8: {
    title: "Mission 8 Lesson: Sparse Secrets",
    image: {
      src: "/academy/sparse.svg",
      alt: "A desert with a single oasis in the distance.",
      caption: "Sparse rewards mean no feedback until the very end.",
    },
    hook: "Imagine walking in the dark until you find a light. That's sparse rewards.",
    intro:
      "In many problems, the AI doesn't get points for every step. It only gets points when it succeeds. This is called 'Sparse Rewards'.",
    bullets: [
      "Sparse rewards are realistic but very hard to learn.",
      "The agent must explore randomly for a long time before hitting the goal.",
      "Once it hits the goal once, the 'reward signal' starts to trickle back.",
    ],
    watchFor: [
      "The agent will look 'lost' for many episodes.",
      "Watch for the first time 'Success' flips from 0 to 1.",
    ],
    tryIt: [
      "Increase Episodes to 200. Does it find the goal eventually?",
      "Try 'Random' first. It will probably never win.",
    ],
    keyWords: [
      { term: "Sparse", meaning: "Spread out or rare; very little feedback." },
      { term: "Exploration Gap", meaning: "The time spent learning nothing until a goal is found." },
    ],
    conceptIds: ["explore", "reward"],
  },
  9: {
    title: "Mission 9 Lesson: Generalization",
    image: {
      src: "/academy/general.svg",
      alt: "A robot seeing common patterns in different rooms.",
      caption: "Generalization is applying old lessons to new places.",
    },
    hook: "If you learn to open one door, can you open all doors?",
    intro:
      "Smart AI doesn't just memorize one maze. It learns patterns that work in any maze. This is called Generalization.",
    bullets: [
      "Memorization: Knowing one specific path by heart.",
      "Generalization: Knowing that 'moving toward the goal' is usually good.",
      "True intelligence comes from generalizing, not just memorizing.",
    ],
    watchFor: [
      "Does the agent learn the second 'room' faster than the first?",
      "Look for similar Q-value patterns in both rooms.",
    ],
    tryIt: [
      "Run 100 episodes. Does the agent feel 'smarter' than in Mission 1?",
    ],
    keyWords: [
      { term: "Generalization", meaning: "Applying knowledge to new, unseen situations." },
      { term: "Overfitting", meaning: "Memorizing so well that you can't handle new things." },
    ],
    conceptIds: ["qtable", "control"],
  },
  10: {
    title: "Mission 10 Lesson: The Grandmaster Test",
    image: {
      src: "/academy/master.svg",
      alt: "A golden trophy with all previous lesson icons.",
      caption: "The ultimate challenge combines everything you've learned.",
    },
    hook: "You've trained your agent, you've been a scientist. Now, be a Grandmaster.",
    intro:
      "The final test is a massive maze with traps, long paths, and sparse rewards. You must tune every parameters to win.",
    bullets: [
      "Balance Alpha, Gamma, and Epsilon for maximum performance.",
      "Monitor the Science Dashboard to prove your agent is a pro.",
      "Remember the irony: while you coached the AI, the AI coach learned from YOU.",
    ],
    watchFor: [
      "The 'Final Reveal' once you clear this level!",
      "How all the charts work together to show a complete story.",
    ],
    tryIt: [
      "Run the full Science Test with all algorithms. Who wins?",
      "Can you beat the AI's best time in Race Mode?",
    ],
    keyWords: [
      { term: "Integration", meaning: "Combining multiple parts into a whole." },
      { term: "Grandmaster", meaning: "Someone who has mastered all aspects of a craft." },
    ],
    conceptIds: ["reward", "explore", "control", "qtable"],
  },
};

import { ControlsRefs } from "./controls";
import { Dashboard } from "./dashboard";

// ... existing code ...

export class LearnPanel {
  readonly root: HTMLElement;
  private onLevelSelect?: (id: number) => void;
  private onCoachPlan?: (levelId: number) => void;
  private onLessonDemo?: (levelId: number) => void;
  private onMissionExit?: () => void;
  private progression: ProgressionManager;
  private coach: AdaptiveMissionCoach;

  private activeLessonId: number | null = null;
  private lessonQuestions: QuizQuestion[] = [];
  private lessonAnswers: Record<string, number> = {};
  private lessonGrade: QuizGrade | null = null;

  private finalQuestions: QuizQuestion[] = [];
  private finalAnswers: Record<string, number> = {};
  private finalGrade: QuizGrade | null = null;

  private stars = 0;
  private rewardedLessons = new Set<number>();
  private rewardedTryIts = new Set<number>();
  private finalRewardGiven = false;
  private tryItChecks: Record<number, boolean[]> = {};

  private controls?: ControlsRefs;
  private viewerPanel?: HTMLElement;
  private mapPanel?: HTMLElement;
  private dashboard?: Dashboard;

  private static REWARD_KEY = "rl_school_rewards_v1";

  constructor(
    progression: ProgressionManager,
    coach: AdaptiveMissionCoach,
    onLevelSelect?: (id: number) => void,
    onCoachPlan?: (levelId: number) => void,
    onLessonDemo?: (levelId: number) => void,
    onMissionExit?: () => void,
    controls?: ControlsRefs,
    viewerPanel?: HTMLElement,
    mapPanel?: HTMLElement,
    dashboard?: Dashboard
  ) {
    this.progression = progression;
    this.coach = coach;
    this.onLevelSelect = onLevelSelect;
    this.onCoachPlan = onCoachPlan;
    this.onLessonDemo = onLessonDemo;
    this.onMissionExit = onMissionExit;
    this.controls = controls;
    this.viewerPanel = viewerPanel;
    this.mapPanel = mapPanel;
    this.dashboard = dashboard;
    this.loadRewards();
    this.syncProgressFromRewards();

    this.root = document.createElement("section");
    this.root.className = "panel learn-panel";
    this.render();
  }

  public refresh() {
    this.render();
  }

  public returnToSagaMap(): void {
    this.exitToSagaMap();
  }

  private viewMode: "SAGA" | "MISSION" = "SAGA";

  private render() {
    this.root.innerHTML = "";

    if (this.viewMode === "SAGA") {
      this.renderSagaView();
    } else {
      this.renderMissionCockpit();
    }
  }

  private renderSagaView() {
    const header = document.createElement("header");
    header.className = "learn-header";

    const badgesHtml = this.progression
      .getEarnedBadges()
      .map((b) => `<span class="hero-badge-mini" title="${b}">🏅</span>`)
      .join("");

    header.innerHTML = `
      <div class="saga-header-content">
        <h1>🎓 Neural Maze Runner</h1>
        <div class="saga-stats">
          <div class="stat-pill">⭐ ${this.stars} Stars</div>
          <div class="earned-badges-row">${badgesHtml}</div>
        </div>
      </div>
    `;

    const sagaMap = this.renderSagaMap();
    this.root.append(header, sagaMap);

    // Final Reveal logic check
    const allCleared = this.progression.getClearedLevels().length === LEVELS.length;
    if (allCleared) {
      const reveal = this.createLessonCard(
        "🎭 Final Reveal",
        "The Coach was learning from YOU all along."
      );
      reveal.classList.add("final-reveal-card");
      this.root.append(reveal, this.renderFinalQuizSection());
    }
  }

  private renderMissionCockpit() {
    if (this.activeLessonId === null) return;
    const levelId = this.activeLessonId;

    const cockpit = document.createElement("div");
    cockpit.className = "mission-cockpit";

    // 1. Sidebar (Lesson & Coach)
    const sidebar = document.createElement("aside");
    sidebar.className = "cockpit-sidebar";

    // Back Button
    const navRow = document.createElement("div");
    navRow.className = "cockpit-nav";
    const backBtn = document.createElement("button");
    backBtn.className = "btn-back-map";
    backBtn.innerHTML = "⬅ Back to Map";
    backBtn.onclick = () => this.exitToSagaMap();
    navRow.append(backBtn);
    sidebar.append(navRow);

    // Render the actual lesson content into sidebar
    const lessonContent = this.renderGuidedLessonSection(levelId);
    sidebar.append(lessonContent);

    // 2. Lab Area (Right side)
    const labArea = document.createElement("div");
    labArea.className = "cockpit-lab";

    const viewRow = document.createElement("div");
    viewRow.className = "cockpit-view-row";

    if (this.viewerPanel) {
      const threeSlot = document.createElement("div");
      threeSlot.className = "cockpit-view-3d";
      threeSlot.append(this.viewerPanel);
      viewRow.append(threeSlot);
    }
    if (this.mapPanel) {
      const mapSlot = document.createElement("div");
      mapSlot.className = "cockpit-view-2d";
      mapSlot.append(this.mapPanel);
      viewRow.append(mapSlot);
    }
    if (viewRow.childElementCount > 0) {
      labArea.append(viewRow);
    }
    if (this.dashboard) {
      this.dashboard.root.style.display = "block";
      const dashboardSlot = document.createElement("div");
      dashboardSlot.className = "cockpit-dashboard";
      dashboardSlot.append(this.dashboard.root);
      labArea.append(dashboardSlot);
    }
    if (this.controls) {
      this.controls.root.style.display = "block"; // Ensure visible
      labArea.append(this.controls.root);
    }

    cockpit.append(sidebar, labArea);
    this.root.append(cockpit);

    // Trigger resize for 3D view
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
  }

  private renderSagaMap(): HTMLElement {
    const container = document.createElement("div");
    container.className = "saga-map-container";

    const mapTitle = document.createElement("h2");
    mapTitle.textContent = "Your Journey";
    mapTitle.style.textAlign = "center";
    mapTitle.style.marginBottom = "2rem";

    // Create the winding path
    const pathContainer = document.createElement("div");
    pathContainer.className = "saga-path";

    LEVELS.forEach((lvl: LevelDef, index: number) => {
      const isUnlocked = this.progression.isUnlocked(lvl.id);
      const isCleared = this.progression.isCleared(lvl.id);
      const insight = this.coach.getMissionInsight(lvl.id);

      const node = document.createElement("div");
      node.className = "saga-node" + (isUnlocked ? " unlocked" : " locked") + (isCleared ? " cleared" : "");

      // Position logic for winding path (css will handle zigzag)
      // Visuals
      if (!isUnlocked) {
        node.innerHTML = `<span class="lock-icon">🔒</span>`;
      } else {
        node.innerHTML = `
           <div class="node-content">
             <span class="node-id">${lvl.id}</span>
             ${isCleared ? '<span class="node-stars">⭐⭐⭐</span>' : ''}
           </div>
         `;
        node.onclick = () => this.openMissionBriefing(lvl);
      }

      // Connector line (except last)
      if (index < LEVELS.length - 1) {
        const connector = document.createElement("div");
        connector.className = "saga-connector";
        if (isCleared && this.progression.isUnlocked(LEVELS[index + 1].id)) {
          connector.classList.add("connector-active");
        }
        node.append(connector);
      }

      pathContainer.append(node);
    });

    container.append(mapTitle, pathContainer);
    return container;
  }

  private openMissionBriefing(lvl: LevelDef) {
    // Create Modal
    const overlay = document.createElement("div");
    overlay.className = "mission-briefing-overlay";

    const modal = document.createElement("div");
    modal.className = "mission-briefing-modal"; // Re-use panel styles

    const isCleared = this.progression.isCleared(lvl.id);
    const insight = this.coach.getMissionInsight(lvl.id);

    modal.innerHTML = `
      <div class="briefing-header">
        <h2>Mission ${lvl.id}: ${lvl.title}</h2>
        <button class="btn-close-briefing">✕</button>
      </div>
      <div class="briefing-body">
        <div class="briefing-icon">🚀</div>
        <p class="briefing-desc">${lvl.hint}</p>
        
        <div class="briefing-stats">
            <div class="stat-box">
                <label>Lesson</label>
                <span>${lvl.lesson}</span>
            </div>
            <div class="stat-box">
                <label>Mastery</label>
                <span>${insight.masteryPercent}%</span>
            </div>
        </div>

        <div class="briefing-coach">
            <strong>Coach says:</strong> "${insight.coachTip}"
        </div>

        <div class="briefing-actions">
           <button class="btn-start-mission-action">
             ${isCleared ? "Replay Mission" : "Start Mission"}
           </button>
        </div>
      </div>
    `;

    // Bind events
    const closeBtn = modal.querySelector(".btn-close-briefing") as HTMLButtonElement;
    closeBtn.onclick = () => overlay.remove();

    const startBtn = modal.querySelector(".btn-start-mission-action") as HTMLButtonElement;
    startBtn.onclick = () => {
      this.startLesson(lvl.id);
      overlay.remove();
    };

    // Close on background click
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };

    overlay.append(modal);
    document.body.append(overlay);

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add("active");
      modal.classList.add("active");
    });
  }

  // Remove old renderMissionSection and renderCheckInSection
  // Keep renderGuidedLessonSection but maybe adjust styles


  private renderGuidedLessonSection(levelId: number): HTMLElement {
    const lesson = LESSONS[levelId] ?? LESSONS[1];
    if (this.lessonQuestions.length === 0) {
      this.lessonQuestions = this.coach.getQuestionsForConcepts(lesson.conceptIds, 2);
      this.lessonAnswers = {};
      this.lessonGrade = null;
    }
    if (!this.tryItChecks[levelId] || this.tryItChecks[levelId].length !== lesson.tryIt.length) {
      this.tryItChecks[levelId] = Array.from({ length: lesson.tryIt.length }, () => false);
    }

    const section = document.createElement("section");
    section.className = "guided-lesson-section";

    const title = document.createElement("h2");
    title.textContent = `📘 ${lesson.title}`;

    const hook = document.createElement("div");
    hook.className = "lesson-hook";
    hook.textContent = lesson.hook;

    const intro = document.createElement("p");
    intro.className = "guided-lesson-intro";
    intro.textContent = lesson.intro;

    const media = document.createElement("div");
    media.className = "lesson-media lesson-media--text-only";
    const mediaText = document.createElement("div");
    mediaText.className = "lesson-media-text";
    mediaText.append(intro);
    media.append(mediaText);

    /* Image removed per user request */
    // if (lesson.image) { ... }

    const keyTitle = document.createElement("h3");
    keyTitle.className = "lesson-subtitle";
    keyTitle.textContent = "Key Words";

    const keyGrid = document.createElement("div");
    keyGrid.className = "lesson-keyword-grid";
    lesson.keyWords.forEach((kw) => {
      const card = document.createElement("div");
      card.className = "lesson-keyword";
      card.innerHTML = `<strong>${kw.term}:</strong> <span>${kw.meaning}</span>`;
      keyGrid.append(card);
    });

    const bulletList = document.createElement("ul");
    bulletList.className = "guided-lesson-bullets";
    lesson.bullets.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      bulletList.append(li);
    });

    const watchTitle = document.createElement("h3");
    watchTitle.className = "lesson-subtitle";
    watchTitle.textContent = "What To Watch For On Screen";

    const watchList = document.createElement("ul");
    watchList.className = "lesson-watch-list";
    lesson.watchFor.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      watchList.append(li);
    });

    const tryTitle = document.createElement("h3");
    tryTitle.className = "lesson-subtitle";
    tryTitle.textContent = "Try It (Checklist)";

    const tryWrap = document.createElement("div");
    tryWrap.className = "lesson-try-wrap";

    const tryHint = document.createElement("p");
    tryHint.className = "lesson-try-hint";
    tryHint.textContent = "Check items as you try them. No pressure. This is practice, not a test.";
    tryWrap.append(tryHint);

    const tryList = document.createElement("div");
    tryList.className = "lesson-try-list";
    lesson.tryIt.forEach((item, idx) => {
      const row = document.createElement("label");
      row.className = "lesson-try-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!this.tryItChecks[levelId][idx];
      cb.onchange = () => {
        this.tryItChecks[levelId][idx] = cb.checked;
        const allDone = this.tryItChecks[levelId].every(Boolean);
        if (allDone && !!this.lessonGrade?.passed && !this.rewardedTryIts.has(levelId)) {
          this.rewardedTryIts.add(levelId);
          this.stars += 1;
          this.saveRewards();
        } else {
          this.saveRewards();
        }
        this.render();
      };

      const text = document.createElement("span");

      // Interactive matches
      if (item.includes("Set Speed to Slow") && this.controls) {
        text.innerHTML = `Set Speed to <span class="clickable-action" title="Click to set speed">Slow</span>. Press Watch Learning. Watch rewards as it moves.`;
        const action = text.querySelector(".clickable-action") as HTMLElement;
        if (action) {
          action.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.controls) {
              this.controls.speedSelect.value = "slow";
              action.classList.add("highlight-glow");
              setTimeout(() => action.classList.remove("highlight-glow"), 1000);
            }
          };
        }
      } else if (item.includes("Switch Algorithm to Random") && this.controls) {
        text.innerHTML = `Switch Algorithm to <span class="clickable-action" title="Click to set Random">Random</span> and run again. Does it improve over time?`;
        const action = text.querySelector(".clickable-action") as HTMLElement;
        if (action) {
          action.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.controls) {
              this.controls.algorithmSelect.value = "Random";
              action.classList.add("highlight-glow");
              setTimeout(() => action.classList.remove("highlight-glow"), 1000);
            }
          };
        }
      } else if (item.includes("Switch back to Q-learning") && this.controls) {
        text.innerHTML = `Switch back to <span class="clickable-action" title="Click to set Q-learning">Q-learning</span> and run 50 episodes. Does success improve?`;
        const action = text.querySelector(".clickable-action") as HTMLElement;
        if (action) {
          action.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.controls) {
              this.controls.algorithmSelect.value = "Q-learning";
              this.controls.episodesInput.value = "50";
              action.classList.add("highlight-glow");
              setTimeout(() => action.classList.remove("highlight-glow"), 1000);
            }
          };
        }
      } else if (item.includes("Run 20 episodes") && this.controls) {
        text.innerHTML = `Run <span class="clickable-action" title="Set to 20 episodes">20 episodes</span> and watch how often it explores.`;
        const action = text.querySelector(".clickable-action") as HTMLElement;
        if (action) {
          action.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.controls) {
              this.controls.episodesInput.value = "20";
              action.classList.add("highlight-glow");
              setTimeout(() => action.classList.remove("highlight-glow"), 1000);
            }
          };
        }
      } else if (item.includes("Run 50 episodes") && this.controls) {
        text.innerHTML = `Run <span class="clickable-action" title="Set to 50 episodes">50 episodes</span> and see if it exploits more and succeeds more.`;
        const action = text.querySelector(".clickable-action") as HTMLElement;
        if (action) {
          action.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.controls) {
              this.controls.episodesInput.value = "50";
              action.classList.add("highlight-glow");
              setTimeout(() => action.classList.remove("highlight-glow"), 1000);
            }
          };
        }
      } else if (item.includes("Try SARSA") && this.controls) {
        text.innerHTML = `Try <span class="clickable-action" title="Switch to SARSA">SARSA</span> and compare: does it feel more careful than Q-learning?`;
        const action = text.querySelector(".clickable-action") as HTMLElement;
        if (action) {
          action.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.controls) {
              this.controls.algorithmSelect.value = "SARSA";
              action.classList.add("highlight-glow");
              setTimeout(() => action.classList.remove("highlight-glow"), 1000);
            }
          };
        }
      } else if (item.includes("Dashboard") && this.dashboard) {
        // Highlight dashboard on hover or click of the word "Dashboard"
        text.innerHTML = item.replace("Dashboard", `<span class="clickable-action" title="Look at the dashboard panel">Dashboard</span>`);
        const action = text.querySelector(".clickable-action") as HTMLElement;
        if (action) {
          action.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.dashboard) {
              this.dashboard.root.classList.add("highlight-glow");
              setTimeout(() => this.dashboard?.root.classList.remove("highlight-glow"), 2000);
            }
          };
        }
      } else {
        text.textContent = item;
      }

      row.append(cb, text);
      tryList.append(row);
    });
    tryWrap.append(tryList);

    const tryReward = document.createElement("p");
    tryReward.className = "lesson-try-reward";
    const allTryDone = this.tryItChecks[levelId].every(Boolean);
    if (this.lessonGrade == null) {
      tryReward.textContent = "Tip: do the mini quiz, then do the checklist while watching the demo.";
    } else if (!this.lessonGrade.passed) {
      tryReward.textContent = allTryDone
        ? "Checklist done. Re-check the mini quiz to earn the ⭐ star."
        : "Do the guided demo, then re-check the mini quiz to earn the ⭐ star.";
    } else if (allTryDone) {
      tryReward.textContent = this.rewardedTryIts.has(levelId)
        ? "Checklist complete. ⭐ Star earned."
        : "Checklist complete.";
    } else {
      tryReward.textContent = "After the guided demo, check off what you tried.";
    }
    tryWrap.append(tryReward);

    const quizWrap = document.createElement("div");
    quizWrap.className = "guided-quiz-wrap";
    const quizTitle = document.createElement("h3");
    quizTitle.textContent = "Mini Quiz (2 questions)";
    quizWrap.append(quizTitle);

    this.lessonQuestions.forEach((q, qIndex) => {
      const block = document.createElement("div");
      block.className = "guided-question";
      const qLabel = document.createElement("p");
      qLabel.textContent = `${qIndex + 1}. ${q.prompt}`;
      block.append(qLabel);

      const opts = document.createElement("div");
      opts.className = "guided-options";
      q.options.forEach((opt, idx) => {
        const optBtn = document.createElement("button");
        optBtn.className = "guided-option-btn";
        if (this.lessonAnswers[q.questionId] === idx) {
          optBtn.classList.add("selected");
        }
        optBtn.textContent = opt;
        optBtn.onclick = () => {
          this.lessonAnswers[q.questionId] = idx;
          Array.from(opts.querySelectorAll("button")).forEach((btn, btnIdx) => {
            btn.classList.toggle("selected", btnIdx === idx);
          });
        };
        opts.append(optBtn);
      });
      block.append(opts);
      quizWrap.append(block);
    });

    const quizFeedback = document.createElement("p");
    quizFeedback.className = "guided-quiz-feedback";

    if (this.lessonGrade) {
      const scoreText = `Score: ${this.lessonGrade.score}/${this.lessonGrade.total}. ${this.lessonGrade.message}`;
      const reviewText = this.lessonGrade.reviewLines.length > 0
        ? ` Review: ${this.lessonGrade.reviewLines.join(" ")}`
        : "";
      quizFeedback.textContent = `${scoreText}${reviewText}`;
      quizFeedback.classList.toggle("correct", this.lessonGrade.passed);
      quizFeedback.classList.toggle("needs-review", !this.lessonGrade.passed);
    }

    const actionRow = document.createElement("div");
    actionRow.className = "guided-action-row";

    const submitBtn = document.createElement("button");
    submitBtn.className = "btn-check-lesson";
    submitBtn.textContent = "Check Lesson Quiz";
    submitBtn.onclick = () => {
      const submissions = this.lessonQuestions.map((q) => ({
        questionId: q.questionId,
        chosenIndex: this.lessonAnswers[q.questionId] ?? -1,
      }));
      const unanswered = submissions.some((s) => s.chosenIndex < 0);
      if (unanswered) {
        this.lessonGrade = {
          score: 0,
          total: this.lessonQuestions.length,
          passed: false,
          message: "No rush. Answer both questions and then check again.",
          reviewLines: [],
        };
        this.render();
        return;
      }

      this.lessonGrade = this.coach.gradeQuestionSet(submissions, 0.65);
      if (this.lessonGrade.passed && !this.rewardedLessons.has(levelId)) {
        this.rewardedLessons.add(levelId);
        this.stars += 1;
        this.saveRewards();
      }
      if (this.lessonGrade.passed) {
        const level = LEVELS.find((item) => item.id === levelId);
        if (level) {
          const maxLevelId = LEVELS[LEVELS.length - 1]?.id ?? level.id;
          this.progression.clearLevel(levelId, level.badge, maxLevelId);
        }
      }
      this.render();
    };

    const runBtn = document.createElement("button");
    runBtn.className = "btn-run-guided";
    // Unlock immediately per plan
    runBtn.textContent = "Start Guided Demo";
    runBtn.disabled = false;
    runBtn.onclick = () => {
      // Implicitly apply coach plan before running demo
      if (this.onCoachPlan) {
        this.onCoachPlan(levelId);
      }
      if (this.onLessonDemo) {
        this.onLessonDemo(levelId);
      }
    };

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn-close-lesson";
    closeBtn.textContent = "Close Lesson";
    closeBtn.onclick = () => this.exitToSagaMap();

    actionRow.append(submitBtn, runBtn, closeBtn);
    quizWrap.append(quizFeedback, actionRow);

    section.append(
      title,
      hook,
      media,
      keyTitle,
      keyGrid,
      bulletList,
      watchTitle,
      watchList,
      tryTitle,
      tryWrap,
      quizWrap
    );

    if (this.lessonGrade?.passed) {
      const explanation = document.createElement("p");
      explanation.className = "lab-mode-intro";
      explanation.innerHTML = `<strong>🎓 Nice work:</strong> Your mission controls are live on the right. Press <strong>Start Watch Learning</strong>.`;
      section.append(explanation);
    }

    return section;
  }

  private renderFinalQuizSection(): HTMLElement {
    const section = document.createElement("section");
    section.className = "final-quiz-section";

    if (this.finalQuestions.length === 0) {
      this.finalQuestions = this.coach.getQuestionsForConcepts(["reward", "explore", "control", "qtable", "discount", "alpha", "general"], 6);
      this.finalAnswers = {};
      this.finalGrade = null;
    }

    const title = document.createElement("h2");
    title.textContent = "🏁 Final Quiz (Gentle Mastery Check)";
    const subtitle = document.createElement("p");
    subtitle.textContent = "This checks what you learned. If you miss something, we guide you kindly.";
    section.append(title, subtitle);

    this.finalQuestions.forEach((q, idx) => {
      const block = document.createElement("div");
      block.className = "guided-question";
      block.innerHTML = `<p>${idx + 1}. ${q.prompt}</p>`;
      const opts = document.createElement("div");
      opts.className = "guided-options";
      q.options.forEach((opt, optIdx) => {
        const btn = document.createElement("button");
        btn.className = "guided-option-btn";
        if (this.finalAnswers[q.questionId] === optIdx) {
          btn.classList.add("selected");
        }
        btn.textContent = opt;
        btn.onclick = () => {
          this.finalAnswers[q.questionId] = optIdx;
          Array.from(opts.querySelectorAll("button")).forEach((node, nodeIdx) => {
            node.classList.toggle("selected", nodeIdx === optIdx);
          });
        };
        opts.append(btn);
      });
      block.append(opts);
      section.append(block);
    });

    const feedback = document.createElement("p");
    feedback.className = "guided-quiz-feedback";
    if (this.finalGrade) {
      const reviewText = this.finalGrade.reviewLines.length > 0
        ? ` Review suggestions: ${this.finalGrade.reviewLines.join(" ")}`
        : "";
      feedback.textContent = `Final score ${this.finalGrade.score}/${this.finalGrade.total}. ${this.finalGrade.message}${reviewText}`;
      feedback.classList.toggle("correct", this.finalGrade.passed);
      feedback.classList.toggle("needs-review", !this.finalGrade.passed);
    }

    const actions = document.createElement("div");
    actions.className = "guided-action-row";

    const gradeBtn = document.createElement("button");
    gradeBtn.className = "btn-check-lesson";
    gradeBtn.textContent = "Grade Final Quiz";
    gradeBtn.onclick = () => {
      const submissions = this.finalQuestions.map((q) => ({
        questionId: q.questionId,
        chosenIndex: this.finalAnswers[q.questionId] ?? -1,
      }));
      if (submissions.some((s) => s.chosenIndex < 0)) {
        this.finalGrade = {
          score: 0,
          total: this.finalQuestions.length,
          passed: false,
          message: "Take your time and answer all questions first.",
          reviewLines: [],
        };
        this.render();
        return;
      }

      this.finalGrade = this.coach.gradeQuestionSet(submissions, 0.75);
      if (this.finalGrade.passed && !this.finalRewardGiven) {
        this.finalRewardGiven = true;
        this.stars += 3;
        this.saveRewards();
      }
      this.render();
    };

    const retryBtn = document.createElement("button");
    retryBtn.className = "btn-next-checkin";
    retryBtn.textContent = "New Final Quiz Set";
    retryBtn.onclick = () => {
      this.finalQuestions = this.coach.getQuestionsForConcepts(["reward", "explore", "control", "qtable", "discount", "alpha", "general"], 6);
      this.finalAnswers = {};
      this.finalGrade = null;
      this.render();
    };

    actions.append(gradeBtn, retryBtn);
    section.append(feedback, actions);
    return section;
  }

  private startLesson(levelId: number): void {
    this.activeLessonId = levelId;
    this.viewMode = "MISSION"; // Switch to Cockpit

    // Notify MAIN to ensure level is loaded in the env (using new data-only loader)
    if (this.onLevelSelect) {
      this.onLevelSelect(levelId);
    }

    const lesson = LESSONS[levelId] ?? LESSONS[1];
    this.lessonQuestions = this.coach.getQuestionsForConcepts(lesson.conceptIds, 2);
    this.lessonAnswers = {};
    this.lessonGrade = null;
    this.render();
  }

  private exitToSagaMap(): void {
    this.activeLessonId = null;
    this.viewMode = "SAGA";
    this.lessonQuestions = [];
    this.lessonAnswers = {};
    this.lessonGrade = null;
    this.onMissionExit?.();
    this.render();
  }

  private loadRewards(): void {
    const raw = localStorage.getItem(LearnPanel.REWARD_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        stars?: number;
        rewardedLessons?: number[];
        rewardedTryIts?: number[];
        finalRewardGiven?: boolean;
        tryItChecks?: Record<string, boolean[]>;
      };
      this.stars = parsed.stars ?? 0;
      this.rewardedLessons = new Set(parsed.rewardedLessons ?? []);
      this.rewardedTryIts = new Set(parsed.rewardedTryIts ?? []);
      this.finalRewardGiven = !!parsed.finalRewardGiven;
      if (parsed.tryItChecks && typeof parsed.tryItChecks === "object") {
        this.tryItChecks = {};
        Object.entries(parsed.tryItChecks).forEach(([k, v]) => {
          const n = Number(k);
          if (Number.isFinite(n) && Array.isArray(v)) {
            this.tryItChecks[n] = v.map(Boolean);
          }
        });
      }
    } catch {
      // Ignore malformed reward cache.
    }
  }

  private syncProgressFromRewards(): void {
    const maxLevelId = LEVELS[LEVELS.length - 1]?.id ?? 1;
    for (const levelId of this.rewardedLessons) {
      const level = LEVELS.find((item) => item.id === levelId);
      if (level) {
        this.progression.clearLevel(levelId, level.badge, maxLevelId);
      }
    }
  }

  private saveRewards(): void {
    localStorage.setItem(
      LearnPanel.REWARD_KEY,
      JSON.stringify({
        stars: this.stars,
        rewardedLessons: Array.from(this.rewardedLessons),
        rewardedTryIts: Array.from(this.rewardedTryIts),
        finalRewardGiven: this.finalRewardGiven,
        tryItChecks: Object.fromEntries(Object.entries(this.tryItChecks).map(([k, v]) => [String(k), v])),
      })
    );
  }

  private createLessonCard(title: string, html: string): HTMLElement {
    const card = document.createElement("div");
    card.className = "learn-card";
    card.innerHTML = `
      <h3>${title}</h3>
      <p>${html}</p>
    `;
    return card;
  }
}
