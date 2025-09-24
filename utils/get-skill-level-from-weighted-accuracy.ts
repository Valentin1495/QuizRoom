type Difficulty = 'easy' | 'medium' | 'hard';
type SkillLevelType =
  | '등급 미부여 - 아직 퀴즈를 3세트(30문제) 이상 풀지 않아 등급이 부여되지 않았어요. 더 많은 문제를 풀면 실력 티어가 표시됩니다.'
  | '🤪 완전 깡깡이'
  | '😅 여전히 깡깡이'
  | '🤔 깡깡이 벗어나는 중'
  | '🧠 이제 깡깡이 아님'
  | '🚀 깡깡이 완전 극복';

interface DifficultyStats {
  totalQuestions: number;
  accuracy: number;
}

type DifficultyAnalysis = Record<Difficulty, DifficultyStats>;

// 통일된 가중 평균 정확도 계산 함수 (문제 수 기반)
export function calculateWeightedAccuracy(difficultyStats: DifficultyAnalysis): number {
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

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
}

// 스킬 레벨 결정 함수 (weightedAccuracy 기반)
export function getSkillLevelFromWeightedAccuracy(
  weightedAccuracy: number,
  minTotalQuestions?: number,
): SkillLevelType {
  // 티어 산정 기준
  if (weightedAccuracy < 40) return '🤪 완전 깡깡이';
  if (weightedAccuracy < 60) return '😅 여전히 깡깡이';
  if (weightedAccuracy < 75) return '🤔 깡깡이 벗어나는 중';
  if (weightedAccuracy < 85) return '🧠 이제 깡깡이 아님';
  if (weightedAccuracy < 95) return '🚀 깡깡이 완전 극복';
  return '등급 미부여 - 아직 퀴즈를 3세트(30문제) 이상 풀지 않아 등급이 부여되지 않았어요. 더 많은 문제를 풀면 실력 티어가 표시됩니다.';
}
