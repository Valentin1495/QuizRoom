import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { useAuth } from '@/hooks/use-auth';
import { resolveGuestSources, type GuestSwipeSource } from '@/lib/guest-feed';
import { useConvex, useMutation } from 'convex/react';

const VISIBLE_CARDS = 3;
const PREFETCH_THRESHOLD = 2;
const PREFETCH_TARGET = 6;
const DEFAULT_SESSION_LIMIT = 20;
// MAX_BUFFER는 세션 제한보다 커야 모든 카드를 보관할 수 있음
const MAX_BUFFER = 30;

type QuestionDoc = Doc<'questions'>;

export type SwipeFeedQuestion = {
  id: Id<'questions'>;
  deckId: QuestionDoc['deckId'];
  deckSlug: string;
  type: QuestionDoc['type'];
  prompt: QuestionDoc['prompt'];
  mediaUrl?: QuestionDoc['mediaUrl'] | null;
  choices: { id: string; text: string }[];
  difficulty: QuestionDoc['difficulty'];
  createdAt: QuestionDoc['createdAt'];
  tags: string[];
  qualityScore: number;
  elo: number;
  category: string;
  answerToken: string;
  correctChoiceId: string;
  correctChoiceIndex: number | null;
  explanation?: string | null;
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
  limit?: number;
};

const GUEST_SESSION_MULTIPLIER = 3;
const GUEST_DEFAULT_QUALITY = 0.5;
const GUEST_DEFAULT_ELO = 1200;

const normalizeSlug = (value: string) => value.trim().toLowerCase();

function createGuestQuestion(
  source: GuestSwipeSource,
  index: number,
  sessionKey: string,
  fallbackCategory: string
): SwipeFeedQuestion {
  const normalizedCategory = normalizeSlug(
    source.category ?? fallbackCategory
  );
  const category = normalizedCategory || normalizeSlug(fallbackCategory);
  const baseId = `${sessionKey}:${category}:${index}`;
  const questionId = baseId as unknown as Id<'questions'>;
  const deckId = `${source.deckSlug ?? category}:${sessionKey}` as unknown as QuestionDoc['deckId'];
  const choices =
    source.choices?.map((choice) => ({ ...choice })) ?? [];
  const safeIndex =
    source.answerIndex >= 0 && source.answerIndex < choices.length
      ? source.answerIndex
      : 0;
  const fallbackChoice = choices[0] ?? { id: `${baseId}:a`, text: '' };
  const correctChoice = choices[safeIndex] ?? fallbackChoice;
  const correctId = correctChoice.id ?? fallbackChoice.id;
  const derivedCorrectIndex = choices.findIndex(
    (choice) => choice.id === correctId
  );

  return {
    id: questionId,
    deckId,
    deckSlug: source.deckSlug ?? category,
    type: (source.type as QuestionDoc['type']) ?? 'mcq',
    prompt: source.prompt,
    mediaUrl: source.mediaUrl ?? null,
    choices,
    difficulty: (source.difficulty as QuestionDoc['difficulty']) ?? 0.5,
    createdAt: (source.createdAt ?? Date.now()) as QuestionDoc['createdAt'],
    tags: source.tags ?? [],
    qualityScore: source.qualityScore ?? GUEST_DEFAULT_QUALITY,
    elo: source.elo ?? GUEST_DEFAULT_ELO,
    category,
    answerToken: `${baseId}:token`,
    correctChoiceId: correctId,
    correctChoiceIndex:
      derivedCorrectIndex >= 0 ? derivedCorrectIndex : safeIndex,
    explanation: source.explanation ?? null,
  };
}

