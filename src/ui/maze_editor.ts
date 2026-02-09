import { analyzeMaze } from "../core/maze_analyze";
import { cloneMaze, MazeAnalysis, MazeLayout } from "../core/maze_types";
import { validateMazeLayout } from "../core/maze_validate";

export type EditorTool = "wall" | "start" | "goal" | "ice" | "water" | "fire" | "hole";

export interface EditorStatus {
  valid: boolean;
  errors: string[];
  analysis: MazeAnalysis;
}

export class MazeEditor {
  private maze: MazeLayout;
  private tool: EditorTool = "wall";
  private enabled = false;

  constructor(initialMaze: MazeLayout) {
    this.maze = cloneMaze(initialMaze);
  }

  setMaze(maze: MazeLayout): void {
    this.maze = cloneMaze(maze);
  }

  getMaze(): MazeLayout {
    return cloneMaze(this.maze);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
  }

  setTool(tool: EditorTool): void {
    this.tool = tool;
  }

  applyAt(row: number, col: number): void {
    if (!this.enabled) {
      return;
    }

    if (row === 0 || col === 0 || row === this.maze.size - 1 || col === this.maze.size - 1) {
      return;
    }

    if (this.tool === "wall") {
      const cell = this.maze.grid[row][col];
      if (cell === "S" || cell === "G") {
        this.maze.grid[row][col] = ".";
      } else {
        this.maze.grid[row][col] = cell === "#" ? "." : "#";
      }
      return;
    }

    if (this.tool === "start") {
      for (let r = 0; r < this.maze.size; r += 1) {
        for (let c = 0; c < this.maze.size; c += 1) {
          if (this.maze.grid[r][c] === "S") {
            this.maze.grid[r][c] = ".";
          }
        }
      }
      this.maze.grid[row][col] = "S";
      this.maze.start = { row, col };
      return;
    }

    if (this.tool === "goal") {
      for (let r = 0; r < this.maze.size; r += 1) {
        for (let c = 0; c < this.maze.size; c += 1) {
          if (this.maze.grid[r][c] === "G") {
            this.maze.grid[r][c] = ".";
          }
        }
      }
      this.maze.grid[row][col] = "G";
      this.maze.goal = { row, col };
      return;
    }

    if (this.tool === "ice") {
      this.maze.grid[row][col] = "I";
      return;
    }

    if (this.tool === "water") {
      this.maze.grid[row][col] = "W";
      return;
    }

    if (this.tool === "fire") {
      this.maze.grid[row][col] = "F";
      return;
    }

    if (this.tool === "hole") {
      this.maze.grid[row][col] = "H";
    }
  }

  status(): EditorStatus {
    const validation = validateMazeLayout(this.maze);
    const analysis = analyzeMaze(this.maze);

    return {
      valid: validation.ok,
      errors: validation.errors,
      analysis,
    };
  }
}
