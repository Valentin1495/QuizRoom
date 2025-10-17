import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { useConvex, useMutation } from 'convex/react';

const VISIBLE_CARDS = 3;
const PREFETCH_THRESHOLD = 3;
const PREFETCH_TARGET = 8;
const MAX_BUFFER = 12;

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

  const submitAnswerMutation = useMutation(api.swipe.submitAnswer);
  type SubmitArgs = Parameters<typeof submitAnswerMutation>[0];
  type SubmitResult = Awaited<ReturnType<typeof submitAnswerMutation>>;

  const toggleBookmarkMutation = useMutation(api.swipe.toggleBookmark);
  type BookmarkArgs = Parameters<typeof toggleBookmarkMutation>[0];

  const reportMutation = useMutation(api.swipe.createReport);
  type ReportArgs = Parameters<typeof reportMutation>[0];

  const pushPrefetch = useCallback((items: SwipeFeedQuestion[]) => {
    if (!items.length) return;
    items.forEach((item) => excludeRef.current.add(item.id));
    setState((current) => {
      const prefetch = [...current.prefetch, ...items].slice(0, MAX_BUFFER);
      const queue = [...current.queue];

      while (queue.length < VISIBLE_CARDS && prefetch.length > 0) {
        queue.push(prefetch.shift() as SwipeFeedQuestion);
      }

      return { queue, prefetch };
    });
  }, []);

  const fetchMore = useCallback(async () => {
    if (isLoading || !hasMore) {
      return;
    }
    setIsLoading(true);
    try {
      const response = await convex.query(api.swipe.getSwipeFeed, {
        category: options.category,
        cursor: cursor ?? undefined,
        limit: options.limit,
        tags: options.tags,
        excludeIds: Array.from(excludeRef.current),
      });

      setHasMore(Boolean(response.hasMore));
      setCursor(response.nextCursor ?? null);

      const items: SwipeFeedQuestion[] = response.items.map((item) => ({
        ...item,
        mediaUrl: item.mediaUrl ?? null,
        tags: item.tags ?? [],
      }));

      pushPrefetch(items);
    } finally {
      setIsLoading(false);
    }
  }, [convex, cursor, hasMore, isLoading, options.category, options.limit, options.tags, pushPrefetch]);

  useEffect(() => {
    if (!state.queue.length && !isLoading) {
      fetchMore();
    }
  }, [fetchMore, isLoading, state.queue.length]);

  useEffect(() => {
    const totalBuffered = state.queue.length + state.prefetch.length;
    if (!isLoading && hasMore && totalBuffered <= PREFETCH_THRESHOLD) {
      fetchMore();
    } else if (
      !isLoading &&
      hasMore &&
      state.prefetch.length < PREFETCH_TARGET
    ) {
      fetchMore();
    }
  }, [fetchMore, hasMore, isLoading, state.prefetch.length, state.queue.length]);

  const advance = useCallback(() => {
    setState((current) => {
      const queue = current.queue.slice(1);
      const prefetch = [...current.prefetch];
      while (queue.length < VISIBLE_CARDS && prefetch.length > 0) {
        queue.push(prefetch.shift() as SwipeFeedQuestion);
      }
      return { queue, prefetch };
    });
  }, []);

  const reset = useCallback(() => {
    excludeRef.current.clear();
    setState(emptyState);
    setCursor(null);
    setHasMore(true);
  }, []);

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

  return useMemo(
    () => ({
      current,
      queue,
      nextItems,
      prefetchCount: state.prefetch.length,
      isLoading,
      hasMore,
      fetchMore,
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
      fetchMore,
      hasMore,
      isLoading,
      nextItems,
      queue,
      reportQuestion,
      reset,
      skip,
      state.prefetch.length,
      submitAnswer,
      toggleBookmark,
    ]
  );
}
