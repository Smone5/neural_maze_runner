import { AlgorithmType } from "../rl/agent_types";
import type { RunSpeed } from "../ui/controls";
import { LevelDef } from "./levels";
import { analyzeMaze } from "./maze_analyze";
import { EpisodeMetrics } from "./metrics";
import { parseMazeJson } from "./maze_validate";

interface MissionCoachRecord {
  attempts: number;
  lastAlgorithm: AlgorithmType;
  lastEpisodes: number;
  lastSpeed: RunSpeed;
  lastSuccessRate: number;
  bestSuccessRate: number;
  lastAvgStepsOnSuccess: number | null;
  bestAvgStepsOnSuccess: number | null;
  lastExploreRate: number;
  lastBumpRate: number;
  improvement: number;
  masteryPercent: number;
}

interface ConceptRecord {
  attempts: number;
  correct: number;
  streak: number;
  masteryPercent: number;
  qValue: number;
}

interface AdaptiveCoachState {
  missions: Record<string, MissionCoachRecord>;
  policyQ: Record<string, number[]>;
  concepts: Record<string, ConceptRecord>;
  questionSeen: Record<string, number>;
}

interface CoachActionPreset {
  id: number;
  label: string;
  algorithm: AlgorithmType;
  speed: RunSpeed;
  baseEpisodes: number;
  levelBump: number;
  reason: string;
}

interface CheckInQuestionDef {
  id: string;
  conceptId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explain: string;
  reviewTip: string;
}

const COACH_ACTIONS: CoachActionPreset[] = [
  {
    id: 0,
    label: "Careful Q-learning",
    algorithm: "Q-learning",
    speed: "slow",
    baseEpisodes: 45,
    levelBump: 10,
    reason: "Go step-by-step so you can see rewards teach the agent.",
  },
  {
    id: 1,
    label: "Standard Q-learning",
    algorithm: "Q-learning",
    speed: "normal",
    baseEpisodes: 65,
    levelBump: 12,
    reason: "Run a balanced practice to improve success and keep it watchable.",
  },
  {
    id: 2,
    label: "Long Q-learning",
    algorithm: "Q-learning",
    speed: "fast",
    baseEpisodes: 100,
    levelBump: 15,
    reason: "Give the AI many tries so it can discover better paths.",
  },
  {
    id: 3,
    label: "Safe SARSA",
    algorithm: "SARSA",
    speed: "normal",
    baseEpisodes: 75,
    levelBump: 14,
    reason: "Use SARSA to practice safer turns and fewer wall bumps.",
  },
  {
    id: 4,
    label: "Deep SARSA",
    algorithm: "SARSA",
    speed: "slow",
    baseEpisodes: 110,
    levelBump: 18,
    reason: "Slow down and run longer to build stable, careful behavior.",
  },
  {
    id: 5,
    label: "Control Random",
    algorithm: "Random",
    speed: "normal",
    baseEpisodes: 50,
    levelBump: 8,
    reason: "Use Random as a control group baseline to compare learning against.",
  },
];

const CONCEPT_LABELS: Record<string, string> = {
  reward: "Rewards",
  explore: "Explore vs Exploit",
  control: "Control Group",
  qtable: "Q-Table Memory",
  discount: "Discount Factor (Gamma)",
  alpha: "Learning Rate (Alpha)",
  general: "Generalization",
};

