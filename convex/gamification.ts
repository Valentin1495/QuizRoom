import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// 난이도별 가중치 상수
const DIFFICULTY_WEIGHTS = {
  easy: 1,
  medium: 2,
  hard: 3,
} as const;

// 타입 정의
type DifficultyType = 'easy' | 'medium' | 'hard';
type SkillLevelType =
  | 'beginner'
  | 'novice'
  | 'intermediate'
  | 'advanced'
  | 'expert';

interface DifficultyStats {
  easy: {
    total: number;
    correct: number;
    accuracy: number;
    avgTime?: number;
  };
  medium: {
    total: number;
    correct: number;
    accuracy: number;
    avgTime?: number;
  };
  hard: {
    total: number;
    correct: number;
    accuracy: number;
    avgTime?: number;
  };
}

interface GrowthTrend {
  last7Days: number;
  last30Days: number;
  isImproving: boolean;
}

// 게이미피케이션 데이터 초기화 또는 가져오기
export const getOrCreateGamificationData = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('gamificationData')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first();

    if (existing) {
      return existing;
    }

    // 초기 데이터 반환 (아직 저장하지 않음)
    return {
      userId: args.userId,
      totalPoints: 0,
      level: 1,
      pointsToNextLevel: 100,
      expInCurrentLevel: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastQuizDate: null,
      totalQuizzes: 0,
      totalCorrectAnswers: 0,
      currentPerfectStreak: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  },
});

// 게이미피케이션 데이터 업데이트
export const updateGamificationData = mutation({
  args: {
    userId: v.string(),
    data: v.object({
      totalPoints: v.number(),
      level: v.number(),
      pointsToNextLevel: v.number(),
      expInCurrentLevel: v.number(),
      currentStreak: v.number(),
      longestStreak: v.number(),
      lastQuizDate: v.optional(v.string()),
      totalQuizzes: v.number(),
      totalCorrectAnswers: v.number(),
      currentPerfectStreak: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('gamificationData')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args.data,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('gamificationData', {
        userId: args.userId,
        ...args.data,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// 사용자의 모든 업적 조회
export const getAchievements = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('achievements')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();
  },
});

// 업적 진행도 업데이트 (자동 해금 포함)
export const updateAchievement = mutation({
  args: {
    userId: v.string(),
    achievementId: v.string(),
    progress: v.number(),
    maxProgress: v.number(), // 목표값 필수
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('achievements')
      .withIndex('by_user_achievement', (q) =>
        q.eq('userId', args.userId).eq('achievementId', args.achievementId)
      )
      .first();

    const now = Date.now();
    const shouldUnlock = args.progress >= args.maxProgress;

    if (existing) {
      // 기존 기록 업데이트
      await ctx.db.patch(existing._id, {
        progress: args.progress,
        maxProgress: args.maxProgress,
        unlockedAt:
          shouldUnlock && !existing.unlockedAt ? now : existing.unlockedAt,
        updatedAt: now,
      });
    } else {
      // 새 기록 생성
      await ctx.db.insert('achievements', {
        userId: args.userId,
        achievementId: args.achievementId,
        progress: args.progress,
        maxProgress: args.maxProgress,
        unlockedAt: shouldUnlock ? now : undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    return shouldUnlock;
  },
});

// 해금된 업적만 조회
export const getUnlockedAchievements = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('achievements')
      .withIndex('by_user_unlocked', (q) =>
        q.eq('userId', args.userId).gt('unlockedAt', 0)
      )
      .collect();
  },
});

// 업적 통계 조회
export const getAchievementStats = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const achievements = await ctx.db
      .query('achievements')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    const unlockedCount = achievements.filter((a) => a.unlockedAt).length;
    const totalCount = achievements.length;

    return {
      unlockedCount,
      totalCount,
      achievements,
    };
  },
});

// 퀴즈 히스토리 추가
export const addQuizHistory = mutation({
  args: {
    id: v.string(),
    userId: v.string(),
    date: v.string(),
    completedAt: v.string(),
    category: v.string(),
    total: v.number(),
    correct: v.number(),
    averageTime: v.optional(v.number()),
    comebackVictory: v.optional(v.boolean()),
    luckyStreak: v.optional(v.number()),
    withFriend: v.optional(v.boolean()),
    relearnedMistakes: v.optional(v.boolean()),
    difficulty: v.optional(
      v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'))
    ),
    timeSpent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('quizHistory', {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// 퀴즈 히스토리 가져오기
export const getQuizHistory = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('quizHistory')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .collect();
  },
});

// 데이터 초기화
export const resetGamificationData = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // 게이미피케이션 데이터 삭제
    const gamificationData = await ctx.db
      .query('gamificationData')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first();
    if (gamificationData) {
      await ctx.db.delete(gamificationData._id);
    }

    // 카테고리 통계 삭제
    const categoryStats = await ctx.db
      .query('categoryStats')
      .withIndex('by_user_category', (q) => q.eq('userId', args.userId))
      .collect();
    for (const stat of categoryStats) {
      await ctx.db.delete(stat._id);
    }

    // 업적 삭제
    const achievements = await ctx.db
      .query('achievements')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();
    for (const achievement of achievements) {
      await ctx.db.delete(achievement._id);
    }

    // 퀴즈 히스토리 삭제
    const quizHistory = await ctx.db
      .query('quizHistory')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();
    for (const quiz of quizHistory) {
      await ctx.db.delete(quiz._id);
    }
  },
});

