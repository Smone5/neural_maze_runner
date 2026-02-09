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
  epsilonStart: 0.28,
  epsilonEnd: 0.03,
};

interface ModelTransition {
  nextStateKey: string;
  reward: number;
  done: boolean;
}

const PLANNING_STEPS = 8;

export class DynaQAgent implements RLAgent {
  algorithm: "Dyna-Q" = "Dyna-Q";
  private qTable = new Map<string, number[]>();
  private model = new Map<string, ModelTransition>();
  private modelKeys: string[] = [];
  private params: AgentParams;
  private eps = DEFAULT_PARAMS.epsilonStart;
  private rand = Math.random;

  constructor(params: Partial<AgentParams> = {}) {
    this.params = { ...DEFAULT_PARAMS, ...params };
  }

  startTrial(seed: number): void {
    this.qTable = new Map<string, number[]>();
    this.model = new Map<string, ModelTransition>();
    this.modelKeys = [];
    let x = (seed | 0) ^ 0x85ebca6b;
    this.rand = () => {
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
    this.updateQ(transition.stateKey, transition.action, transition.reward, transition.nextStateKey, transition.done);
    this.rememberModel(transition);

    for (let i = 0; i < PLANNING_STEPS; i += 1) {
      if (this.modelKeys.length === 0) {
        break;
      }
      const idx = Math.floor(this.rand() * this.modelKeys.length);
      const key = this.modelKeys[idx];
      const sample = this.model.get(key);
      if (!sample) {
        continue;
      }
      const pivot = key.lastIndexOf("|");
      if (pivot <= 0) {
        continue;
      }
      const sampledState = key.slice(0, pivot);
      const sampledAction = Number(key.slice(pivot + 1)) as Action;
      this.updateQ(sampledState, sampledAction, sample.reward, sample.nextStateKey, sample.done);
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

  private rememberModel(transition: Transition): void {
    const key = `${transition.stateKey}|${transition.action}`;
    if (!this.model.has(key)) {
      this.modelKeys.push(key);
    }
    this.model.set(key, {
      nextStateKey: transition.nextStateKey,
      reward: transition.reward,
      done: transition.done,
    });
  }

  private updateQ(
    stateKey: string,
    action: Action,
    reward: number,
    nextStateKey: string,
    done: boolean
  ): void {
    const qS = ensureQ(this.qTable, stateKey);
    const qNext = ensureQ(this.qTable, nextStateKey);
    const bestNext = Math.max(...qNext);
    const target = reward + (done ? 0 : this.params.gamma * bestNext);
    qS[action] = qS[action] + this.params.alpha * (target - qS[action]);
  }
}
