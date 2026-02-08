import { MazeLayout } from "./maze_types";
import { DEFAULT_REWARDS, RewardConfig } from "./rewards";

export type Direction = 0 | 1 | 2 | 3;
export type Action = 0 | 1 | 2;

export const ACTION_NAMES: Record<Action, string> = {
  0: "forward",
  1: "left",
  2: "right",
};

export interface EnvState {
  row: number;
  col: number;
  dir: Direction;
}

export interface Observation {
  row: number;
  col: number;
  dir: Direction;
  front_blocked: boolean;
  left_blocked: boolean;
  right_blocked: boolean;
  at_goal: boolean;
}

export interface StepResult {
  prevState: EnvState;
  state: EnvState;
  action: Action;
  reward: number;
  done: boolean;
  success: boolean;
  bump: boolean;
  observation: Observation;
  stepCount: number;
  episodeReturn: number;
  maxStepsReached: boolean;
}

const DIR_VECTORS: Record<Direction, { dr: number; dc: number }> = {
  0: { dr: -1, dc: 0 },
  1: { dr: 0, dc: 1 },
  2: { dr: 1, dc: 0 },
  3: { dr: 0, dc: -1 },
};

function turnLeft(dir: Direction): Direction {
  return ((dir + 3) % 4) as Direction;
}

function turnRight(dir: Direction): Direction {
  return ((dir + 1) % 4) as Direction;
}

export class MazeEnv {
  layout: MazeLayout;
  rewards: RewardConfig;
  state: EnvState;
  stepCount: number;
  episodeReturn: number;
  maxSteps: number;

  constructor(layout: MazeLayout, rewards: RewardConfig = DEFAULT_REWARDS) {
    this.layout = layout;
    this.rewards = rewards;
    this.maxSteps = layout.size === 9 ? rewards.maxSteps9 : rewards.maxSteps11;
    this.state = { row: layout.start.row, col: layout.start.col, dir: 1 };
    this.stepCount = 0;
    this.episodeReturn = 0;
  }

  reset(): Observation {
    this.state = { row: this.layout.start.row, col: this.layout.start.col, dir: 1 };
    this.stepCount = 0;
    this.episodeReturn = 0;
    return this.observe(this.state);
  }

  isBlocked(row: number, col: number): boolean {
    if (row < 0 || col < 0 || row >= this.layout.size || col >= this.layout.size) {
      return true;
    }
    return this.layout.grid[row][col] === "#";
  }

  private observe(state: EnvState): Observation {
    const forwardDir = state.dir;
    const leftDir = turnLeft(state.dir);
    const rightDir = turnRight(state.dir);

    const f = DIR_VECTORS[forwardDir];
    const l = DIR_VECTORS[leftDir];
    const r = DIR_VECTORS[rightDir];

    const frontBlocked = this.isBlocked(state.row + f.dr, state.col + f.dc);
    const leftBlocked = this.isBlocked(state.row + l.dr, state.col + l.dc);
    const rightBlocked = this.isBlocked(state.row + r.dr, state.col + r.dc);

    return {
      row: state.row,
      col: state.col,
      dir: state.dir,
      front_blocked: frontBlocked,
      left_blocked: leftBlocked,
      right_blocked: rightBlocked,
      at_goal: state.row === this.layout.goal.row && state.col === this.layout.goal.col,
    };
  }

  step(action: Action): StepResult {
    const prevState = { ...this.state };
    let next = { ...this.state };
    let bump = false;

    if (action === 1) {
      next.dir = turnLeft(next.dir);
    } else if (action === 2) {
      next.dir = turnRight(next.dir);
    } else {
      const vec = DIR_VECTORS[next.dir];
      const nr = next.row + vec.dr;
      const nc = next.col + vec.dc;
      if (this.isBlocked(nr, nc)) {
        bump = true;
      } else {
        next.row = nr;
        next.col = nc;
      }
    }

    this.state = next;
    this.stepCount += 1;

    const observation = this.observe(next);
    let reward = this.rewards.stepPenalty;
    if (bump) {
      reward += this.rewards.wallBumpPenalty;
    }

    let done = false;
    let success = false;

    if (observation.at_goal) {
      reward += this.rewards.goalReward;
      done = true;
      success = true;
    }

    if (this.stepCount >= this.maxSteps) {
      done = true;
    }

    this.episodeReturn += reward;

    return {
      prevState,
      state: { ...next },
      action,
      reward,
      done,
      success,
      bump,
      observation,
      stepCount: this.stepCount,
      episodeReturn: this.episodeReturn,
      maxStepsReached: done && !success && this.stepCount >= this.maxSteps,
    };
  }

  observation(): Observation {
    return this.observe(this.state);
  }
}

export function stateToKey(ob: Observation): string {
  return `${ob.row},${ob.col},${ob.dir},${Number(ob.front_blocked)},${Number(ob.left_blocked)},${Number(ob.right_blocked)}`;
}
