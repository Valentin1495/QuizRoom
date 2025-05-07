import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    username: v.string(),
    fullName: v.string(),
    email: v.string(),
    profileImage: v.string(),
    level: v.number(), // 사용자 레벨
    experience: v.number(), // 경험치
    coins: v.number(), // 인앱 화폐
    streak: v.number(), // 연속 참여 일수
    settings: v.optional(
      v.object({
        notifications: v.boolean(), // 알림 설정
        sound: v.boolean(), // 소리 설정
        vibration: v.boolean(), // 진동 설정
        darkMode: v.boolean(), // 다크 모드 설정
        language: v.string(), // 언어 설정
      })
    ),
  }).index('byClerkId', ['clerkId']),

  categories: defineTable({
    quizType: v.union(
      v.literal('knowledge'),
      v.literal('celebrity'),
      v.literal('four-character'),
      v.literal('movie-chain'),
      v.literal('proverb-chain'),
      v.literal('slang'),
      v.literal('logo')
    ),
    value: v.string(),
    label: v.string(),
    icon: v.string(),
    colors: v.array(v.string()),
  }).index('byQuizType', ['quizType']),

  quizzes: defineTable({
    quizType: v.union(
      v.literal('knowledge'),
      v.literal('celebrity'),
      v.literal('four-character'),
      v.literal('movie-chain'),
      v.literal('proverb-chain'),
      v.literal('slang'),
      v.literal('logo')
    ),
    categoryId: v.id('categories'),
    question: v.string(),
    type: v.union(v.literal('multiple'), v.literal('short')),
    options: v.optional(v.array(v.string())),
    answer: v.string(),
    explanation: v.optional(v.string()),
    difficulty: v.optional(
      v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'))
    ),
  }).index('byCategoryId', ['categoryId']),
});
