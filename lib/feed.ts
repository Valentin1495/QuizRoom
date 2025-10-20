import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
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

export function useSwipeFeed(options: UseSwipeFeedOptions) {
  const convex = useConvex();
  const [state, setState] = useState<FeedState>(emptyState);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const excludeRef = useRef<Set<Id<'questions'>>>(new Set());
  const loadedCountRef = useRef(0);
  const sessionLimit = options.limit ?? DEFAULT_SESSION_LIMIT;

  const submitAnswerMutation = useMutation(api.swipe.submitAnswer);
  type SubmitArgs = Parameters<typeof submitAnswerMutation>[0];
  type SubmitResult = Awaited<ReturnType<typeof submitAnswerMutation>>;

  const toggleBookmarkMutation = useMutation(api.swipe.toggleBookmark);
  type BookmarkArgs = Parameters<typeof toggleBookmarkMutation>[0];

  const reportMutation = useMutation(api.swipe.createReport);
  type ReportArgs = Parameters<typeof reportMutation>[0];

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

    itemsToAdd.forEach((item) => excludeRef.current.add(item.id));
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

      // 중복을 감안해서 더 많이 요청 (최대 1.5배)
      const requestLimit = Math.min(Math.ceil(remaining * 1.5), 30);

      const response = await convex.query(api.swipe.getSwipeFeed, {
        category: options.category,
        cursor: cursor ?? undefined,
        limit: requestLimit,
        tags: options.tags,
        excludeIds: Array.from(excludeRef.current),
      });

      const items: SwipeFeedQuestion[] = response.items.map((item) => ({
        ...item,
        mediaUrl: item.mediaUrl ?? null,
        tags: item.tags ?? [],
      }));

      const actualAdded = items.length > 0 ? pushPrefetch(items) : 0;

      console.log(`Fetch: requested=${requestLimit}, received=${items.length}, added=${actualAdded}, total=${loadedCountRef.current}/${sessionLimit}`);

      // 세션 제한에 도달했으면 종료
      if (loadedCountRef.current >= sessionLimit) {
        console.log('Session limit reached in fetchMore');
        setHasMore(false);
        setCursor(null);
      }
      // 서버에서 더 이상 데이터가 없으면 종료
      else if (!response.hasMore) {
        console.log('No more data from server');
        setHasMore(false);
        setCursor(null);
      }
      // 아직 더 로드할 수 있음
      else {
        setHasMore(true);
        setCursor(response.nextCursor ?? null);
      }
    } catch (error) {
      console.error('Failed to fetch more:', error);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [convex, cursor, hasMore, isLoading, options.category, options.limit, options.tags, pushPrefetch, sessionLimit]);

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
      const queue = current.queue.slice(1);
      const prefetch = [...current.prefetch];
      while (queue.length < VISIBLE_CARDS && prefetch.length > 0) {
        queue.push(prefetch.shift() as SwipeFeedQuestion);
      }
      console.log(`Advance: queue=${queue.length}, prefetch=${prefetch.length}, total=${loadedCountRef.current}`);
      return { queue, prefetch };
    });
  }, []);

  const resetSessionMutation = useMutation(api.swipe.resetSession);

  const reset = useCallback(async () => {
    excludeRef.current.clear();
    setState(emptyState);
    setCursor(null);
    setHasMore(true);
    loadedCountRef.current = 0;
    try {
      await resetSessionMutation();
    } catch (error) {
      console.warn('Failed to reset server session:', error);
    }
  }, [resetSessionMutation]);

  const submitAnswer = useCallback(
    async (payload: SubmitArgs): Promise<SubmitResult> => {
      return submitAnswerMutation(payload);
    },
    [submitAnswerMutation]
  );

  const skip = useCallback(() => {
    advance();
  }, [advance]);

  const toggleBookmark = useCallback(
    async (payload: BookmarkArgs) => {
      return toggleBookmarkMutation(payload);
    },
    [toggleBookmarkMutation]
  );

  const reportQuestion = useCallback(
    async (payload: ReportArgs) => {
      return reportMutation(payload);
    },
    [reportMutation]
  );

  const queue = state.queue;
  const current = queue[0] ?? null;
  const nextItems = queue.slice(1, 3);

  // 현재 카드를 포함한 전체 남은 카드 수
  const remainingCount = state.queue.length + state.prefetch.length;

  return useMemo(
    () => ({
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
    }),
    [
      advance,
      current,
      hasMore,
      isLoading,
      nextItems,
      queue,
      remainingCount,
      reportQuestion,
      reset,
      skip,
      submitAnswer,
      toggleBookmark,
    ]
  );
}
