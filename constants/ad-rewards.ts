export type AdRewardSpec = {
  type: string;
  amount: number;
};

const sanitizeRewardType = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'hint_ticket';
};

const sanitizeRewardAmount = (value: string | undefined) => {
  const parsed = Number(value ?? '1');
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
};

export const DEFAULT_ADMOB_REWARD: AdRewardSpec = {
  type: sanitizeRewardType(process.env.EXPO_PUBLIC_ADMOB_REWARD_TYPE),
  amount: sanitizeRewardAmount(process.env.EXPO_PUBLIC_ADMOB_REWARD_AMOUNT),
};

export const REWARDED_AD_REWARDS = {
  streakProtect: DEFAULT_ADMOB_REWARD,
  revive: DEFAULT_ADMOB_REWARD,
  lifelineRecharge: DEFAULT_ADMOB_REWARD,
} as const;

export const isAdRewardMatch = (reward: AdRewardSpec, expected: AdRewardSpec) =>
  reward.type === expected.type && reward.amount >= expected.amount;