const CHECK_IN_QUESTIONS: CheckInQuestionDef[] = [
  {
    id: "reward_goal",
    conceptId: "reward",
    prompt: "Why does the AI want to reach the gold goal square?",
    options: [
      "Because it gives the biggest positive reward.",
      "Because it makes the maze disappear.",
      "Because random actions always go to gold.",
    ],
    correctIndex: 0,
    explain: "Right. The goal gives a big reward, so learning pushes the AI toward it.",
    reviewTip: "Look at reward values in the Explain Box while running Watch Learning.",
  },
  {
    id: "reward_bump",
    conceptId: "reward",
    prompt: "What does a wall bump penalty teach the AI?",
    options: [
      "Keep bumping because it is faster.",
      "Avoid that action in that state next time.",
      "Turn off learning.",
    ],
    correctIndex: 1,
    explain: "Exactly. Negative reward means that move is less useful there.",
    reviewTip: "Notice how bump-heavy paths get lower returns over episodes.",
  },
  {
    id: "explore_meaning",
    conceptId: "explore",
    prompt: "When the dashboard says 'Explore', what is happening?",
    options: [
      "The AI tries a new action to gather info.",
      "The AI always uses its best-known move.",
      "The AI pauses training.",
    ],
    correctIndex: 0,
    explain: "Yes. Explore means trying something new to learn more.",
    reviewTip: "Run slow speed and watch Explore vs Exploit flip over time.",
  },
  {
    id: "exploit_meaning",
    conceptId: "explore",
    prompt: "When the dashboard says 'Exploit', what is happening?",
    options: [
      "The AI ignores rewards.",
      "The AI uses what it already learned works best.",
      "The AI picks a random move.",
    ],
    correctIndex: 1,
    explain: "Correct. Exploit means using the current best known choice.",
    reviewTip: "Look for exploitation increasing after more episodes.",
  },
  {
    id: "control_group",
    conceptId: "control",
    prompt: "Why do we keep Random as a control group?",
    options: [
      "To compare against a no-learning baseline.",
      "Because Random is always the best performer.",
      "To make charts colorful.",
    ],
    correctIndex: 0,
    explain: "Exactly. A control group helps prove learning actually improved results.",
    reviewTip: "In Science Test, compare Random success-last10 vs Q-learning/SARSA.",
  },
  {
    id: "fair_test",
    conceptId: "control",
    prompt: "For a fair algorithm comparison, what must stay the same?",
    options: [
      "Maze, start/goal, rewards, and episodes/trials.",
      "Only the colors.",
      "Only algorithm names.",
    ],
    correctIndex: 0,
    explain: "Perfect. Keep constants fixed so only algorithm changes.",
    reviewTip: "Use Science Test defaults for fair repeated trials.",
  },
  {
    id: "qtable_role",
    conceptId: "qtable",
    prompt: "What does a Q-table store?",
    options: [
      "How yummy the goal looks.",
      "Estimated value for actions in each state.",
      "Only wall positions.",
    ],
    correctIndex: 1,
    explain: "Correct. It stores how good each action seems in each situation.",
    reviewTip: "Watch the Q-value bars in dashboard change as learning runs.",
  },
  {
    id: "qtable_growth",
    conceptId: "qtable",
    prompt: "As training continues, the Q-table should usually...",
    options: [
      "Stay exactly zero forever.",
      "Get updated from rewards and transitions.",
      "Delete all past knowledge every step.",
    ],
    correctIndex: 1,
    explain: "Yes. It updates repeatedly from reward feedback.",
    reviewTip: "Try 50+ episodes and compare early vs late behavior.",
  },
  {
    id: "gamma_vision",
    conceptId: "discount",
    prompt: "What happens if Gamma is set very low (near 0)?",
    options: [
      "The AI only cares about the immediate next reward.",
      "The AI becomes a master of long-term planning.",
      "The AI stops moving entirely.",
    ],
    correctIndex: 0,
    explain: "Correct. Low Gamma makes the AI 'greedy' for the next step only.",
    reviewTip: "Try Mission 6 with low Gamma and see if it struggles to find the end.",
  },
  {
    id: "alpha_speed",
    conceptId: "alpha",
    prompt: "What does the Learning Rate (Alpha) control?",
    options: [
      "How fast the robot physically moves in the maze.",
      "How much new information updates the AI's old memory.",
      "The complexity of the maze grid.",
    ],
    correctIndex: 1,
    explain: "Exactly. Alpha is the 'dial' for how fast the brain updates.",
    reviewTip: "Watch how fast Q-values change in the dashboard with high vs low Alpha.",
  },
  {
    id: "generalization_goal",
    conceptId: "general",
    prompt: "What is 'Generalization' in AI?",
    options: [
      "Memorizing a single path perfectly.",
      "Applying what was learned in one situation to a new, similar one.",
      "Picking actions completely at random.",
    ],
    correctIndex: 1,
    explain: "Yes! Generalization is the key to true adaptivity.",
    reviewTip: "In Mission 9, see if learning one room helps solve the next one faster.",
  },
];

export interface MissionRunReport {
  algorithm: AlgorithmType;
  episodes: number;
  speed: RunSpeed;
  metrics: EpisodeMetrics[];
  exploreRate: number;
  bumpRate: number;
}

export interface MissionCoachPlan {
  levelId: number;
  algorithm: AlgorithmType;
  episodes: number;
  speed: RunSpeed;
  reason: string;
}

