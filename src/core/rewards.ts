export interface RewardConfig {
  stepPenalty: number;
  wallBumpPenalty: number;
  goalReward: number;
  maxSteps9: number;
  maxSteps11: number;
}

export const DEFAULT_REWARDS: RewardConfig = {
  stepPenalty: -0.01,
  wallBumpPenalty: -0.05,
  goalReward: 1.0,
  maxSteps9: 120,
  maxSteps11: 180,
};
