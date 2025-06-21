type Difficulty = 'easy' | 'medium' | 'hard';
type SkillLevelType =
  | '등급 미부여 - 아직 퀴즈를 3세트(30문제) 이상 풀지 않아 등급이 부여되지 않았어요. 더 많은 문제를 풀면 실력 티어가 표시됩니다.'
  | '⚫ 아이언'
  | '🥉 브론즈'
  | '🥈 실버'
  | '🥇 골드'
  | '💜 플래티넘'
  | '💎 다이아몬드';

interface DifficultyStats {
  totalQuestions: number;
  accuracy: number;
}

type DifficultyAnalysis = Record<Difficulty, DifficultyStats>;

export function getSkillLevelFromWeightedAccuracy(
  difficultyStats: DifficultyAnalysis,
  minTotalQuestions = 30
): SkillLevelType {
  const weights: Record<Difficulty, number> = {
    easy: 1,
    medium: 2,
    hard: 3,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const level of ['easy', 'medium', 'hard'] as Difficulty[]) {
    const stat = difficultyStats[level];
    const questions = stat.totalQuestions;
    const weight = weights[level];

    weightedSum += (stat.accuracy / 100) * questions * weight;
    totalWeight += questions * weight;
  }

  if (totalWeight === 0)
    return '등급 미부여 - 아직 퀴즈를 3세트(30문제) 이상 풀지 않아 등급이 부여되지 않았어요. 더 많은 문제를 풀면 실력 티어가 표시됩니다.';

  const weightedAccuracy = (weightedSum / totalWeight) * 100;

  // 티어 산정 기준
  if (totalWeight < minTotalQuestions)
    return '등급 미부여 - 아직 퀴즈를 3세트(30문제) 이상 풀지 않아 등급이 부여되지 않았어요. 더 많은 문제를 풀면 실력 티어가 표시됩니다.';
  if (weightedAccuracy < 40) return '⚫ 아이언';
  if (weightedAccuracy < 60) return '🥉 브론즈';
  if (weightedAccuracy < 75) return '🥈 실버';
  if (weightedAccuracy < 85) return '🥇 골드';
  if (weightedAccuracy < 95) return '💜 플래티넘';
  return '💎 다이아몬드';
}
