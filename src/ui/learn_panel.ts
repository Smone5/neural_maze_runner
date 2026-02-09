import { LEVELS, LevelDef } from "../core/levels";
import { ProgressionManager } from "../core/progression";
import {
  AdaptiveMissionCoach,
  CheckInPrompt,
  CheckInResult,
  ConceptMasterySummary,
  QuizGrade,
  QuizQuestion,
} from "../core/adaptive_coach";

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

interface MissionScrollState {
  levelId: number;
  sidebarTop: number;
  sidebarLeft: number;
  labTop: number;
  labLeft: number;
  pageTop: number;
  pageLeft: number;
}

interface AiTutorQuestionPack {
  conceptId: string;
  conceptLabel: string;
  teachBlurb: string;
  question: string;
  options: string[];
  correctIndex: number;
  hint: string;
}

interface TutorMissionContext {
  missionId: number;
  title: string;
  hook: string;
  intro: string;
  keyFacts: string[];
  watchFor: string[];
  tryIt: string[];
  vocabulary: string[];
}

const LESSONS: Record<number, LessonContent> = {
  1: {
    title: "Mission 1 Lesson: Rewards",
    image: {
      src: "/academy/reward.svg",
      alt: "A trophy and star representing rewards.",
      caption: "Rewards are points that teach the AI what to do more often.",
    },
    hook: "You are teaching a robot using points. In AI, points are called rewards.",
    intro:
      "The robot tries moves and gets points after each move. Over many tries, it learns which moves give better total points.",
    bullets: [
      "A reward is points after one move.",
      "The goal gives a big reward, so reaching the goal is usually best.",
      "Every move has a small penalty, and wall bumps have an extra penalty.",
      "One full try is an episode (start to goal, or time runs out).",
      "Dashboard points are shown on a kid scale (x100), so numbers are easy to read.",
    ],
    watchFor: [
      "In the Dashboard, watch 'Points now' change every move.",
      "Watch 'Total points this try' during the run and when it reaches the goal.",
      "Watch 'Win rate (last 10 completed tries)'. Last 10 means the newest 10 tries.",
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
      "Explore means trying moves to gather new information.",
      "Exploit means using the best move learned so far.",
      "Early episodes usually have more exploring.",
      "Later episodes should show more exploiting and better results.",
    ],
    watchFor: [
      "Watch 'Robot mode' switch between Explore and Exploit.",
      "Watch 'Win rate (last 10 completed tries)' after 20, then 50 episodes.",
      "In the maze view, check if the robot repeats a good path more often later.",
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
      "A trap looks good at first, but causes bumps, dead ends, or wasted moves. Negative rewards help the robot avoid trap routes later.",
    bullets: [
      "A short-looking path can still be worse if it causes many penalties.",
      "The robot should learn to avoid walls, not just move fast.",
      "Better learning means higher win rate and fewer wasted moves.",
    ],
    watchFor: [
      "When it bumps walls, 'Points now' drops more (often around -6).",
      "Watch if 'Total points this try' becomes less negative over time.",
      "Watch if 'Win rate (last 10 completed tries)' goes up as it avoids traps.",
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
      "A Q-table is like a notebook of action scores. For each state, it stores how good forward, left, and right seem.",
    bullets: [
      "State means where the robot is and what it senses.",
      "Q-values are action scores. Bigger score usually means better move.",
      "The robot updates these scores little by little every step.",
      "Think of it like remembering which paths work best in a video game level.",
    ],
    watchFor: [
      "Watch 'AI guess scores (F/L/R)' change during training.",
      "Watch 'Robot chose' and see if it follows higher guess scores more often later.",
      "Compare with Random: guess scores stay near 0 / 0 / 0 because Random does not learn.",
    ],
    tryIt: [
      "Run 60 episodes and watch AI guess scores become less flat.",
      "Try 80 episodes and see if the path becomes smoother and faster.",
      "Switch to Random and notice: AI guess scores do not meaningfully improve.",
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
      "A fair test changes one thing at a time (algorithm) and keeps everything else the same. That is how we prove results are real.",
    bullets: [
      "Independent variable: the algorithm (brain type).",
      "Control group: Random (no learning) to compare against.",
      "Keep constants the same: maze, rewards, max steps, episodes, trials.",
      "Good results: higher success and fewer steps (more efficient).",
      "Use at least 3 trials so one lucky run does not trick you.",
    ],
    watchFor: [
      "In Step 4, watch each live card for 'Win rate (last 10)' and 'Avg steps on wins (last 10)'.",
      "In Step 5, read 'Learning Curve: Success by Episode'.",
      "Then compare 'Compare Success Last 10' and 'Compare Steps Last 10' together.",
    ],
    tryIt: [
      "Run Science Test with 15 episodes and at least 3 trials.",
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
      "Discount factor (Gamma) means how much future rewards matter. In this long maze, good learning needs patience, not just quick tiny gains.",
    bullets: [
      "Low Gamma behavior is greedy for right-now rewards.",
      "High Gamma behavior cares more about future rewards.",
      "In long mazes, future planning is important to reach the goal.",
      "It's like choosing: spend your allowance now, or save for something bigger later.",
      "This app does not expose a Gamma slider, so focus on reading behavior from the metrics.",
    ],
    watchFor: [
      "Early episodes may look messy. That is normal in a long maze.",
      "Watch 'Win rate (last 10 completed tries)' climb after enough training.",
      "Watch 'Total points this try' trend upward (less negative, then stronger wins).",
    ],
    tryIt: [
      "Run 80 episodes. How does the agent handle the long corridor?",
      "Switch Algorithm to Random and run again. Which one reaches the goal more often?",
      "Imagine Gamma = 0. Would the robot care about a far-away goal?",
    ],
    keyWords: [
      { term: "Gamma", meaning: "The discount factor (0 to 1)." },
      { term: "Discounting", meaning: "Making future rewards worth less than current ones." },
    ],
    conceptIds: ["discount", "reward"],
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
      "Learning rate (Alpha) controls how strongly each new result updates memory. Too high can be jumpy. Too low can be very slow.",
    bullets: [
      "High Alpha learns quickly but can overreact.",
      "Low Alpha is steadier but improves slowly.",
      "It's like learning to ride a bike: change too fast and you wobble, change too slow and you never balance.",
      "You cannot edit Alpha in this UI, but you can still study its idea by watching how learning settles over time.",
    ],
    watchFor: [
      "Watch AI guess scores shift from flat numbers to clearer favorites.",
      "Watch if the robot route becomes steadier (fewer turn-back loops).",
      "Use win rate and total points to judge if learning is becoming stable.",
    ],
    tryIt: [
      "Try SARSA and compare: does it feel more careful than Q-learning?",
      "Run 80 episodes with Q-learning. Does behavior become steadier?",
      "Write one sentence: fast updates vs stable updates.",
    ],
    keyWords: [
      { term: "Alpha", meaning: "The learning rate (0 to 1)." },
      { term: "Stability", meaning: "How much the AI's behavior stays consistent." },
    ],
    conceptIds: ["alpha", "qtable"],
  },
  8: {
    title: "Mission 8 Lesson: Sparse Secrets",
    image: {
      src: "/academy/sparse.svg",
      alt: "A desert with a single oasis in the distance.",
      caption: "Sparse rewards mean big positive rewards are rare.",
    },
    hook: "Imagine walking in the dark until you find a light. That's sparse rewards.",
    intro:
      "In sparse-reward problems, big positive signals are rare. Here, the robot still gets small step penalties, but goal rewards are hard to earn at first.",
    bullets: [
      "Sparse rewards are realistic but hard to learn from.",
      "The robot may wander for many episodes before first success.",
      "After first success, learning often speeds up because useful paths get reinforced.",
    ],
    watchFor: [
      "Expect lots of early episodes with no goal reached.",
      "Watch for the first jump in 'Win rate (last 10 completed tries)'.",
      "Watch total points: very low early, then improving after first wins.",
    ],
    tryIt: [
      "Increase Episodes to 200. Does it find the goal eventually?",
      "Try 'Random' first. It will probably never win.",
      "Switch back to Q-learning and run 50 episodes. Does win rate recover?",
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
      "Smart AI does not only memorize one map. It learns patterns that work again in new maps. That is generalization.",
    bullets: [
      "Memorization is one exact path.",
      "Generalization is using a useful idea in a new place.",
      "A strong learner adapts faster when map patterns look familiar.",
    ],
    watchFor: [
      "Compare how quickly win rate rises here versus earlier missions.",
      "Watch whether the robot reuses smart turning patterns in similar corridors.",
      "Check AI guess scores: do familiar states get confident scores faster?",
    ],
    tryIt: [
      "Run 100 episodes. Does the agent feel smarter than in Mission 1?",
      "Run Science Test and compare Success Last 10 for Q-learning, SARSA, and Random.",
      "Explain one pattern you saw in AI guess scores (F/L/R).",
    ],
    keyWords: [
      { term: "Generalization", meaning: "Applying knowledge to new, unseen situations." },
      { term: "Overfitting", meaning: "Memorizing so well that you can't handle new things." },
    ],
    conceptIds: ["general", "qtable"],
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
      "This final mission combines long planning, trap avoidance, and fair science comparison. Your job is to read the data clearly and explain it simply.",
    bullets: [
      "Use fair settings: same maze, same episodes, same trials across algorithms.",
      "Read all three charts together: learning speed, final success, and efficiency.",
      "Use numbers as evidence when you make claims.",
      "Remember the irony: while you coached the AI, the AI coach learned from you.",
    ],
    watchFor: [
      "The 'Final Reveal' once you clear this level!",
      "How all three charts work together to tell one complete story.",
      "Whether your conclusion uses chart numbers, not guesses.",
    ],
    tryIt: [
      "Run the full Science Test with all algorithms and at least 3 trials. Who wins?",
      "Use one number from Compare Success Last 10 and one from Compare Steps Last 10.",
      "Can you beat the AI's best time in Race Mode?",
    ],
    keyWords: [
      { term: "Integration", meaning: "Combining multiple parts into a whole." },
      { term: "Grandmaster", meaning: "Someone who has mastered all aspects of a craft." },
    ],
    conceptIds: ["reward", "explore", "control", "qtable", "discount", "alpha", "general"],
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
  private onMissionAward?: (levelId: number, badge: string) => void;
  private progression: ProgressionManager;
  private coach: AdaptiveMissionCoach;

  private activeLessonId: number | null = null;
  private lessonQuestions: QuizQuestion[] = [];
  private lessonAnswers: Record<string, number> = {};
  private lessonGrade: QuizGrade | null = null;
  private lessonFocusConceptIds: string[] = [];
  private lessonFocusConceptLabels: string[] = [];
  private reviewPrompt: CheckInPrompt | null = null;
  private reviewSelected: number | null = null;
  private reviewResult: CheckInResult | null = null;
  private aiQuestionHistoryByConcept: Record<string, string[]> = {};

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
  private static AI_QUESTION_HISTORY_LIMIT = 8;
  private static AI_REQUEST_ATTEMPTS = 2;

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
    dashboard?: Dashboard,
    onMissionAward?: (levelId: number, badge: string) => void
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
    this.onMissionAward = onMissionAward;
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

  public openMission(levelId: number): boolean {
    if (!this.progression.isUnlocked(levelId)) {
      return false;
    }
    this.startLesson(levelId);
    return true;
  }

  private viewMode: "SAGA" | "MISSION" = "SAGA";

  private render() {
    const missionScrollState = this.captureMissionScrollState();
    this.root.innerHTML = "";

    if (this.viewMode === "SAGA") {
      this.renderSagaView();
    } else {
      this.renderMissionCockpit();
    }

    this.restoreMissionScrollState(missionScrollState);
  }

  private captureMissionScrollState(): MissionScrollState | null {
    if (this.viewMode !== "MISSION" || this.activeLessonId == null) return null;

    const sidebar = this.root.querySelector<HTMLElement>(".cockpit-sidebar");
    const lab = this.root.querySelector<HTMLElement>(".cockpit-lab");

    return {
      levelId: this.activeLessonId,
      sidebarTop: sidebar?.scrollTop ?? 0,
      sidebarLeft: sidebar?.scrollLeft ?? 0,
      labTop: lab?.scrollTop ?? 0,
      labLeft: lab?.scrollLeft ?? 0,
      pageTop: window.scrollY,
      pageLeft: window.scrollX,
    };
  }

  private restoreMissionScrollState(state: MissionScrollState | null): void {
    if (!state) return;
    if (this.viewMode !== "MISSION" || this.activeLessonId !== state.levelId) return;

    requestAnimationFrame(() => {
      const sidebar = this.root.querySelector<HTMLElement>(".cockpit-sidebar");
      const lab = this.root.querySelector<HTMLElement>(".cockpit-lab");

      if (sidebar) {
        sidebar.scrollTop = state.sidebarTop;
        sidebar.scrollLeft = state.sidebarLeft;
      }
      if (lab) {
        lab.scrollTop = state.labTop;
        lab.scrollLeft = state.labLeft;
      }
      if (window.scrollY !== state.pageTop || window.scrollX !== state.pageLeft) {
        window.scrollTo(state.pageLeft, state.pageTop);
      }
    });
  }

  private isLessonQuizPerfect(): boolean {
    return !!this.lessonGrade && this.lessonGrade.total > 0 && this.lessonGrade.score === this.lessonGrade.total;
  }

  private gradeLessonQuizIfAnswered(levelId: number): boolean {
    if (this.lessonQuestions.length === 0) return false;
    const submissions = this.lessonQuestions.map((q) => ({
      questionId: q.questionId,
      chosenIndex: this.lessonAnswers[q.questionId] ?? -1,
    }));
    const unanswered = submissions.some((s) => s.chosenIndex < 0);
    if (unanswered) {
      return false;
    }
    this.lessonGrade = this.coach.gradeQuestionSet(submissions, 1);
    const missedByConcept = new Map<string, string>();
    submissions.forEach((submission) => {
      const question = this.lessonQuestions.find((q) => q.questionId === submission.questionId);
      if (!question) return;
      const selectedIndex = submission.chosenIndex;
      const answerCorrect = selectedIndex >= 0 && this.coach.isQuestionCorrect(question.questionId, selectedIndex);
      if (!answerCorrect) {
        missedByConcept.set(question.conceptId, question.conceptLabel);
      }
    });
    this.lessonFocusConceptIds = Array.from(missedByConcept.keys());
    this.lessonFocusConceptLabels = Array.from(missedByConcept.values());
    this.maybeCompleteMission(levelId);
    return true;
  }

  private missionMasteryDisplay(levelId: number, insightMastery: number): number {
    const missionComplete = this.progression.isCleared(levelId) || this.rewardedLessons.has(levelId);
    if (missionComplete) {
      return 100;
    }
    return insightMastery;
  }

  private isTryChecklistComplete(levelId: number): boolean {
    const checks = this.tryItChecks[levelId] ?? [];
    return checks.length > 0 && checks.every(Boolean);
  }

  private maybeCompleteMission(levelId: number): boolean {
    if (!this.isLessonQuizPerfect() || !this.isTryChecklistComplete(levelId)) return false;
    if (this.rewardedLessons.has(levelId)) return false;

    const level = LEVELS.find((item) => item.id === levelId);
    if (!level) return false;

    const alreadyCleared = this.progression.isCleared(levelId);
    const maxLevelId = LEVELS[LEVELS.length - 1]?.id ?? level.id;

    this.rewardedLessons.add(levelId);
    this.rewardedTryIts.add(levelId);
    if (!alreadyCleared) {
      this.stars += 2;
    }
    this.progression.clearLevel(levelId, level.badge, maxLevelId);
    this.saveRewards();

    if (!alreadyCleared) {
      this.onMissionAward?.(levelId, level.badge);
    }
    return true;
  }

  private renderSagaView() {
    const header = document.createElement("header");
    header.className = "learn-header";

    const badgesHtml = this.progression
      .getEarnedBadges()
      .map((b) => `<span class="hero-badge-mini" title="${b}">🏅</span>`)
      .join("");

    // Get weakest concept for tooltip
    const mastery = this.coach
      .getConceptMasterySummary()
      .sort((a, b) => a.masteryPercent - b.masteryPercent);
    const weakest = mastery[0];
    const boostTooltip = weakest
      ? `Power up your ${weakest.label} skills!`
      : "Practice makes perfect!";

    header.innerHTML = `
      <div class="saga-header-content">
        <h1>🎓 Neural Maze Runner</h1>
        <div class="saga-stats">
          <div class="stat-pill">⭐ ${this.stars} Stars</div>
          <button type="button" class="brain-boost-btn" title="${boostTooltip}">
            <span class="boost-icon">🧠⚡</span>
            <span class="boost-text">Brain Boost!</span>
            <span class="boost-sparkle">✨</span>
          </button>
          <div class="earned-badges-row">${badgesHtml}</div>
        </div>
      </div>
    `;

    // Bind Brain Boost button
    const boostBtn = header.querySelector(".brain-boost-btn") as HTMLButtonElement;
    boostBtn.onclick = () => this.openAdaptiveReviewModal(true); // true = auto-try AI

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


  private renderAdaptiveReviewLab(): HTMLElement {
    const card = document.createElement("section");
    card.className = "learn-card adaptive-review-card";

    const mastery = this.coach
      .getConceptMasterySummary()
      .sort((a, b) => a.masteryPercent - b.masteryPercent)
      .slice(0, 4);

    const weakest = mastery[0];
    const summary = weakest
      ? `Weakest concept right now: ${weakest.label} (${weakest.masteryPercent}%).`
      : "No mastery data yet.";

    const title = document.createElement("h3");
    title.textContent = "Adaptive Review Lab";

    const subtitle = document.createElement("p");
    subtitle.textContent = `${summary} Practice here anytime to relearn past topics.`;

    const list = document.createElement("ul");
    list.className = "adaptive-mastery-list";
    for (const item of mastery) {
      const li = document.createElement("li");
      li.textContent = `${item.label}: ${item.masteryPercent}%`;
      list.append(li);
    }

    const actions = document.createElement("div");
    actions.className = "guided-action-row";

    const startBtn = document.createElement("button");
    startBtn.type = "button";
    startBtn.className = "btn-check-lesson";
    startBtn.textContent = "Start Adaptive Review";
    startBtn.onclick = () => this.openAdaptiveReviewModal();

    const note = document.createElement("p");
    note.className = "guided-quiz-feedback";
    note.textContent =
      "Optional AI tutor mode: you can plug in ChatGPT via a backend endpoint to generate fresh explanations and question variants.";

    actions.append(startBtn);
    card.append(title, subtitle, list, actions, note);
    return card;
  }

  private normalizeAiQuestion(question: string): string {
    return question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private getRecentAiQuestions(conceptId: string): string[] {
    return [...(this.aiQuestionHistoryByConcept[conceptId] ?? [])];
  }

  private isRepeatedAiQuestion(conceptId: string, question: string, extraRecent: string[] = []): boolean {
    const candidate = this.normalizeAiQuestion(question);
    if (!candidate) return false;
    const history = [
      ...(this.aiQuestionHistoryByConcept[conceptId] ?? []),
      ...extraRecent,
    ];
    return history.some((item) => this.normalizeAiQuestion(item) === candidate);
  }

  private rememberAiQuestion(conceptId: string, question: string): void {
    const trimmed = question.trim();
    if (!trimmed) return;
    const normalized = this.normalizeAiQuestion(trimmed);
    if (!normalized) return;
    const previous = this.aiQuestionHistoryByConcept[conceptId] ?? [];
    const deduped = previous.filter((item) => this.normalizeAiQuestion(item) !== normalized);
    deduped.push(trimmed);
    this.aiQuestionHistoryByConcept[conceptId] = deduped.slice(-LearnPanel.AI_QUESTION_HISTORY_LIMIT);
  }

  private buildTutorMissionContext(conceptId: string): TutorMissionContext[] {
    const entries = Object.entries(LESSONS)
      .map(([id, lesson]) => ({ missionId: Number(id), lesson }))
      .filter(({ lesson }) => lesson.conceptIds.includes(conceptId));

    const activeId = this.activeLessonId;
    entries.sort((a, b) => {
      if (activeId != null && a.missionId === activeId && b.missionId !== activeId) return -1;
      if (activeId != null && b.missionId === activeId && a.missionId !== activeId) return 1;
      return a.missionId - b.missionId;
    });

    return entries.slice(0, 3).map(({ missionId, lesson }) => ({
      missionId,
      title: lesson.title,
      hook: lesson.hook,
      intro: lesson.intro,
      keyFacts: lesson.bullets.slice(0, 4),
      watchFor: lesson.watchFor.slice(0, 3),
      tryIt: lesson.tryIt.slice(0, 2),
      vocabulary: lesson.keyWords.map((item) => item.term).slice(0, 8),
    }));
  }

  private async requestAiTutorPack(
    prompt: CheckInPrompt,
    recentQuestions: string[] = [],
    attempt = 1
  ): Promise<AiTutorQuestionPack> {
    const response = await fetch("/api/tutor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conceptId: prompt.conceptId,
        conceptLabel: prompt.conceptLabel,
        confidencePercent: prompt.confidencePercent,
        age: 11,
        gradeLevel: 5,
        attempt,
        recentQuestions: recentQuestions.slice(-LearnPanel.AI_QUESTION_HISTORY_LIMIT),
        missionContext: this.buildTutorMissionContext(prompt.conceptId),
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      let detail = raw;
      try {
        const parsed = JSON.parse(raw) as { error?: string };
        detail = parsed.error ?? raw;
      } catch {
        // Keep raw body.
      }
      throw new Error(`AI tutor request failed (${response.status}): ${detail}`);
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      pack?: AiTutorQuestionPack;
      error?: string;
    };

    if (!payload.ok || !payload.pack) {
      throw new Error(payload.error || "AI tutor response missing question pack.");
    }

    return payload.pack;
  }

  private openAdaptiveReviewModal(autoTryAi = false): void {
    const overlay = document.createElement("div");
    overlay.className = "mission-briefing-overlay brain-boost-overlay";

    const modal = document.createElement("div");
    modal.className = "mission-briefing-modal brain-boost-modal";
    let reviewMode: "local" | "ai" = "local";
    let aiPack: AiTutorQuestionPack | null = null;
    let aiLoading = false;
    let aiError = "";
    let streak = 0;
    let hintVisible = false;
    let waitingForAiQuestion = false;

    const close = () => {
      overlay.remove();
      this.render();
    };

    const refreshPrompt = (tryAi = false) => {
      this.reviewPrompt = this.coach.getCheckInPrompt();
      this.reviewSelected = null;
      this.reviewResult = null;
      reviewMode = "local";
      aiPack = null;
      aiLoading = tryAi;
      aiError = "";
      hintVisible = false;
      waitingForAiQuestion = tryAi;
      renderBody();
      if (tryAi) {
        void loadAiPack();
      }
    };

    const loadAiPack = async () => {
      if (!this.reviewPrompt) {
        this.reviewPrompt = this.coach.getCheckInPrompt();
      }
      if (!this.reviewPrompt) {
        aiLoading = false;
        waitingForAiQuestion = false;
        renderBody();
        return;
      }
      aiLoading = true;
      aiError = "";
      this.reviewSelected = null;
      this.reviewResult = null;
      hintVisible = false;
      renderBody();
      try {
        const conceptId = this.reviewPrompt.conceptId;
        const blockedQuestions = this.getRecentAiQuestions(conceptId);
        let nextPack: AiTutorQuestionPack | null = null;

        for (let attempt = 1; attempt <= LearnPanel.AI_REQUEST_ATTEMPTS; attempt++) {
          const candidate = await this.requestAiTutorPack(this.reviewPrompt, blockedQuestions, attempt);
          if (this.isRepeatedAiQuestion(conceptId, candidate.question, blockedQuestions)) {
            blockedQuestions.push(candidate.question);
            continue;
          }
          nextPack = candidate;
          break;
        }

        if (!nextPack) {
          throw new Error("AI repeated a recent question. Try Next Challenge again.");
        }

        aiPack = nextPack;
        reviewMode = "ai";
        waitingForAiQuestion = false;
        this.rememberAiQuestion(conceptId, nextPack.question);
      } catch (error) {
        aiPack = null;
        reviewMode = "local";
        aiError = error instanceof Error ? error.message : "";
        waitingForAiQuestion = false;
        console.warn("AI tutor fallback to local mode:", aiError || error);
      } finally {
        aiLoading = false;
        renderBody();
      }
    };

    const renderBody = () => {
      const prompt = this.reviewPrompt;
      if (!prompt) return;
      const showAiLoadingState = waitingForAiQuestion && aiLoading && !aiPack;
      const activeConcept = reviewMode === "ai" && aiPack ? aiPack.conceptLabel : prompt.conceptLabel;
      const activeConfidence = prompt.confidencePercent;
      const activeQuestion = showAiLoadingState
        ? "Building a fresh Brain Boost challenge for you..."
        : reviewMode === "ai" && aiPack
          ? aiPack.question
          : prompt.prompt;
      const activeOptions = showAiLoadingState
        ? []
        : reviewMode === "ai" && aiPack
          ? aiPack.options
          : prompt.options;
      const teachBlurb = showAiLoadingState ? "" : reviewMode === "ai" && aiPack ? aiPack.teachBlurb : "";
      const activeHint = showAiLoadingState ? "" : reviewMode === "ai" && aiPack ? aiPack.hint : "";
      const hintBlock = activeHint
        ? `
            <button type="button" class="boost-hint-toggle-btn">
              ${hintVisible ? "🙈 Hide Hint" : "💡 Show Hint"}
            </button>
            ${hintVisible ? `<p class="boost-hint">💡 Hint: ${activeHint}</p>` : ""}
          `
        : "";
      const aiStatus = showAiLoadingState
        ? `
            <div class="boost-ai-loading">
              <span class="boost-spinner" aria-hidden="true"></span>
              <span>AI Coach is thinking...</span>
            </div>
          `
        : "";
      const aiErrorMessage = !showAiLoadingState && aiError
        ? `<p class="boost-ai-error">AI Coach is unavailable right now. Switched to Practice Mode.</p>`
        : "";

      // Fun encouraging messages for kids
      const modeEmoji = showAiLoadingState || reviewMode === "ai" ? "🤖" : "🎯";
      const modeLabel = showAiLoadingState || reviewMode === "ai" ? "AI Coach Mode" : "Practice Mode";
      const streakDisplay = streak > 0 ? `🔥 ${streak} in a row!` : "";

      modal.innerHTML = `
        <div class="briefing-header boost-header">
          <div class="boost-title-row">
            <span class="boost-title-icon">🧠⚡</span>
            <h2>Brain Boost Arena</h2>
          </div>
          <div class="boost-streak">${streakDisplay}</div>
          <button class="btn-close-briefing">✕</button>
        </div>
        <div class="briefing-body boost-body">
          <div class="boost-topic-badge">
            <span class="topic-emoji">${modeEmoji}</span>
            <span class="topic-text">${activeConcept}</span>
            <span class="topic-level">Level ${Math.floor(activeConfidence / 20) + 1}</span>
          </div>
          ${teachBlurb ? `<p class="boost-teach-blurb">${teachBlurb}</p>` : ""}
          <div class="boost-question">
            <p class="boost-question-text">${activeQuestion}</p>
            ${aiStatus}
            ${hintBlock}
            ${aiErrorMessage}
          </div>
          <div class="boost-options"></div>
          <div class="boost-feedback"></div>
          <div class="boost-actions"></div>
          <div class="boost-mode-indicator">
            ${showAiLoadingState
          ? `<span class="boost-loading-pill"><span class="boost-spinner" aria-hidden="true"></span>Loading AI Coach...</span>`
          : `${modeEmoji} ${modeLabel}`}
          </div>
        </div>
      `;

      const closeBtn = modal.querySelector(".btn-close-briefing") as HTMLButtonElement;
      closeBtn.type = "button";
      closeBtn.onclick = close;

      const hintToggleBtn = modal.querySelector(".boost-hint-toggle-btn") as HTMLButtonElement | null;
      if (hintToggleBtn) {
        hintToggleBtn.onclick = () => {
          hintVisible = !hintVisible;
          renderBody();
        };
      }

      const options = modal.querySelector(".boost-options") as HTMLElement;
      activeOptions.forEach((opt, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "boost-option-btn";
        if (this.reviewSelected === index) {
          btn.classList.add("selected");
        }
        if (this.reviewResult) {
          const isCorrect = reviewMode === "ai" && aiPack
            ? index === aiPack.correctIndex
            : this.coach.isQuestionCorrect(prompt.questionId, index);
          if (index === this.reviewSelected) {
            btn.classList.add(this.reviewResult.correct ? "correct" : "wrong");
          } else if (isCorrect) {
            btn.classList.add("was-correct");
          }
        }
        btn.textContent = opt;
        btn.disabled = !!this.reviewResult;
        btn.onclick = () => {
          this.reviewSelected = index;
          this.reviewResult = null;
          renderBody();
        };
        options.append(btn);
      });

      const feedback = modal.querySelector(".boost-feedback") as HTMLElement;
      if (this.reviewResult) {
        const feedbackEmoji = this.reviewResult.correct ? "🎉" : "💪";
        const feedbackMsg = this.reviewResult.correct
          ? "AWESOME! You nailed it!"
          : "Good try! Keep learning!";
        feedback.innerHTML = `
          <div class="boost-feedback-msg ${this.reviewResult.correct ? "correct" : "try-again"}">
            <span class="feedback-emoji">${feedbackEmoji}</span>
            <span class="feedback-text">${feedbackMsg}</span>
          </div>
        `;
      }

      const actions = modal.querySelector(".boost-actions") as HTMLElement;

      if (showAiLoadingState) {
        // Keep actions empty while waiting for AI, so local fallback does not flash first.
      } else if (!this.reviewResult) {
        const submit = document.createElement("button");
        submit.type = "button";
        submit.className = "boost-submit-btn";
        submit.innerHTML = "🚀 Lock In Answer!";
        submit.disabled = this.reviewSelected == null || aiLoading || showAiLoadingState;
        submit.onclick = () => {
          if (this.reviewSelected == null || !this.reviewPrompt) return;
          if (reviewMode === "ai" && aiPack) {
            const correct = this.reviewSelected === aiPack.correctIndex;
            const result = this.coach.submitConceptPractice(aiPack.conceptId, correct);
            this.reviewResult = {
              correct,
              message: correct ? "Awesome!" : "Keep trying!",
              review: "",
              conceptMasteryPercent: result.masteryPercent,
            };
            if (correct) streak++;
            else streak = 0;
          } else {
            this.reviewResult = this.coach.submitCheckInAnswer(this.reviewPrompt.questionId, this.reviewSelected);
            if (this.reviewResult.correct) streak++;
            else streak = 0;
          }
          renderBody();
        };
        actions.append(submit);
      } else {
        const next = document.createElement("button");
        next.type = "button";
        next.className = "boost-next-btn";
        next.innerHTML = "⚡ Next Challenge!";
        next.onclick = () => refreshPrompt(true); // Always try AI for next question
        actions.append(next);
      }
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) close();
    };

    overlay.append(modal);
    document.body.append(overlay);
    requestAnimationFrame(() => {
      overlay.classList.add("active");
      modal.classList.add("active");
    });

    refreshPrompt(autoTryAi);
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
    backBtn.type = "button";
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
      this.dashboard.setCompactMode(true);
      this.dashboard.root.style.display = "block";
      this.dashboard.root.style.visibility = "visible";
      this.dashboard.root.style.opacity = "1";
      const dashboardSlot = document.createElement("div");
      dashboardSlot.className = "cockpit-dashboard";
      dashboardSlot.append(this.dashboard.root);
      labArea.append(dashboardSlot);
    }
    if (this.controls) {
      this.controls.root.style.display = "block"; // Ensure visible

      // Onboarding Pulse for Mission 1
      const isCleared = this.progression.isCleared(levelId);
      if (levelId === 1 && !isCleared) {
        this.controls.runDemoBtn.classList.add("guide-pulse");
      } else {
        this.controls.runDemoBtn.classList.add("guide-pulse"); // For testing purposes, I'll pulsate it for now, but the logic should be correct
        // Removing for production logic:
        this.controls.runDemoBtn.classList.toggle("guide-pulse", levelId === 1 && !isCleared);
      }

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

    let nextMissionId: number | null = null;
    for (const lvl of LEVELS) {
      if (this.progression.isUnlocked(lvl.id) && !this.progression.isCleared(lvl.id)) {
        nextMissionId = lvl.id;
        break;
      }
    }

    LEVELS.forEach((lvl: LevelDef, index: number) => {
      const isUnlocked = this.progression.isUnlocked(lvl.id);
      const isCleared = this.progression.isCleared(lvl.id);
      const isNext = lvl.id === nextMissionId;

      const node = document.createElement("div");
      node.className = "saga-node" +
        (isUnlocked ? " unlocked" : " locked") +
        (isCleared ? " cleared" : "") +
        (isNext ? " guide-pulse" : "");

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

        if (isNext) {
          const hint = document.createElement("div");
          hint.className = "next-mission-hint";
          hint.innerHTML = `<span>🎯 START HERE!</span>`;
          node.appendChild(hint);
        }
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
    const masteryPercent = this.missionMasteryDisplay(lvl.id, insight.masteryPercent);

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
                <span>${masteryPercent}%</span>
            </div>
        </div>

        <div class="briefing-coach">
            <strong>Coach says:</strong> "${insight.coachTip}"
        </div>

        ${lvl.id === 1 && !isCleared ? `
        <div class="mission-guide-box">
          <h4>🚀 How to solve this Mission:</h4>
          <ol>
            <li><strong>Read Lesson:</strong> Understand the concept on the left sidebar.</li>
            <li><strong>Watch Learning:</strong> Press the big button in the Lab to see the AI in action.</li>
            <li><strong>Mastery Quiz:</strong> Answer the final question to clear the mission and earn XP!</li>
          </ol>
        </div>
        ` : ""}

        <div class="briefing-actions">
           <button class="btn-start-mission-action">
             ${isCleared ? "Replay Mission" : "Start Mission"}
           </button>
        </div>
      </div>
    `;

    // Bind events
    const closeBtn = modal.querySelector(".btn-close-briefing") as HTMLButtonElement;
    closeBtn.type = "button";
    closeBtn.onclick = () => overlay.remove();

    const startBtn = modal.querySelector(".btn-start-mission-action") as HTMLButtonElement;
    startBtn.type = "button";
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

  private renderMissionSteps(levelId: number): HTMLElement {
    const quizDone = this.isLessonQuizPerfect();
    const tryItDone = this.isTryChecklistComplete(levelId);
    const missionComplete = this.progression.isCleared(levelId) || this.rewardedLessons.has(levelId);

    const box = document.createElement("div");
    box.className = "mission-steps-box";

    // Step states
    const step2Class = quizDone ? "step-done" : "step-current";
    const step2Icon = quizDone ? "✅" : "👉";
    const step2DoNow = !quizDone ? ' <span class="do-now">← DO THIS</span>' : "";

    const step3Class = !quizDone ? "step-locked" : (tryItDone ? "step-done" : "step-current");
    const step3Icon = tryItDone ? "✅" : (quizDone ? "👉" : "🔒");
    const step3DoNow = quizDone && !tryItDone ? ' <span class="do-now">← DO THIS</span>' : "";

    const step4Class = missionComplete ? "step-done" : "step-locked";
    const step4Icon = missionComplete ? "🏆" : "🔒";

    box.innerHTML = `
      <h3>🎯 Your Mission Steps</h3>
      <ol class="mission-steps-list">
        <li class="step-done">✅ Read the lesson below</li>
        <li class="${step2Class}">${step2Icon} Answer the Mini Quiz and press "Check Lesson Quiz"${step2DoNow}</li>
        <li class="${step3Class}">${step3Icon} Complete the Try It checklist${step3DoNow}</li>
        <li class="${step4Class}">${step4Icon} Mission Complete!</li>
      </ol>
    `;

    return box;
  }

  private renderGuidedLessonSection(levelId: number): HTMLElement {
    const lesson = LESSONS[levelId] ?? LESSONS[1];
    if (this.lessonQuestions.length === 0) {
      this.lessonQuestions = this.coach.getQuestionsForConcepts(lesson.conceptIds, 2);
      this.lessonAnswers = {};
      this.lessonGrade = null;
      this.lessonFocusConceptIds = [];
      this.lessonFocusConceptLabels = [];
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
        this.saveRewards();
        this.maybeCompleteMission(levelId);
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
    const allTryDone = this.isTryChecklistComplete(levelId);
    const quizPerfect = this.isLessonQuizPerfect();
    const missionCleared = this.progression.isCleared(levelId) || this.rewardedLessons.has(levelId);
    if (missionCleared) {
      tryReward.textContent = "Mission complete. Arcade award unlocked.";
    } else if (this.lessonGrade == null) {
      tryReward.textContent = "Tip: do the mini quiz, then do the checklist while watching the demo.";
    } else if (!quizPerfect) {
      const targetScore = this.lessonGrade.total > 0 ? `${this.lessonGrade.total}/${this.lessonGrade.total}` : "perfect";
      tryReward.textContent = `Mission requirement: score ${targetScore} on the mini quiz.`;
    } else if (allTryDone) {
      tryReward.textContent = "Checklist complete + perfect quiz. Mission is ready to clear.";
    } else {
      tryReward.textContent = "Perfect quiz achieved. Finish every checklist item to clear this mission.";
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
        optBtn.type = "button";
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
      const missionGateText =
        this.lessonGrade.total > 0 && this.lessonGrade.score < this.lessonGrade.total
          ? ` Mission requirement: ${this.lessonGrade.total}/${this.lessonGrade.total}.`
          : "";
      const reviewText = this.lessonGrade.reviewLines.length > 0
        ? ` Review: ${this.lessonGrade.reviewLines.join(" ")}`
        : "";
      quizFeedback.textContent = `${scoreText}${missionGateText}${reviewText}`;
      quizFeedback.classList.toggle("correct", this.lessonGrade.passed);
      quizFeedback.classList.toggle("needs-review", !this.lessonGrade.passed);
    }

    const actionRow = document.createElement("div");
    actionRow.className = "guided-action-row";

    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "btn-check-lesson";
    submitBtn.textContent = "Check Lesson Quiz";
    submitBtn.onclick = () => {
      const graded = this.gradeLessonQuizIfAnswered(levelId);
      if (!graded) {
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
      this.render();
    };

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn-close-lesson";
    closeBtn.textContent = "Close Lesson";
    closeBtn.onclick = () => this.exitToSagaMap();

    actionRow.append(submitBtn, closeBtn);
    quizWrap.append(quizFeedback, actionRow);

    if (this.lessonGrade && this.lessonFocusConceptIds.length > 0) {
      const focusWrap = document.createElement("div");
      focusWrap.className = "guided-action-row";
      const focusHint = document.createElement("p");
      focusHint.className = "guided-quiz-feedback needs-review";
      focusHint.textContent = `Coach focus: ${this.lessonFocusConceptLabels.join(", ")}.`;
      const focusBtn = document.createElement("button");
      focusBtn.type = "button";
      focusBtn.className = "btn-check-lesson";
      focusBtn.textContent = "Retry Missed Concepts";
      focusBtn.onclick = () => {
        const count = Math.max(2, this.lessonFocusConceptIds.length);
        this.lessonQuestions = this.coach.getQuestionsForConcepts(this.lessonFocusConceptIds, count);
        this.lessonAnswers = {};
        this.lessonGrade = null;
        this.render();
      };
      focusWrap.append(focusBtn);
      quizWrap.append(focusHint, focusWrap);
    }

    const missionSteps = this.renderMissionSteps(levelId);

    section.append(
      missionSteps,
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

    if (this.isLessonQuizPerfect()) {
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
        btn.type = "button";
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
    gradeBtn.type = "button";
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
    retryBtn.type = "button";
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
    this.lessonFocusConceptIds = [];
    this.lessonFocusConceptLabels = [];
    this.render();
  }

  private exitToSagaMap(): void {
    const levelId = this.activeLessonId;
    if (levelId != null && !this.progression.isCleared(levelId)) {
      // If the student answered the quiz but forgot to press "Check Lesson Quiz",
      // auto-grade on exit so completion is not lost.
      this.gradeLessonQuizIfAnswered(levelId);
    }
    this.activeLessonId = null;
    this.viewMode = "SAGA";
    this.lessonQuestions = [];
    this.lessonAnswers = {};
    this.lessonGrade = null;
    this.lessonFocusConceptIds = [];
    this.lessonFocusConceptLabels = [];
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
