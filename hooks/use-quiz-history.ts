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
  return useQuizHistoryImpl(options);
}

// Determine which backend to use at module init.
// If Convex URL is missing we default to Supabase to avoid provider errors.
const USE_SUPABASE_HISTORY =
  FEATURE_FLAGS.quizHistory || !process.env.EXPO_PUBLIC_CONVEX_URL;

function useSupabaseHistory(options?: {
  limit?: number;
  enabled?: boolean;
}): HistoryBuckets | undefined {
  const limit = options?.limit ?? 10;
  const enabled = options?.enabled ?? true;

  const { history: supabaseResult, isLoading } = useSupabaseQuizHistory(
    enabled ? limit : 0,
    { enabled }
  );

  if (!enabled || isLoading) return undefined;
  return normalizeSupabaseHistory(supabaseResult);
}

function useConvexHistory(options?: {
  limit?: number;
  enabled?: boolean;
}): HistoryBuckets | undefined {
  const limit = options?.limit ?? 10;
  const enabled = options?.enabled ?? true;

  const convexResult = useQuery(
    api.history.listHistory,
    !enabled ? 'skip' : { limit }
  );

  if (!enabled) return undefined;
  return convexResult as HistoryBuckets | undefined;
}

const useQuizHistoryImpl = USE_SUPABASE_HISTORY ? useSupabaseHistory : useConvexHistory;

type SupabaseHistoryEntry = {
  id?: string;
  user_id?: string | null;
  mode?: 'daily' | 'swipe' | 'live_match' | 'liveMatch';
  session_id?: string;
  created_at?: string;
  createdAt?: number;
  payload?: unknown;
};

type SupabaseHistoryBuckets = {
  daily?: SupabaseHistoryEntry[];
  swipe?: SupabaseHistoryEntry[];
  liveMatch?: SupabaseHistoryEntry[];
};

function normalizeSupabaseHistory(data: SupabaseHistoryBuckets): HistoryBuckets {
  const mapEntry = (entry: SupabaseHistoryEntry, mode: keyof HistoryBuckets): QuizHistoryDoc => {
    const createdAt = parseTimestamp(entry.created_at ?? entry.createdAt);
    const sessionId = entry.session_id ?? '';
    const normalizedMode =
      entry.mode === 'live_match' || entry.mode === 'liveMatch' ? 'liveMatch' : mode;
    return {
      _id: (entry.id ?? sessionId ?? `${mode}-${createdAt}`) as QuizHistoryDoc['_id'],
      _creationTime: createdAt,
      userId: (entry.user_id ?? 'supabase') as QuizHistoryDoc['userId'],
      mode: normalizedMode as QuizHistoryDoc['mode'],
      sessionId,
      createdAt,
      payload: (entry.payload as QuizHistoryDoc['payload']) ?? ({} as QuizHistoryDoc['payload']),
    };
  };

  return {
    daily: (data.daily ?? []).map((entry) => mapEntry(entry, 'daily')),
    swipe: (data.swipe ?? []).map((entry) => mapEntry(entry, 'swipe')),
    liveMatch: (data.liveMatch ?? []).map((entry) => mapEntry(entry, 'liveMatch')),
  };
}

function parseTimestamp(value: string | number | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}
