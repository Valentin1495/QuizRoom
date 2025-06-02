import { Doc } from '@/convex/_generated/dataModel';
import { createContext, ReactNode, useContext, useState } from 'react';

// 사용자 응답 타입
export interface UserAnswer {
  questionId: string;
  question: string;
  correctAnswer: string | string[] | undefined;
  userAnswer: string;
  isCorrect: boolean;
  pointsEarned: number;
  streakCount: number;

  // 업적 추적을 위한 새 필드들 (선택적)
  answerTime?: number; // 답변에 걸린 시간 (초)
  questionIndex?: number; // 문제 순서 (처음 3문제 추적용)
}

// 1. 퀴즈 타입
export type QuizType =
  | 'knowledge'
  | 'celebrity'
  | 'four-character'
  | 'movie-chain'
  | 'proverb-chain'
  | 'slang'
  | 'logo'
  | 'nonsense'
  | null;

// 2. 퀴즈별 카테고리
export type KnowledgeCategory =
  | 'general'
  | 'kpop-music'
  | 'entertainment'
  | 'history-culture'
  | 'sports'
  | 'science-tech'
  | 'math-logic'
  | 'arts-literature';

export type MovieCategory = 'korean-movie' | 'foreign-movie';
export type CelebrityCategory = 'korean-celebrity' | 'foreign-celebrity';

export type CategoryByQuizType<T extends QuizType> = T extends 'knowledge'
  ? KnowledgeCategory
  : T extends 'movie-chain'
    ? MovieCategory
    : T extends 'celebrity'
      ? CelebrityCategory
      : null;

// 3. 퀴즈 유형
export type QuestionFormatByQuizType<T extends QuizType> = T extends 'knowledge'
  ? 'multiple' | 'short'
  : T extends 'movie-chain'
    ? 'short'
    : T extends 'celebrity'
      ? 'short'
      : null;

// 4. 난이도 (공통으로 가정)
export type Difficulty = 'easy' | 'medium' | 'hard' | null; // expert

// 5. 상태 타입
type QuizSetup<T extends QuizType = QuizType> = {
  quizType: T;
  category: CategoryByQuizType<T>;
  difficulty: Difficulty;
  questionFormat: QuestionFormatByQuizType<T>;
  // 새로 추가된 필드
  questions: Doc<'quizzes'>[];
  userAnswers: UserAnswer[];
};

// 6. Context 타입
type QuizSetupContextType = {
  setup: QuizSetup;
  setSetup: React.Dispatch<React.SetStateAction<QuizSetup>>;
  // 개별 필드에 대한 업데이트 함수들
  setQuestions: (questions: Doc<'quizzes'>[]) => void;
  setUserAnswers: (userAnswers: UserAnswer[]) => void;
  addUserAnswer: (userAnswer: UserAnswer) => void;
  resetQuizData: () => void;
  restartQuiz: () => void;
};

const QuizSetupContext = createContext<QuizSetupContextType | undefined>(
  undefined
);

export const QuizSetupProvider = ({ children }: { children: ReactNode }) => {
  const [setup, setSetup] = useState<QuizSetup>({
    quizType: 'knowledge',
    category: null,
    difficulty: null,
    questionFormat: null,
    questions: [],
    userAnswers: [],
  });

  // 개별 필드 업데이트를 위한 헬퍼 함수들
  const setQuestions = (questions: Doc<'quizzes'>[]) => {
    setSetup((prev) => ({ ...prev, questions }));
  };

  const setUserAnswers = (userAnswers: UserAnswer[]) => {
    setSetup((prev) => ({ ...prev, userAnswers }));
  };

  const addUserAnswer = (userAnswer: UserAnswer) => {
    setSetup((prev) => ({
      ...prev,
      userAnswers: [...prev.userAnswers, userAnswer],
    }));
  };

  const resetQuizData = () => {
    setSetup((prev) => ({
      ...prev,
      quizType: 'knowledge',
      category: null,
      difficulty: null,
      questionFormat: null,
      questions: [],
    }));
  };

  const restartQuiz = () => {
    setSetup((prev) => ({
      ...prev,
      questions: [],
    }));
  };

  return (
    <QuizSetupContext.Provider
      value={{
        setup,
        setSetup,
        setQuestions,
        setUserAnswers,
        addUserAnswer,
        resetQuizData,
        restartQuiz,
      }}
    >
      {children}
    </QuizSetupContext.Provider>
  );
};

export const useQuizSetup = (): QuizSetupContextType => {
  const context = useContext(QuizSetupContext);
  if (!context) {
    throw new Error('useQuizSetup must be used within a QuizSetupProvider');
  }
  return context;
};
