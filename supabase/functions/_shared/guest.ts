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
  '헷갈리는',
  '집중한',
  '멍한',
  '바쁜',
  '한가한',
  '신중한',
  '급한',
  '여유로운',
  '차분한',
  '활발한',
  '소심한',
  '대담한',
  '긍정적인',
  '호기심많은',
  '성실한',
  '엉뚱한',
  '잔잔한',
  '느린',
  '조심스러운',
  '자유로운',
  '평범한',
  '특별한',
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
  '강아지',
  '펭귄',
  '부엉이',
  '고슴도치',
  '너구리',
  '오리',
  '사슴',
  '코알라',
  '치타',
  '거북이',
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
  '도적',
  '현자',
  '음유시인',
  '치유사',
  '수호자',
  '여행자',
  '탐험가',
  '관찰자',
  '방랑자',
  '구경꾼',
  '수험생',
  '연구원',
  '문제풀이자',
  '도전자',
  '참가자',
] as const;

export function hashString(source: string): number {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildGuestNickname(seed: number): string {
  const adjective = GUEST_ADJECTIVES[seed % GUEST_ADJECTIVES.length];
  const nounPool = (seed & 1) === 0 ? GUEST_ANIMALS : GUEST_CHARACTERS;
  const nounSeed = ((seed >>> 8) ^ (seed * 2654435761)) >>> 0;
  const noun = nounPool[nounSeed % nounPool.length];
  return `${adjective} ${noun}`;
}

export function deriveGuestNicknameFromKey(key: string): string {
  return buildGuestNickname(hashString(key));
}

function buildAvatarSeed(source: string): string {
  return `avatar-${hashString(source).toString(36)}`;
}

export function deriveAvatarSeedFromIdentity(
  identityId: string | null | undefined,
  fallback = 'guest'
): string {
  const normalizedIdentity = identityId?.trim();
  return buildAvatarSeed(normalizedIdentity && normalizedIdentity.length > 0 ? normalizedIdentity : fallback);
}
