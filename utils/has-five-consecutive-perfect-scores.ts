import { QuizHistoryItem } from '@/context/gamification-context';

export function hasFiveConsecutivePerfectScores(
  quizzes: QuizHistoryItem[]
): boolean {
  let count = 0;

  for (const quiz of quizzes) {
    if (quiz.correct === quiz.total) {
      count++;
      if (count >= 5) return true;
    } else {
      count = 0;
    }
  }

  return false;
}
