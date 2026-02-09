import { DEFAULT_MAZE_LEGEND, MazeJson, MazeLayout } from "./maze_types";
import { parseMazeJson, validateMazeJson } from "./maze_validate";

export const BUILTIN_MAZE_FILES = [
  "maze1_easy_9.json",
  "maze2_medium_11.json",
  "maze3_hazard_fork_9.json",
  "maze4_frozen_lake_11.json",
  "maze5_elemental_gauntlet_11.json",
];

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function loadBuiltinMazes(): Promise<MazeLayout[]> {
  const mazes: MazeLayout[] = [];
  for (const file of BUILTIN_MAZE_FILES) {
    const res = await fetch(`/mazes/${file}`);
    if (!res.ok) {
      throw new Error(`Failed to load ${file}`);
    }
    const json = (await res.json()) as MazeJson;
    const validation = validateMazeJson(json);
    if (!validation.ok) {
      throw new Error(`Maze ${file} invalid: ${validation.errors.join(" ")}`);
    }
    mazes.push(parseMazeJson(json));
  }
  return mazes;
}

export function encodeMazeToShareUrl(maze: MazeLayout): string {
  const payload: MazeJson = {
    name: maze.name,
    size: maze.size,
    grid: maze.grid.map((row) => row.join("")),
    legend: DEFAULT_MAZE_LEGEND,
  };
  const encoded = bytesToBase64(new TextEncoder().encode(JSON.stringify(payload)));
  const url = new URL(window.location.href);
  url.searchParams.set("maze", encoded);
  return url.toString();
}

export function decodeMazeFromUrl(raw: string | null): MazeLayout | null {
  if (!raw) {
    return null;
  }
  try {
    const decoded = new TextDecoder().decode(base64ToBytes(raw));
    const parsed = JSON.parse(decoded) as MazeJson;
    const validation = validateMazeJson(parsed);
    if (!validation.ok) {
      console.warn("Shared maze invalid", validation.errors);
      return null;
    }
    return parseMazeJson(parsed);
  } catch (err) {
    console.warn("Failed to decode shared maze", err);
    return null;
  }
}
