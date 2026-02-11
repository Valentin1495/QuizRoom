/**
 * Unified Daily Quiz Hook
 * Supabase-only implementation
 */

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
export function useDailyQuiz(
  date?: string,
  options?: { enabled?: boolean; refreshKey?: number }
): DailyQuiz | null | undefined {
  const { quiz, isLoading } = useSupabaseDailyQuiz(date, options);
  if (isLoading) return undefined;
  return quiz as DailyQuiz | null;
}
