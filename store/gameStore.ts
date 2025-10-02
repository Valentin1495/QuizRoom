import { create } from 'zustand';
import { Question } from '../types/question'; // 타입 정의 파일은 나중에 생성

type SessionAnswer = {
  qid: string;
  choice: number;
  correct: boolean;
  ms: number;
};

interface GameState {
  questions: Question[];
  currentQuestionIndex: number;
  status: 'idle' | 'playing' | 'completed';

  startQuiz: (questions: Question[]) => void;
  nextQuestion: () => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  questions: [],
  currentQuestionIndex: 0,
  status: 'idle',

  startQuiz: (questions) => {
    set({
      questions,
      currentQuestionIndex: 0,
      status: 'playing',
    });
  },

  nextQuestion: () => {
    if (get().currentQuestionIndex + 1 >= get().questions.length) {
      set({ status: 'completed' });
    } else {
      set((state) => ({
        currentQuestionIndex: state.currentQuestionIndex + 1,
      }));
    }
  },

  reset: () => {
    set({
      questions: [],
      currentQuestionIndex: 0,
      status: 'idle',
    });
  },
}));
