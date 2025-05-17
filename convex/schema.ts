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

  quizzes: defineTable({
    quizType: v.union(
      v.literal('knowledge'),
      v.literal('celebrity'),
      v.literal('four-character'),
      v.literal('movie-chain'),
      v.literal('proverb-chain'),
      v.literal('slang'),
      v.literal('logo'),
      v.literal('nonsense'),
      v.null()
    ),
    category: v.optional(
      v.union(
        v.literal('kpop-music'),
        v.literal('general'),
        v.literal('history-culture'),
        v.literal('arts-literature'),
        v.literal('sports'),
        v.literal('science-tech'),
        v.literal('math-logic'),
        v.literal('entertainment'),
        v.literal('korean-movie'),
        v.literal('foreign-movie'),
        v.literal('korean-celebrity'),
        v.literal('foreign-celebrity'),
        v.null()
      )
    ),
    question: v.string(),
    questionFormat: v.union(
      v.literal('multiple'),
      v.literal('short'),
      v.null()
    ),
    explanation: v.optional(v.string()),
    difficulty: v.union(
      v.literal('easy'),
      v.literal('medium'),
      v.literal('hard'),
      v.null()
    ),

    // 객관식일 때만 사용
    options: v.optional(v.array(v.string())),
    answer: v.optional(v.string()),

    // 주관식일 때만 사용
    answers: v.optional(v.array(v.string())),
  })
    .index('byQuizType', ['quizType'])
    .index('byCategory', ['category']),
});
