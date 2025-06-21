import { GoogleGenAI } from '@google/genai';
import { v } from 'convex/values';
import { Doc } from './_generated/dataModel';
import { action, mutation, query } from './_generated/server';

interface LearningPattern {
  category: string;
  patterns: string[];
  preferredDifficulty: 'easy' | 'medium' | 'hard';
  consistencyScore: number;
  engagementLevel: 'high' | 'medium' | 'low';
}

interface PersonalizedRecommendation {
  category: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
}

interface AIInsights {
  overallInsight: string;
  personalizedRecommendations: PersonalizedRecommendation[];
  learningStrategy: string;
  motivationalMessage: string;
  nextGoals: string[];
}

// 게이미피케이션 데이터 초기화 또는 가져오기
export const getGamificationData = query({
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
export const updateCategoryStatsFromAnalysis = mutation({
  args: {
    userId: v.string(),
    analysisData: v.object({
      category: v.string(),
      skillScore: v.number(),
      difficulty: v.union(
        v.literal('easy'),
        v.literal('medium'),
        v.literal('hard')
      ),
      accuracy: v.number(),
      timeSpent: v.number(),
    }),
  },

  handler: async (ctx, { userId, analysisData }) => {
    const { category, skillScore, difficulty, accuracy, timeSpent } =
      analysisData;
    const correct = Math.round((accuracy / 100) * 10);

    const existing = await ctx.db
      .query('categoryStats')
      .withIndex('by_user_category', (q) =>
        q.eq('userId', userId).eq('category', category)
      )
      .unique();

    const fallbackStats = {
      easy: { totalQuestions: 0, correct: 0, accuracy: 0, avgTime: 0 },
      medium: { totalQuestions: 0, correct: 0, accuracy: 0, avgTime: 0 },
      hard: { totalQuestions: 0, correct: 0, accuracy: 0, avgTime: 0 },
    };

    const prevStats = existing?.difficultyStats ?? fallbackStats;

    const updatedDifficultyStats = (['easy', 'medium', 'hard'] as const).reduce(
      (acc, level) => {
        const prev = prevStats[level] || fallbackStats[level];
        const isTarget = level === difficulty;
        const addedCorrect = isTarget ? correct : 0;
        const addedTime = isTarget ? timeSpent : 0;
        const addedQuestions = isTarget ? 10 : 0;

        const newTotal = prev.totalQuestions + addedQuestions;
        const newCorrect = (prev.correct || 0) + addedCorrect;
        const newAvgTime =
          newTotal > 0
            ? Math.round(
                ((prev.avgTime || 0) * prev.totalQuestions + addedTime) /
                  newTotal
              )
            : 0;
        const accuracy =
          newTotal === 0
            ? -1 // 아예 미응시한 경우를 -1로 구분
            : Math.round((newCorrect / newTotal) * 100);

        acc[level] = {
          totalQuestions: newTotal,
          correct: newCorrect,
          accuracy,
          avgTime: newAvgTime,
        };

        return acc;
      },
      {} as Record<
        'easy' | 'medium' | 'hard',
        {
          totalQuestions: number;
          correct: number;
          accuracy: number;
          avgTime: number;
        }
      >
    );

    const updatedCorrectAnswers = (existing?.correctAnswers || 0) + correct;
    const updatedTotalQuestions = (existing?.totalQuestions || 0) + 10;

    const weightedScore =
      updatedDifficultyStats.easy.accuracy * 1 +
      updatedDifficultyStats.medium.accuracy * 2 +
      updatedDifficultyStats.hard.accuracy * 3;

    const maxWeightedScore = 3 * 100;
    const updatedSkillScore = skillScore;
    const now = Date.now();

    const prevHistory = existing?.progressHistory ?? [];
    const today = new Date();
    const todayStamp = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).getTime();
    const filteredHistory = prevHistory.filter((h) => h.date !== todayStamp);

    const progressHistory = [
      ...filteredHistory,
      {
        date: todayStamp,
        skillScore: updatedSkillScore,
        accuracy: Math.round(
          (updatedCorrectAnswers / updatedTotalQuestions) * 100
        ),
        questionsAnswered: 10,
      },
    ];

    const newData = {
      userId,
      category,
      skillScore: updatedSkillScore,
      totalQuestions: updatedTotalQuestions,
      correctAnswers: updatedCorrectAnswers,
      weightedScore,
      maxWeightedScore,
      difficultyStats: updatedDifficultyStats,
      growthTrend: updatedSkillScore - (existing?.skillScore || 0),
      averageTime: updatedDifficultyStats[difficulty].avgTime,
      skillLevel: 'Unranked' as const,
      progressHistory,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, newData);
    } else {
      await ctx.db.insert('categoryStats', {
        ...newData,
        createdAt: now,
      });
    }
  },
});

