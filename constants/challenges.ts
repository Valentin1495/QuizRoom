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
  tagline: '초등 저학년부터 대학+까지 단계별 진단',
  description: '과목 선택 후 단계별로 풀며 현재 수준을 빠르게 확인해요',
  ctaLabel: '측정 시작',
  route: '/skill-assessment',
  deckSlug: 'deck_skill_assessment_v1',
  category: 'education',
  tags: ['mode:skill_assessment'],
  totalQuestions: 16,
  allowedMisses: 16,
  scorePerCorrect: 100,
};
