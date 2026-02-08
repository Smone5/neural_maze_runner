import { MazeAnalysis, MazeLayout, Point } from "./maze_types";

function neighbors(layout: MazeLayout, row: number, col: number): Point[] {
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  const out: Point[] = [];
  for (const [dr, dc] of dirs) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr < 0 || nr >= layout.size || nc < 0 || nc >= layout.size) {
      continue;
    }
    if (layout.grid[nr][nc] !== "#") {
      out.push({ row: nr, col: nc });
    }
  }
  return out;
}

function shortestPathLength(layout: MazeLayout): number | null {
  const visited = Array.from({ length: layout.size }, () => Array(layout.size).fill(false));
  const queue: Array<Point & { d: number }> = [{ ...layout.start, d: 0 }];
  visited[layout.start.row][layout.start.col] = true;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.row === layout.goal.row && cur.col === layout.goal.col) {
      return cur.d;
    }
    for (const next of neighbors(layout, cur.row, cur.col)) {
      if (visited[next.row][next.col]) {
        continue;
      }
      visited[next.row][next.col] = true;
      queue.push({ ...next, d: cur.d + 1 });
    }
  }

  return null;
}

export function analyzeMaze(layout: MazeLayout): MazeAnalysis {
  let floorCount = 0;
  let wallCount = 0;
  let deadEnds = 0;
  let intersections = 0;

  for (let r = 0; r < layout.size; r += 1) {
    for (let c = 0; c < layout.size; c += 1) {
      const cell = layout.grid[r][c];
      if (cell === "#") {
        wallCount += 1;
        continue;
      }
      floorCount += 1;
      const degree = neighbors(layout, r, c).length;
      if (degree === 1) {
        deadEnds += 1;
      }
      if (degree >= 3) {
        intersections += 1;
      }
    }
  }

  const path = shortestPathLength(layout);

  return {
    shortestPathLength: path,
    deadEnds,
    intersections,
    wallDensityPercent: ((wallCount / (wallCount + floorCount || 1)) * 100),
  };
}
