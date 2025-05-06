import React, { createContext, ReactNode, useContext, useState } from 'react';

export type Category =
  | 'kpop-music'
  | 'movies-drama'
  | 'world-knowledge'
  | 'trivia-tmi'
  | 'memes-trends'
  | 'sports'
  | 'science-tech'
  | 'math-logic';

type QuizSetup = {
  category: Category | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  type: 'multiple' | 'short' | null;
};

type QuizSetupContextType = {
  setup: QuizSetup;
  setSetup: React.Dispatch<React.SetStateAction<QuizSetup>>;
};

const QuizSetupContext = createContext<QuizSetupContextType | undefined>(
  undefined
);

export const QuizSetupProvider = ({ children }: { children: ReactNode }) => {
  const [setup, setSetup] = useState<QuizSetup>({
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
