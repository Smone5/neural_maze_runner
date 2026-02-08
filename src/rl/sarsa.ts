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

export class SarsaAgent implements RLAgent {
  algorithm: "SARSA" = "SARSA";
  private qTable = new Map<string, number[]>();
  private params: AgentParams;
  private eps = DEFAULT_PARAMS.epsilonStart;

  constructor(params: Partial<AgentParams> = {}) {
    this.params = { ...DEFAULT_PARAMS, ...params };
  }

  startTrial(_seed: number): void {
    this.qTable = new Map<string, number[]>();
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
    const qValues = ensureQ(this.qTable, stateKey);
    if (explore) {
      return {
        action: rng.pick<Action>(ALL_ACTIONS),
        explored: true,
      };
    }
    return {
      action: argmax(qValues),
      explored: false,
    };
  }

  update(transition: Transition): void {
    const qS = ensureQ(this.qTable, transition.stateKey);
    const qNext = ensureQ(this.qTable, transition.nextStateKey);
    const nextAction = transition.nextAction ?? argmax(qNext);
    const target = transition.reward + (transition.done ? 0 : this.params.gamma * qNext[nextAction]);
    qS[transition.action] = qS[transition.action] + this.params.alpha * (target - qS[transition.action]);
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
