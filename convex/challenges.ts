import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// 도전과제 생성
export const generateDailyChallenges = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const now = Date.now();

    // 한국 시간(KST) 기준 오늘 자정까지의 UTC timestamp 계산
    const endOfTodayKST = () => {
      const now = new Date();
      const kstOffset = 9 * 60 * 60 * 1000;
      const kstNow = new Date(now.getTime() + kstOffset);

      const year = kstNow.getFullYear();
      const month = kstNow.getMonth();
      const date = kstNow.getDate();

      const kstMidnight = new Date(year, month, date + 1, 0, 0, 0, 0); // 다음 날 0시
      return kstMidnight.getTime() - kstOffset - 1; // 23:59:59.999 KST → UTC 기준
    };

    // 오늘 이미 생성된 도전과제가 있는지 확인
    const existingChallenges = await ctx.db
      .query('challenges')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), userId),
          q.eq(q.field('type'), 'daily'),
          q.gte(q.field('expiresAt'), now)
        )
      )
      .collect();

    if (existingChallenges.length > 0) {
      return existingChallenges;
    }

    // 새로운 일일 도전과제 생성 - 다양하고 재미있게
    const dailyChallenges = [
      // 기본 도전과제
      {
        type: 'daily' as const,
        title: '🌅 첫 발걸음',
        description: '오늘 첫 퀴즈 풀어보기',
        targetCount: 1,
        currentCount: 0,
        reward: { type: 'points' as const, value: 10 },
        completed: false,
        expiresAt: endOfTodayKST(),
        createdAt: now,
        userId,
      },
      {
        type: 'daily' as const,
        title: '🎯 꾸준한 학습자',
        description: '오늘 퀴즈 5개 완료하기',
        targetCount: 5,
        currentCount: 0,
        reward: { type: 'points' as const, value: 50 },
        completed: false,
        expiresAt: endOfTodayKST(),
        createdAt: now,
        userId,
      },
      {
        type: 'daily' as const,
        title: '🔥 퀴즈 마스터',
        description: '오늘 퀴즈 10개 완료하기',
        targetCount: 10,
        currentCount: 0,
        reward: { type: 'points' as const, value: 100 },
        completed: false,
        expiresAt: endOfTodayKST(),
        createdAt: now,
        userId,
      },
      // 정확도 관련 도전과제
      {
        type: 'daily' as const,
        title: '🎪 완벽주의자',
        description: '연속으로 퀴즈 10문제 정답 맞히기',
        targetCount: 10,
        currentCount: 0,
        reward: { type: 'badge' as const, value: 1, name: '완벽주의자' },
        completed: false,
        expiresAt: endOfTodayKST(),
        createdAt: now,
        userId,
      },
      {
        type: 'daily' as const,
        title: '⚡ 스피드 러너',
        description: '평균 30초 이내로 퀴즈 5개 풀기',
        targetCount: 5,
        currentCount: 0,
        reward: { type: 'points' as const, value: 75 },
        completed: false,
        expiresAt: endOfTodayKST(),
        createdAt: now,
        userId,
      },
      // 탐험 관련 도전과제
      {
        type: 'daily' as const,
        title: '🗺️ 탐험가',
        description: '3개 이상 다른 카테고리 퀴즈 시도하기',
        targetCount: 3,
        currentCount: 0,
        reward: { type: 'points' as const, value: 60 },
        completed: false,
        expiresAt: endOfTodayKST(),
        createdAt: now,
        userId,
      },
      // 정확도 도전과제
      {
        type: 'daily' as const,
        title: '🏹 명중률 90%',
        description: '오늘 퀴즈 정답률 90% 이상 달성',
        targetCount: 1,
        currentCount: 0,
        reward: { type: 'badge' as const, value: 1, name: '명사수' },
        completed: false,
        expiresAt: endOfTodayKST(),
        createdAt: now,
        userId,
      },
      // 연속 도전과제
      {
        type: 'daily' as const,
        title: '🔥 화끈한 연승',
        description: '연속으로 퀴즈 5문제 정답 맞히기',
        targetCount: 5,
        currentCount: 0,
        reward: { type: 'points' as const, value: 80 },
        completed: false,
        expiresAt: endOfTodayKST(),
        createdAt: now,
        userId,
      },
    ];

    // 랜덤하게 4-5개의 도전과제만 선택 (너무 많으면 부담스러울 수 있음)
    const selectedChallenges = dailyChallenges
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 2) + 4); // 4-5개

    const createdChallenges = [];
    for (const challenge of selectedChallenges) {
      const id = await ctx.db.insert('challenges', challenge);
      createdChallenges.push({ ...challenge, _id: id });
    }

    return createdChallenges;
  },
});