// 난이도별 카테고리 통계 조회 (가중 평균 방식)
export const getCategoryStatsWithDifficulty = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const categoryStats = await ctx.db
      .query('categoryStats')
      .withIndex('by_user_category', (q) => q.eq('userId', args.userId))
      .collect();

    const result: Record<string, any> = {};

    for (const stat of categoryStats) {
      const { easy, medium, hard } = stat.difficultyStats;

      // 가중 평균 정확도 계산 (실제 정답 수 기반)
      const correctSum =
        (easy.accuracy / 100) * easy.totalQuestions +
        (medium.accuracy / 100) * medium.totalQuestions +
        (hard.accuracy / 100) * hard.totalQuestions;

      const totalQuestions =
        easy.totalQuestions + medium.totalQuestions + hard.totalQuestions;

      const overallAccuracy =
        totalQuestions > 0
          ? Math.round((correctSum / totalQuestions) * 100)
          : 0;

      // 가중치 기반 skillScore (easy:1, medium:2, hard:3)
      const weightedScore =
        (easy.accuracy ?? 0) * 1 +
        (medium.accuracy ?? 0) * 2 +
        (hard.accuracy ?? 0) * 3;

      const maxWeightedScore = 3 * 100; // 300
      const skillScore = Math.round((weightedScore / maxWeightedScore) * 100);

      result[stat.category] = {
        ...stat,
        overallAccuracy,
        skillScore,
      };
    }

    return result;
  },
});

function hasMinimumDataForBasicAnalysis(
  categoryStats: Doc<'categoryStats'>[]
): boolean {
  return categoryStats.some((stat) => {
    const { difficultyStats } = stat;
    return (
      difficultyStats.easy.totalQuestions >= 10 &&
      difficultyStats.medium.totalQuestions >= 10 &&
      difficultyStats.hard.totalQuestions >= 10
    );
  });
}

// 데이터 충분성 검증 함수
function hasEnoughDataForAIAnalysis(
  categoryStats: Doc<'categoryStats'>[]
): boolean {
  const validCategories = categoryStats.filter(
    (stat) => stat.totalQuestions >= 30
  );
  if (validCategories.length < 2) return false;

  const hasVariedDifficulty = validCategories.some((stat) => {
    const { difficultyStats } = stat;
    return (
      difficultyStats.easy.totalQuestions > 0 &&
      difficultyStats.medium.totalQuestions > 0 &&
      difficultyStats.hard.totalQuestions > 0
    );
  });

  return hasVariedDifficulty;
}

// 학습 패턴 분석 함수
function analyzeLearningPatterns(
  categoryStats: Doc<'categoryStats'>[]
): LearningPattern[] {
  return categoryStats.map((stat) => {
    const { difficultyStats, category, growthTrend } = stat;

    // 학습 패턴 식별
    const patterns: string[] = [];

    // 일관성 패턴
    const accuracyVariance = Math.abs(
      difficultyStats.easy.accuracy - difficultyStats.hard.accuracy
    );
    if (accuracyVariance < 20) patterns.push('일관된 실력');
    else if (accuracyVariance > 40) patterns.push('실력 편차 큼');

    // 성장 패턴
    if (growthTrend > 10) patterns.push('빠른 성장');
    else if (growthTrend < -5) patterns.push('실력 하락');
    else patterns.push('안정적 유지');

    // 난이도 선호도
    const maxAccuracy = Math.max(
      difficultyStats.easy.accuracy,
      difficultyStats.medium.accuracy,
      difficultyStats.hard.accuracy
    );

    let preferredDifficulty: 'easy' | 'medium' | 'hard' = 'easy';
    if (difficultyStats.medium.accuracy === maxAccuracy)
      preferredDifficulty = 'medium';
    if (difficultyStats.hard.accuracy === maxAccuracy)
      preferredDifficulty = 'hard';

    // 참여도 레벨 계산
    const totalQuestions = stat.totalQuestions || 0;
    const engagementLevel: 'high' | 'medium' | 'low' =
      totalQuestions > 50 ? 'high' : totalQuestions > 20 ? 'medium' : 'low';

    return {
      category,
      patterns,
      preferredDifficulty,
      consistencyScore: 100 - accuracyVariance,
      engagementLevel,
    };
  });
}

