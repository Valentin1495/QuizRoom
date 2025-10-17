const MIN_ELO = 600;
const MAX_ELO = 2400;
const BASE_ELO = 1200;
const ELO_SPREAD = 800;
const DOT_SEGMENTS = [0.45, 0.65];

export const USER_K = 24;
export const QUESTION_K = 16;

export const clampElo = (value: number) => {
  return Math.max(MIN_ELO, Math.min(MAX_ELO, Math.round(value)));
};

export const mapDifficultyToElo = (difficulty: number | null | undefined) => {
  if (difficulty === null || difficulty === undefined) {
    return BASE_ELO;
  }
  return clampElo(BASE_ELO + (difficulty - 0.5) * ELO_SPREAD);
};

export const expectedScore = (userElo: number, questionElo: number) => {
  return 1 / (1 + Math.pow(10, (questionElo - userElo) / 400));
};

export const projectElo = (
  current: number,
  opponent: number,
  result: 1 | 0,
  k: number = USER_K
) => {
  const expectation = expectedScore(current, opponent);
  const next = current + k * (result - expectation);
  return clampElo(next);
};

export const difficultyToDots = (difficulty: number | null | undefined) => {
  const normalized = difficulty ?? 0.5;
  if (normalized <= DOT_SEGMENTS[0]) return 1;
  if (normalized <= DOT_SEGMENTS[1]) return 2;
  return 3;
};