export interface MissionCoachInsight {
  levelId: number;
  status: "new" | "practicing" | "improving" | "mastered";
  masteryPercent: number;
  hasHistory: boolean;
  coachTip: string;
  summaryLine: string;
  nextStep: string;
  plan: MissionCoachPlan;
}

export interface CheckInPrompt {
  questionId: string;
  conceptId: string;
  conceptLabel: string;
  prompt: string;
  options: string[];
  confidencePercent: number;
}

export interface CheckInResult {
  correct: boolean;
  message: string;
  review: string;
  conceptMasteryPercent: number;
}

export interface ConceptMasterySummary {
  conceptId: string;
  label: string;
  masteryPercent: number;
}

export interface ConceptPracticeResult {
  conceptId: string;
  masteryPercent: number;
}

export interface QuizQuestion {
  questionId: string;
  conceptId: string;
  conceptLabel: string;
  prompt: string;
  options: string[];
  reviewTip: string;
}

export interface QuizSubmission {
  questionId: string;
  chosenIndex: number;
}

export interface QuizGrade {
  score: number;
  total: number;
  passed: boolean;
  message: string;
  reviewLines: string[];
}

export class AdaptiveMissionCoach {
  private static STORAGE_KEY = "rl_adaptive_mission_coach_v2";
  private static ALPHA = 0.26;
  private static GAMMA = 0.84;

  private state: AdaptiveCoachState;
  private levelsById = new Map<number, LevelDef>();
  private idealStepsByLevel = new Map<number, number>();

  constructor(levels: LevelDef[]) {
    levels.forEach((level) => {
      this.levelsById.set(level.id, level);
      const layout = parseMazeJson(level.maze);
      const analysis = analyzeMaze(layout);
      const idealSteps = analysis.shortestPathLength ?? Math.max(10, Math.round(layout.size * 1.8));
      this.idealStepsByLevel.set(level.id, idealSteps);
    });
    this.state = this.load();
  }

  chooseCoachPlan(levelId: number): MissionCoachPlan {
    const record = this.getOrCreate(levelId);
    const stateKey = this.stateKey(levelId, record);
    const actionId = this.selectAction(stateKey, record.attempts, true);
    const status = this.statusFromRecord(levelId, record);
    const plan = this.planForAction(levelId, actionId, record, status);
    this.save();
    return plan;
  }

  recordMissionRun(levelId: number, report: MissionRunReport): MissionCoachInsight {
    const record = this.getOrCreate(levelId);
    const prev = { ...record };

    const successRate = calcSuccessRate(report.metrics);
    const avgStepsOnSuccess = calcAvgStepsOnSuccess(report.metrics);
    const improvement = calcImprovement(report.metrics);

    const nextMastery = this.computeMastery(levelId, {
      successRate,
      avgStepsOnSuccess,
      improvement,
      exploreRate: report.exploreRate,
    });

    const reward = this.computeReward(prev, {
      successRate,
      avgStepsOnSuccess,
      improvement,
      exploreRate: report.exploreRate,
      bumpRate: report.bumpRate,
      masteryPercent: nextMastery,
    });

    const stateBefore = this.stateKey(levelId, prev);
    const actionId = this.actionFromReport(report);

    const simulatedNext: MissionCoachRecord = {
      ...prev,
      attempts: prev.attempts + 1,
      lastAlgorithm: report.algorithm,
      lastEpisodes: report.episodes,
      lastSpeed: report.speed,
      lastSuccessRate: successRate,
      lastAvgStepsOnSuccess: avgStepsOnSuccess,
      lastExploreRate: report.exploreRate,
      lastBumpRate: report.bumpRate,
      improvement,
      masteryPercent: nextMastery,
    };
    const stateAfter = this.stateKey(levelId, simulatedNext);
    this.updateQ(stateBefore, actionId, reward, stateAfter);

    record.attempts = prev.attempts + 1;
    record.lastAlgorithm = report.algorithm;
    record.lastEpisodes = report.episodes;
    record.lastSpeed = report.speed;
    record.lastSuccessRate = successRate;
    record.bestSuccessRate = Math.max(prev.bestSuccessRate, successRate);
    record.lastAvgStepsOnSuccess = avgStepsOnSuccess;
    if (avgStepsOnSuccess != null) {
      record.bestAvgStepsOnSuccess =
        prev.bestAvgStepsOnSuccess == null
          ? avgStepsOnSuccess
          : Math.min(prev.bestAvgStepsOnSuccess, avgStepsOnSuccess);
    }
    record.lastExploreRate = report.exploreRate;
    record.lastBumpRate = report.bumpRate;
    record.improvement = improvement;
    record.masteryPercent =
      prev.attempts <= 1 ? nextMastery : Math.round(prev.masteryPercent * 0.55 + nextMastery * 0.45);

    this.save();
    return this.getMissionInsight(levelId);
  }

