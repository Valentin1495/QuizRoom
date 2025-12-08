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
  if (FEATURE_FLAGS.dailyQuiz) {
    // Supabase-only path
    const { quiz: supabaseQuiz, isLoading } = useSupabaseDailyQuiz(date);
    if (isLoading) return undefined;
    return supabaseQuiz as DailyQuiz | null;
  }

  // Convex-only path
  return useQuery(api.daily.getDailyQuiz, { date }) as DailyQuiz | null | undefined;
}
