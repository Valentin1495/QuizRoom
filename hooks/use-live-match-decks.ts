/**
 * Live Match Decks Hook (Supabase Only)
 */

import { useLiveMatchDecks as useSupabaseLiveMatchDecks } from '@/lib/supabase-api';

export type LiveMatchDeck = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  questionCount: number;
  sourceCategories: string[];
  updatedAt: string;
};

/**
 * Hook to fetch live match decks
 * Returns { decks, isLoading }
 */
export function useLiveMatchDecks(options?: { refreshKey?: number }): {
  decks: LiveMatchDeck[];
  isLoading: boolean;
} {
  const { decks, isLoading } = useSupabaseLiveMatchDecks({
    enabled: true,
    refreshKey: options?.refreshKey,
  });

  return {
    decks: decks as LiveMatchDeck[],
    isLoading,
  };
}
