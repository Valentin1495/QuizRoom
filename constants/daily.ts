export type DailyCategory = 'tech' | 'series' | 'music' | 'fashion' | 'movie' | 'sports' | 'meme';

export const DAILY_CATEGORY_COPY: Record<DailyCategory, { label: string; emoji: string }> = {
  tech: { label: '테크/IT', emoji: '💡' },
  series: { label: '예능·드라마', emoji: '🍿' },
  music: { label: 'K-POP', emoji: '🎵' },
  fashion: { label: '패션', emoji: '👗' },
  movie: { label: '영화', emoji: '🎬' },
  sports: { label: '스포츠', emoji: '🏆' },
  meme: { label: '밈/신조어', emoji: '🤣' },
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
