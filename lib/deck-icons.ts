import type { IconSymbolName } from '@/components/ui/icon-symbol';

const DECK_ICON_MAP: Record<string, IconSymbolName> = {
  live_match_pop_culture_mix: 'star',
  live_match_trend_mix: 'flame',
  live_match_random_all: 'die.face.5',
  live_match_showtime_mix: 'music.microphone',
  live_match_brainiac_mix: 'brain.head.profile',
  live_match_lifestyle_mix: 'paintpalette',
};

export const getDeckIcon = (slug?: string | null): IconSymbolName => {
  if (!slug) return 'sparkles';
  return DECK_ICON_MAP[slug] ?? 'sparkles';
};
