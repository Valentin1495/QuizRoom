import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// 게이미피케이션 데이터 초기화 또는 가져오기
export const getOrCreateGamificationData = query({
  args: { userId: v.string(), _refresh: v.optional(v.number()) },
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

// 카테고리 통계 가져오기
export const getCategoryStats = query({
  args: { userId: v.string(), _refresh: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query('categoryStats')
      .withIndex('by_user_category', (q) => q.eq('userId', args.userId))
      .collect();

    return stats.reduce(
      (acc, stat) => {
        acc[stat.category] = {
          totalQuestions: stat.totalQuestions,
          correctAnswers: stat.correctAnswers,
          masteryLevel: stat.masteryLevel,
          initialAccuracy: stat.initialAccuracy,
        };
        return acc;
      },
      {} as Record<string, any>
    );
  },
});

// 카테고리 통계 업데이트
export const updateCategoryStats = mutation({
  args: {
    userId: v.string(),
    category: v.string(),
    totalQuestions: v.number(),
    correctAnswers: v.number(),
    masteryLevel: v.number(),
    initialAccuracy: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('categoryStats')
      .withIndex('by_user_category', (q) =>
        q.eq('userId', args.userId).eq('category', args.category)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalQuestions: args.totalQuestions,
        correctAnswers: args.correctAnswers,
        masteryLevel: args.masteryLevel,
        initialAccuracy: args.initialAccuracy ?? existing.initialAccuracy,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('categoryStats', {
        userId: args.userId,
        category: args.category,
        totalQuestions: args.totalQuestions,
        correctAnswers: args.correctAnswers,
        masteryLevel: args.masteryLevel,
        initialAccuracy: args.initialAccuracy,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// 업적 데이터 가져오기
export const getAchievements = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('achievements')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();
  },
});

// 업적 업데이트
export const updateAchievement = mutation({
  args: {
    userId: v.string(),
    achievementId: v.string(),
    progress: v.number(),
    unlockedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('achievements')
      .withIndex('by_user_achievement', (q) =>
        q.eq('userId', args.userId).eq('achievementId', args.achievementId)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        progress: args.progress,
        unlockedAt: args.unlockedAt ?? existing.unlockedAt,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('achievements', {
        userId: args.userId,
        achievementId: args.achievementId,
        progress: args.progress,
        unlockedAt: args.unlockedAt,
        createdAt: now,
        updatedAt: now,
      });
    }
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