// 퀴즈 결과 저장 시 난이도별 통계 업데이트
export const updateCategoryStatsWithDifficulty = mutation({
  args: {
    userId: v.string(),
    category: v.string(),
    difficulty: v.union(
      v.literal('easy'),
      v.literal('medium'),
      v.literal('hard')
    ),
    isCorrect: v.boolean(),
    timeSpent: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, category, difficulty, isCorrect, timeSpent } = args;

    // 기존 카테고리 통계 조회
    const existingStats = await ctx.db
      .query('categoryStats')
      .withIndex('by_user_category', (q) =>
        q.eq('userId', userId).eq('category', category)
      )
      .first();

    const now = Date.now();

    if (existingStats) {
      // 기존 통계 업데이트
      const currentDiffStats = existingStats.difficultyStats[difficulty];
      const newTotal = currentDiffStats.total + 1;
      const newCorrect = currentDiffStats.correct + (isCorrect ? 1 : 0);
      const newAccuracy = (newCorrect / newTotal) * 100;

      // 평균 시간 계산
      const currentAvgTime = currentDiffStats.avgTime || 0;
      const newAvgTime =
        (currentAvgTime * currentDiffStats.total + timeSpent) / newTotal;

      // 전체 통계 업데이트
      const newTotalQuestions = existingStats.totalQuestions + 1;
      const newCorrectAnswers =
        existingStats.correctAnswers + (isCorrect ? 1 : 0);

      // 가중 점수 계산
      const updatedDiffStats: DifficultyStats = {
        ...existingStats.difficultyStats,
        [difficulty]: {
          total: newTotal,
          correct: newCorrect,
          accuracy: newAccuracy,
          avgTime: newAvgTime,
        },
      };

      // 새로운 가중 점수 계산
      let newWeightedScore = 0;
      let newMaxWeightedScore = 0;

      Object.entries(updatedDiffStats).forEach(([diff, stats]) => {
        const weight = DIFFICULTY_WEIGHTS[diff as DifficultyType];
        newWeightedScore += stats.correct * weight;
        newMaxWeightedScore += stats.total * weight;
      });

      // 실력 레벨 계산
      const skillLevel = calculateSkillLevel(
        newWeightedScore,
        newMaxWeightedScore
      );

      // 추천 난이도 계산
      const recommendedDifficulty =
        calculateRecommendedDifficulty(updatedDiffStats);

      // 성장 추세 계산 (최근 기록들과 비교)
      const growthTrend = await calculateGrowthTrend(ctx, userId, category);

      await ctx.db.patch(existingStats._id, {
        totalQuestions: newTotalQuestions,
        correctAnswers: newCorrectAnswers,
        difficultyStats: updatedDiffStats,
        weightedScore: newWeightedScore,
        maxWeightedScore: newMaxWeightedScore,
        skillLevel,
        recommendedDifficulty,
        growthTrend,
        updatedAt: now,
      });
    } else {
      // 새로운 카테고리 통계 생성
      const initialDiffStats: DifficultyStats = {
        easy: { total: 0, correct: 0, accuracy: 0, avgTime: 0 },
        medium: { total: 0, correct: 0, accuracy: 0, avgTime: 0 },
        hard: { total: 0, correct: 0, accuracy: 0, avgTime: 0 },
      };

      // 현재 퀴즈 결과 반영
      initialDiffStats[difficulty] = {
        total: 1,
        correct: isCorrect ? 1 : 0,
        accuracy: isCorrect ? 100 : 0,
        avgTime: timeSpent,
      };

      const weightedScore =
        (isCorrect ? 1 : 0) * DIFFICULTY_WEIGHTS[difficulty];
      const maxWeightedScore = DIFFICULTY_WEIGHTS[difficulty];
      const skillLevel = calculateSkillLevel(weightedScore, maxWeightedScore);

      await ctx.db.insert('categoryStats', {
        userId,
        category,
        totalQuestions: 1,
        correctAnswers: isCorrect ? 1 : 0,
        masteryLevel: isCorrect ? 25 : 0, // 기존 호환성을 위해 유지
        difficultyStats: initialDiffStats,
        weightedScore,
        maxWeightedScore,
        skillLevel,
        recommendedDifficulty: 'easy', // 초기에는 쉬운 난이도부터
        growthTrend: {
          last7Days: 0,
          last30Days: 0,
          isImproving: false,
        },
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// 난이도별 카테고리 통계 조회
export const getCategoryStatsWithDifficulty = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const categoryStats = await ctx.db
      .query('categoryStats')
      .withIndex('by_user_category', (q) => q.eq('userId', args.userId))
      .collect();

    const result: Record<string, any> = {};

    for (const stat of categoryStats) {
      result[stat.category] = {
        ...stat,
        overallAccuracy:
          stat.totalQuestions > 0
            ? Math.round((stat.correctAnswers / stat.totalQuestions) * 100)
            : 0,
        skillScore:
          stat.maxWeightedScore > 0
            ? Math.round((stat.weightedScore / stat.maxWeightedScore) * 100)
            : 0,
      };
    }

    return result;
  },
});

// 종합 실력 분석 조회
export const getOverallAnalysis = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const categoryStats = await ctx.db
      .query('categoryStats')
      .withIndex('by_user_category', (q) => q.eq('userId', args.userId))
      .collect();

    if (categoryStats.length === 0) {
      return {
        strongestCategories: [],
        weakestCategories: [],
        overallAnalysis: [],
      };
    }

    // 각 카테고리별 실력 점수 계산
    const analysis = categoryStats.map((stat) => {
      const skillScore =
        stat.maxWeightedScore > 0
          ? (stat.weightedScore / stat.maxWeightedScore) * 100
          : 0;

      const { difficultyStats } = stat;

      // 강점/약점 분석
      const strengths: string[] = [];
      const weaknesses: string[] = [];

      if (difficultyStats.easy.accuracy >= 80) strengths.push('기초 실력 탄탄');
      if (difficultyStats.medium.accuracy >= 70)
        strengths.push('응용 능력 우수');
      if (difficultyStats.hard.accuracy >= 60)
        strengths.push('고난도 문제 해결 능력');

      if (difficultyStats.easy.accuracy < 60) weaknesses.push('기초 개념 부족');
      if (difficultyStats.medium.accuracy < 50)
        weaknesses.push('응용 능력 개선 필요');
      if (difficultyStats.hard.accuracy < 40)
        weaknesses.push('고난도 문제 연습 필요');

      return {
        category: stat.category,
        skillScore,
        difficultyAnalysis: {
          easy: difficultyStats.easy.accuracy,
          medium: difficultyStats.medium.accuracy,
          hard: difficultyStats.hard.accuracy,
        },
        strengths,
        weaknesses,
        recommendedDifficulty: stat.recommendedDifficulty,
        growthTrend: stat.growthTrend,
      };
    });

    // 실력 순으로 정렬
    const sortedBySkill = analysis.sort((a, b) => b.skillScore - a.skillScore);

    return {
      strongestCategories: sortedBySkill.slice(0, 3),
      weakestCategories: sortedBySkill.slice(-3).reverse(),
      overallAnalysis: analysis,
    };
  },
});

