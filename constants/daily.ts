import type { IconSymbolName } from '../components/ui/icon-symbol';

export type DailyCategory =
  | 'tech_it'
  | 'variety_reality'
  | 'drama_movie'
  | 'sports_games'
  | 'kpop_music'
  | 'fashion_life'
  | 'news_issues';

export const DAILY_CATEGORY_COPY: Record<DailyCategory, { label: string; emoji: string }> = {
  tech_it: { label: '테크•IT', emoji: '💡' },
  variety_reality: { label: '예능•리얼리티', emoji: '📺' },
  kpop_music: { label: 'K-POP•음악', emoji: '🎵' },
  fashion_life: { label: '패션•라이프', emoji: '👗' },
  drama_movie: { label: '드라마•영화', emoji: '🎬' },
  sports_games: { label: '스포츠•게임', emoji: '🏆' },
  news_issues: { label: '뉴스•시사', emoji: '🗞️' },
};

export const DAILY_CATEGORY_ICONS: Record<DailyCategory, IconSymbolName> = {
  tech_it: 'desktopcomputer',
  variety_reality: 'tv',
  drama_movie: 'film',
  sports_games: 'trophy',
  kpop_music: 'music.note',
  fashion_life: 'bag',
  news_issues: 'newspaper',
};

export function resolveDailyCategoryCopy(category?: string | null) {
  if (!category) {
    return null;
  }
  if (category in DAILY_CATEGORY_COPY) {
    return DAILY_CATEGORY_COPY[category as DailyCategory];
  }
  return null;
}
