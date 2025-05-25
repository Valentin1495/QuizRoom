import Questions from '@/components/questions';
import {
  CategoryByQuizType,
  Difficulty,
  QuestionFormatByQuizType,
  useQuizSetup,
} from '@/context/quiz-setup-context';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { getRandomElements } from '@/utils/get-random-elements';
import { useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

export default function QuestionScreen() {
  const { setQuestions, setUserAnswers } = useQuizSetup();

  const { category, quizType, questionFormat, difficulty } =
    useLocalSearchParams<{
      category: CategoryByQuizType<'knowledge'>;
      quizType: 'knowledge';
      questionFormat: QuestionFormatByQuizType<'knowledge'>;
      difficulty: Exclude<Difficulty, null>;
    }>();

  const questions = useQuery(api.quizzes.getQuestionsByQuizType, {
    category,
    quizType,
    questionFormat,
    difficulty,
  });

  useEffect(() => {
    if (questions === undefined) return;

    const randomQuestions = getRandomElements<Doc<'quizzes'>>(questions, 10);

    setQuestions(randomQuestions);
    setUserAnswers(
      randomQuestions.map((question) => ({
        questionId: question._id,
        question: question.question,
        correctAnswer: question.answer || question.answers,
        userAnswer: '',
        isCorrect: false,
        pointsEarned: 0,
        streakCount: 0,
      }))
    );
  }, [questions]);

  return <Questions />;
}