export const generateWeeklyChallenges = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const now = Date.now();

    // 한국 시간 기준 7일 후 자정까지의 UTC timestamp 계산
    const endOfNextWeekKST = () => {
      const now = new Date();
      const kstOffset = 9 * 60 * 60 * 1000;
      const kstNow = new Date(now.getTime() + kstOffset);
      const future = new Date(kstNow);
      future.setDate(kstNow.getDate() + 7);
      future.setHours(23, 59, 59, 999);
      return future.getTime() - kstOffset; // UTC 기준 timestamp
    };

    // 이번 주 도전과제가 있는지 확인
    const existingChallenges = await ctx.db
      .query('challenges')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), userId),
          q.eq(q.field('type'), 'weekly'),
          q.gte(q.field('expiresAt'), now)
        )
      )
      .collect();

    if (existingChallenges.length > 0) {
      return existingChallenges;
    }

    const weeklyChallenges = [
      // 기본 주간 도전과제
      {
        type: 'weekly' as const,
        title: '🏆 주간 챌린저',
        description: '이번 주 퀴즈 30개 완료하기',
        targetCount: 30,
        currentCount: 0,
        reward: { type: 'points' as const, value: 200 },
        completed: false,
        expiresAt: endOfNextWeekKST(),
        createdAt: now,
        userId,
      },
      {
        type: 'weekly' as const,
        title: '📈 꾸준함의 힘',
        description: '7일 연속 퀴즈 풀기',
        targetCount: 7,
        currentCount: 0,
        reward: { type: 'streak' as const, value: 7, name: '일주일 연속' },
        completed: false,
        expiresAt: endOfNextWeekKST(),
        createdAt: now,
        userId,
      },
      // 정확도 관련
      {
        type: 'weekly' as const,
        title: '🎯 정확도 마스터',
        description: '이번 주 전체 정답률 80% 이상 유지하기',
        targetCount: 1,
        currentCount: 0,
        reward: { type: 'badge' as const, value: 1, name: '정확도 마스터' },
        completed: false,
        expiresAt: endOfNextWeekKST(),
        createdAt: now,
        userId,
      },
      // 탐험 관련
      {
        type: 'weekly' as const,
        title: '🌟 다재다능',
        description: '이번 주 5개 이상 다른 카테고리 퀴즈 풀기',
        targetCount: 5,
        currentCount: 0,
        reward: { type: 'points' as const, value: 150 },
        completed: false,
        expiresAt: endOfNextWeekKST(),
        createdAt: now,
        userId,
      },
      // 고급 도전과제
      {
        type: 'weekly' as const,
        title: '🚀 퀴즈 애호가',
        description: '이번 주 퀴즈 50개 완료하기',
        targetCount: 50,
        currentCount: 0,
        reward: { type: 'badge' as const, value: 1, name: '퀴즈 애호가' },
        completed: false,
        expiresAt: endOfNextWeekKST(),
        createdAt: now,
        userId,
      },
      {
        type: 'weekly' as const,
        title: '💎 완벽한 한 주',
        description: '이번 주 연속 정답 기록 10문제 달성',
        targetCount: 10,
        currentCount: 0,
        reward: { type: 'badge' as const, value: 1, name: '완벽한 주' },
        completed: false,
        expiresAt: endOfNextWeekKST(),
        createdAt: now,
        userId,
      },
      {
        type: 'weekly' as const,
        title: '⚡ 스피드 마스터',
        description: '이번 주 평균 답변 시간 20초 이하 유지',
        targetCount: 1,
        currentCount: 0,
        reward: { type: 'badge' as const, value: 1, name: '스피드 마스터' },
        completed: false,
        expiresAt: endOfNextWeekKST(),
        createdAt: now,
        userId,
      },
    ];

    // 랜덤하게 3-4개의 주간 도전과제 선택
    const selectedChallenges = weeklyChallenges
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 2) + 3); // 3-4개

    const createdChallenges = [];
    for (const challenge of selectedChallenges) {
      const id = await ctx.db.insert('challenges', challenge);
      createdChallenges.push({ ...challenge, _id: id });
    }

    return createdChallenges;
  },
});

