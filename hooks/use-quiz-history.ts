/**
 * Unified Quiz History Hook
 * Switches between Convex and Supabase based on feature flag
 */

import { useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { useQuizHistory as useSupabaseQuizHistory } from '@/lib/supabase-api';

// Type for quiz history document (Convex style)
export type QuizHistoryDoc = Doc<'quizHistory'>;

// Type for quiz history buckets
export type HistoryBuckets = {
  daily: QuizHistoryDoc[];
  swipe: QuizHistoryDoc[];
  liveMatch: QuizHistoryDoc[];
};

/**
 * Hook to fetch quiz history
 * Returns history buckets or undefined while loading
 * 
 * @param options.limit Max number of entries per mode (default 10)
 * @param options.enabled Whether to fetch (use for conditional fetching)
 */
export function useQuizHistory(options?: {
  limit?: number;
  enabled?: boolean;
}): HistoryBuckets | undefined {
  const limit = options?.limit ?? 10;
  const enabled = options?.enabled ?? true;
  const useSupabase = FEATURE_FLAGS.quizHistory;

  // Convex query (only runs when feature flag is off)
  const convexResult = useQuery(
    api.history.listHistory,
    useSupabase || !enabled ? 'skip' : { limit }
  );

  // Supabase query (only runs when feature flag is on)
  const { history: supabaseResult, isLoading: supabaseLoading } = useSupabaseQuizHistory(
    useSupabase && enabled ? limit : 0,
    { enabled: useSupabase && enabled }
  );

  // If using Supabase
  if (useSupabase) {
    if (!enabled) return undefined;
    if (supabaseLoading) return undefined;
    // Convert Supabase format to Convex-compatible format
    return supabaseResult as unknown as HistoryBuckets;
  }

  // If using Convex
  if (!enabled) return undefined;
  return convexResult as HistoryBuckets | undefined;
}
