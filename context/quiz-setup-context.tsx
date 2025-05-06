import { Id } from '@/convex/_generated/dataModel';
import React, { createContext, ReactNode, useContext, useState } from 'react';

type QuizSetup = {
  categoryId: Id<'categories'> | null;
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
    categoryId: null,
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
