import { MazeChar, MazeLayout } from "./maze_types";
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

const DIR_ORDER: Direction[] = [0, 1, 2, 3];
const MAX_ICE_SLIDE_STEPS = 6;
const WATER_PENALTY = -0.06;
const FIRE_PENALTY = -0.14;
const HOLE_PENALTY = -1.0;

function isPathCell(cell: MazeChar): boolean {
  return cell !== "#" && cell !== "H";
}

function isWalkable(layout: MazeLayout, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row >= layout.size || col >= layout.size) {
    return false;
  }
  return isPathCell(layout.grid[row]?.[col] ?? "#");
}

function key(row: number, col: number): string {
  return `${row},${col}`;
}

function parseKey(k: string): { row: number; col: number } {
  const [row, col] = k.split(",").map(Number);
  return { row, col };
}

function directionFromDelta(dr: number, dc: number): Direction {
  for (const dir of DIR_ORDER) {
    const vec = DIR_VECTORS[dir];
    if (vec.dr === dr && vec.dc === dc) {
      return dir;
    }
  }
  return 1;
}

function oppositeDir(dir: Direction): Direction {
  return ((dir + 2) % 4) as Direction;
}

export function initialDirectionForMaze(layout: MazeLayout): Direction {
  const start = layout.start;
  const goal = layout.goal;
  if (start.row === goal.row && start.col === goal.col) {
    return 1;
  }

  // Prefer a heading that points toward the goal axis while staying in open space.
  const dr = goal.row - start.row;
  const dc = goal.col - start.col;
  const horizontalDir: Direction = dc >= 0 ? 1 : 3;
  const verticalDir: Direction = dr >= 0 ? 2 : 0;
  const preferred: Direction[] =
    Math.abs(dc) >= Math.abs(dr)
      ? [horizontalDir, verticalDir, oppositeDir(horizontalDir), oppositeDir(verticalDir)]
      : [verticalDir, horizontalDir, oppositeDir(verticalDir), oppositeDir(horizontalDir)];
  for (const dir of preferred) {
    const vec = DIR_VECTORS[dir];
    if (isWalkable(layout, start.row + vec.dr, start.col + vec.dc)) {
      return dir;
    }
  }

  const startKey = key(start.row, start.col);
  const goalKey = key(goal.row, goal.col);
  const queue: Array<{ row: number; col: number }> = [{ row: start.row, col: start.col }];
  const visited = new Set<string>([startKey]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.row === goal.row && cur.col === goal.col) {
      break;
    }
    for (const dir of DIR_ORDER) {
      const vec = DIR_VECTORS[dir];
      const nr = cur.row + vec.dr;
      const nc = cur.col + vec.dc;
      if (!isWalkable(layout, nr, nc)) {
        continue;
      }
      const nk = key(nr, nc);
      if (visited.has(nk)) {
        continue;
      }
      visited.add(nk);
      parent.set(nk, key(cur.row, cur.col));
      queue.push({ row: nr, col: nc });
    }
  }

  if (visited.has(goalKey)) {
    let cursor = goalKey;
    let prev = parent.get(cursor);
    while (prev && prev !== startKey) {
      cursor = prev;
      prev = parent.get(cursor);
    }
    if (prev === startKey) {
      const next = parseKey(cursor);
      return directionFromDelta(next.row - start.row, next.col - start.col);
    }
  }

  // Fallback: pick the first open direction by a stable order.
  const fallbackOrder: Direction[] = [1, 2, 3, 0];
  for (const dir of fallbackOrder) {
    const vec = DIR_VECTORS[dir];
    if (isWalkable(layout, start.row + vec.dr, start.col + vec.dc)) {
      return dir;
    }
  }
  return 1;
}

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
  startDir: Direction;
  stepCount: number;
  episodeReturn: number;
  maxSteps: number;

  constructor(layout: MazeLayout, rewards: RewardConfig = DEFAULT_REWARDS) {
    this.layout = layout;
    this.rewards = rewards;
    this.maxSteps = layout.size === 9 ? rewards.maxSteps9 : rewards.maxSteps11;
    this.startDir = initialDirectionForMaze(layout);
    this.state = { row: layout.start.row, col: layout.start.col, dir: this.startDir };
    this.stepCount = 0;
    this.episodeReturn = 0;
  }

  reset(): Observation {
    this.state = { row: this.layout.start.row, col: this.layout.start.col, dir: this.startDir };
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

  private tileAt(row: number, col: number): MazeChar {
    if (row < 0 || col < 0 || row >= this.layout.size || col >= this.layout.size) {
      return "#";
    }
    return this.layout.grid[row][col];
  }

  private slideForwardOnIce(state: EnvState): void {
    const vec = DIR_VECTORS[state.dir];
    for (let i = 0; i < MAX_ICE_SLIDE_STEPS; i += 1) {
      if (this.tileAt(state.row, state.col) !== "I") {
        return;
      }
      const nr = state.row + vec.dr;
      const nc = state.col + vec.dc;
      if (this.isBlocked(nr, nc)) {
        return;
      }
      state.row = nr;
      state.col = nc;
    }
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
        this.slideForwardOnIce(next);
      }
    }

    this.state = next;
    this.stepCount += 1;

    const observation = this.observe(next);
    let reward = this.rewards.stepPenalty;
    if (bump) {
      reward += this.rewards.wallBumpPenalty;
    }

    const landedTile = this.tileAt(next.row, next.col);
    if (landedTile === "W") {
      reward += WATER_PENALTY;
    } else if (landedTile === "F") {
      reward += FIRE_PENALTY;
    } else if (landedTile === "H") {
      reward += HOLE_PENALTY;
    }

    let done = false;
    let success = false;

    if (landedTile === "H") {
      done = true;
    } else if (observation.at_goal) {
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
