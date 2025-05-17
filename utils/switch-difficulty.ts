import { Difficulty } from '@/context/quiz-setup-context';

export function switchDifficulty(difficulty: Difficulty) {
  switch (difficulty) {
    case 'easy':
      return '쉬움';
    case 'medium':
      return '보통';
    case 'hard':
      return '어려움';
    default:
      break;
  }
}
