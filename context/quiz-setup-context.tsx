import React, { createContext, ReactNode, useContext, useState } from 'react';

// 1. 퀴즈 타입
export type QuizType =
  | 'knowledge'
  | 'celebrity'
  | 'four-character'
  | 'movie-chain'
  | 'proverb-chain'
  | 'slang'
  | 'logo';

// 2. 퀴즈별 카테고리
export type KnowledgeCategory =
  | 'kpop-music'
  | 'movies-drama'
  | 'world-knowledge'
  | 'trivia-tmi'
  | 'memes-trends'
  | 'sports'
  | 'science-tech'
  | 'math-logic';

export type MovieCategory = 'korean-movie' | 'foreign-movie';
export type CelebrityCategory = 'korean-celebrity' | 'foreign-celebrity';

type CategoryByQuizType<T extends QuizType> = T extends 'knowledge'
  ? KnowledgeCategory
  : T extends 'movie-chain'
    ? MovieCategory
    : T extends 'celebrity'
      ? CelebrityCategory
      : never;

// 3. 퀴즈 유형
type TypeByQuizType<T extends QuizType> = T extends 'knowledge'
  ? 'multiple' | 'short'
  : T extends 'movie-chain'
    ? 'short'
    : T extends 'celebrity'
      ? 'short'
      : never;

// 4. 난이도 (공통으로 가정)
export type Difficulty = 'easy' | 'medium' | 'hard'; // expert

// 5. 상태 타입
type QuizSetup<T extends QuizType = QuizType> = {
  quizType: T;
  category: CategoryByQuizType<T> | null;
  difficulty: Difficulty | null;
  type: TypeByQuizType<T> | null;
};

// 6. Context 타입
type QuizSetupContextType = {
  setup: QuizSetup;
  setSetup: React.Dispatch<React.SetStateAction<QuizSetup>>;
};

const QuizSetupContext = createContext<QuizSetupContextType | undefined>(
  undefined
);

export const QuizSetupProvider = ({ children }: { children: ReactNode }) => {
  const [setup, setSetup] = useState<QuizSetup>({
    quizType: 'knowledge',
    category: null,
    difficulty: null,
    type: null,
  });

  return (
    <QuizSetupContext.Provider value={{ setup, setSetup }}>
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
