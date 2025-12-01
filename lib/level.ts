// 클라이언트용 레벨 계산 유틸리티
// 백엔드(convex/users.ts)와 동일한 로직

export type LevelInfo = {
  level: number;
  current: number;
  next: number;
  progress: number;
  totalXpForLevel: number;
};

// XP -> 레벨 변환 함수
export function calculateLevel(xp: number): LevelInfo {
  let level = 1;
  let totalXp = 0;

  // 레벨당 필요 XP: 100 * level^1.5
  while (totalXp + Math.floor(100 * Math.pow(level, 1.5)) <= xp) {
    totalXp += Math.floor(100 * Math.pow(level, 1.5));
    level++;
  }

  const current = xp - totalXp;
  const next = Math.floor(100 * Math.pow(level, 1.5));
  const progress = Math.min(100, Math.round((current / next) * 100));

  return { level, current, next, progress, totalXpForLevel: totalXp };
}

// 레벨별 타이틀
export function getLevelTitle(level: number): string {
  if (level >= 60) return '챌린저';
  if (level >= 50) return '그랜드 마스터';
  if (level >= 40) return '마스터';
  if (level >= 30) return '다이아몬드';
  if (level >= 20) return '플래티넘';
  if (level >= 15) return '골드';
  if (level >= 10) return '실버';
  if (level >= 5) return '브론즈';
  return '아이언';
}

// 레벨별 색상 (가독성을 위해 라이트/다크 모드 색상 조정)
export function getLevelColor(level: number, isDark: boolean): string {
  if (level >= 60) return isDark ? '#00F7BF' : '#00A37E'; // 챌린저 - 네온 민트 (라이트 모드용 어두운 톤)
  if (level >= 50) return '#FF6B6B'; // 그랜드 마스터 - 빨강
  if (level >= 40) return '#A855F7'; // 마스터 - 보라
  if (level >= 30) return '#3B82F6'; // 다이아몬드 - 파랑
  if (level >= 20) return '#38BDF8'; // 플래티넘 - 스카이 블루
  if (level >= 15) return isDark ? '#FFD700' : '#B8860B'; // 골드 - 금색 (라이트 모드용 어두운 톤)
  if (level >= 10) return isDark ? '#E5E7EB' : '#404040'; // 실버: 라이트 모드용 순수 다크 그레이
  if (level >= 5) return '#CD7F32'; // 브론즈 - 동색
  return isDark ? '#D4CFC7' : '#78350F'; // 아이언: 다크 모드용 밝은 베이지, 라이트 모드용 명확한 다크 브라운
}

// 레벨별 배경 색상 (더 연한 버전)
export function getLevelBackgroundColor(level: number, isDark: boolean): string {
  if (level >= 60) return isDark ? 'rgba(0, 247, 191, 0.2)' : 'rgba(0, 247, 191, 0.1)';
  if (level >= 50) return isDark ? 'rgba(255, 107, 107, 0.2)' : 'rgba(255, 107, 107, 0.1)';
  if (level >= 40) return isDark ? 'rgba(168, 85, 247, 0.2)' : 'rgba(168, 85, 247, 0.1)';
  if (level >= 30) return isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)';
  if (level >= 20) return isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(56, 189, 248, 0.12)';
  if (level >= 15) return isDark ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 215, 0, 0.1)';
  if (level >= 10) return isDark ? 'rgba(200, 200, 205, 0.2)' : 'rgba(226, 232, 240, 0.6)'; // 실버: 밝고 차가운 은색
  if (level >= 5) return isDark ? 'rgba(205, 127, 50, 0.2)' : 'rgba(205, 127, 50, 0.1)';
  return isDark ? 'rgba(120, 53, 15, 0.25)' : 'rgba(229, 206, 188, 0.5)'; // 아이언: 다크 모드용 어두운 브라운, 라이트 모드용 옅은 브라운
}

// 다음 레벨까지 필요한 XP
export function getXpToNextLevel(xp: number): number {
  const info = calculateLevel(xp);
  return info.next - info.current;
}

// 특정 레벨 도달에 필요한 총 누적 XP
export function getTotalXpForLevel(targetLevel: number): number {
  let total = 0;
  for (let lv = 1; lv < targetLevel; lv++) {
    total += Math.floor(100 * Math.pow(lv, 1.5));
  }
  return total;
}

// 다음 티어 정보 반환
export function getNextTierInfo(currentLevel: number): { title: string; fromLevel: number; xpNeeded: number } | null {
  const tiers = [
    { title: '챌린저', from: 60 },
    { title: '그랜드 마스터', from: 50 },
    { title: '마스터', from: 40 },
    { title: '다이아몬드', from: 30 },
    { title: '플래티넘', from: 20 },
    { title: '골드', from: 15 },
    { title: '실버', from: 10 },
    { title: '브론즈', from: 5 },
  ];

  for (const tier of tiers.reverse()) {
    if (currentLevel < tier.from) {
      return {
        title: tier.title,
        fromLevel: tier.from,
        xpNeeded: getTotalXpForLevel(tier.from),
      };
    }
  }
  return null; // 이미 최고 티어
}
