import type { LinkProps } from 'expo-router';

export type ChallengeConfig = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  ctaLabel: string;
  route: LinkProps['href'];
  deckSlug: string;
  category: string;
  tags: string[];
  totalQuestions: number;
  allowedMisses: number;
  scorePerCorrect: number;
};

export const FIFTH_GRADER_CHALLENGE: ChallengeConfig = {
  slug: 'fifth-grader',
  title: '5th Grader 챌린지',
  tagline: '10문항 런 · 오답 2회까지',
  description: '50:50, 학생 힌트 각 1회 제공',
  ctaLabel: '도전하기',
  route: '/5th-grader',
  deckSlug: 'deck_fifth_grader_v1',
  category: 'education',
  tags: ['mode:fifth_grader'],
  totalQuestions: 10,
  allowedMisses: 2,
  scorePerCorrect: 100,
};
