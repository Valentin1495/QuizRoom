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

  gamificationData: defineTable({
    userId: v.string(), // Clerk 유저 ID

    // 포인트 & 레벨
    totalPoints: v.number(),
    level: v.number(),
    pointsToNextLevel: v.number(),
    expInCurrentLevel: v.number(),

    // 스트릭
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastQuizDate: v.optional(v.string()), // ISO 날짜 문자열

    // 퀴즈 통계
    totalQuizzes: v.number(),
    totalCorrectAnswers: v.number(),
    currentPerfectStreak: v.number(),

    // 메타데이터
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  categoryStats: defineTable({
    userId: v.string(),
    category: v.string(),

    // 전체 통계
    totalQuestions: v.number(),
    correctAnswers: v.number(),
    masteryLevel: v.number(),
    initialAccuracy: v.optional(v.number()),

    // 난이도별 상세 통계
    difficultyStats: v.object({
      easy: v.object({
        total: v.number(),
        correct: v.number(),
        accuracy: v.number(),
        avgTime: v.optional(v.number()),
      }),
      medium: v.object({
        total: v.number(),
        correct: v.number(),
        accuracy: v.number(),
        avgTime: v.optional(v.number()),
      }),
      hard: v.object({
        total: v.number(),
        correct: v.number(),
        accuracy: v.number(),
        avgTime: v.optional(v.number()),
      }),
    }),

    // 가중 점수 (난이도별 가중치 적용)
    weightedScore: v.number(), // easy: 1점, medium: 2점, hard: 3점
    maxWeightedScore: v.number(),

    // 실력 레벨 분석
    skillLevel: v.union(
      v.literal('beginner'), // 0-30%
      v.literal('novice'), // 30-50%
      v.literal('intermediate'), // 50-70%
      v.literal('advanced'), // 70-85%
      v.literal('expert') // 85-100%
    ),

    // 추천 난이도
    recommendedDifficulty: v.union(
      v.literal('easy'),
      v.literal('medium'),
      v.literal('hard')
    ),

    // 성장 추세
    growthTrend: v.object({
      last7Days: v.number(), // 최근 7일간 정답률 변화
      last30Days: v.number(), // 최근 30일간 정답률 변화
      isImproving: v.boolean(), // 향상 중인지 여부
    }),

    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user_category', ['userId', 'category']),

  // 퀴즈 결과에 난이도 정보 추가
  quizResults: defineTable({
    id: v.string(),
    userId: v.string(),
    quizId: v.string(),
    category: v.string(),
    difficulty: v.union(
      v.literal('easy'),
      v.literal('medium'),
      v.literal('hard')
    ),
    isCorrect: v.boolean(),
    timeSpent: v.number(), // 밀리초
    attemptedAt: v.number(),

    // 추가 메타데이터
    hintsUsed: v.optional(v.number()),
    confidenceLevel: v.optional(v.number()), // 1-5 스케일
  })
    .index('by_user', ['userId'])
    .index('by_user_category', ['userId', 'category'])
    .index('by_user_difficulty', ['userId', 'difficulty']),

  achievements: defineTable({
    userId: v.string(),
    achievementId: v.string(), // 업적의 고유 ID
    unlockedAt: v.optional(v.number()), // timestamp, null이면 미해금
    progress: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_achievement', ['userId', 'achievementId']),

  quizHistory: defineTable({
    id: v.string(), // UUID
    userId: v.string(),
    date: v.string(), // ISO 날짜 (YYYY-MM-DD)
    completedAt: v.string(), // ISO 날짜시간
    category: v.string(),
    total: v.number(),
    correct: v.number(),
    averageTime: v.optional(v.number()),
    comebackVictory: v.optional(v.boolean()),
    luckyStreak: v.optional(v.number()),
    withFriend: v.optional(v.boolean()),
    relearnedMistakes: v.optional(v.boolean()),
    createdAt: v.number(),
    difficulty: v.optional(
      v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'))
    ),
    timeSpent: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_user_date', ['userId', 'date']),

  // 도전과제 관련 새로운 테이블들
  challenges: defineTable({
    userId: v.string(),
    type: v.union(v.literal('daily'), v.literal('weekly')),
    title: v.string(),
    description: v.string(),
    targetCount: v.number(),
    currentCount: v.number(),
    reward: v.object({
      type: v.union(
        v.literal('points'),
        v.literal('badge'),
        v.literal('streak')
      ),
      value: v.number(),
      name: v.optional(v.string()),
    }),
    completed: v.boolean(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_type', ['userId', 'type'])
    .index('by_expiry', ['expiresAt']),

  dailyChallengeProgress: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD 형식
    quizCount: v.number(),
    perfectQuizCount: v.number(),
    streakDays: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_date', ['userId', 'date']),
});
