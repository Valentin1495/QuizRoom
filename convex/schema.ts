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
    name: v.string(),
    description: v.string(),
    iconUrl: v.optional(v.string()), // 카테고리 아이콘 URL
    order: v.number(), // 표시 순서
    isActive: v.boolean(), // 활성화 여부
  }),

  quizzes: defineTable({
    categoryId: v.id('categories'),
    question: v.string(),
    options: v.array(v.string()),
    correctOptionIndex: v.number(),
    explanation: v.optional(v.string()), // 정답 설명
    difficulty: v.number(), // 난이도 (1-5)
    timeLimit: v.number(), // 제한 시간 (초)
    points: v.number(), // 기본 점수
    imageUrl: v.optional(v.string()), // 이미지 URL (문제에 사용)
    createdBy: v.optional(v.id('users')), // 생성자 ID (어드민 또는 사용자)
    isApproved: v.boolean(), // 승인 여부 (사용자 생성 퀴즈에 사용)
    tags: v.optional(v.array(v.string())), // 태그 (검색용)
  }),
});
