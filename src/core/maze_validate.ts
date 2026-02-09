import { DEFAULT_MAZE_LEGEND, MazeChar, MazeJson, MazeLayout, MazeValidationResult, Point } from "./maze_types";

function inBounds(row: number, col: number, size: number): boolean {
  return row >= 0 && row < size && col >= 0 && col < size;
}

function isPathCell(cell: MazeChar): boolean {
  return cell !== "#" && cell !== "H";
}

function findSpecial(grid: MazeChar[][], key: "S" | "G"): Point[] {
  const points: Point[] = [];
  for (let r = 0; r < grid.length; r += 1) {
    for (let c = 0; c < grid[r].length; c += 1) {
      if (grid[r][c] === key) {
        points.push({ row: r, col: c });
      }
    }
  }
  return points;
}

function bfsReachable(grid: MazeChar[][], start: Point, goal: Point): boolean {
  const size = grid.length;
  const visited: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const queue: Point[] = [start];
  visited[start.row][start.col] = true;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.row === goal.row && cur.col === goal.col) {
      return true;
    }

    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    for (const [dr, dc] of dirs) {
      const nr = cur.row + dr;
      const nc = cur.col + dc;
      if (!inBounds(nr, nc, size)) {
        continue;
      }
      if (visited[nr][nc] || !isPathCell(grid[nr][nc])) {
        continue;
      }
      visited[nr][nc] = true;
      queue.push({ row: nr, col: nc });
    }
  }

  return false;
}

export function parseMazeJson(input: MazeJson): MazeLayout {
  const grid: MazeChar[][] = input.grid.map((row) => row.split("") as MazeChar[]);
  const starts = findSpecial(grid, "S");
  const goals = findSpecial(grid, "G");

  return {
    name: input.name,
    size: input.size,
    grid,
    start: starts[0] ?? { row: 1, col: 1 },
    goal: goals[0] ?? { row: input.size - 2, col: input.size - 2 },
  };
}

export function validateMazeJson(input: MazeJson): MazeValidationResult {
  const errors: string[] = [];

  if (!(input.size === 9 || input.size === 11 || input.size === 13 || input.size === 15 || input.size === 17)) {
    errors.push("Maze size must be one of: 9, 11, 13, 15, 17.");
  }

  if (input.grid.length !== input.size) {
    errors.push(`Grid row count (${input.grid.length}) must match size (${input.size}).`);
  }

  const allowedChars = new Set(["#", ".", "S", "G", "I", "W", "F", "H"]);
  const parsed: MazeChar[][] = [];

  for (let r = 0; r < input.grid.length; r += 1) {
    const row = input.grid[r];
    if (row.length !== input.size) {
      errors.push(`Row ${r + 1} length (${row.length}) must match size (${input.size}).`);
    }

    const chars = row.split("") as MazeChar[];
    for (let c = 0; c < chars.length; c += 1) {
      if (!allowedChars.has(chars[c])) {
        errors.push(`Invalid cell '${chars[c]}' at row ${r + 1}, col ${c + 1}.`);
      }
    }
    parsed.push(chars);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const starts = findSpecial(parsed, "S");
  const goals = findSpecial(parsed, "G");

  if (starts.length !== 1) {
    errors.push(`Maze must contain exactly one start S. Found ${starts.length}.`);
  }
  if (goals.length !== 1) {
    errors.push(`Maze must contain exactly one goal G. Found ${goals.length}.`);
  }

  for (let i = 0; i < input.size; i += 1) {
    if (parsed[0][i] !== "#" || parsed[input.size - 1][i] !== "#") {
      errors.push("Top and bottom borders must be all walls (#).");
      break;
    }
  }
  for (let i = 0; i < input.size; i += 1) {
    if (parsed[i][0] !== "#" || parsed[i][input.size - 1] !== "#") {
      errors.push("Left and right borders must be all walls (#).");
      break;
    }
  }

  let wallCount = 0;
  for (const row of parsed) {
    for (const cell of row) {
      if (cell === "#") {
        wallCount += 1;
      }
    }
  }
  const density = wallCount / (input.size * input.size);
  if (density > 0.6) {
    errors.push(`Wall density ${(density * 100).toFixed(1)}% exceeds 60% limit.`);
  }

  if (starts.length === 1 && goals.length === 1) {
    if (!bfsReachable(parsed, starts[0], goals[0])) {
      errors.push("Goal is not reachable from start (BFS check failed).");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validateMazeLayout(layout: MazeLayout): MazeValidationResult {
  return validateMazeJson({
    name: layout.name,
    size: layout.size,
    grid: layout.grid.map((row) => row.join("")),
    legend: DEFAULT_MAZE_LEGEND,
  });
}
