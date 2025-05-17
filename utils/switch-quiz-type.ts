import { QuizType } from '@/context/quiz-setup-context';

export function switchQuizType(quizType: QuizType) {
  switch (quizType) {
    case 'knowledge':
      return '상식 퀴즈';

    case 'celebrity':
      return '인물 퀴즈';

    case 'four-character':
      return '4글자 퀴즈';

    case 'movie-chain':
      return '영화 제목 이어말하기';

    case 'proverb-chain':
      return '속담/명언 이어말하기';

    case 'slang':
      return '신조어 퀴즈';

    case 'logo':
      return '로고 퀴즈';

    case 'nonsense':
      return '넌센스 퀴즈';

    default:
      break;
  }
}