  getMissionInsight(levelId: number): MissionCoachInsight {
    const level = this.levelsById.get(levelId);
    const record = this.state.missions[String(levelId)] ?? null;

    if (!level) {
      const fallback = this.defaultPlan(levelId);
      return {
        levelId,
        status: "new",
        masteryPercent: 0,
        hasHistory: false,
        coachTip: "Load a mission first.",
        summaryLine: "No mission data yet.",
        nextStep: fallback.reason,
        plan: fallback,
      };
    }

    const snapshot = record ?? this.emptyRecord(levelId);
    const status = record ? this.statusFromRecord(levelId, snapshot) : "new";
    const stateKey = this.stateKey(levelId, snapshot);
    const greedyAction = this.selectAction(stateKey, snapshot.attempts, false);
    const plan = this.planForAction(levelId, greedyAction, snapshot, status);

    let coachTip = "Press Start Watch Learning, then compare results in the dashboard.";
    if (status === "practicing") {
      coachTip = "Keep practicing. More tries help the agent connect actions to rewards.";
    } else if (status === "improving") {
      coachTip = "Great growth. Now aim for fewer steps and fewer bumps.";
    } else if (status === "mastered") {
      coachTip = "Mastered. You can unlock the next mission or challenge race mode.";
    }

    const avgStepsText =
      snapshot.lastAvgStepsOnSuccess == null
        ? "n/a"
        : `${snapshot.lastAvgStepsOnSuccess.toFixed(1)} avg steps on wins`;

    return {
      levelId,
      status,
      masteryPercent: clamp(Math.round(snapshot.masteryPercent), 0, 100),
      hasHistory: !!record,
      coachTip,
      summaryLine: record
        ? `Last run: ${snapshot.lastSuccessRate.toFixed(0)}% success, ${avgStepsText}.`
        : "No runs yet. Your first run will teach the coach how you learn.",
      nextStep: plan.reason,
      plan,
    };
  }

  getAcademyRecommendation(unlocked: number[], cleared: number[]): string {
    const weakest = this.getWeakestConcept();
    if (weakest && weakest.masteryPercent < 55) {
      return `Quick review suggested: ${weakest.label}. Take a no-pressure check-in question.`;
    }

    const nextUncleared = unlocked.find((id) => !cleared.includes(id));
    if (nextUncleared != null) {
      const insight = this.getMissionInsight(nextUncleared);
      return `Recommended now: Mission ${nextUncleared}. ${insight.nextStep}`;
    }

    if (cleared.length > 0) {
      return "All unlocked missions are cleared. Try Race mode and compare your time with AI.";
    }

    return "Start with Mission 1. The coach will adapt after your first run.";
  }

  getCheckInPrompt(): CheckInPrompt {
    const conceptId = this.pickCheckInConcept();
    const question = this.pickQuestionForConcept(conceptId);
    const concept = this.getConceptRecord(conceptId);
    this.state.questionSeen[question.id] = (this.state.questionSeen[question.id] ?? 0) + 1;
    this.save();
    return {
      questionId: question.id,
      conceptId: question.conceptId,
      conceptLabel: CONCEPT_LABELS[question.conceptId] ?? question.conceptId,
      prompt: question.prompt,
      options: question.options,
      confidencePercent: concept.masteryPercent,
    };
  }

  submitCheckInAnswer(questionId: string, chosenIndex: number): CheckInResult {
    const question = this.findQuestion(questionId);
    if (!question) {
      return {
        correct: false,
        message: "Question expired. Tap Next Check-In for a fresh one.",
        review: "No problem. Learning is a process.",
        conceptMasteryPercent: 0,
      };
    }

    const correct = chosenIndex === question.correctIndex;
    const concept = this.applyConceptOutcome(question.conceptId, correct);

    this.save();

    if (correct) {
      return {
        correct: true,
        message: `Nice work. ${question.explain}`,
        review: `Mastery in ${CONCEPT_LABELS[question.conceptId]} is now ${concept.masteryPercent}%.`,
        conceptMasteryPercent: concept.masteryPercent,
      };
    }

    return {
      correct: false,
      message: "Good try. You are still learning, and that is exactly the goal.",
      review: `${question.reviewTip} Then do one more check-in.`,
      conceptMasteryPercent: concept.masteryPercent,
    };
  }

