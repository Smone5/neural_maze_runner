import { formatDisplayPoints } from "./points_display";

export interface ExplainContext {
  explored: boolean;
  reward: number;
  bump: boolean;
  goal: boolean;
  maxSteps: boolean;
}

export function explainText(ctx: ExplainContext): string {
  const lines: string[] = [];

  if (ctx.goal) {
    lines.push("Success: reached the goal, big reward.");
  } else if (ctx.maxSteps) {
    lines.push("Stopped: ran out of steps.");
  } else if (ctx.explored) {
    lines.push("Exploring: trying something new.");
  } else {
    lines.push("Exploiting: using what it learned.");
  }

  lines.push(`Reward: points earned this step = ${formatDisplayPoints(ctx.reward)}.`);
  lines.push("Goal: reach the gold square.");

  if (ctx.bump) {
    lines.push("Bump: hit a wall, lost extra points.");
  }

  return lines.join(" ");
}
