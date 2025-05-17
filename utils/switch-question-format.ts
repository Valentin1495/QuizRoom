import {
  QuestionFormatByQuizType,
  QuizType,
} from '@/context/quiz-setup-context';

export function switchQuestionFormat(
  questionFormat: QuestionFormatByQuizType<QuizType>
) {
  switch (questionFormat) {
    case 'multiple':
      return '객관식';

    case 'short':
      return '주관식';

    default:
      break;
  }
}
