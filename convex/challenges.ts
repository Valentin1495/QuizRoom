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

    // 새로운 일일 도전과제 생성
    const dailyChallenges = [
      {
        type: 'daily' as const,
        title: '첫 발걸음',
        description: '오늘 퀴즈 1개 풀기',
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
        title: '꾸준한 학습',
        description: '오늘 퀴즈 3개 풀기',
        targetCount: 3,
        currentCount: 0,
        reward: { type: 'points' as const, value: 30 },
        completed: false,
        expiresAt: endOfTodayKST(),
        createdAt: now,
        userId,
      },
      {
        type: 'daily' as const,
        title: '완벽주의자',
        description: '오늘 퀴즈 5개를 모두 정답 맞히기',
        targetCount: 5,
        currentCount: 0,
        reward: { type: 'badge' as const, value: 1, name: '완벽주의자' },
        completed: false,
        expiresAt: endOfTodayKST(),
        createdAt: now,
        userId,
      },
    ];

    const createdChallenges = [];
    for (const challenge of dailyChallenges) {
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
      {
        type: 'weekly' as const,
        title: '주간 챌린저',
        description: '이번 주 퀴즈 15개 풀기',
        targetCount: 15,
        currentCount: 0,
        reward: { type: 'points' as const, value: 100 },
        completed: false,
        expiresAt: endOfNextWeekKST(),
        createdAt: now,
        userId,
      },
      {
        type: 'weekly' as const,
        title: '일주일 연속',
        description: '7일 연속 퀴즈 풀기',
        targetCount: 7,
        currentCount: 0,
        reward: { type: 'streak' as const, value: 7 },
        completed: false,
        expiresAt: endOfNextWeekKST(),
        createdAt: now,
        userId,
      },
    ];

    const createdChallenges = [];
    for (const challenge of weeklyChallenges) {
      const id = await ctx.db.insert('challenges', challenge);
      createdChallenges.push({ ...challenge, _id: id });
    }

    return createdChallenges;
  },
});

// 도전과제 목록 조회
export const getChallenges = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const now = Date.now();

    const challenges = await ctx.db
      .query('challenges')
      .filter((q) =>
        q.and(q.eq(q.field('userId'), userId), q.gte(q.field('expiresAt'), now))
      )
      .order('desc')
      .collect();

    return challenges;
  },
});

// 도전과제 진행도 업데이트 - 기존 gamificationData 테이블과 연동
export const updateChallengeProgress = mutation({
  args: {
    userId: v.string(),
    quizCompleted: v.boolean(),
    perfectScore: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, quizCompleted, perfectScore = false }) => {
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
        perfectQuizCount: perfectScore
          ? dailyProgress.perfectQuizCount + 1
          : dailyProgress.perfectQuizCount,
        updatedAt: now,
      });
    }

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

      // 퀴즈 완료 관련 도전과제
      if (
        quizCompleted &&
        challenge.description.includes('퀴즈') &&
        !challenge.description.includes('정답')
      ) {
        newCount += 1;
        shouldUpdate = true;
      }

      // 완벽한 점수 관련 도전과제
      if (perfectScore && challenge.description.includes('정답')) {
        newCount += 1;
        shouldUpdate = true;
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

// 보상 지급 함수 - 기존 gamificationData 테이블 활용
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
