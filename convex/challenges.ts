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
          q.gte(q.field('expiresAt'), now),
        ),
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
        description: '오늘 첫 퀴즈(10문제) 풀어보기',
        targetCount: 10,
        currentCount: 0,
        reward: { type: 'points' as const, value: 10 },
        completed: false,
        expiresAt: endOfTodayKST(),
        userId,
      },
      {
        type: 'daily' as const,
        title: '🎯 꾸준한 학습자',
        description: '오늘 50문제(5퀴즈) 풀기',
        targetCount: 50,
        currentCount: 0,
        reward: { type: 'points' as const, value: 50 },
        completed: false,
        expiresAt: endOfTodayKST(),
        userId,
      },
      {
        type: 'daily' as const,
        title: '🔥 퀴즈 마스터',
        description: '오늘 100문제(10퀴즈) 풀기',
        targetCount: 100,
        currentCount: 0,
        reward: { type: 'points' as const, value: 100 },
        completed: false,
        expiresAt: endOfTodayKST(),
        userId,
      },
      // 정확도 관련 도전과제
      {
        type: 'daily' as const,
        title: '🎪 완벽주의자',
        description: '연속으로 10문제 정답',
        targetCount: 10,
        currentCount: 0,
        reward: { type: 'points' as const, value: 150 },
        completed: false,
        expiresAt: endOfTodayKST(),
        userId,
      },
      {
        type: 'daily' as const,
        title: '⚡ 스피드 러너',
        description: '평균 30초 이내로 50문제(5퀴즈) 풀기',
        targetCount: 50,
        currentCount: 0,
        reward: { type: 'points' as const, value: 75 },
        completed: false,
        expiresAt: endOfTodayKST(),
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
        userId,
      },
      // 정확도 도전과제
      {
        type: 'daily' as const,
        title: '🏹 명중률 90%',
        description: '오늘 퀴즈 정답률 90% 이상 달성',
        targetCount: 1,
        currentCount: 0,
        reward: { type: 'points' as const, value: 120 },
        completed: false,
        expiresAt: endOfTodayKST(),
        userId,
      },
      // 연속 도전과제
      {
        type: 'daily' as const,
        title: '🔥 화끈한 연승',
        description: '연속으로 5문제 정답',
        targetCount: 5,
        currentCount: 0,
        reward: { type: 'points' as const, value: 80 },
        completed: false,
        expiresAt: endOfTodayKST(),
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
          q.gte(q.field('expiresAt'), now),
        ),
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
        description: '이번 주 300문제(30퀴즈) 풀기',
        targetCount: 300,
        currentCount: 0,
        reward: { type: 'points' as const, value: 200 },
        completed: false,
        expiresAt: endOfNextWeekKST(),
        userId,
      },
      {
        type: 'weekly' as const,
        title: '📈 꾸준함의 힘',
        description: '7일 연속 퀴즈 풀기',
        targetCount: 7,
        currentCount: 0,
        reward: { type: 'points' as const, value: 300 },
        completed: false,
        expiresAt: endOfNextWeekKST(),
        userId,
      },
      // 정확도 관련 - 더 구체적인 조건
      {
        type: 'weekly' as const,
        title: '🎯 정확도 마스터',
        description: '이번 주 200문제(20퀴즈) 이상 풀고 정답률 80% 이상 달성',
        targetCount: 1,
        currentCount: 0,
        reward: { type: 'points' as const, value: 250 },
        completed: false,
        expiresAt: endOfNextWeekKST(),
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
        userId,
      },
      // 고급 도전과제
      {
        type: 'weekly' as const,
        title: '🚀 퀴즈 애호가',
        description: '이번 주 500문제(50퀴즈) 풀기',
        targetCount: 500,
        currentCount: 0,
        reward: { type: 'points' as const, value: 400 },
        completed: false,
        expiresAt: endOfNextWeekKST(),
        userId,
      },
      {
        type: 'weekly' as const,
        title: '💎 완벽한 한 주',
        description: '이번 주 매일 한 번씩 만점 받기',
        targetCount: 7,
        currentCount: 0,
        reward: { type: 'points' as const, value: 350 },
        completed: false,
        expiresAt: endOfNextWeekKST(),
        userId,
      },
      // 스피드 관련 - 더 구체적인 조건
      {
        type: 'weekly' as const,
        title: '⚡ 스피드 마스터',
        description: '이번 주 150문제(15퀴즈) 이상 풀고 평균 답변 시간 20초 이하',
        targetCount: 1,
        currentCount: 0,
        reward: { type: 'points' as const, value: 280 },
        completed: false,
        expiresAt: endOfNextWeekKST(),
        userId,
      },
      // 새로운 구체적인 도전과제들
      {
        type: 'weekly' as const,
        title: '🌅 아침형 인간',
        description: '이번 주 5일 이상 오전(9시-12시)에 10문제(1퀴즈) 이상 풀기',
        targetCount: 5,
        currentCount: 0,
        reward: { type: 'points' as const, value: 180 },
        completed: false,
        expiresAt: endOfNextWeekKST(),
        userId,
      },
      {
        type: 'weekly' as const,
        title: '🎪 퀴즈 파티',
        description: '하루에 50문제(5퀴즈) 이상 푸는 날 3일 만들기',
        targetCount: 3,
        currentCount: 0,
        reward: { type: 'points' as const, value: 220 },
        completed: false,
        expiresAt: endOfNextWeekKST(),
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
      .filter((q) => q.and(q.eq(q.field('userId'), userId), q.gte(q.field('expiresAt'), now)));

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
      .filter((q) => q.and(q.eq(q.field('userId'), userId), q.eq(q.field('completed'), true)))
      .collect();

    // 현재 활성 도전과제
    const activeChallenges = await ctx.db
      .query('challenges')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), userId),
          q.eq(q.field('completed'), false),
          q.gte(q.field('expiresAt'), now),
        ),
      )
      .collect();

    // 타입별 통계
    const typeStats = completedChallenges.reduce(
      (acc, challenge) => {
        const type = challenge.type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
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
                100,
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
    category: v.optional(v.string()),
    answerTime: v.optional(v.number()), // 초 단위
    maxPerfectStreak: v.optional(v.number()), // 최대 연속 정답 수
    questionCount: v.optional(v.number()), // 퀴즈당 문제 수
  },
  handler: async (
    ctx,
    { userId, quizCompleted, category, answerTime, maxPerfectStreak = 0, questionCount = 10 },
  ) => {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

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
          q.gte(q.field('expiresAt'), now),
        ),
      )
      .collect();

    const updatedChallenges = [];

    for (const challenge of activeChallenges) {
      let shouldUpdate = false;
      let newCount = challenge.currentCount;

      if (quizCompleted) {
        // 기본 문제 수 완료 도전과제 (퀴즈/문제)
        if (
          (challenge.description.includes('퀴즈') || challenge.description.includes('문제')) &&
          !challenge.description.includes('정답') &&
          !challenge.description.includes('연속') &&
          !challenge.description.includes('카테고리') &&
          !challenge.description.includes('시간') &&
          !challenge.description.includes('정답률')
        ) {
          // 퀴즈당 문제 수를 더함 (기본값 10문제)
          newCount += questionCount;
          shouldUpdate = true;
        }

        // 연속 정답 도전과제
        if (challenge.description.includes('연속') && challenge.description.includes('정답')) {
          newCount = Math.max(newCount, maxPerfectStreak);
          shouldUpdate = true;
        }

        // 카테고리 다양성 도전과제 (일일/주간 진행도 기반)
        if (challenge.description.includes('카테고리') && category) {
          // 오늘 시도한 카테고리 수를 계산하기 위해 quizHistory 확인
          const todayHistory = await ctx.db
            .query('quizHistory')
            .filter((q) => q.and(q.eq(q.field('userId'), userId), q.eq(q.field('date'), today)))
            .collect();

          // 챌린지 기간 내 quizHistory만 사용 (주간)
          const startTimestamp = challenge._creationTime;
          const endTimestamp = challenge.expiresAt;
          const challengePeriodHistory = await ctx.db
            .query('quizHistory')
            .filter((q) => q.eq(q.field('userId'), userId))
            .collect();
          const filteredHistory = challengePeriodHistory.filter((h) => {
            const completedAtMs = new Date(h.completedAt).getTime();
            return completedAtMs >= startTimestamp && completedAtMs <= endTimestamp;
          });

          // 주간 카테고리 다양성
          const thisWeekUniqueCategories = [...new Set(filteredHistory.map((h) => h.category))];

          // 도전과제 설명에 따라 일일 또는 주간 카테고리 수 사용
          if (challenge.description.includes('이번 주') || challenge.description.includes('주간')) {
            newCount = thisWeekUniqueCategories.length;
          } else {
            const todayUniqueCategories = [...new Set(todayHistory.map((h) => h.category))];
            newCount = todayUniqueCategories.length;
          }

          shouldUpdate = true;
        }

        // 정답률 기반 도전과제 (주간 유지)
        if (challenge.description.includes('이번 주') && challenge.description.includes('정답률')) {
          if (gamificationData && !challenge.completed) {
            // 챌린지 기간 내 quizHistory만 사용
            const startTimestamp = challenge._creationTime;
            const endTimestamp = challenge.expiresAt;
            const challengePeriodHistory = await ctx.db
              .query('quizHistory')
              .filter((q) => q.eq(q.field('userId'), userId))
              .collect();
            const filteredHistory = challengePeriodHistory.filter((h) => {
              const completedAtMs = new Date(h.completedAt).getTime();
              return completedAtMs >= startTimestamp && completedAtMs <= endTimestamp;
            });

            if (filteredHistory.length > 0) {
              const weekTotalQuestions = filteredHistory.reduce((sum, h) => sum + h.total, 0);
              const weekTotalCorrect = filteredHistory.reduce((sum, h) => sum + h.correct, 0);
              const weekAccuracy = (weekTotalCorrect / weekTotalQuestions) * 100;

              const targetAccuracy = 80;

              // 최소 문제 수 조건 확인 (200문제 이상)
              const minQuestions = challenge.description.includes('200문제') ? 200 : 0;

              // 주간 정답률이 기준을 만족하고 최소 문제 수도 만족하면 1
              if (weekAccuracy >= targetAccuracy && weekTotalQuestions >= minQuestions) {
                newCount = 1;
              } else {
                newCount = 0;
              }
              shouldUpdate = true;
            }
          }
        }

        // 평균 시간 기반 도전과제 (주간 유지)
        if (
          challenge.description.includes('평균') &&
          challenge.description.includes('시간') &&
          answerTime
        ) {
          if (!challenge.completed) {
            // 챌린지 기간 내 quizHistory만 사용
            const startTimestamp = challenge._creationTime;
            const endTimestamp = challenge.expiresAt;
            const challengePeriodHistory = await ctx.db
              .query('quizHistory')
              .filter((q) => q.eq(q.field('userId'), userId))
              .collect();
            const filteredHistory = challengePeriodHistory.filter((h) => {
              const completedAtMs = new Date(h.completedAt).getTime();
              return completedAtMs >= startTimestamp && completedAtMs <= endTimestamp;
            });

            if (filteredHistory.length > 0) {
              const totalTime = filteredHistory.reduce((sum, h) => sum + (h.averageTime || 0), 0);
              const avgTime = totalTime / filteredHistory.length;

              const targetTime = challenge.description.includes('30초')
                ? 30
                : challenge.description.includes('20초')
                  ? 20
                  : 999;

              // 최소 문제 수 조건 확인 (150문제 이상)
              const minQuestions = challenge.description.includes('150문제') ? 150 : 0;
              const weekTotalQuestions = filteredHistory.reduce((sum, h) => sum + h.total, 0);

              // 주간 평균 시간이 기준을 만족하고 최소 문제 수도 만족하면 1
              if (avgTime <= targetTime && weekTotalQuestions >= minQuestions) {
                newCount = 1;
              } else {
                newCount = 0;
              }
              shouldUpdate = true;
            }
          }
        }

        // 평균 시간 기반 도전과제 (일일, 문제 수 기준)
        if (
          challenge.description.includes('평균') &&
          challenge.description.includes('30초') &&
          challenge.description.includes('문제') &&
          !challenge.description.includes('주간') &&
          answerTime
        ) {
          if (!challenge.completed) {
            // 오늘의 quizHistory에서 문제 수와 평균 시간 계산
            const todayHistory = await ctx.db
              .query('quizHistory')
              .filter((q) => q.and(q.eq(q.field('userId'), userId), q.eq(q.field('date'), today)))
              .collect();

            if (todayHistory.length > 0) {
              const totalQuestions = todayHistory.reduce((sum, h) => sum + h.total, 0);
              const totalTime = todayHistory.reduce((sum, h) => sum + (h.averageTime || 0), 0);
              const avgTime = totalTime / todayHistory.length;

              // 최소 문제 수 조건 (50문제)
              const minQuestions = 50;

              if (avgTime <= 30 && totalQuestions >= minQuestions) {
                newCount = minQuestions;
              } else {
                newCount = 0;
              }
              shouldUpdate = true;
            }
          }
        }

        // 아침형 인간 도전과제
        if (challenge.description.includes('오전')) {
          if (!challenge.completed) {
            // 챌린지 기간 내 quizHistory만 사용
            const startTimestamp = challenge._creationTime;
            const endTimestamp = challenge.expiresAt;
            const challengePeriodHistory = await ctx.db
              .query('quizHistory')
              .filter((q) => q.eq(q.field('userId'), userId))
              .collect();
            const filteredHistory = challengePeriodHistory.filter((h) => {
              const completedAtMs = new Date(h.completedAt).getTime();
              return completedAtMs >= startTimestamp && completedAtMs <= endTimestamp;
            });

            // 날짜별 오전(KST) 문제 수 집계
            const morningQuestionsPerDay: Record<string, number> = {};
            for (const history of filteredHistory) {
              const completedAt = new Date(history.completedAt);
              const hourKST = (completedAt.getUTCHours() + 9) % 24;
              if (hourKST >= 9 && hourKST < 12) {
                morningQuestionsPerDay[history.date] =
                  (morningQuestionsPerDay[history.date] || 0) + history.total;
              }
            }

            // 오전에 10문제 이상 푼 날의 개수
            const daysWith10PlusQuestions = Object.values(morningQuestionsPerDay).filter(
              (count) => count >= 10,
            ).length;

            newCount = daysWith10PlusQuestions;
            shouldUpdate = true;
          }
        }

        // 퀴즈 파티 도전과제 (하루에 5개 이상 퀴즈 푸는 날 3일)
        if (challenge.description === '하루에 50문제(5퀴즈) 이상 푸는 날 3일 만들기') {
          if (!challenge.completed) {
            // 챌린지 기간 내 quizHistory만 사용
            const startTimestamp = challenge._creationTime;
            const endTimestamp = challenge.expiresAt;
            const challengePeriodHistory = await ctx.db
              .query('quizHistory')
              .filter((q) => q.eq(q.field('userId'), userId))
              .collect();
            const filteredHistory = challengePeriodHistory.filter((h) => {
              const completedAtMs = new Date(h.completedAt).getTime();
              return completedAtMs >= startTimestamp && completedAtMs <= endTimestamp;
            });

            // 날짜별 퀴즈 수 집계
            const dailyQuizCounts: Record<string, number> = {};
            for (const history of filteredHistory) {
              dailyQuizCounts[history.date] = (dailyQuizCounts[history.date] || 0) + history.total;
            }

            // 하루에 50문제 이상 푼 날 수 계산
            const daysWith50PlusQuestions = Object.values(dailyQuizCounts).filter(
              (count) => count >= 50,
            ).length;

            newCount = daysWith50PlusQuestions;
            shouldUpdate = true;
          }
        }

        // 연속 참여 도전과제 (주간)
        if (
          challenge.description.includes('연속') &&
          challenge.description.includes('일') &&
          gamificationData
        ) {
          // 챌린지 기간 내 quizHistory만 사용
          const startTimestamp = challenge._creationTime;
          const endTimestamp = challenge.expiresAt;
          const challengePeriodHistory = await ctx.db
            .query('quizHistory')
            .filter((q) => q.eq(q.field('userId'), userId))
            .collect();
          const filteredHistory = challengePeriodHistory.filter((h) => {
            const completedAtMs = new Date(h.completedAt).getTime();
            return completedAtMs >= startTimestamp && completedAtMs <= endTimestamp;
          });

          // 챌린지 기간 내 퀴즈를 푼 고유한 일수 계산
          const uniqueDaysThisWeek = [...new Set(filteredHistory.map((h) => h.date))];

          newCount = uniqueDaysThisWeek.length;
          shouldUpdate = true;
        }

        // 💎 완벽한 한 주: 이번 주 매일 한 번씩 만점 받기
        if (challenge.description.includes('만점')) {
          // 챌린지의 시작~종료 기간 내의 quizHistory만 집계
          const startTimestamp = challenge._creationTime;
          const endTimestamp = challenge.expiresAt;

          const challengePeriodHistory = await ctx.db
            .query('quizHistory')
            .filter((q) => q.eq(q.field('userId'), userId))
            .collect();

          // 기간 내 기록만 필터링
          const filteredHistory = challengePeriodHistory.filter((h) => {
            const completedAtMs = new Date(h.completedAt).getTime();
            return completedAtMs >= startTimestamp && completedAtMs <= endTimestamp;
          });

          // 날짜별로 그룹화
          const perfectDays = new Set();
          for (const h of filteredHistory) {
            if (h.total > 0 && h.correct === h.total) {
              perfectDays.add(h.date);
            }
          }
          newCount = perfectDays.size;
          shouldUpdate = true;
        }

        // 정답률 기반 도전과제 (일일)
        if (challenge.description.includes('오늘') && challenge.description.includes('정답률')) {
          if (gamificationData && !challenge.completed) {
            // 오늘의 quizHistory만 사용
            const todayHistory = await ctx.db
              .query('quizHistory')
              .filter((q) => q.and(q.eq(q.field('userId'), userId), q.eq(q.field('date'), today)))
              .collect();

            if (todayHistory.length > 0) {
              const totalQuestions = todayHistory.reduce((sum, h) => sum + h.total, 0);
              const totalCorrect = todayHistory.reduce((sum, h) => sum + h.correct, 0);
              const accuracy = (totalCorrect / totalQuestions) * 100;

              const targetAccuracy = 90;
              // 최소 문제 수 조건 (10문제 이상)
              const minQuestions = 10;

              if (accuracy >= targetAccuracy && totalQuestions >= minQuestions) {
                newCount = 1;
              } else {
                newCount = 0;
              }
              shouldUpdate = true;
            }
          }
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
}