  getConceptMasterySummary(): ConceptMasterySummary[] {
    return Object.entries(CONCEPT_LABELS).map(([conceptId, label]) => {
      const record = this.getConceptRecord(conceptId);
      return {
        conceptId,
        label,
        masteryPercent: record.masteryPercent,
      };
    });
  }

  getQuestionsForConcepts(conceptIds: string[], maxCount = 4): QuizQuestion[] {
    const wanted = new Set(conceptIds);
    const pool = CHECK_IN_QUESTIONS.filter((q) => wanted.has(q.conceptId));
    const deduped: CheckInQuestionDef[] = [];
    for (const conceptId of conceptIds) {
      const conceptPool = pool.filter((q) => q.conceptId === conceptId);
      if (conceptPool.length === 0) continue;
      deduped.push(this.pickLeastSeenQuestion(conceptPool));
    }

    const selected = deduped.slice(0, maxCount);
    selected.forEach((q) => {
      this.state.questionSeen[q.id] = (this.state.questionSeen[q.id] ?? 0) + 1;
    });

    const questions = selected.map((q) => ({
      questionId: q.id,
      conceptId: q.conceptId,
      conceptLabel: CONCEPT_LABELS[q.conceptId] ?? q.conceptId,
      prompt: q.prompt,
      options: q.options,
      reviewTip: q.reviewTip,
    }));

    if (questions.length >= maxCount) {
      return questions.slice(0, maxCount);
    }

    for (const q of pool) {
      if (questions.some((existing) => existing.questionId === q.id)) continue;
      this.state.questionSeen[q.id] = (this.state.questionSeen[q.id] ?? 0) + 1;
      questions.push({
        questionId: q.id,
        conceptId: q.conceptId,
        conceptLabel: CONCEPT_LABELS[q.conceptId] ?? q.conceptId,
        prompt: q.prompt,
        options: q.options,
        reviewTip: q.reviewTip,
      });
      if (questions.length >= maxCount) break;
    }
    this.save();
    return questions;
  }

  gradeQuestionSet(submissions: QuizSubmission[], passRatio = 0.7): QuizGrade {
    let score = 0;
    const reviewLines: string[] = [];
    const seenConceptMiss = new Set<string>();

    submissions.forEach((submission) => {
      const question = this.findQuestion(submission.questionId);
      if (!question) return;
      const correct = submission.chosenIndex === question.correctIndex;
      this.applyConceptOutcome(question.conceptId, correct);
      if (correct) {
        score += 1;
      } else if (!seenConceptMiss.has(question.conceptId)) {
        seenConceptMiss.add(question.conceptId);
        reviewLines.push(`${CONCEPT_LABELS[question.conceptId]}: ${question.reviewTip}`);
      }
    });

    const total = submissions.length;
    const ratio = total === 0 ? 0 : score / total;
    const passed = ratio >= passRatio;
    this.save();

    return {
      score,
      total,
      passed,
      message: passed
        ? "Awesome effort. You are building real RL understanding."
        : "Nice try. You are learning, and a quick review will make the next round easier.",
      reviewLines,
    };
  }

  isQuestionCorrect(questionId: string, chosenIndex: number): boolean {
    const question = this.findQuestion(questionId);
    if (!question) return false;
    return chosenIndex === question.correctIndex;
  }

  submitConceptPractice(conceptId: string, correct: boolean): ConceptPracticeResult {
    const concept = this.applyConceptOutcome(conceptId, correct);
    this.save();
    return {
      conceptId,
      masteryPercent: concept.masteryPercent,
    };
  }

