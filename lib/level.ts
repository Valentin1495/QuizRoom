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

// 레벨별 색상
export function getLevelColor(level: number, isDark: boolean): string {
  if (level >= 60) return '#00E5FF';     // 챌린저 - 청록
  if (level >= 50) return '#FF6B6B';     // 그랜드 마스터 - 빨강
  if (level >= 40) return '#A855F7';     // 마스터 - 보라
  if (level >= 30) return '#3B82F6';     // 다이아몬드 - 파랑
  if (level >= 20) return '#22D3EE';     // 플래티넘 - 시안
  if (level >= 15) return '#FFD700';     // 골드 - 금색
  if (level >= 10) return '#C0C0C0';     // 실버 - 은색
  if (level >= 5) return '#CD7F32';      // 브론즈 - 동색
  return isDark ? '#71717A' : '#A1A1AA'; // 아이언 - 회색
}

// 레벨별 배경 색상 (더 연한 버전)
export function getLevelBackgroundColor(level: number, isDark: boolean): string {
  if (level >= 60) return isDark ? 'rgba(0, 229, 255, 0.2)' : 'rgba(0, 229, 255, 0.1)';
  if (level >= 50) return isDark ? 'rgba(255, 107, 107, 0.2)' : 'rgba(255, 107, 107, 0.1)';
  if (level >= 40) return isDark ? 'rgba(168, 85, 247, 0.2)' : 'rgba(168, 85, 247, 0.1)';
  if (level >= 30) return isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)';
  if (level >= 20) return isDark ? 'rgba(34, 211, 238, 0.2)' : 'rgba(34, 211, 238, 0.1)';
  if (level >= 15) return isDark ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 215, 0, 0.1)';
  if (level >= 10) return isDark ? 'rgba(192, 192, 192, 0.2)' : 'rgba(192, 192, 192, 0.1)';
  if (level >= 5) return isDark ? 'rgba(205, 127, 50, 0.2)' : 'rgba(205, 127, 50, 0.1)';
  return isDark ? 'rgba(113, 113, 122, 0.2)' : 'rgba(161, 161, 170, 0.1)';
}

// 다음 레벨까지 필요한 XP
export function getXpToNextLevel(xp: number): number {
  const info = calculateLevel(xp);
  return info.next - info.current;
}

