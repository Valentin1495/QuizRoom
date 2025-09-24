import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    firebaseUid: v.string(),
    displayName: v.optional(v.string()),
    photoURL: v.optional(v.string()),
    email: v.string(),
    lastLoginAt: v.number(),
    settings: v.optional(
      v.object({
        notifications: v.boolean(), // 알림 설정
        sound: v.boolean(), // 소리 설정
        vibration: v.boolean(), // 진동 설정
        darkMode: v.boolean(), // 다크 모드 설정
        language: v.string(), // 언어 설정
      }),
    ),
    coins: v.number(),
    experience: v.number(),
    level: v.number(),
    streak: v.number(),
  }).index('by_firebase_uid', ['firebaseUid']),

  gamificationData: defineTable({
    userId: v.string(),

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
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  categoryStats: defineTable({
    userId: v.string(),
    category: v.string(),

    // 기본 통계
    totalQuestions: v.number(),
    correctAnswers: v.number(),

    // 가중 점수 시스템 (코드의 핵심 로직)
    weightedScore: v.number(),
    maxWeightedScore: v.number(),

    // 난이도별 상세 통계 (코드의 DifficultyStats 인터페이스와 일치)
    difficultyStats: v.object({
      easy: v.object({
        accuracy: v.number(),
        totalQuestions: v.number(), // 코드에서 사용하는 필드명
        correct: v.optional(v.number()), // 추가 통계용
        avgTime: v.optional(v.number()),
      }),
      medium: v.object({
        accuracy: v.number(),
        totalQuestions: v.number(),
        correct: v.optional(v.number()),
        avgTime: v.optional(v.number()),
      }),
      hard: v.object({
        accuracy: v.number(),
        totalQuestions: v.number(),
        correct: v.optional(v.number()),
        avgTime: v.optional(v.number()),
      }),
    }),

    // 성장 추세 (코드에서 단일 숫자로 처리)
    growthTrend: v.number(),

    // 평균 시간 (코드의 AnalysisResult에서 사용)
    averageTime: v.optional(v.number()),

    // 실력 티어 시스템 (게임 스타일 - 기존 유지)
    skillLevel: v.union(
      v.literal('Unranked'),
      v.literal('Iron'),
      v.literal('Bronze'),
      v.literal('Silver'),
      v.literal('Gold'),
      v.literal('Platinum'),
      v.literal('Diamond'),
    ),

    weightedAccuracy: v.number(),

    skillLevelNote: v.optional(v.string()), // 선택적으로 변경

    // AI 인사이트 캐싱 (성능 최적화용)
    aiInsightsCache: v.optional(
      v.object({
        overallInsight: v.string(),
        motivationalMessage: v.string(),
        nextGoals: v.array(v.string()),
        cacheExpiry: v.number(), // 캐시 만료 시간 (timestamp)
      }),
    ),

    // 진행률 추적을 위한 히스토리
    progressHistory: v.optional(
      v.array(
        v.object({
          date: v.number(), // timestamp
          weightedAccuracy: v.number(),
          accuracy: v.number(),
          questionsAnswered: v.number(),
        }),
      ),
    ),

    updatedAt: v.number(),
  })
    .index('by_user_category', ['userId', 'category'])
    .index('by_user', ['userId']) // 사용자별 전체 분석용
    .index('by_skill_level', ['skillLevel']) // 랭킹 시스템용
    .index('by_updated_at', ['updatedAt']), // 최근 업데이트 조회용

  achievements: defineTable({
    userId: v.string(),
    achievementId: v.string(), // 업적의 고유 ID
    unlockedAt: v.optional(v.number()), // timestamp, undefined면 미해금
    progress: v.number(), // 현재 진행도
    target: v.optional(v.number()), // 목표값 (예: streak_30이면 30, first_quiz면 1)
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_achievement', ['userId', 'achievementId'])
    .index('by_user_unlocked', ['userId', 'unlockedAt']), // 해금된 업적 조회용

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
    maxPerfectStreak: v.optional(v.number()),
    withFriend: v.optional(v.boolean()),
    relearnedMistakes: v.optional(v.boolean()),
    difficulty: v.optional(v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'))),
    questionFormat: v.optional(
      v.union(
        v.literal('multiple'),
        v.literal('short'),
        v.literal('true_false'),
        v.literal('filmography'),
        v.null(),
      ),
    ),
    timeSpent: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_user_date', ['userId', 'date']),

  challenges: defineTable({
    userId: v.string(),
    type: v.union(v.literal('daily'), v.literal('weekly')),
    title: v.string(),
    description: v.string(),
    targetCount: v.number(),
    currentCount: v.number(),
    reward: v.object({
      type: v.union(v.literal('points'), v.literal('badge'), v.literal('streak')),
      value: v.number(),
      name: v.optional(v.string()),
    }),
    completed: v.boolean(),
    expiresAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_type', ['userId', 'type'])
    .index('by_expiry', ['expiresAt']),

  // 신규 문제 테이블: testQuestions
  testQuestions: defineTable({
    answer: v.optional(v.string()),
    answers: v.optional(v.array(v.string())),
    category: v.union(
      v.literal('general'),
      v.literal('entertainment'),
      v.literal('slang'),
      v.literal('capitals'),
      v.literal('four-character-idioms'),
    ),
    difficulty: v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'), v.null()),
    explanation: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    question: v.string(),
    questionFormat: v.union(
      v.literal('multiple'),
      v.literal('short'),
      v.literal('true_false'),
      v.literal('filmography'),
      v.null(),
    ),
    subcategory: v.optional(
      v.union(
        v.literal('kpop-music'),
        v.literal('general'),
        v.literal('history-culture'),
        v.literal('arts-literature'),
        v.literal('sports'),
        v.literal('science-tech'),
        v.literal('math-logic'),
        v.literal('movies'),
        v.literal('drama-variety'),
        v.null(),
      ),
    ),
  })
    .index('byCategory', ['category'])
    .index('bySubcategory', ['category', 'subcategory']),

  // 문제 오류 신고 테이블
  reports: defineTable({
    questionId: v.id('testQuestions'), // 신고된 문제 ID
    userId: v.string(),
    reason: v.union(v.literal('정답 오류'), v.literal('문제 불명확'), v.literal('기타')), // 신고 사유 선택지
    detail: v.optional(v.string()), // 기타 입력란
  })
    .index('by_question', ['questionId'])
    .index('by_user', ['userId']),

  // === MVP: Daily set flow tables ===
  questionBank: defineTable({
    stem: v.string(),
    choices: v.array(v.object({ id: v.string(), text: v.string() })),
    answerId: v.string(),
    subject: v.string(), // math|science|history|language|etc
    difficulty: v.number(), // 0~1
    locale: v.string(), // ko|en
    reviewed: v.boolean(),
  }).index('by_locale_diff', ['locale', 'difficulty']),

  dailySets: defineTable({
    date: v.string(), // YYYY-MM-DD
    questionIds: v.array(v.id('questionBank')),
    locale: v.string(),
  }).index('by_date_locale', ['date', 'locale']),

  sessions: defineTable({
    userId: v.id('users'),
    setId: v.id('dailySets'),
    answers: v.array(
      v.object({
        qid: v.id('questionBank'),
        choiceId: v.string(),
        elapsedMs: v.number(),
        correct: v.boolean(),
      }),
    ),
    score: v.number(),
    hintsUsed: v.number(),
    status: v.string(), // active|done
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  }).index('by_user', ['userId']),

  leaderboards: defineTable({
    date: v.string(),
    userId: v.id('users'),
    score: v.number(),
    handle: v.string(),
  }).index('by_date_score', ['date', 'score']),
});
