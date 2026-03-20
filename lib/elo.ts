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
  failed?: boolean;
};

export type AssessmentResult = {
  finalElo: number;
  topPercent: number;
  accuracy: number;
  answered: number;
  correct: number;
};

export type EliteTier = 'candidate' | 'elite' | 'elite_plus' | 'none';

export type EliteEligibilityResult = {
  isEligible: boolean;
  overallAccuracy: number;
  collegeBasicAccuracy: number;
  reachedCollegePlus: boolean;
};

export type EliteRoundResult = {
  tier: EliteTier;
  label: string | null;
  description: string | null;
  topPercent: number | null;
  correct: number;
  answered: number;
};

const EDUCATION_LEVEL_ORDER: EducationLevelKey[] = [
  'elem_low',
  'elem_high',
  'middle',
  'high',
  'college_basic',
  'college_plus',
];

const EDUCATION_LEVEL_PERCENTILE_FLOOR: Partial<Record<EducationLevelKey, number>> = {
  elem_high: 80,
  middle: 60,
  high: 40,
  college_basic: 25,
  college_plus: 12,
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

const getPreviousEducationLevel = (levelKey: EducationLevelKey) => {
  const levelIndex = EDUCATION_LEVEL_ORDER.indexOf(levelKey);
  if (levelIndex <= 0) return null;
  return EDUCATION_LEVEL_ORDER[levelIndex - 1] ?? null;
};

const getAssessmentPercentileFloor = (stageResults: AssessmentStageResult[]) => {
  const failedStage = stageResults.find((stage) => stage.failed);
  if (!failedStage) return null;

  const floorLevel = getPreviousEducationLevel(failedStage.eduLevel);
  if (!floorLevel) return null;

  return EDUCATION_LEVEL_PERCENTILE_FLOOR[floorLevel] ?? null;
};

const getStageStats = (stageResults: AssessmentStageResult[], levelKey: EducationLevelKey) => {
  const stage = stageResults.find((entry) => entry.eduLevel === levelKey);
  const answered = Math.max(0, stage?.answered ?? 0);
  const correct = Math.max(0, Math.min(stage?.correct ?? 0, answered));
  const accuracy = answered > 0 ? correct / answered : 0;

  return { answered, correct, accuracy };
};

export const calculateEliteRoundEligibility = (
  stageResults: AssessmentStageResult[],
  options?: { usedLifeline?: boolean }
): EliteEligibilityResult => {
  const totals = calculateAssessmentResult(stageResults);
  const collegeBasicStats = getStageStats(stageResults, 'college_basic');
  const collegePlusStats = getStageStats(stageResults, 'college_plus');
  const reachedCollegePlus = collegePlusStats.answered > 0;
  const usedLifeline = options?.usedLifeline ?? false;
  const overallAccuracy = totals.answered > 0 ? totals.correct / totals.answered : 0;
  const isEligible =
    !usedLifeline &&
    reachedCollegePlus &&
    collegeBasicStats.correct >= 2 &&
    overallAccuracy >= 0.75;

  return {
    isEligible,
    overallAccuracy,
    collegeBasicAccuracy: collegeBasicStats.accuracy,
    reachedCollegePlus,
  };
};

export const calculateEliteRoundResult = (
  answered: number,
  correct: number,
  options?: { overallAccuracy?: number }
): EliteRoundResult => {
  const safeAnswered = Math.max(0, answered);
  const safeCorrect = Math.max(0, Math.min(correct, safeAnswered));
  const overallAccuracy = options?.overallAccuracy ?? 0;

  if (safeCorrect >= 5 && overallAccuracy >= 0.85) {
    return {
      tier: 'elite_plus',
      label: '최상위권',
      description: '',
      topPercent: 3,
      answered: safeAnswered,
      correct: safeCorrect,
    };
  }

  if (safeCorrect >= 4) {
    return {
      tier: 'elite',
      label: '상위권',
      description: '',
      topPercent: 8,
      answered: safeAnswered,
      correct: safeCorrect,
    };
  }

  if (safeCorrect >= 3) {
    return {
      tier: 'candidate',
      label: '상위권 후보',
      description: '',
      topPercent: 15,
      answered: safeAnswered,
      correct: safeCorrect,
    };
  }

  return {
    tier: 'none',
    label: null,
    description: null,
    topPercent: null,
    answered: safeAnswered,
    correct: safeCorrect,
  };
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
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const rawTopPercent = mapEloToPercentile(finalElo);
  const percentileFloor = getAssessmentPercentileFloor(stageResults);
  const topPercent =
    percentileFloor === null ? rawTopPercent : Math.min(rawTopPercent, percentileFloor);

  return {
    finalElo,
    topPercent,
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
