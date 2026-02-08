import { Action } from "../core/env";
import { Rng } from "../core/rng";
import { ActionDecision, ALL_ACTIONS, RLAgent, Transition } from "./agent_types";

export class RandomAgent implements RLAgent {
  algorithm: "Random" = "Random";

  startTrial(_seed: number): void {
    // No internal state.
  }

  startEpisode(_episodeIndex: number, _totalEpisodes: number): void {
    // No internal state.
  }

  selectAction(_stateKey: string, rng: Rng): ActionDecision {
    return {
      action: rng.pick<Action>(ALL_ACTIONS),
      explored: true,
    };
  }

  update(_transition: Transition): void {
    // Random policy does not learn.
  }

  epsilon(): number {
    return 1;
  }

  qValues(_stateKey: string): number[] {
    return [0, 0, 0];
  }

  greedyAction(_stateKey: string): Action {
    return 0;
  }
}
