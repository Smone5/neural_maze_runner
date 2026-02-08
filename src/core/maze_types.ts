export type MazeChar = "#" | "." | "S" | "G";

export interface MazeLegend {
  "#": "wall";
  ".": "floor";
  S: "start";
  G: "goal";
}

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
    legend: {
      "#": "wall",
      ".": "floor",
      S: "start",
      G: "goal",
    },
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