  getCoachIronyStats() {
    // Total attempts across all missions as a proxy for "steps" the coach has taken
    const totalAttempts = Object.values(this.state.missions).reduce((s, m) => s + m.attempts, 0);
    const totalCorrect = Object.values(this.state.concepts).reduce((s, c) => s + c.correct, 0);
    const totalChecks = Object.values(this.state.concepts).reduce((s, c) => s + c.attempts, 0);

    // Average Q-value of the coach's policy actions
    const allQ = Object.values(this.state.policyQ).flat();
    const avgQ = allQ.length > 0 ? allQ.reduce((a, b) => a + b, 0) / allQ.length : 0;

    return {
      coachEpisodes: totalAttempts,
      userMasteryRewarded: totalCorrect,
      totalChecks,
      coachBrainStability: avgQ.toFixed(3),
      ironyMessage: "Irony: While you train the agent, I am an RL agent training YOU. My reward is your performance."
    };
  }

  private load(): AdaptiveCoachState {
    const raw = localStorage.getItem(AdaptiveMissionCoach.STORAGE_KEY);
    if (!raw) {
      return { missions: {}, policyQ: {}, concepts: {}, questionSeen: {} };
    }
    try {
      const parsed = JSON.parse(raw) as AdaptiveCoachState;
      if (parsed && typeof parsed === "object") {
        return {
          missions: parsed.missions && typeof parsed.missions === "object" ? parsed.missions : {},
          policyQ: parsed.policyQ && typeof parsed.policyQ === "object" ? parsed.policyQ : {},
          concepts: parsed.concepts && typeof parsed.concepts === "object" ? parsed.concepts : {},
          questionSeen: parsed.questionSeen && typeof parsed.questionSeen === "object" ? parsed.questionSeen : {},
        };
      }
    } catch (err) {
      console.error("Failed to parse adaptive coach state", err);
    }
    return { missions: {}, policyQ: {}, concepts: {}, questionSeen: {} };
  }

  private save(): void {
    localStorage.setItem(AdaptiveMissionCoach.STORAGE_KEY, JSON.stringify(this.state));
  }

  private emptyRecord(levelId: number): MissionCoachRecord {
    return {
      attempts: 0,
      lastAlgorithm: "Q-learning",
      lastEpisodes: this.defaultEpisodes(levelId),
      lastSpeed: "slow",
      lastSuccessRate: 0,
      bestSuccessRate: 0,
      lastAvgStepsOnSuccess: null,
      bestAvgStepsOnSuccess: null,
      lastExploreRate: 0,
      lastBumpRate: 0,
      improvement: 0,
      masteryPercent: 0,
    };
  }

  private getOrCreate(levelId: number): MissionCoachRecord {
    const key = String(levelId);
    const existing = this.state.missions[key];
    if (existing) {
      return existing;
    }

    const created = this.emptyRecord(levelId);
    this.state.missions[key] = created;
    return created;
  }

  private getConceptRecord(conceptId: string): ConceptRecord {
    const existing = this.state.concepts[conceptId];
    if (existing) {
      return existing;
    }
    const created: ConceptRecord = {
      attempts: 0,
      correct: 0,
      streak: 0,
      masteryPercent: 10,
      qValue: 0,
    };
    this.state.concepts[conceptId] = created;
    return created;
  }

  private getWeakestConcept(): ConceptMasterySummary | null {
    const summary = this.getConceptMasterySummary();
    if (summary.length === 0) {
      return null;
    }
    return summary.reduce((weakest, current) =>
      current.masteryPercent < weakest.masteryPercent ? current : weakest
    );
  }

  private pickCheckInConcept(): string {
    const conceptIds = Object.keys(CONCEPT_LABELS);
    const explorationRate = 0.16;
    if (Math.random() < explorationRate) {
      return conceptIds[Math.floor(Math.random() * conceptIds.length)];
    }

    let bestConceptId = conceptIds[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const conceptId of conceptIds) {
      const concept = this.getConceptRecord(conceptId);
      const weakness = (100 - concept.masteryPercent) / 100;
      const noveltyBoost = concept.attempts < 2 ? 0.15 : 0;
      const score = concept.qValue + weakness * 0.9 + noveltyBoost;
      if (score > bestScore) {
        bestScore = score;
        bestConceptId = conceptId;
      }
    }
    return bestConceptId;
  }

  private pickQuestionForConcept(conceptId: string): CheckInQuestionDef {
    const pool = CHECK_IN_QUESTIONS.filter((q) => q.conceptId === conceptId);
    if (pool.length === 0) {
      return CHECK_IN_QUESTIONS[0];
    }
    return this.pickLeastSeenQuestion(pool);
  }

