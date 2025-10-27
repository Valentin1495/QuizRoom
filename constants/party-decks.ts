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
    slug: 'party_pop_culture_mix',
    title: '대중문화 믹스',
    emoji: '🌟',
    description: '음악·예능·드라마를 한 번에 즐기는 올인원 덱',
    sourceCategories: ['kpop_music', 'variety_reality', 'drama_movie', 'fashion_life'],
    questionLimit: 150,
  },
  {
    slug: 'party_trend_mix',
    title: '트렌드 믹스',
    emoji: '🔥',
    description: '테크, 시사, 라이프스타일 최신 트렌드 총집합',
    sourceCategories: ['tech_it', 'news_issues', 'fashion_life'],
    questionLimit: 150,
  },
  {
    slug: 'party_random_all',
    title: '랜덤 올인원',
    emoji: '🎲',
    description: '모든 카테고리에서 랜덤으로 출제되는 파티 덱',
    sourceCategories: [
      'kpop_music',
      'variety_reality',
      'drama_movie',
      'sports_games',
      'tech_it',
      'fashion_life',
      'news_issues',
      'general_knowledge',
    ],
    questionLimit: 200,
  },
  {
    slug: 'party_showtime_mix',
    title: '쇼타임 믹스',
    emoji: '🎤',
    description: '음악, 예능, 스포츠까지 무대의 열기를 그대로 모았어요',
    sourceCategories: ['kpop_music', 'variety_reality', 'sports_games'],
    questionLimit: 150,
  },
  {
    slug: 'party_brainiac_mix',
    title: '지식 파워 믹스',
    emoji: '🧠',
    description: '뉴스, 테크, 상식 문제로 머리를 깨우는 덱',
    sourceCategories: ['news_issues', 'tech_it', 'general_knowledge'],
    questionLimit: 150,
  },
  {
    slug: 'party_lifestyle_mix',
    title: '라이프 & 컬처 믹스',
    emoji: '🍹',
    description: '패션, 드라마, 라이프스타일 트렌드를 한 번에 즐겨요',
    sourceCategories: ['fashion_life', 'drama_movie', 'general_knowledge'],
    questionLimit: 150,
  },
];