// 개인 맞춤 퀴즈 추천
export const getPersonalizedQuizRecommendation = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const categoryStats = await ctx.db
      .query('categoryStats')
      .withIndex('by_user_category', (q) => q.eq('userId', args.userId))
      .collect();

    const recommendations = [];

    for (const stat of categoryStats) {
      const { category, difficultyStats, recommendedDifficulty, skillLevel } =
        stat;

      // 각 카테고리별 추천 이유 생성
      let reason = '';
      let priority = 0;

      if (skillLevel === 'beginner' || skillLevel === 'novice') {
        reason = '기초 실력 향상을 위해 더 많은 연습이 필요합니다';
        priority = 3; // 높은 우선순위
      } else if (
        difficultyStats.hard.accuracy < 50 &&
        difficultyStats.medium.accuracy > 70
      ) {
        reason = '중급 문제는 잘 풀고 있으니 고난도 문제에 도전해보세요';
        priority = 2;
      } else if (stat.growthTrend.isImproving) {
        reason = '최근 실력이 향상되고 있습니다. 꾸준히 연습하세요';
        priority = 1;
      }

      recommendations.push({
        category,
        recommendedDifficulty,
        reason,
        priority,
        currentAccuracy: Math.round(
          (stat.correctAnswers / stat.totalQuestions) * 100
        ),
      });
    }

    // 우선순위 순으로 정렬
    return recommendations.sort((a, b) => b.priority - a.priority);
  },
});

