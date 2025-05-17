import Questions from '@/components/questions';
import { useQuizSetup } from '@/context/quiz-setup-context';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { getRandomElements } from '@/utils/get-random-elements';
import { useQuery } from 'convex/react';
import { useEffect } from 'react';

export default function QuestionScreen() {
  const { setup, setQuestions } = useQuizSetup();
  const questions = useQuery(api.quizzes.getQuestionsByQuizType, {
    category: setup.category!,
    quizType: setup.quizType,
    questionFormat: setup.questionFormat!,
    difficulty: setup.difficulty!,
  });

  useEffect(() => {
    if (questions === undefined) return;

    setQuestions(getRandomElements<Doc<'quizzes'>>(questions, 10));
  }, [questions]);

  return <Questions />;
}