export function useSwipeFeed(options: UseSwipeFeedOptions) {
  const convex = useConvex();
  const { status: authStatus, isConvexReady } = useAuth();
  const canFetch = authStatus === 'authenticated' && isConvexReady;
  const [state, setState] = useState<FeedState>(emptyState);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const excludeRef = useRef<Set<Id<'questions'>>>(new Set());
  const questionMapRef = useRef<Map<string, SwipeFeedQuestion>>(new Map());
  const loadedCountRef = useRef(0);
  const sessionLimit = options.limit ?? DEFAULT_SESSION_LIMIT;
  const guestPoolRef = useRef<SwipeFeedQuestion[]>([]);
  const guestCursorRef = useRef(0);
  const guestSessionKeyRef = useRef<string>('');
  const guestStreakRef = useRef(0);
  const guestBookmarksRef = useRef<Set<string>>(new Set());

  const submitAnswerMutation = useMutation(api.swipe.submitAnswer);
  type SubmitArgs = Parameters<typeof submitAnswerMutation>[0];
  type SubmitResult = Awaited<ReturnType<typeof submitAnswerMutation>>;

  const toggleBookmarkMutation = useMutation(api.swipe.toggleBookmark);
  type BookmarkArgs = Parameters<typeof toggleBookmarkMutation>[0];

  const reportMutation = useMutation(api.swipe.createReport);
  type ReportArgs = Parameters<typeof reportMutation>[0];

  const logGuestAnswerMutation = useMutation(api.swipe.logGuestAnswer);
  type GuestAnswerArgs = Parameters<typeof logGuestAnswerMutation>[0];

  const pushPrefetch = useCallback((items: SwipeFeedQuestion[]): number => {
    if (!items.length) return 0;

    // 세션 제한 체크: 이미 제한에 도달했으면 추가하지 않음
    const remaining = sessionLimit - loadedCountRef.current;
    if (remaining <= 0) {
      console.log('Session limit reached, ignoring new items');
      setHasMore(false);
      setCursor(null);
      return 0;
    }

    // 중복 체크: 이미 excludeRef에 있는 문항은 필터링
    const newItems = items.filter((item) => {
      if (excludeRef.current.has(item.id)) {
        console.warn('Duplicate question detected and filtered:', item.id);
        return false;
      }
      return true;
    });

    if (!newItems.length) {
      console.warn('All items were duplicates, skipping');
      return 0;
    }

    // 세션 제한을 초과하지 않도록 슬라이스
    const itemsToAdd = newItems.slice(0, remaining);
    const actualCount = itemsToAdd.length;

    itemsToAdd.forEach((item) => {
      excludeRef.current.add(item.id);
      questionMapRef.current.set(item.id.toString(), item);
    });
    setState((current) => {
      // 세션 제한까지는 모든 아이템을 보관
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
      setCursor(null);
    }

    console.log(`PushPrefetch: added=${actualCount}, filtered=${newItems.length - actualCount}, total=${loadedCountRef.current}/${sessionLimit}`);

    return actualCount;
  }, [sessionLimit]);

  useEffect(() => {
    excludeRef.current.clear();
    questionMapRef.current.clear();
    guestCursorRef.current = 0;
    guestPoolRef.current = [];
    guestStreakRef.current = 0;
    loadedCountRef.current = 0;
    setState(emptyState);
    setCursor(null);
    setIsLoading(false);
    if (canFetch) {
      setHasMore(true);
      return;
    }
    guestBookmarksRef.current.clear();
    guestSessionKeyRef.current = `guest-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const desired = Math.max(
      sessionLimit * GUEST_SESSION_MULTIPLIER,
      sessionLimit + PREFETCH_TARGET
    );
    const sources = resolveGuestSources(
      options.category,
      desired,
      options.tags
    );
    guestPoolRef.current = sources.map((source, index) =>
      createGuestQuestion(
        source,
        index,
        guestSessionKeyRef.current,
        options.category
      )
    );
    setHasMore(guestPoolRef.current.length > 0);
  }, [canFetch, options.category, options.tags, sessionLimit]);

  const fetchMore = useCallback(async () => {
    if (isLoading || !hasMore || loadedCountRef.current >= sessionLimit) {
      return;
    }
    setIsLoading(true);
    try {
      const remaining = Math.max(0, sessionLimit - loadedCountRef.current);
      if (remaining === 0) {
        setHasMore(false);
        setCursor(null);
        return;
      }

      if (!canFetch) {
        if (!guestPoolRef.current.length) {
          setHasMore(false);
          return;
        }
        const start = guestCursorRef.current;
        const end = Math.min(start + remaining, guestPoolRef.current.length);
        const slice = guestPoolRef.current.slice(start, end);
        guestCursorRef.current = end;
        const added = slice.length > 0 ? pushPrefetch(slice) : 0;
        if (added === 0 || guestCursorRef.current >= guestPoolRef.current.length) {
          setHasMore(false);
        }
        return;
      }

      // 중복을 감안해서 더 많이 요청 (최대 1.5배)
      const requestLimit = Math.min(Math.ceil(remaining * 1.5), 30);

      const response = await convex.query(api.swipe.getSwipeFeed, {
        category: options.category,
        cursor: cursor ?? undefined,
        limit: requestLimit,
        tags: options.tags,
        excludeIds: Array.from(excludeRef.current),
      });

      const items: SwipeFeedQuestion[] = response.items.map((item) => {
        const choices = item.choices ?? [];
        const correctIndex = choices.findIndex((choice) => choice.id === item.correctChoiceId);
        return {
          ...item,
          deckSlug: String((item as { deckId?: string }).deckId ?? ''),
          mediaUrl: item.mediaUrl ?? null,
          tags: item.tags ?? [],
          correctChoiceIndex: correctIndex >= 0 ? correctIndex : null,
          explanation: null,
        };
      });

      const actualAdded = items.length > 0 ? pushPrefetch(items) : 0;

      if (items.length > 0) {
        const categoryCounts = items.reduce(
          (acc, item) => {
            const cat = item.category || 'unknown';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );
        console.log(
          `[DEBUG] Fetched categories for "${options.category}":`,
          categoryCounts
        );
      }

      console.log(`Fetch: requested=${requestLimit}, received=${items.length}, added=${actualAdded}, total=${loadedCountRef.current}/${sessionLimit}`);

      if (loadedCountRef.current >= sessionLimit) {
        console.log('Session limit reached in fetchMore');
        setHasMore(false);
        setCursor(null);
      } else if (!response.hasMore) {
        console.log('No more data from server');
        setHasMore(false);
        setCursor(null);
      } else {
        setHasMore(true);
        setCursor(response.nextCursor ?? null);
      }
    } catch (error) {
      console.error('Failed to fetch more:', error);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [canFetch, convex, cursor, hasMore, isLoading, options.category, options.tags, pushPrefetch, sessionLimit]);

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
  }, [canFetch, fetchMore, hasMore, isLoading, sessionLimit, state.prefetch.length, state.queue.length]);

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
  }, [canFetch, fetchMore, hasMore, isLoading, sessionLimit, state.prefetch.length, state.queue.length]);

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
      console.log(
        `Advance: queue=${queue.length}, prefetch=${prefetch.length}, total=${loadedCountRef.current}`
      );
      return { queue, prefetch };
    });
  }, []);

  const resetSessionMutation = useMutation(api.swipe.resetSession);

  const reset = useCallback(async () => {
    excludeRef.current.clear();
    questionMapRef.current.clear();
    setState(emptyState);
    setCursor(null);
    setIsLoading(false);
    loadedCountRef.current = 0;
    guestCursorRef.current = 0;
    guestStreakRef.current = 0;
    if (!canFetch) {
      guestBookmarksRef.current.clear();
      guestSessionKeyRef.current = `guest-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const desired = Math.max(
        sessionLimit * GUEST_SESSION_MULTIPLIER,
        sessionLimit + PREFETCH_TARGET
      );
      const sources = resolveGuestSources(
        options.category,
        desired,
        options.tags
      );
      guestPoolRef.current = sources.map((source, index) =>
        createGuestQuestion(
          source,
          index,
          guestSessionKeyRef.current,
          options.category
        )
      );
      setHasMore(guestPoolRef.current.length > 0);
      return;
    }
    setHasMore(true);
    try {
      await resetSessionMutation();
    } catch (error) {
      console.warn('Failed to reset server session:', error);
    }
  }, [canFetch, options.category, options.tags, resetSessionMutation, sessionLimit]);

  const submitAnswer = useCallback(
    async (payload: SubmitArgs): Promise<SubmitResult> => {
      if (!canFetch) {
        const key = payload.questionId.toString();
        const question = questionMapRef.current.get(key);
        const correctChoiceId =
          question?.correctChoiceId ?? payload.choiceId;
        const isCorrect = correctChoiceId === payload.choiceId;
        guestStreakRef.current = isCorrect
          ? guestStreakRef.current + 1
          : 0;
        const guestArgs: GuestAnswerArgs = {
          sessionKey: guestSessionKeyRef.current || `guest-${Date.now()}`,
          questionId: key,
          deckSlug:
            question?.deckSlug ??
            (typeof question?.deckId === "string" ? question.deckId : "unknown"),
          category: question?.category ?? options.category,
          prompt: question?.prompt ?? "",
          choiceId: payload.choiceId,
          isCorrect,
          timeMs: payload.timeMs,
          tags: question?.tags ?? [],
          difficulty: question?.difficulty,
          metadata: {
            source: "guest_swipe",
            correctChoiceId,
          },
        };
        logGuestAnswerMutation(guestArgs).catch((error) => {
          console.warn("Failed to log guest answer", error);
        });
        const result = {
          isCorrect,
          correctChoiceId,
          explanation: question?.explanation ?? null,
          scoreDelta: isCorrect ? 15 : -5,
          streak: guestStreakRef.current,
          nextQuestionElo: question?.elo ?? GUEST_DEFAULT_ELO,
          expected: 0.5,
          timeMs: payload.timeMs,
        } satisfies Partial<SubmitResult>;
        return result as SubmitResult;
      }
      return submitAnswerMutation(payload);
    },
    [canFetch, logGuestAnswerMutation, options.category, submitAnswerMutation]
  );

  const skip = useCallback(() => {
    advance();
  }, [advance]);

  const toggleBookmark = useCallback(
    async (payload: BookmarkArgs) => {
      if (!canFetch) {
        const key = payload.questionId.toString();
        const store = guestBookmarksRef.current;
        let bookmarked: boolean;
        if (store.has(key)) {
          store.delete(key);
          bookmarked = false;
        } else {
          store.add(key);
          bookmarked = true;
        }
        return { bookmarked };
      }
      return toggleBookmarkMutation(payload);
    },
    [canFetch, toggleBookmarkMutation]
  );

  const reportQuestion = useCallback(
    async (payload: ReportArgs) => reportMutation(payload),
    [reportMutation]
  );

  const queue = state.queue;
  const current = queue[0] ?? null;
  const nextItems = queue.slice(1, 3);

  // 현재 카드를 포함한 전체 남은 카드 수
  const remainingCount = state.queue.length + state.prefetch.length;

  const isGuest = !canFetch;

  return useMemo(() => {
    if (queue.length > 0) {
      const categoryCounts = queue.reduce(
        (acc, item) => {
          const cat = item.category || 'unknown';
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
      console.log('[DEBUG] Current queue distribution:', categoryCounts);
    }
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
    };
  }, [
    advance,
    current,
    hasMore,
    isLoading,
    isGuest,
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
