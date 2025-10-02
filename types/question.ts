export type Question = {
  id: string;
  stem: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
  category: string;
  gradeBand: "K-2" | "3-5" | "6-8" | "9-12";
  difficulty: 1 | 2 | 3 | 4 | 5;
  flags?: string[];
};
