const MIN_ELO = 600;
const MAX_ELO = 2400;
const BASE_ELO = 1200;
const ELO_SPREAD = 800;
const DOT_SEGMENTS = [0.45, 0.65];

export const USER_K = 24;
export const QUESTION_K = 16;

export const EDUCATION_LEVEL_ELO = {
  elem_low: 800,
  elem_high: 1000,
  middle: 1200,
  high: 1400,
  college_basic: 1600,
  college_plus: 1800,
} as const;

export type EducationLevelKey = keyof typeof EDUCATION_LEVEL_ELO;

export type AssessmentStageResult = {
  eduLevel: EducationLevelKey;
  answered: number;
  correct: number;
};

export type AssessmentEduBand = {
  key: EducationLevelKey;
  label: string;
};

export type AssessmentResult = {
  finalElo: number;
  topPercent: number;
  eduLevelKey: EducationLevelKey;
  eduLevelLabel: string;
  accuracy: number;
  answered: number;
  correct: number;
};

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

export const calculateExpectedScore = expectedScore;

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

export const projectUserElo = projectElo;

export const mapEduLevelToElo = (levelKey: EducationLevelKey) => {
  return EDUCATION_LEVEL_ELO[levelKey] ?? BASE_ELO;
};

export const mapEloToPercentile = (elo: number) => {
  const probability = 1 / (1 + Math.exp(-(elo - BASE_ELO) / 200));
  return Math.max(0, Math.min(100, Math.round((1 - probability) * 100)));
};

export const mapEloToEduBand = (elo: number): AssessmentEduBand => {
  if (elo < 900) return { key: 'elem_low', label: '초등 저학년' };
  if (elo < 1100) return { key: 'elem_high', label: '초등 고학년' };
  if (elo < 1300) return { key: 'middle', label: '중등' };
  if (elo < 1500) return { key: 'high', label: '고등' };
  if (elo < 1700) return { key: 'college_basic', label: '대학' };
  return { key: 'college_plus', label: '대학+' };
};

export const calculateAssessmentResult = (
  stageResults: AssessmentStageResult[],
  options?: { initialElo?: number; k?: number }
): AssessmentResult => {
  const initialElo = options?.initialElo ?? BASE_ELO;
  const k = options?.k ?? USER_K;

  let currentElo = clampElo(initialElo);
  let answered = 0;
  let correct = 0;

  stageResults.forEach((stage) => {
    const questionElo = mapEduLevelToElo(stage.eduLevel);
    const safeAnswered = Math.max(0, stage.answered);
    const safeCorrect = Math.max(0, Math.min(stage.correct, safeAnswered));
    const incorrect = safeAnswered - safeCorrect;

    answered += safeAnswered;
    correct += safeCorrect;

    for (let index = 0; index < safeCorrect; index += 1) {
      currentElo = projectUserElo(currentElo, questionElo, 1, k);
    }
    for (let index = 0; index < incorrect; index += 1) {
      currentElo = projectUserElo(currentElo, questionElo, 0, k);
    }
  });

  const finalElo = answered > 0 ? currentElo : BASE_ELO;
  const eduBand = mapEloToEduBand(finalElo);
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  return {
    finalElo,
    topPercent: mapEloToPercentile(finalElo),
    eduLevelKey: eduBand.key,
    eduLevelLabel: eduBand.label,
    accuracy,
    answered,
    correct,
  };
};

export const difficultyToDots = (difficulty: number | null | undefined) => {
  const normalized = difficulty ?? 0.5;
  if (normalized <= DOT_SEGMENTS[0]) return 1;
  if (normalized <= DOT_SEGMENTS[1]) return 2;
  return 3;
};
