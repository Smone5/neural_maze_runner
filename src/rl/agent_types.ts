import { Action } from "../core/env";
import { Rng } from "../core/rng";

export type AlgorithmType = "Random" | "Q-learning" | "SARSA" | "Expected SARSA" | "Double Q-learning";

export interface AgentParams {
  alpha: number;
  gamma: number;
  epsilonStart: number;
  epsilonEnd: number;
}

export interface ActionDecision {
  action: Action;
  explored: boolean;
}

export interface Transition {
  stateKey: string;
  action: Action;
  reward: number;
  nextStateKey: string;
  done: boolean;
  nextAction?: Action;
}

export interface RLAgent {
  algorithm: AlgorithmType;
  startTrial(seed: number): void;
  startEpisode(episodeIndex: number, totalEpisodes: number): void;
  selectAction(stateKey: string, rng: Rng): ActionDecision;
  update(transition: Transition): void;
  epsilon(): number;
  qValues(stateKey: string): number[];
  greedyAction(stateKey: string): Action;
}

export const ALL_ACTIONS: Action[] = [0, 1, 2];

export function argmax(values: number[]): Action {
  let bestIndex = 0;
  let bestValue = values[0] ?? Number.NEGATIVE_INFINITY;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > bestValue) {
      bestValue = values[i];
      bestIndex = i;
    }
  }
  return bestIndex as Action;
}

export function ensureQ(qTable: Map<string, number[]>, key: string): number[] {
  let values = qTable.get(key);
  if (!values) {
    values = [0, 0, 0];
    qTable.set(key, values);
  }
  return values;
}

export function epsilonLinear(
  episodeIndex: number,
  totalEpisodes: number,
  epsilonStart: number,
  epsilonEnd: number
): number {
  if (totalEpisodes <= 1) {
    return epsilonEnd;
  }
  const t = Math.min(1, Math.max(0, episodeIndex / (totalEpisodes - 1)));
  return epsilonStart + t * (epsilonEnd - epsilonStart);
}
