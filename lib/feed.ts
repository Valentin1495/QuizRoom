import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/hooks/use-unified-auth';
import { supabase as authedSupabase } from '@/lib/supabase-index';

const VISIBLE_CARDS = 3;
const PREFETCH_THRESHOLD = 2;
const PREFETCH_TARGET = 6;
const DEFAULT_SESSION_LIMIT = 20;
const MAX_BUFFER = 30;

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseAnonKey) {
  console.error('Supabase anon key is not defined for feed.ts function calls.');
}

export type SwipeFeedQuestion = {
  id: string;
  deckId: string;
  deckSlug: string;
  prompt: string;
  mediaUrl?: string | null;
  choices: { id: string; text: string }[];
  difficulty: number;
  createdAt: string;
  tags: string[];
  qualityScore: number;
  elo: number;
  category: string;
  answerToken: string;
  correctChoiceId: string | null;
  correctChoiceIndex: number | null;
  explanation?: string | null;
  hint?: string | null;
  subject?: string | null;
  eduLevel?: string | null;
  grade?: number | null;
  lifelineMeta?: Record<string, unknown> | null;
};

type ReportPayload = {
  questionId?: string;
  reason: string;
  note?: string;
  guest?: {
    deckSlug: string;
    category: string;
    prompt: string;
    choiceId?: string;
    explanation?: string;
    choices?: { id: string; text: string }[];
    metadata?: unknown;
  };
};

type FeedState = {
  queue: SwipeFeedQuestion[];
  prefetch: SwipeFeedQuestion[];
};

const emptyState: FeedState = {
  queue: [],
  prefetch: [],
};

export type UseSwipeFeedOptions = {
  category: string;
  tags?: string[];
  deckSlug?: string;
  excludeTag?: string;
  grade?: number;
  eduLevel?: string;
  subject?: string;
  limit?: number;
};