  private pickLeastSeenQuestion(pool: CheckInQuestionDef[]): CheckInQuestionDef {
    let chosen = pool[0];
    let minSeen = this.state.questionSeen[chosen.id] ?? 0;
    for (const question of pool) {
      const seen = this.state.questionSeen[question.id] ?? 0;
      if (seen < minSeen) {
        minSeen = seen;
        chosen = question;
      }
    }
    return chosen;
  }

  private findQuestion(questionId: string): CheckInQuestionDef | undefined {
    return CHECK_IN_QUESTIONS.find((q) => q.id === questionId);
  }

  private applyConceptOutcome(conceptId: string, correct: boolean): ConceptRecord {
    const concept = this.getConceptRecord(conceptId);
    const prevMastery = concept.masteryPercent;

    concept.attempts += 1;
    if (correct) {
      concept.correct += 1;
      concept.streak += 1;
    } else {
      concept.streak = 0;
    }

    const accuracy = concept.correct / Math.max(1, concept.attempts);
    const streakBoost = Math.min(0.2, concept.streak * 0.03);
    concept.masteryPercent = Math.round(clamp((accuracy + streakBoost) * 100, 5, 100));

    const rewardBase = correct ? 0.9 : -0.25;
    const growthBonus = (concept.masteryPercent - prevMastery) / 100;
    const reward = clamp(rewardBase + growthBonus, -0.5, 1.2);
    concept.qValue = concept.qValue + 0.28 * (reward - concept.qValue);
    return concept;
  }

  private defaultPlan(levelId: number): MissionCoachPlan {
    const record = this.emptyRecord(levelId);
    const action = levelId >= 3 ? 3 : 0;
    return this.planForAction(levelId, action, record, "new");
  }

  private defaultEpisodes(levelId: number): number {
    if (levelId >= 4) return 90;
    if (levelId >= 2) return 65;
    return 45;
  }

  private statusFromRecord(levelId: number, record: MissionCoachRecord): MissionCoachInsight["status"] {
    const ideal = this.idealStepsByLevel.get(levelId) ?? 18;
    const avgSteps = record.lastAvgStepsOnSuccess;
    if (record.lastSuccessRate >= 85 && avgSteps != null && avgSteps <= ideal * 1.9 && record.masteryPercent >= 80) {
      return "mastered";
    }
    if (record.lastSuccessRate >= 45 || record.improvement >= 12 || record.masteryPercent >= 55) {
      return "improving";
    }
    return "practicing";
  }

  private stateKey(levelId: number, record: MissionCoachRecord): string {
    const difficulty = levelId <= 2 ? "path" : levelId === 3 ? "trap" : "maze";
    if (record.attempts === 0) {
      return `${difficulty}:new`;
    }

    const ideal = this.idealStepsByLevel.get(levelId) ?? 18;
    if (record.lastSuccessRate < 25) {
      return `${difficulty}:struggle`;
    }
    if (record.lastSuccessRate < 55) {
      return `${difficulty}:learning`;
    }
    if (record.lastAvgStepsOnSuccess != null && record.lastAvgStepsOnSuccess > ideal * 2.3) {
      return `${difficulty}:inefficient`;
    }
    if (record.lastSuccessRate < 85) {
      return `${difficulty}:growing`;
    }
    return `${difficulty}:master`;
  }

  private planForAction(
    levelId: number,
    actionId: number,
    record: MissionCoachRecord,
    status: MissionCoachInsight["status"]
  ): MissionCoachPlan {
    const preset = COACH_ACTIONS[actionId] ?? COACH_ACTIONS[0];
    const statusBump = status === "practicing" ? 12 : status === "improving" ? 4 : -8;
    const failBump = record.lastSuccessRate < 30 ? 14 : 0;
    const episodes = clamp(
      Math.round(preset.baseEpisodes + (levelId - 1) * preset.levelBump + statusBump + failBump),
      30,
      400
    );

    return {
      levelId,
      algorithm: preset.algorithm,
      speed: preset.speed,
      episodes,
      reason: preset.reason,
    };
  }

  private selectAction(stateKey: string, attempts: number, allowExplore: boolean): number {
    const values = this.ensureQ(stateKey);
    const epsilon = allowExplore ? Math.max(0.08, 0.34 - attempts * 0.03) : 0;
    if (allowExplore && Math.random() < epsilon) {
      return Math.floor(Math.random() * COACH_ACTIONS.length);
    }
    return argMax(values);
  }

