import type { IconSymbolName } from '@/components/ui/icon-symbol';

const DECK_ICON_MAP: Record<string, IconSymbolName> = {
  party_pop_culture_mix: 'star',
  party_trend_mix: 'flame',
  party_random_all: 'die.face.5',
  party_showtime_mix: 'mic',
  party_brainiac_mix: 'brain.head.profile',
  party_lifestyle_mix: 'paintpalette',
};

export const getDeckIcon = (slug?: string | null): IconSymbolName => {
  if (!slug) return 'sparkles';
  return DECK_ICON_MAP[slug] ?? 'sparkles';
};