export function useSwipeFeed(options: UseSwipeFeedOptions) {
  const sessionLimit = options.limit ?? DEFAULT_SESSION_LIMIT;
  const { status: authStatus } = useAuth();
  const isGuest = authStatus !== 'authenticated';

  const [state, setState] = useState<FeedState>(emptyState);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const isFetchingRef = useRef(false);
  const loadedCountRef = useRef(0);
  const questionMapRef = useRef<Map<string, SwipeFeedQuestion>>(new Map());
  const sessionKeyRef = useRef<string>('');

  // Pick an auth header: user token when signed in, otherwise anon key.
  const getFunctionAuthHeaders = useCallback(async () => {
    if (authStatus === 'authenticated') {
      try {
        const { data: { session } } = await authedSupabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          return { Authorization: `Bearer ${token}` };
        }
      } catch (err) {
        console.warn('Failed to resolve auth session for functions', err);
      }
    }
    return supabaseAnonKey ? { Authorization: `Bearer ${supabaseAnonKey}` } : undefined;
  }, [authStatus, supabaseAnonKey]);

  // Initialize/reset on category/tags change
  useEffect(() => {
    sessionKeyRef.current = `swipe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    loadedCountRef.current = 0;
    questionMapRef.current.clear();
    setState(emptyState);
    setCursor(null);
    setHasMore(true);
    setIsLoading(false);
  }, [options.category, options.deckSlug, options.excludeTag, options.grade, options.eduLevel, options.subject, options.tags]);

  const pushPrefetch = useCallback((items: SwipeFeedQuestion[]): number => {
    if (!items.length) return 0;

    const remaining = sessionLimit - loadedCountRef.current;
    if (remaining <= 0) {
      setHasMore(false);
      return 0;
    }

    const itemsToAdd = items.slice(0, remaining);
    const actualCount = itemsToAdd.length;

    itemsToAdd.forEach((item) => {
      questionMapRef.current.set(item.id, item);
    });

    setState((current) => {
      const maxBufferSize = Math.max(MAX_BUFFER, sessionLimit);
      const prefetch = [...current.prefetch, ...itemsToAdd].slice(0, maxBufferSize);
      const queue = [...current.queue];

      while (queue.length < VISIBLE_CARDS && prefetch.length > 0) {
        queue.push(prefetch.shift() as SwipeFeedQuestion);
      }

      return { queue, prefetch };
    });

    loadedCountRef.current += actualCount;
    if (loadedCountRef.current >= sessionLimit) {
      setHasMore(false);
    }

    return actualCount;
  }, [sessionLimit]);

  const fetchMore = useCallback(async () => {
    if (isFetchingRef.current || isLoading || !hasMore || loadedCountRef.current >= sessionLimit) {
      return;
    }
    isFetchingRef.current = true;
    setIsLoading(true);
    try {
      const remaining = Math.max(0, sessionLimit - loadedCountRef.current);
      const requestLimit = Math.min(Math.ceil(remaining * 1.5), 30);
      const headers = await getFunctionAuthHeaders();
      const { data, error } = await authedSupabase.functions.invoke('swipe-feed', {
        headers,
        body: {
          category: options.category,
          tags: options.tags,
          deckSlug: options.deckSlug,
          excludeTag: options.excludeTag,
          limit: requestLimit,
          cursor,
          grade: options.grade,
          eduLevel: options.eduLevel,
          subject: options.subject,
        },
      });

      if (error) {
        let status: number | undefined;
        let bodyText: string | null = null;
        try {
          const resp = ((error as any)?.context ?? (error as any)?.response) as Response | undefined;
          status = resp?.status;
          if (resp) {
            bodyText = await resp.text();
          }
        } catch {
          bodyText = null;
        }
        console.warn('Failed to fetch swipe feed', {
          message: error?.message,
          status,
          body: bodyText,
        });
        setHasMore(false);
        return;
      }

      const payload = (data as { data?: { items?: SwipeFeedQuestion[]; nextCursor?: string | null; hasMore?: boolean } })?.data;
      const items = payload?.items ?? [];
      const added = items.length > 0 ? pushPrefetch(items) : 0;
      const reachedLimit = loadedCountRef.current >= sessionLimit;
      setCursor(payload?.nextCursor ?? null);
      if (reachedLimit || !payload?.hasMore || added === 0) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } catch (err) {
      console.warn('Failed to fetch swipe feed', err);
      setHasMore(false);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [
    cursor,
    hasMore,
    isLoading,
    options.category,
    options.tags,
    options.excludeTag,
    options.deckSlug,
    options.grade,
    options.eduLevel,
    options.subject,
    pushPrefetch,
    sessionLimit,
    getFunctionAuthHeaders,
  ]);

  useEffect(() => {
    if (
      !state.queue.length &&
      !state.prefetch.length &&
      hasMore &&
      !isLoading &&
      loadedCountRef.current < sessionLimit
    ) {
      fetchMore();
    }
  }, [fetchMore, hasMore, isLoading, sessionLimit, state.prefetch.length, state.queue.length]);

  useEffect(() => {
    const totalBuffered = state.queue.length + state.prefetch.length;
    if (
      !isLoading &&
      hasMore &&
      loadedCountRef.current < sessionLimit &&
      totalBuffered <= PREFETCH_THRESHOLD
    ) {
      fetchMore();
    } else if (
      !isLoading &&
      hasMore &&
      loadedCountRef.current < sessionLimit &&
      state.prefetch.length < PREFETCH_TARGET
    ) {
      fetchMore();
    }
  }, [fetchMore, hasMore, isLoading, sessionLimit, state.prefetch.length, state.queue.length]);

  const advance = useCallback(() => {
    setState((current) => {
      const [removed, ...restQueue] = current.queue;
      if (removed) {
        questionMapRef.current.delete(removed.id.toString());
      }
      const queue = [...restQueue];
      const prefetch = [...current.prefetch];
      while (queue.length < VISIBLE_CARDS && prefetch.length > 0) {
        queue.push(prefetch.shift() as SwipeFeedQuestion);
      }
      return { queue, prefetch };
    });
  }, []);

  const reset = useCallback(async () => {
    loadedCountRef.current = 0;
    questionMapRef.current.clear();
    sessionKeyRef.current = `swipe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setState(emptyState);
    setCursor(null);
    setIsLoading(false);
    setHasMore(true);
    isFetchingRef.current = false;
  }, []);

  const submitAnswer = useCallback(
    async (payload: { questionId: string; choiceId: string; timeMs: number; answerToken?: string }) => {
      const question = questionMapRef.current.get(payload.questionId);
      const correctChoiceId = question?.correctChoiceId ?? payload.choiceId;
      const isCorrect = correctChoiceId === payload.choiceId;
      return {
        isCorrect,
        correctChoiceId,
        explanation: question?.explanation ?? null,
        scoreDelta: isCorrect ? 15 : -5,
        streak: undefined,
        nextQuestionElo: question?.elo ?? 1200,
        expected: 0.5,
        timeMs: payload.timeMs,
      };
    },
    []
  );

  const skip = useCallback(() => {
    advance();
  }, [advance]);

  const toggleBookmark = useCallback(
    async (_payload: { questionId: string }) => {
      // TODO: implement Supabase bookmarks; currently no-op
      return { bookmarked: false };
    },
    []
  );

  const reportQuestion = useCallback(
    async (_payload: ReportPayload) => {
      // TODO: implement Supabase reports; currently no-op
      return { reported: true };
    },
    []
  );

  const queue = state.queue;
  const current = queue[0] ?? null;
  const nextItems = queue.slice(1, 3);

  const remainingCount = state.queue.length + state.prefetch.length;

  return useMemo(() => {
    return {
      current,
      queue,
      nextItems,
      prefetchCount: Math.max(0, remainingCount),
      isLoading,
      hasMore,
      reset,
      advance,
      skip,
      submitAnswer,
      toggleBookmark,
      reportQuestion,
      isGuest,
      sessionKey: sessionKeyRef.current,
    };
  }, [
    advance,
    current,
    hasMore,
    isGuest,
    isLoading,
    nextItems,
    queue,
    remainingCount,
    reportQuestion,
    reset,
    skip,
    submitAnswer,
    toggleBookmark,
  ]);
}