// 도전과제 목록 조회
export const getChallenges = query({
  args: {
    userId: v.string(),
    type: v.optional(v.string()), // 'daily', 'weekly'
  },
  handler: async (ctx, { userId, type }) => {
    const now = Date.now();

    let query = ctx.db
      .query('challenges')
      .filter((q) =>
        q.and(q.eq(q.field('userId'), userId), q.gte(q.field('expiresAt'), now))
      );

    // 타입 필터
    if (type) {
      query = query.filter((q) => q.eq(q.field('type'), type));
    }

    const challenges = await query.order('desc').collect();

    return challenges;
  },
});

// 도전과제 통계 조회
export const getChallengeStats = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const now = Date.now();

    // 전체 완료된 도전과제
    const completedChallenges = await ctx.db
      .query('challenges')
      .filter((q) =>
        q.and(q.eq(q.field('userId'), userId), q.eq(q.field('completed'), true))
      )
      .collect();

    // 현재 활성 도전과제
    const activeChallenges = await ctx.db
      .query('challenges')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), userId),
          q.eq(q.field('completed'), false),
          q.gte(q.field('expiresAt'), now)
        )
      )
      .collect();

    // 타입별 통계
    const typeStats = completedChallenges.reduce(
      (acc, challenge) => {
        const type = challenge.type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalCompleted: completedChallenges.length,
      totalActive: activeChallenges.length,
      typeStats,
      completionRate:
        activeChallenges.length > 0
          ? Math.round(
              (completedChallenges.length /
                (completedChallenges.length + activeChallenges.length)) *
                100
            )
          : 100,
    };
  },
});

