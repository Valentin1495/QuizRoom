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
    engName: v.string(),
    korName: v.string(),
    description: v.string(),
    iconName: v.string(), // 카테고리 아이콘 URL
    order: v.number(), // 표시 순서
    isActive: v.boolean(), // 활성화 여부
  }),

  quizzes: defineTable({
    categoryId: v.id('categories'), // 연결된 카테고리
    question: v.string(), // 문제 내용
    type: v.union(v.literal('multiple'), v.literal('short')), // 문제 유형
    options: v.optional(v.array(v.string())), // 객관식 선택지
    answer: v.string(), // 객관식 정답 or 주관식 정답
    explanation: v.optional(v.string()), // 해설
    difficulty: v.optional(
      v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'))
    ),
  }).index('byCategoryId', ['categoryId']),
});
