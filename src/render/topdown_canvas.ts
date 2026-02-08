import { Action, Direction, EnvState, StepResult } from "../core/env";
import { MazeLayout } from "../core/maze_types";
import { easeInOut, pingPong } from "./animations";

interface Transition {
  from: EnvState;
  to: EnvState;
  action: Action;
  bump: boolean;
  startedAt: number;
  durationMs: number;
}

interface VisualState {
  row: number;
  col: number;
  dir: Direction;
}

const COLORS = {
  bg: "#f2efe8",
  wall: "#242424",
  floor: "#f7f4eb",
  grid: "#ddd5c7",
  agent: "#ff5a36",
  agentStroke: "#9f2e16",
  ghost: "#2f78ff",
  ghostStroke: "#194aa6",
  goal: "#f2c94c",
  goalGlow: "#ffd977",
  start: "#7ad97a",
};

function dirVector(dir: Direction): { x: number; y: number } {
  if (dir === 0) return { x: 0, y: -1 };
  if (dir === 1) return { x: 1, y: 0 };
  if (dir === 2) return { x: 0, y: 1 };
  return { x: -1, y: 0 };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class TopDownCanvasRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private layout: MazeLayout;
  private transition: Transition | null = null;
  private visualState: VisualState;
  private ghostTransition: Transition | null = null;
  private ghostState: VisualState | null = null;
  private editorEnabled = false;
  private lastGoalAt = 0;
  private animationFrame = 0;
  private collectibles: boolean[][] = [];

  onCellClick: ((row: number, col: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, layout: MazeLayout) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context not available");
    }
    this.ctx = ctx;
    this.layout = layout;
    this.visualState = {
      row: layout.start.row,
      col: layout.start.col,
      dir: 1,
    };
    this.resetCollectibles();

    this.canvas.addEventListener("click", (event) => {
      if (!this.editorEnabled || !this.onCellClick) {
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const size = this.cellSize();
      const offsetX = (this.canvas.width - size * this.layout.size) / 2;
      const offsetY = (this.canvas.height - size * this.layout.size) / 2;
      const localX = x - offsetX;
      const localY = y - offsetY;
      if (localX < 0 || localY < 0 || localX >= size * this.layout.size || localY >= size * this.layout.size) {
        return;
      }
      const col = Math.floor(localX / size);
      const row = Math.floor(localY / size);
      if (row >= 0 && col >= 0 && row < this.layout.size && col < this.layout.size) {
        this.onCellClick(row, col);
      }
    });

    this.renderLoop = this.renderLoop.bind(this);
    this.animationFrame = requestAnimationFrame(this.renderLoop);
  }

  destroy(): void {
    cancelAnimationFrame(this.animationFrame);
  }

  setLayout(layout: MazeLayout): void {
    this.layout = layout;
    this.transition = null;
    this.ghostTransition = null;
    this.ghostState = null;
    this.resetCollectibles();
    this.visualState = {
      row: layout.start.row,
      col: layout.start.col,
      dir: 1,
    };
  }

  setEditorEnabled(enabled: boolean): void {
    this.editorEnabled = enabled;
  }

  setAgentState(state: EnvState): void {
    this.transition = null;
    this.resetCollectibles();
    this.collectAt(state.row, state.col);
    this.visualState = { ...state };
  }

  setGhostState(state: EnvState): void {
    this.ghostTransition = null;
    this.ghostState = { ...state };
  }

  clearGhost(): void {
    this.ghostTransition = null;
    this.ghostState = null;
  }

  stepTransition(step: StepResult, speedMs: number): void {
    this.collectFromStep(step);
    this.transition = {
      from: step.prevState,
      to: step.state,
      action: step.action,
      bump: step.bump,
      startedAt: performance.now(),
      durationMs: Math.max(70, speedMs),
    };
    if (step.success) {
      this.lastGoalAt = performance.now();
    }
  }

  stepGhostTransition(step: StepResult, speedMs: number): void {
    this.ghostTransition = {
      from: step.prevState,
      to: step.state,
      action: step.action,
      bump: step.bump,
      startedAt: performance.now(),
      durationMs: Math.max(70, speedMs),
    };
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  private resetCollectibles(): void {
    this.collectibles = this.layout.grid.map((row, r) =>
      row.map((cell, c) => {
        if (cell === "#") return false;
        if (r === this.layout.goal.row && c === this.layout.goal.col) return false;
        return true;
      })
    );
    this.collectAt(this.layout.start.row, this.layout.start.col);
  }

  private collectAt(row: number, col: number): void {
    if (row < 0 || col < 0 || row >= this.layout.size || col >= this.layout.size) {
      return;
    }
    if (!this.collectibles[row]) {
      return;
    }
    this.collectibles[row][col] = false;
  }

  private collectFromStep(step: StepResult): void {
    if (step.bump) {
      return;
    }
    const moved = step.prevState.row !== step.state.row || step.prevState.col !== step.state.col;
    if (!moved) {
      return;
    }
    this.collectAt(step.state.row, step.state.col);
  }

  private cellSize(): number {
    return Math.floor(Math.min(this.canvas.width, this.canvas.height) / this.layout.size);
  }

  private renderLoop(timestamp: number): void {
    this.render(timestamp);
    this.animationFrame = requestAnimationFrame(this.renderLoop);
  }

  private drawGrid(): void {
    const size = this.cellSize();
    const offsetX = (this.canvas.width - size * this.layout.size) / 2;
    const offsetY = (this.canvas.height - size * this.layout.size) / 2;

    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let r = 0; r < this.layout.size; r += 1) {
      for (let c = 0; c < this.layout.size; c += 1) {
        const x = offsetX + c * size;
        const y = offsetY + r * size;

        const cell = this.layout.grid[r][c];
        if (cell === "#") {
          this.ctx.fillStyle = COLORS.wall;
          this.ctx.fillRect(x, y, size, size);
        } else {
          this.ctx.fillStyle = COLORS.floor;
          this.ctx.fillRect(x, y, size, size);
        }

        this.ctx.strokeStyle = COLORS.grid;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, size, size);

        if (r === this.layout.start.row && c === this.layout.start.col) {
          this.ctx.fillStyle = COLORS.start;
          this.ctx.globalAlpha = 0.32;
          this.ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
          this.ctx.globalAlpha = 1;
        }
      }
    }

    const now = performance.now();
    const pulse = 0.5 + 0.5 * Math.sin((now - this.lastGoalAt) * 0.01);
    const gx = offsetX + this.layout.goal.col * size;
    const gy = offsetY + this.layout.goal.row * size;

    this.ctx.fillStyle = COLORS.goalGlow;
    this.ctx.globalAlpha = 0.25 + 0.25 * pulse;
    this.ctx.fillRect(gx + size * 0.1, gy + size * 0.1, size * 0.8, size * 0.8);

    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = COLORS.goal;
    this.ctx.fillRect(gx + size * 0.2, gy + size * 0.2, size * 0.6, size * 0.6);
  }

  private drawCollectibles(now: number): void {
    const size = this.cellSize();
    const offsetX = (this.canvas.width - size * this.layout.size) / 2;
    const offsetY = (this.canvas.height - size * this.layout.size) / 2;

    for (let r = 0; r < this.layout.size; r += 1) {
      for (let c = 0; c < this.layout.size; c += 1) {
        if (!this.collectibles[r]?.[c]) {
          continue;
        }
        const x = offsetX + c * size + size / 2;
        const y = offsetY + r * size + size / 2;
        const pulse = 0.82 + 0.18 * Math.sin((now + r * 61 + c * 47) * 0.008);

        this.ctx.save();
        this.ctx.globalAlpha = 0.35 * pulse;
        this.ctx.fillStyle = "#7dd3fc";
        this.ctx.beginPath();
        this.ctx.arc(x, y, size * 0.19, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.globalAlpha = 0.95;
        this.ctx.fillStyle = "#fef08a";
        this.ctx.beginPath();
        this.ctx.arc(x, y, size * 0.1, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    }
  }

  private drawAgent(state: VisualState, ghost = false): void {
    const size = this.cellSize();
    const offsetX = (this.canvas.width - size * this.layout.size) / 2;
    const offsetY = (this.canvas.height - size * this.layout.size) / 2;

    const cx = offsetX + state.col * size + size / 2;
    const cy = offsetY + state.row * size + size / 2;
    const radius = size * (ghost ? 0.24 : 0.28);

    this.ctx.fillStyle = ghost ? COLORS.ghost : COLORS.agent;
    this.ctx.strokeStyle = ghost ? COLORS.ghostStroke : COLORS.agentStroke;
    this.ctx.lineWidth = 2;
    this.ctx.globalAlpha = ghost ? 0.72 : 1;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    const vec = dirVector(state.dir);
    this.ctx.strokeStyle = "#fff";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.lineTo(cx + vec.x * radius * 0.9, cy + vec.y * radius * 0.9);
    this.ctx.stroke();
    this.ctx.globalAlpha = 1;
  }

  private interpolate(now: number, transition: Transition | null, fallback: VisualState): [VisualState, boolean] {
    if (!transition) {
      return [{ ...fallback }, false];
    }

    const elapsed = now - transition.startedAt;
    const t = Math.min(1, elapsed / transition.durationMs);
    const eased = easeInOut(t);

    let row = lerp(transition.from.row, transition.to.row, eased);
    let col = lerp(transition.from.col, transition.to.col, eased);
    const dir = t < 0.5 ? transition.from.dir : transition.to.dir;

    if (transition.bump && transition.action === 0) {
      const amount = 0.12 * pingPong(eased);
      const vec = dirVector(transition.from.dir);
      row += vec.y * amount;
      col += vec.x * amount;
    }

    if (t >= 1) {
      return [{ ...transition.to }, true];
    }

    return [{ row, col, dir }, false];
  }

  render(now = performance.now()): void {
    this.drawGrid();
    this.drawCollectibles(now);

    const [agentState, doneAgent] = this.interpolate(now, this.transition, this.visualState);
    if (doneAgent && this.transition) {
      this.visualState = { ...this.transition.to };
      this.transition = null;
    }

    const [ghostState, doneGhost] = this.interpolate(now, this.ghostTransition, this.ghostState ?? this.visualState);
    if (doneGhost && this.ghostTransition) {
      this.ghostState = { ...this.ghostTransition.to };
      this.ghostTransition = null;
    }

    this.drawAgent(agentState, false);
    if (this.ghostState) {
      this.drawAgent(ghostState, true);
    }

    if (this.editorEnabled) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.52)";
      this.ctx.fillRect(0, this.canvas.height - 26, this.canvas.width, 26);
      this.ctx.fillStyle = "#fff";
      this.ctx.font = "12px monospace";
      this.ctx.fillText("Editor mode: click cells to edit", 8, this.canvas.height - 9);
    }
  }
}