// 도전과제 진행도 업데이트 - 기존 테이블들과 연동
export const updateChallengeProgress = mutation({
  args: {
    userId: v.string(),
    quizCompleted: v.boolean(),
    isCorrect: v.optional(v.boolean()),
    category: v.optional(v.string()),
    answerTime: v.optional(v.number()), // 초 단위
    perfectStreak: v.optional(v.number()), // 현재 연속 정답 수
  },
  handler: async (
    ctx,
    {
      userId,
      quizCompleted,
      isCorrect = false,
      category,
      answerTime,
      perfectStreak = 0,
    }
  ) => {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    // 오늘의 진행도 가져오기 또는 생성
    let dailyProgress = await ctx.db
      .query('dailyChallengeProgress')
      .filter((q) =>
        q.and(q.eq(q.field('userId'), userId), q.eq(q.field('date'), today))
      )
      .first();

    if (!dailyProgress) {
      const progressId = await ctx.db.insert('dailyChallengeProgress', {
        userId,
        date: today,
        quizCount: 0,
        perfectQuizCount: 0,
        streakDays: 0,
        createdAt: now,
        updatedAt: now,
      });
      dailyProgress = await ctx.db.get(progressId);
    }

    // 진행도 업데이트
    if (quizCompleted && dailyProgress) {
      await ctx.db.patch(dailyProgress._id, {
        quizCount: dailyProgress.quizCount + 1,
        perfectQuizCount: isCorrect
          ? dailyProgress.perfectQuizCount + 1
          : dailyProgress.perfectQuizCount,
        updatedAt: now,
      });
    }

    // 기존 gamificationData에서 통계 가져오기
    const gamificationData = await ctx.db
      .query('gamificationData')
      .filter((q) => q.eq(q.field('userId'), userId))
      .first();

    // 활성 도전과제 가져오기
    const activeChallenges = await ctx.db
      .query('challenges')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), userId),
          q.eq(q.field('completed'), false),
          q.gte(q.field('expiresAt'), now)
        )
      )
      .collect();

    const updatedChallenges = [];

    for (const challenge of activeChallenges) {
      let shouldUpdate = false;
      let newCount = challenge.currentCount;

      if (quizCompleted) {
        // 기본 퀴즈 완료 도전과제
        if (
          challenge.description.includes('퀴즈') &&
          !challenge.description.includes('정답') &&
          !challenge.description.includes('연속') &&
          !challenge.description.includes('카테고리') &&
          !challenge.description.includes('시간') &&
          !challenge.description.includes('정답률')
        ) {
          newCount += 1;
          shouldUpdate = true;
        }

        // 연속 정답 도전과제
        if (
          challenge.description.includes('연속') &&
          challenge.description.includes('정답')
        ) {
          newCount = Math.max(newCount, perfectStreak);
          shouldUpdate = true;
        }

        // 카테고리 다양성 도전과제 (일일 진행도 기반)
        if (challenge.description.includes('카테고리') && category) {
          // 오늘 시도한 카테고리 수를 계산하기 위해 quizHistory 확인
          const todayHistory = await ctx.db
            .query('quizHistory')
            .filter((q) =>
              q.and(
                q.eq(q.field('userId'), userId),
                q.eq(q.field('date'), today)
              )
            )
            .collect();

          const uniqueCategories = [
            ...new Set(todayHistory.map((h) => h.category)),
          ];
          newCount = uniqueCategories.length;
          shouldUpdate = true;
        }

        // 정답률 기반 도전과제
        if (
          challenge.description.includes('정답률') ||
          challenge.description.includes('90%') ||
          challenge.description.includes('80%')
        ) {
          if (gamificationData) {
            const accuracy =
              gamificationData.totalQuizzes > 0
                ? (gamificationData.totalCorrectAnswers /
                    gamificationData.totalQuizzes) *
                  100
                : 0;

            const targetAccuracy = challenge.description.includes('90%')
              ? 90
              : 80;
            if (accuracy >= targetAccuracy) {
              newCount = 1;
              shouldUpdate = true;
            }
          }
        }

        // 평균 시간 기반 도전과제
        if (
          challenge.description.includes('평균') &&
          challenge.description.includes('시간') &&
          answerTime
        ) {
          // 오늘의 평균 시간 계산
          const todayHistory = await ctx.db
            .query('quizHistory')
            .filter((q) =>
              q.and(
                q.eq(q.field('userId'), userId),
                q.eq(q.field('date'), today)
              )
            )
            .collect();

          if (todayHistory.length > 0) {
            const totalTime = todayHistory.reduce(
              (sum, h) => sum + (h.averageTime || 0),
              0
            );
            const avgTime = totalTime / todayHistory.length;

            const targetTime = challenge.description.includes('30초')
              ? 30
              : challenge.description.includes('20초')
                ? 20
                : 999;

            if (
              avgTime <= targetTime &&
              todayHistory.length >= challenge.targetCount
            ) {
              newCount = challenge.targetCount;
              shouldUpdate = true;
            } else if (avgTime <= targetTime) {
              newCount = todayHistory.length;
              shouldUpdate = true;
            }
          }
        }

        // 연속 참여 도전과제 (주간)
        if (
          challenge.description.includes('연속') &&
          challenge.description.includes('일') &&
          gamificationData
        ) {
          newCount = Math.max(newCount, gamificationData.currentStreak);
          shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        const completed = newCount >= challenge.targetCount;

        await ctx.db.patch(challenge._id, {
          currentCount: newCount,
          completed,
        });

        updatedChallenges.push({
          ...challenge,
          currentCount: newCount,
          completed,
        });

        // 완료된 도전과제의 보상 지급
        if (completed && !challenge.completed) {
          await grantReward(ctx, userId, challenge.reward);
        }
      }
    }

    return updatedChallenges;
  },
});

// 보상 지급 함수 - 기존 테이블과 연동
async function grantReward(ctx: any, userId: string, reward: any) {
  // 기존 gamificationData에서 사용자 데이터 가져오기
  const gamificationData = await ctx.db
    .query('gamificationData')
    .filter((q: any) => q.eq(q.field('userId'), userId))
    .first();

  if (gamificationData && reward.type === 'points') {
    // 포인트 보상 지급
    await ctx.db.patch(gamificationData._id, {
      totalPoints: gamificationData.totalPoints + reward.value,
      updatedAt: Date.now(),
    });
  }

  if (gamificationData && reward.type === 'streak') {
    // 스트릭 보상 지급
    await ctx.db.patch(gamificationData._id, {
      currentStreak: Math.max(gamificationData.currentStreak, reward.value),
      updatedAt: Date.now(),
    });
  }

  // 배지는 achievements 테이블에 추가
  if (reward.type === 'badge' && reward.name) {
    const existingAchievement = await ctx.db
      .query('achievements')
      .filter((q: any) =>
        q.and(
          q.eq(q.field('userId'), userId),
          q.eq(q.field('achievementId'), reward.name)
        )
      )
      .first();

    if (!existingAchievement) {
      await ctx.db.insert('achievements', {
        userId,
        achievementId: reward.name,
        unlockedAt: Date.now(),
        progress: 100,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }
}
