/**
 * Unified Daily Quiz Hook
 * Switches between Convex and Supabase based on feature flag
 */

import { useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { useDailyQuiz as useSupabaseDailyQuiz } from '@/lib/supabase-api';

export type DailyQuiz = {
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

/**
 * Hook to fetch daily quiz
 * Returns undefined while loading, null if no quiz, or the quiz data
 * 
 * @param date Optional date string (YYYY-MM-DD format, KST)
 */
export function useDailyQuiz(date?: string): DailyQuiz | null | undefined {
  const useSupabase = FEATURE_FLAGS.dailyQuiz;

  // Convex query (only runs when feature flag is off)
  const convexQuiz = useQuery(
    api.daily.getDailyQuiz,
    useSupabase ? 'skip' : { date }
  );

  // Supabase query (only runs when feature flag is on)
  const { quiz: supabaseQuiz, isLoading: supabaseLoading } = useSupabaseDailyQuiz(
    date,
    { enabled: useSupabase }
  );

  // If using Supabase
  if (useSupabase) {
    if (supabaseLoading) return undefined; // loading state
    return supabaseQuiz as DailyQuiz | null;
  }

  // If using Convex
  return convexQuiz as DailyQuiz | null | undefined;
}
