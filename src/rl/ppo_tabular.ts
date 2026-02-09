import { Action } from "../core/env";
import { Rng } from "../core/rng";
import {
  ActionDecision,
  AgentParams,
  ALL_ACTIONS,
  RLAgent,
  Transition,
  argmax,
  ensureQ,
  epsilonLinear,
} from "./agent_types";

const DEFAULT_PARAMS: AgentParams = {
  alpha: 0.2,
  gamma: 0.95,
  epsilonStart: 0.3,
  epsilonEnd: 0.05,
};

const PPO_CLIP = 0.2;
const POLICY_ALPHA = 0.18;
const DISTILL_ALPHA = 0.12;
const DISTILL_TEMP = 0.35;
const ENTROPY_ALPHA = 0.03;
const MAX_LOGIT_STEP = 0.45;
const EPS_SCHEDULE_CAP = 1200;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function softmax(values: number[]): number[] {
  const maxValue = Math.max(...values);
  const exps = values.map((value) => Math.exp(value - maxValue));
  const denom = exps.reduce((sum, value) => sum + value, 0);
  if (denom <= 0) {
    return Array.from({ length: values.length }, () => 1 / values.length);
  }
  return exps.map((value) => value / denom);
}

export class TabularPpoAgent implements RLAgent {
  algorithm: "PPO (Tabular)" = "PPO (Tabular)";
  private policyTable = new Map<string, number[]>();
  private qTable = new Map<string, number[]>();
  private params: AgentParams;
  private eps = DEFAULT_PARAMS.epsilonStart;

  constructor(params: Partial<AgentParams> = {}) {
    this.params = { ...DEFAULT_PARAMS, ...params };
  }

  startTrial(_seed: number): void {
    this.policyTable = new Map<string, number[]>();
    this.qTable = new Map<string, number[]>();
  }

  startEpisode(episodeIndex: number, totalEpisodes: number): void {
    const horizon = Math.max(2, Math.min(totalEpisodes, EPS_SCHEDULE_CAP));
    const cappedEpisode = Math.min(episodeIndex, horizon - 1);
    this.eps = epsilonLinear(cappedEpisode, horizon, this.params.epsilonStart, this.params.epsilonEnd);
  }

  selectAction(stateKey: string, rng: Rng): ActionDecision {
    const explore = rng.next() < this.eps;
    if (explore) {
      return {
        action: rng.pick<Action>(ALL_ACTIONS),
        explored: true,
      };
    }
    // Use critic values for action selection so policy updates cannot collapse behavior.
    const qValues = ensureQ(this.qTable, stateKey);
    const logits = ensureQ(this.policyTable, stateKey);
    const probs = softmax(logits);
    const blended = qValues.map((q, i) => q + 0.02 * Math.log(Math.max(1e-6, probs[i])));
    return {
      action: argmax(blended),
      explored: false,
    };
  }

  update(transition: Transition): void {
    // Critic: tabular TD target (same bootstrap signal used by value-based methods).
    const qState = ensureQ(this.qTable, transition.stateKey);
    const prevQ = qState[transition.action];
    const qNext = ensureQ(this.qTable, transition.nextStateKey);
    const bestNext = Math.max(...qNext);
    const tdTarget = transition.reward + (transition.done ? 0 : this.params.gamma * bestNext);
    const tdError = tdTarget - prevQ;
    qState[transition.action] = prevQ + this.params.alpha * tdError;

    // Actor: PPO-style clipped policy update guided by critic advantage.
    const logits = ensureQ(this.policyTable, transition.stateKey);
    const probs = softmax(logits);
    const gradients = probs.map((prob, idx) => (idx === transition.action ? 1 : 0) - prob);
    const oldProb = Math.max(probs[transition.action], 1e-6);

    const advantage = clamp(tdError * 2.5, -1.5, 1.5);
    const tentative = logits.map((value, idx) => value + POLICY_ALPHA * advantage * gradients[idx]);
    const tentativeProb = Math.max(softmax(tentative)[transition.action], 1e-6);
    const ratio = tentativeProb / oldProb;
    let scale = 1;
    if (advantage >= 0 && ratio > 1 + PPO_CLIP) {
      scale = (1 + PPO_CLIP) / ratio;
    } else if (advantage < 0 && ratio < 1 - PPO_CLIP) {
      scale = (1 - PPO_CLIP) / ratio;
    }
    const effectiveAdvantage = advantage * scale;

    const criticPolicy = softmax(qState.map((value) => value / DISTILL_TEMP));
    for (let i = 0; i < logits.length; i += 1) {
      const ppoStep = POLICY_ALPHA * effectiveAdvantage * gradients[i];
      const distillStep = DISTILL_ALPHA * (criticPolicy[i] - probs[i]);
      const entropyStep = ENTROPY_ALPHA * (1 / logits.length - probs[i]);
      const boundedStep = clamp(ppoStep + distillStep + entropyStep, -MAX_LOGIT_STEP, MAX_LOGIT_STEP);
      logits[i] += boundedStep;
    }

    // Keep logits centered to avoid drift.
    const mean = logits.reduce((sum, value) => sum + value, 0) / logits.length;
    for (let i = 0; i < logits.length; i += 1) {
      logits[i] -= mean;
    }
  }

  epsilon(): number {
    return this.eps;
  }

  qValues(stateKey: string): number[] {
    return [...ensureQ(this.qTable, stateKey)];
  }

  greedyAction(stateKey: string): Action {
    return argmax(ensureQ(this.qTable, stateKey));
  }
}
