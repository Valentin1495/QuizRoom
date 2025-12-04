/**
 * Supabase API Layer
 * Replaces lib/api.ts (Convex-based)
 * Provides React hooks and functions for database operations
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase, type Database } from './supabase';

// ============================================
// Types
// ============================================

type LiveMatchDeck = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  questionCount: number;
  sourceCategories: string[];
  updatedAt: string;
};

type DailyQuiz = {
  id: string;
  availableDate: string;
  category: string;
  questions: {
    id: string;
    prompt: string;
    correctAnswer: boolean;
    explanation: string;
    difficulty: number;
  }[];
  shareTemplate: {
    headline: string;
    cta: string;
    emoji: string;
  };
};

type Deck = {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  plays: number;
  likes: number;
  createdAt: string;
};

type QuizHistoryEntry = Database['public']['Tables']['quiz_history']['Row'];

// ============================================
// Error Messages
// ============================================

export const ROOM_EXPIRED_MESSAGE = '퀴즈룸이 만료됐어요. 새로 생성해 주세요.';
export const ROOM_NOT_FOUND_MESSAGE = '퀴즈룸을 찾을 수 없어요. 초대 코드를 확인해주세요.';
export const ROOM_FULL_MESSAGE = '퀴즈룸이 가득 찼어요. 다른 방을 찾아주세요.';
export const ROOM_IN_PROGRESS_MESSAGE =
  '퀴즈 진행 중에는 다시 입장할 수 없어요. 게임이 끝난 뒤 다시 시도해 주세요.';

export function extractJoinErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : null;
  if (!message) {
    return '코드를 확인하거나 방이 이미 시작되었는지 확인해주세요.';
  }
  if (message.includes(ROOM_EXPIRED_MESSAGE)) return ROOM_EXPIRED_MESSAGE;
  if (message.includes(ROOM_NOT_FOUND_MESSAGE)) return ROOM_NOT_FOUND_MESSAGE;
  if (message.includes(ROOM_FULL_MESSAGE)) return ROOM_FULL_MESSAGE;
  if (message.includes(ROOM_IN_PROGRESS_MESSAGE)) return ROOM_IN_PROGRESS_MESSAGE;
  return message;
}

// ============================================
// Daily Quiz Hooks
// ============================================

export function useDailyQuiz(date?: string, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<DailyQuiz | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const fetchQuiz = async () => {
      setIsLoading(true);
      try {
        const { data: result, error: fetchError } = await supabase.functions.invoke(
          'daily-quiz',
          { body: { date } }
        );

        if (fetchError) throw fetchError;
        setData(result?.data ?? null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch daily quiz'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuiz();
  }, [date, enabled]);

  return { quiz: data, isLoading, error };
}

// ============================================
// Deck Feed Hooks
// ============================================

export function useDeckFeed(options?: { tag?: string; limit?: number }) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const args = useMemo(
    () => ({
      tag: options?.tag,
      limit: options?.limit,
    }),
    [options?.tag, options?.limit]
  );

  useEffect(() => {
    const fetchDecks = async () => {
      setIsLoading(true);
      try {
        const { data: result } = await supabase.functions.invoke('deck-feed', {
          body: args,
        });
        setDecks(result?.data ?? []);
      } catch (err) {
        console.error('Failed to fetch deck feed:', err);
        setDecks([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDecks();
  }, [args]);

  return { decks, isLoading };
}

// ============================================
// Live Match Deck Hooks
// ============================================

export function useLiveMatchDecks() {
  const [decks, setDecks] = useState<LiveMatchDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDecks = async () => {
      setIsLoading(true);
      try {
        const { data: result } = await supabase.functions.invoke('live-match-decks', {
          body: {},
        });
        setDecks(result?.data ?? []);
      } catch (err) {
        console.error('Failed to fetch live match decks:', err);
        setDecks([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDecks();
  }, []);

  return { decks, isLoading };
}

// ============================================
// Quiz History Hooks
// ============================================

export function useQuizHistory(limit = 10) {
  const [history, setHistory] = useState<{
    daily: QuizHistoryEntry[];
    swipe: QuizHistoryEntry[];
    liveMatch: QuizHistoryEntry[];
  }>({ daily: [], swipe: [], liveMatch: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const { data: result } = await supabase.functions.invoke('quiz-history', {
          body: { action: 'list', limit },
        });
        setHistory(result?.data ?? { daily: [], swipe: [], liveMatch: [] });
      } catch (err) {
        console.error('Failed to fetch quiz history:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [limit]);

  return { history, isLoading };
}

export function useLogQuizHistory() {
  return useCallback(
    async (params: {
      mode: 'daily' | 'swipe' | 'live_match';
      sessionId: string;
      data: Record<string, unknown>;
    }) => {
      const { data: result, error } = await supabase.functions.invoke('quiz-history', {
        body: { action: 'log', ...params },
      });
      if (error) throw error;
      return result?.data;
    },
    []
  );
}

// ============================================
// User Stats Hooks
// ============================================

export function useUserStats() {
  const [stats, setStats] = useState<{
    streak: number;
    xp: number;
    level: number;
    levelProgress: number;
    levelTitle: string;
    totalCorrect: number;
    totalPlayed: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setStats(null);
          return;
        }

        type UserStatsRow = Pick<
          Database['public']['Tables']['users']['Row'],
          'streak' | 'xp' | 'total_correct' | 'total_played'
        >;

        const { data, error } = await supabase
          .from('users')
          .select('streak, xp, total_correct, total_played')
          .eq('identity_id', user.id)
          .single<UserStatsRow>();

        if (error || !data) {
          setStats(null);
          return;
        }

        // Calculate level
        let level = 1;
        let totalXp = 0;
        const xp = data.xp;

        while (totalXp + Math.floor(100 * Math.pow(level, 1.5)) <= xp) {
          totalXp += Math.floor(100 * Math.pow(level, 1.5));
          level++;
        }

        const current = xp - totalXp;
        const next = Math.floor(100 * Math.pow(level, 1.5));
        const levelProgress = Math.min(100, Math.round((current / next) * 100));

        // Level title
        let levelTitle = '아이언';
        if (level >= 60) levelTitle = '챌린저';
        else if (level >= 50) levelTitle = '그랜드 마스터';
        else if (level >= 40) levelTitle = '마스터';
        else if (level >= 30) levelTitle = '다이아몬드';
        else if (level >= 20) levelTitle = '플래티넘';
        else if (level >= 15) levelTitle = '골드';
        else if (level >= 10) levelTitle = '실버';
        else if (level >= 5) levelTitle = '브론즈';

        setStats({
          streak: data.streak,
          xp: data.xp,
          level,
          levelProgress,
          levelTitle,
          totalCorrect: data.total_correct,
          totalPlayed: data.total_played,
        });
      } catch (err) {
        console.error('Failed to fetch user stats:', err);
        setStats(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();

    // Subscribe to user changes
    const channel = supabase.auth.onAuthStateChange(() => {
      fetchStats();
    });

    return () => {
      channel.data.subscription.unsubscribe();
    };
  }, []);

  return { stats, isLoading };
}

// ============================================
// Categories Hook
// ============================================

export function useCategories() {
  const [categories, setCategories] = useState<Database['public']['Tables']['categories']['Row'][]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setCategories(data ?? []);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
        setCategories([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, isLoading };
}

// ============================================
// Direct Supabase Client Export
// ============================================

export { supabase };
