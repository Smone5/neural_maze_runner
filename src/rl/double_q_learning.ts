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

function combinedValues(qA: number[], qB: number[]): number[] {
  return qA.map((value, idx) => value + (qB[idx] ?? 0));
}

export class DoubleQLearningAgent implements RLAgent {
  algorithm: "Double Q-learning" = "Double Q-learning";
  private qTableA = new Map<string, number[]>();
  private qTableB = new Map<string, number[]>();
  private params: AgentParams;
  private eps = DEFAULT_PARAMS.epsilonStart;
  private rng = Math.random;

  constructor(params: Partial<AgentParams> = {}) {
    this.params = { ...DEFAULT_PARAMS, ...params };
  }

  startTrial(seed: number): void {
    this.qTableA = new Map<string, number[]>();
    this.qTableB = new Map<string, number[]>();
    // Deterministic pseudo-random update-table coin flip per trial.
    let x = (seed | 0) ^ 0x9e3779b9;
    this.rng = () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return ((x >>> 0) % 1_000_000) / 1_000_000;
    };
  }

  startEpisode(episodeIndex: number, totalEpisodes: number): void {
    this.eps = epsilonLinear(
      episodeIndex,
      totalEpisodes,
      this.params.epsilonStart,
      this.params.epsilonEnd
    );
  }

  selectAction(stateKey: string, rng: Rng): ActionDecision {
    const explore = rng.next() < this.eps;
    if (explore) {
      return {
        action: rng.pick<Action>(ALL_ACTIONS),
        explored: true,
      };
    }
    return {
      action: this.greedyAction(stateKey),
      explored: false,
    };
  }

  update(transition: Transition): void {
    const updateA = this.rng() < 0.5;
    if (updateA) {
      this.updateTable(this.qTableA, this.qTableB, transition);
      return;
    }
    this.updateTable(this.qTableB, this.qTableA, transition);
  }

  epsilon(): number {
    return this.eps;
  }

  qValues(stateKey: string): number[] {
    const qA = ensureQ(this.qTableA, stateKey);
    const qB = ensureQ(this.qTableB, stateKey);
    return combinedValues(qA, qB).map((value) => value / 2);
  }

  greedyAction(stateKey: string): Action {
    const qA = ensureQ(this.qTableA, stateKey);
    const qB = ensureQ(this.qTableB, stateKey);
    return argmax(combinedValues(qA, qB));
  }

  private updateTable(
    qPrimaryTable: Map<string, number[]>,
    qOtherTable: Map<string, number[]>,
    transition: Transition
  ): void {
    const qPrimary = ensureQ(qPrimaryTable, transition.stateKey);
    const nextPrimary = ensureQ(qPrimaryTable, transition.nextStateKey);
    const nextOther = ensureQ(qOtherTable, transition.nextStateKey);
    const bestPrimaryNext = argmax(nextPrimary);
    const estimate = transition.done ? 0 : this.params.gamma * nextOther[bestPrimaryNext];
    const target = transition.reward + estimate;
    qPrimary[transition.action] =
      qPrimary[transition.action] + this.params.alpha * (target - qPrimary[transition.action]);
  }
}