  private ensureQ(stateKey: string): number[] {
    const existing = this.state.policyQ[stateKey];
    if (existing && existing.length === COACH_ACTIONS.length) {
      return existing;
    }
    const created = Array.from({ length: COACH_ACTIONS.length }, () => 0);
    this.state.policyQ[stateKey] = created;
    return created;
  }

  private updateQ(stateKey: string, actionId: number, reward: number, nextStateKey: string): void {
    const qState = this.ensureQ(stateKey);
    const qNext = this.ensureQ(nextStateKey);
    const current = qState[actionId] ?? 0;
    const nextBest = Math.max(...qNext);
    const target = reward + AdaptiveMissionCoach.GAMMA * nextBest;
    qState[actionId] = current + AdaptiveMissionCoach.ALPHA * (target - current);
  }

  private actionFromReport(report: MissionRunReport): number {
    let best = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    COACH_ACTIONS.forEach((action) => {
      let score = 0;
      if (action.algorithm === report.algorithm) score += 3.2;
      if (action.speed === report.speed) score += 1.4;
      score -= Math.abs(action.baseEpisodes - report.episodes) / 38;
      if (action.algorithm === "Random" && report.algorithm !== "Random") {
        score -= 1.5;
      }
      if (score > bestScore) {
        bestScore = score;
        best = action.id;
      }
    });

    return best;
  }

  private computeMastery(
    levelId: number,
    data: {
      successRate: number;
      avgStepsOnSuccess: number | null;
      improvement: number;
      exploreRate: number;
    }
  ): number {
    const ideal = this.idealStepsByLevel.get(levelId) ?? 18;
    const successScore = clamp(data.successRate / 90, 0, 1);
    const stepScore =
      data.avgStepsOnSuccess == null ? 0 : clamp(ideal / Math.max(ideal, data.avgStepsOnSuccess), 0, 1);
    const improvementScore = clamp((data.improvement + 15) / 35, 0, 1);
    const targetExplore = 0.28;
    const exploreScore = clamp(1 - Math.abs(data.exploreRate - targetExplore) / targetExplore, 0, 1);
    return Math.round((0.58 * successScore + 0.22 * stepScore + 0.14 * improvementScore + 0.06 * exploreScore) * 100);
  }

  private computeReward(
    prev: MissionCoachRecord,
    now: {
      successRate: number;
      avgStepsOnSuccess: number | null;
      improvement: number;
      exploreRate: number;
      bumpRate: number;
      masteryPercent: number;
    }
  ): number {
    const baseSuccess = now.successRate / 100;
    const deltaSuccess = (now.successRate - prev.lastSuccessRate) / 100;
    const improvementBoost = now.improvement / 45;
    const bumpPenalty = now.bumpRate * 0.7;
    const masteryBoost = now.masteryPercent / 100;

    let stepBoost = 0;
    if (prev.lastAvgStepsOnSuccess != null && now.avgStepsOnSuccess != null) {
      stepBoost = clamp((prev.lastAvgStepsOnSuccess - now.avgStepsOnSuccess) / 25, -0.4, 0.5);
    }

    const reward = 1.3 * baseSuccess + 1.6 * deltaSuccess + 0.4 * improvementBoost + 0.3 * masteryBoost + stepBoost - bumpPenalty;
    return clamp(reward, -1.1, 2.2);
  }
}

function calcSuccessRate(metrics: EpisodeMetrics[]): number {
  if (metrics.length === 0) return 0;
  const wins = metrics.reduce((sum, m) => sum + (m.success ? 1 : 0), 0);
  return (wins / metrics.length) * 100;
}

function calcAvgStepsOnSuccess(metrics: EpisodeMetrics[]): number | null {
  const wins = metrics.filter((m) => m.success);
  if (wins.length === 0) return null;
  return wins.reduce((sum, m) => sum + m.steps, 0) / wins.length;
}

function calcImprovement(metrics: EpisodeMetrics[]): number {
  if (metrics.length < 2) return 0;
  const window = Math.max(3, Math.min(10, Math.floor(metrics.length / 2)));
  const first = calcSuccessRate(metrics.slice(0, window));
  const last = calcSuccessRate(metrics.slice(-window));
  return last - first;
}

function argMax(values: number[]): number {
  let idx = 0;
  let best = values[0] ?? Number.NEGATIVE_INFINITY;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > best) {
      best = values[i];
      idx = i;
    }
  }
  return idx;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
