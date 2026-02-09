export type MazeChar = "#" | "." | "S" | "G" | "I" | "W" | "F" | "H";

export interface MazeLegend {
  "#": "wall";
  ".": "floor";
  S: "start";
  G: "goal";
  I?: "ice";
  W?: "water";
  F?: "fire";
  H?: "hole";
}

export const DEFAULT_MAZE_LEGEND: MazeLegend = {
  "#": "wall",
  ".": "floor",
  S: "start",
  G: "goal",
  I: "ice",
  W: "water",
  F: "fire",
  H: "hole",
};

export interface MazeJson {
  name: string;
  size: 9 | 11 | 13 | 15 | 17;
  grid: string[];
  legend: MazeLegend;
}

export interface Point {
  row: number;
  col: number;
}

export interface MazeLayout {
  name: string;
  size: 9 | 11 | 13 | 15 | 17;
  grid: MazeChar[][];
  start: Point;
  goal: Point;
}

export interface MazeValidationResult {
  ok: boolean;
  errors: string[];
}

export interface MazeAnalysis {
  shortestPathLength: number | null;
  deadEnds: number;
  intersections: number;
  wallDensityPercent: number;
}

export function toMazeJson(layout: MazeLayout): MazeJson {
  return {
    name: layout.name,
    size: layout.size,
    grid: layout.grid.map((row) => row.join("")),
    legend: DEFAULT_MAZE_LEGEND,
  };
}

export function cloneMaze(layout: MazeLayout): MazeLayout {
  return {
    name: layout.name,
    size: layout.size,
    grid: layout.grid.map((row) => [...row]),
    start: { ...layout.start },
    goal: { ...layout.goal },
  };
}