// 종합 실력 분석 조회
export const getOverallAnalysis = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const categoryStats = await ctx.db
      .query('categoryStats')
      .withIndex('by_user_category', (q) => q.eq('userId', userId))
      .collect();

    if (categoryStats.length === 0) return getEmptyAnalysisResponse();

    const now = Date.now();
    const hasBasicData = hasMinimumDataForBasicAnalysis(categoryStats);
    const hasEnoughData = hasEnoughDataForAIAnalysis(categoryStats);

    const analysis = categoryStats.map((stat) => ({
      category: stat.category,
      skillScore: stat.skillScore,
      difficultyAnalysis: stat.difficultyStats,
      growthTrend: stat.growthTrend,
      totalQuestions: stat.totalQuestions || 0,
      averageTime: stat.averageTime || 0,
    }));

    const sorted = [...analysis].sort((a, b) => b.skillScore - a.skillScore);
    const learningPatterns = analyzeLearningPatterns(categoryStats as any);

    // ✅ 캐시된 AI 인사이트만 사용
    const cached = categoryStats[0].aiInsightsCache;
    const aiInsights = cached && cached.cacheExpiry > now ? cached : null;

    return {
      strongestCategories: sorted.slice(0, 3),
      weakestCategories: sorted.slice(-3).reverse(),
      overallAnalysis: analysis,
      learningPatterns,
      aiInsights,
      analysisMetadata: {
        generatedAt: new Date().toISOString(),
        totalDataPoints: categoryStats.length,
        hasAIAnalysis: aiInsights !== null,
        dataStatus: hasBasicData
          ? hasEnoughData
            ? 'sufficient'
            : 'partial'
          : 'insufficient',
        currentProgress: {
          totalQuestions: categoryStats.reduce(
            (sum, stat) => sum + (stat.totalQuestions || 0),
            0
          ),
          totalCategories: categoryStats.length,
          categoriesWith30Plus: categoryStats.filter(
            (s) =>
              s.difficultyStats.easy.totalQuestions >= 10 &&
              s.difficultyStats.medium.totalQuestions >= 10 &&
              s.difficultyStats.hard.totalQuestions >= 10
          ).length,
        },
        dataRequirements: {
          basicAnalysis: {
            description: '1개 카테고리에서 난이도별로 10문제 이상',
            minCategoryCount: 1,
            minPerDifficultyQuestions: 10,
          },
          aiAnalysis: {
            description: '2개 이상 카테고리에서 난이도별로 10문제 이상',
            minCategoryCount: 2,
            minPerDifficultyQuestions: 10,
            needsVariedDifficulty: true,
          },
        },
      },
    };
  },
});

function getEmptyAnalysisResponse() {
  return {
    strongestCategories: [],
    weakestCategories: [],
    overallAnalysis: [],
    aiInsights: null,
    learningPatterns: [],
    analysisMetadata: {
      generatedAt: new Date().toISOString(),
      totalDataPoints: 0,
      hasAIAnalysis: false,
      dataStatus: 'insufficient',
      dataRequirements: {
        minCategories: 2,
        minQuestionsPerCategory: 10,
        minTotalQuestions: 30,
        needsVariedDifficulty: true,
      },
    },
  };
}

export const analyzeWithGemini = action({
  args: { analysisData: v.any() },
  handler: async (_, { analysisData }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing');

    const ai = new GoogleGenAI({
      apiKey,
    });

    const prompt = `
다음은 사용자의 퀴즈 실력 데이터입니다. 이 데이터를 분석하여 **Gen Z 및 밀레니얼 세대**를 대상으로 개인화된 학습 인사이트를 작성해주세요.

### 🧠 분석 시 고려사항:
1. 강점과 약점의 균형
2. 카테고리별 성장 추세 및 성취도 변화
3. 난이도별 성취도 분석
4. 학습 패턴 - 일관성 패턴, 성장 패턴, 난이도 선호도, 참여도

### 🎯 카테고리 이름은 반드시 다음 한국어 이름으로 출력해주세요:
- knowledge-kpop-music → "K-POP & 음악"
- knowledge-history-culture → "역사 & 문화"
- knowledge-general → "일반 상식"
- knowledge-arts-literature → "예술 & 문학"
- knowledge-sports → "스포츠"
- knowledge-science-tech → "과학 & 기술" 
- knowledge-logic → "수학 & 논리"
- knowledge-entertainment → "영화 & TV"

### 📊 난이도는 아래와 같이 한글로 표시해주세요:
- easy → "쉬움"
- medium → "보통"
- hard → "어려움"

※ accuracy가 -1인 경우는 "아직 응시하지 않음"으로 간주해주세요. 0%는 시도했지만 모두 틀린 경우입니다. 

### 📦 JSON 형식으로 아래 구조로만 응답해주세요 (Markdown 등 기타 포맷 없이):
\`\`\`json
{
  "overallInsight": "전반적인 학습 상태에 대한 종합 평가",
  "motivationalMessage": "격려 메시지",
  "nextGoals": ["목표1", "목표2", "목표3"]
}
\`\`\`

### 📂 사용자 데이터:
${JSON.stringify(analysisData, null, 2)}
`;

    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
      const text = result.text ?? '{}';

      // 마크다운 코드 블록 제거
      const cleanJSON = text
        .replace(/^```json\s*/, '')
        .replace(/```$/, '')
        .trim();

      try {
        const parsedResult = JSON.parse(cleanJSON) as AIInsights;
        return parsedResult;
      } catch (parseError) {
        console.error('AI 응답 파싱 오류:', parseError);
        return null;
      }
    } catch (err) {
      console.error('Gemini API 오류:', err);
      return null;
    }
  },
});

export const updateAIInsightsCache = mutation({
  args: {
    userId: v.string(),
    insights: v.any(),
  },
  handler: async (ctx, { userId, insights }) => {
    const stats = await ctx.db
      .query('categoryStats')
      .withIndex('by_user_category', (q) => q.eq('userId', userId))
      .collect();

    if (stats.length === 0) return;

    const expiry = Date.now() + 1000 * 60 * 60 * 12; // 12시간 캐시
    const withExpiry = { ...insights, cacheExpiry: expiry };

    await ctx.db.patch(stats[0]._id, {
      aiInsightsCache: withExpiry,
    });
  },
});
