/**
 * Unified Quiz History Hook
 * Supabase-only implementation
 */

import { useQuizHistory as useSupabaseQuizHistory } from '@/lib/supabase-api';

export type QuizHistoryDoc = {
  _id: string;
  _creationTime: number;
  userId: string;
  mode: 'daily' | 'swipe' | 'liveMatch';
  sessionId: string;
  createdAt: number;
  payload: Record<string, unknown>;
};

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
  refreshKey?: number;
}): HistoryBuckets | undefined {
  const limit = options?.limit ?? 10;
  const enabled = options?.enabled ?? true;
  const refreshKey = options?.refreshKey ?? 0;

  const { history: supabaseResult, isLoading } = useSupabaseQuizHistory(
    enabled ? limit : 0,
    { enabled, refreshKey }
  );

  if (!enabled || isLoading) return undefined;
  return normalizeSupabaseHistory(supabaseResult);
}

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
      _id: entry.id ?? sessionId ?? `${mode}-${createdAt}`,
      _creationTime: createdAt,
      userId: entry.user_id ?? 'supabase',
      mode: normalizedMode,
      sessionId,
      createdAt,
      payload: (entry.payload as Record<string, unknown>) ?? {},
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
