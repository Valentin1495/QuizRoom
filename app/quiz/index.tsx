import QuestionList from '@/components/question-list';
import { Difficulty, QuestionFormat, useQuizSetup } from '@/context/quiz-setup-context';
import { api } from '@/convex/_generated/api';
import { getRandomElements } from '@/utils/get-random-elements';
import { useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

// 방법 1: NonNullable 유틸리티 타입 사용
type DifficultyWithoutNull = NonNullable<Difficulty>; // 'easy' | 'medium' | 'hard'

export default function QuestionScreen() {
  const { setQuestions, setUserAnswers } = useQuizSetup();

  const params = useLocalSearchParams();
  const category = params.category as
    | 'general'
    | 'history-culture'
    | 'arts-literature'
    | 'kpop-music'
    | 'sports'
    | 'science-tech'
    | 'math-logic'
    | 'movies'
    | 'drama-variety'
    | undefined;
  const questionFormat = (params.questionFormat as QuestionFormat) ?? null;
  const difficulty = params.difficulty as DifficultyWithoutNull | undefined;

  const questions = useQuery(api.quizzes.getQuestions, {
    category,
    questionFormat,
    difficulty: difficulty ?? null,
  });

  useEffect(() => {
    if (questions === undefined) return;

    const randomQuestions = getRandomElements<any>(questions as any, 10);

    setQuestions(randomQuestions as any);
    setUserAnswers(
      randomQuestions.map((question: any) => ({
        questionId: question._id,
        question: question.question,
        correctAnswer: question.answer || question.answers,
        userAnswer: '',
        isCorrect: false,
        pointsEarned: 0,
        streakCount: 0,
      })),
    );
  }, [questions]);

  return <QuestionList />;
}
