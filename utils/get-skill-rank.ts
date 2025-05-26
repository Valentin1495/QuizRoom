export type SkillRank = 'S' | 'A' | 'B' | 'C' | 'D' | 'N/A';

export interface SkillRankResult {
  rank: SkillRank;
  color: string;
}

// 게임 스타일 등급 (S, A, B, C, D)
export const getSkillRank = (score: number): SkillRankResult => {
  if (score < 1 || score > 10) {
    return { rank: 'N/A', color: '#9CA3AF' };
  }

  if (score >= 1 && score <= 2) {
    return { rank: 'D', color: '#EF4444' };
  }
  if (score >= 3 && score <= 4) {
    return { rank: 'C', color: '#F97316' };
  }
  if (score >= 5 && score <= 6) {
    return { rank: 'B', color: '#EAB308' };
  }
  if (score >= 7 && score <= 8) {
    return { rank: 'A', color: '#22C55E' };
  }
  if (score >= 9 && score <= 10) {
    return { rank: 'S', color: '#8B5CF6' }; // 보라색 (최고 등급)
  }

  // 타입스크립트를 위한 fallback (실제로는 도달하지 않음)
  return { rank: 'N/A', color: '#9CA3AF' };
};
