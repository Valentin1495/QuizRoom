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

export const SKILL_ASSESSMENT_CHALLENGE: ChallengeConfig = {
  slug: 'skill-assessment',
  title: '실력 측정',
  tagline: '난이도 자동 조정 · 내 수준 한눈에',
  description: '중·고·대학+ 영역에서 16문항으로 레벨을 추정해요',
  ctaLabel: '측정 시작',
  route: '/skill-assessment',
  deckSlug: 'deck_skill_assessment_v1',
  category: 'education',
  tags: ['mode:skill_assessment'],
  totalQuestions: 16,
  allowedMisses: 16,
  scorePerCorrect: 100,
};