// 헬퍼 함수들
function calculateSkillLevel(
  weightedScore: number,
  maxWeightedScore: number
): SkillLevelType {
  if (maxWeightedScore === 0) return 'beginner';

  const percentage = (weightedScore / maxWeightedScore) * 100;

  if (percentage >= 85) return 'expert';
  if (percentage >= 70) return 'advanced';
  if (percentage >= 50) return 'intermediate';
  if (percentage >= 30) return 'novice';
  return 'beginner';
}

function calculateRecommendedDifficulty(
  difficultyStats: DifficultyStats
): DifficultyType {
  const { easy, medium, hard } = difficultyStats;

  const easyAccuracy = easy.total > 0 ? easy.accuracy : 0;
  const mediumAccuracy = medium.total > 0 ? medium.accuracy : 0;
  const hardAccuracy = hard.total > 0 ? hard.accuracy : 0;

  if (hardAccuracy >= 70) {
    return 'hard';
  } else if (mediumAccuracy >= 75) {
    return 'hard';
  } else if (easyAccuracy >= 80) {
    return 'medium';
  } else {
    return 'easy';
  }
}

async function calculateGrowthTrend(
  ctx: any,
  userId: string,
  category: string
): Promise<GrowthTrend> {
  // 최근 7일, 30일간의 퀴즈 기록을 조회하여 성장 추세 계산
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const recentHistory = await ctx.db
    .query('quizHistory')
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    .filter((q: any) =>
      q.and(
        q.eq(q.field('category'), category),
        q.gte(q.field('createdAt'), thirtyDaysAgo)
      )
    )
    .collect();

  if (recentHistory.length < 2) {
    return {
      last7Days: 0,
      last30Days: 0,
      isImproving: false,
    };
  }

  const last7DaysRecords = recentHistory.filter(
    (record: any) => record.createdAt >= sevenDaysAgo
  );
  const last30DaysRecords = recentHistory;

  const calc7DaysAccuracy =
    last7DaysRecords.length > 0
      ? last7DaysRecords.reduce(
          (sum: number, record: any) => sum + record.correct / record.total,
          0
        ) / last7DaysRecords.length
      : 0;

  const calc30DaysAccuracy =
    last30DaysRecords.reduce(
      (sum: number, record: any) => sum + record.correct / record.total,
      0
    ) / last30DaysRecords.length;

  // 이전 30일과 비교하여 개선 여부 판단
  const isImproving = calc7DaysAccuracy > calc30DaysAccuracy;

  return {
    last7Days: Math.round((calc7DaysAccuracy - calc30DaysAccuracy) * 100),
    last30Days: Math.round(calc30DaysAccuracy * 100),
    isImproving,
  };
}
