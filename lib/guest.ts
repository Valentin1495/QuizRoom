const GUEST_ADJECTIVES = [
  '졸린',
  '조용한',
  '빠른',
  '수줍은',
  '똑똑한',
  '느긋한',
  '용감한',
  '화난',
  '웃는',
  '잠든',
  '떠도는',
  '길잃은',
  '초보',
  '익명의',
] as const;

const GUEST_ANIMALS = [
  '고양이',
  '여우',
  '수달',
  '판다',
  '까치',
  '곰',
  '다람쥐',
  '토끼',
  '고래',
  '햄스터',
] as const;

const GUEST_CHARACTERS = [
  '버섯',
  '슬라임',
  '유령',
  '기사',
  '모험가',
  '마법사',
  '전사',
  '연금술사',
  '궁수',
  '정찰병',
] as const;

function hashString(source: string): number {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildGuestNickname(seed: number): string {
  const adjective = GUEST_ADJECTIVES[seed % GUEST_ADJECTIVES.length];
  const nounPool = (seed & 1) === 0 ? GUEST_ANIMALS : GUEST_CHARACTERS;
  const nounSeed = ((seed >>> 8) ^ (seed * 2654435761)) >>> 0;
  const noun = nounPool[nounSeed % nounPool.length];
  return `${adjective} ${noun}`;
}

export function deriveGuestNickname(key: string): string;
export function deriveGuestNickname(key: string | null | undefined): string | null;
export function deriveGuestNickname(key: string | null | undefined): string | null {
  if (!key) return null;
  return buildGuestNickname(hashString(key));
}

export function deriveGuestAvatarId(key: string): number;
export function deriveGuestAvatarId(key: string | null | undefined): number | undefined;
export function deriveGuestAvatarId(key: string | null | undefined): number | undefined {
  if (!key) return undefined;
  const hash = key.split('').reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
  return Math.abs(hash) % 20;
}
