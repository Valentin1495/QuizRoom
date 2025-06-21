// 더 간단한 버전 (Fisher-Yates 셔플 사용)
export function getRandomTwoElements<T>(array: T[]): T[] {
  if (array.length === 0) {
    return [];
  }

  if (array.length === 1) {
    return [...array];
  }

  const shuffled = [...array];

  // 처음 2개 위치만 셔플
  for (let i = 0; i < 2; i++) {
    const randomIndex = Math.floor(Math.random() * (shuffled.length - i)) + i;
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }

  return shuffled.slice(0, 2);
}
