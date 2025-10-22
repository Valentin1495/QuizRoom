import type { CategoryMeta } from './categories';

export type PartyDeckDefinition = {
  slug: string;
  title: string;
  emoji: string;
  description: string;
  sourceCategories: CategoryMeta['slug'][];
  questionLimit?: number;
  isActive?: boolean;
};

export const PARTY_DECK_DEFINITIONS: PartyDeckDefinition[] = [
  {
    slug: 'party_kpop_music',
    title: 'K-POP 라이브',
    emoji: '🎵',
    description: '아이돌부터 음원 차트까지, 음악 퀴즈 배틀',
    sourceCategories: ['kpop_music'],
    questionLimit: 120,
  },
  {
    slug: 'party_variety_ott',
    title: '예능 & OTT',
    emoji: '📺',
    description: '예능과 OTT 콘텐츠를 섭렵한 사람만 풀 수 있어요',
    sourceCategories: ['variety_ott'],
    questionLimit: 120,
  },
  {
    slug: 'party_drama_movie',
    title: '드라마 & 영화',
    emoji: '🎬',
    description: '명대사부터 흥행작까지 영화·드라마 전용 덱',
    sourceCategories: ['drama_movie'],
    questionLimit: 120,
  },
  {
    slug: 'party_sports_games',
    title: '스포츠 & 게임',
    emoji: '⚽',
    description: 'e스포츠와 프로 스포츠를 넘나드는 하이라이트',
    sourceCategories: ['sports_games'],
    questionLimit: 120,
  },
  {
    slug: 'party_trending_tech',
    title: '테크 & 트렌드',
    emoji: '💡',
    description: '최신 IT, 스타트업, 트렌드 키워드를 모았어요',
    sourceCategories: ['tech_trends'],
    questionLimit: 120,
  },
  {
    slug: 'party_fashion_life',
    title: '패션 & 라이프',
    emoji: '👗',
    description: '뷰티, 패션, 라이프스타일 퀴즈 모음',
    sourceCategories: ['fashion_life'],
    questionLimit: 120,
  },
  {
    slug: 'party_news_issues',
    title: '시사 브리핑',
    emoji: '🗞️',
    description: '뜨거운 최신 이슈와 상식을 체크하세요',
    sourceCategories: ['news_issues'],
    questionLimit: 120,
  },
  {
    slug: 'party_general_knowledge',
    title: '기본 상식',
    emoji: '⚡',
    description: '과학·역사·언어 등 필수 상식만 모았습니다',
    sourceCategories: ['general_knowledge'],
    questionLimit: 120,
  },
  {
    slug: 'party_pop_culture_mix',
    title: '대중문화 믹스',
    emoji: '🌟',
    description: '음악·예능·드라마를 한 번에 즐기는 올인원 덱',
    sourceCategories: ['kpop_music', 'variety_ott', 'drama_movie', 'fashion_life'],
    questionLimit: 150,
  },
  {
    slug: 'party_trend_mix',
    title: '트렌드 올스타',
    emoji: '🔥',
    description: '테크, 시사, 라이프스타일 최신 트렌드 총집합',
    sourceCategories: ['tech_trends', 'news_issues', 'fashion_life'],
    questionLimit: 150,
  },
  {
    slug: 'party_random_all',
    title: '랜덤 올인원',
    emoji: '🎲',
    description: '모든 카테고리에서 랜덤으로 출제되는 파티 덱',
    sourceCategories: [
      'kpop_music',
      'variety_ott',
      'drama_movie',
      'sports_games',
      'tech_trends',
      'fashion_life',
      'news_issues',
      'general_knowledge',
    ],
    questionLimit: 200,
  },
];
