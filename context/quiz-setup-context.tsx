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

// 카테고리 모델
export type TopCategory =
  | 'general'
  | 'entertainment'
  | 'slang'
  | 'capitals'
  | 'four-character-idioms';

export type Subcategory =
  | 'general'
  | 'history-culture'
  | 'arts-literature'
  | 'sports'
  | 'science-tech'
  | 'math-logic'
  | 'kpop-music'
  | 'movies'
  | 'drama-variety'
  | null;

// 문제 형식
export type QuestionFormat = 'multiple' | 'short' | 'true_false' | 'filmography' | null;

// 난이도
export type Difficulty = 'easy' | 'medium' | 'hard' | null;

// 상태 타입
type QuizSetup = {
  topCategory: TopCategory | null;
  subcategory: Subcategory;
  difficulty: Difficulty;
  questionFormat: QuestionFormat;
  questions: Doc<'quizzes'>[];
  userAnswers: UserAnswer[];
  quizStartTime?: number;
  totalTime?: number;
};

// Context 타입
type QuizSetupContextType = {
  setup: QuizSetup;
  setSetup: React.Dispatch<React.SetStateAction<QuizSetup>>;
  setQuestions: (questions: Doc<'quizzes'>[]) => void;
  setUserAnswers: (userAnswers: UserAnswer[]) => void;
  addUserAnswer: (userAnswer: UserAnswer) => void;
  resetQuizData: () => void;
  restartQuiz: () => void;
  setQuizStartTime: (quizStartTime: number) => void;
  setTotalTime: (totalTime: number) => void;
};

const QuizSetupContext = createContext<QuizSetupContextType | undefined>(undefined);

export const QuizSetupProvider = ({ children }: { children: ReactNode }) => {
  const [setup, setSetup] = useState<QuizSetup>({
    topCategory: null,
    subcategory: null,
    difficulty: null,
    questionFormat: null,
    questions: [],
    userAnswers: [],
    quizStartTime: undefined,
    totalTime: undefined,
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
      topCategory: null,
      subcategory: null,
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

  const setQuizStartTime = (quizStartTime: number) => {
    setSetup((prev) => ({ ...prev, quizStartTime }));
  };

  const setTotalTime = (totalTime: number) => {
    setSetup((prev) => ({ ...prev, totalTime }));
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
        setQuizStartTime,
        setTotalTime,
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
