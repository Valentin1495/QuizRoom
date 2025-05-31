import { useUser } from '@clerk/clerk-react';
import { useMutation, useQuery } from 'convex/react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { api } from '../convex/_generated/api';

export interface QuizHistoryItem {
  id: string; // uuid
  date: string; // ISO 날짜
  completedAt: string; // ISO 날짜 (시간 포함)
  category: string;
  total: number;
  correct: number;
  averageTime?: number; // 평균 답변 시간 (초)
  comebackVictory?: boolean; // 처음 3문제 틀리고 완료했는지
  luckyStreak?: number; // 연속 맞힌 문제 수 (행운의 추측용)
  withFriend?: boolean; // 친구와 함께했는지
  relearnedMistakes?: boolean; // 틀린 문제 재학습했는지
}

interface GamificationState {
  /* 포인트 · 레벨 */
  totalPoints: number;
  level: number;
  pointsToNextLevel: number;
  expInCurrentLevel: number;

  /* 스트릭 */
  currentStreak: number;
  longestStreak: number;
  lastQuizDate: string | null;

  /* 업적 */
  achievements: Achievement[];

  /* 퀴즈 통계 */
  totalQuizzes: number;
  totalCorrectAnswers: number;
  categoryStats: Record<string, CategoryStats>;
  quizzesHistory: QuizHistoryItem[];

  /* 완벽한 점수 연속 기록 */
  currentPerfectStreak: number;
}

interface CategoryStats {
  totalQuestions: number;
  correctAnswers: number;
  masteryLevel: number;
  initialAccuracy?: number; // 처음 정답률 (개선 업적용)
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: Date | null;
  progress: number;
  target: number;
}

interface GamificationContextType {
  /* 평탄화된 값 */
  totalPoints: number;
  level: number;
  streak: number;
  achievements: Achievement[];
  newlyUnlockedAchievements: Achievement[];
  pointsToNextLevel: number;
  getPointsForNextLevel: () => number;
  isLoading: boolean;

  /* 메서드 */
  addPoints(points: number, reason?: string): void;
  updateStreak(): void;
  recordQuizCompletion(
    category: string,
    correctAnswers: number,
    totalQuestions: number,
    options?: {
      averageTime?: number;
      comebackVictory?: boolean;
      luckyStreak?: number;
      withFriend?: boolean;
      relearnedMistakes?: boolean;
    }
  ): boolean; // 퍼펙트 여부 반환
  checkAchievements(): Promise<Achievement[]>;
  resetData(): void;
  clearNewlyUnlockedAchievements: () => void;
}

const defaultState: GamificationState = {
  totalPoints: 0,
  level: 1,
  pointsToNextLevel: 100,
  expInCurrentLevel: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastQuizDate: null,
  achievements: [],
  totalQuizzes: 0,
  totalCorrectAnswers: 0,
  categoryStats: {},
  quizzesHistory: [],
  currentPerfectStreak: 0,
};

const GamificationContext = createContext<GamificationContextType | null>(null);

// 레벨 계산 함수
const calculateLevel = (points: number) => {
  let level = 1,
    need = 100,
    acc = 0;
  while (points >= acc + need) {
    acc += need;
    level++;
    need = Math.floor(need * 1.5);
  }
  return {
    level,
    expInCurrentLevel: points - acc,
    pointsToNextLevel: acc + need - points,
  };
};

// 확장된 업적 정의
const defaultAchievements: Achievement[] = [
  // 기본 시작 업적
  {
    id: 'first_quiz',
    title: '첫 걸음',
    description: '첫 번째 퀴즈 완료',
    icon: '🏁',
    unlockedAt: null,
    progress: 0,
    target: 1,
  },

  // 연속 도전 업적들
  {
    id: 'streak_3',
    title: '시작이 반',
    description: '3일 연속 퀴즈 풀기',
    icon: '🔥',
    unlockedAt: null,
    progress: 0,
    target: 3,
  },
  {
    id: 'streak_7',
    title: '꾸준히 하기',
    description: '7일 연속 퀴즈 풀기',
    icon: '🔥',
    unlockedAt: null,
    progress: 0,
    target: 7,
  },
  {
    id: 'streak_30',
    title: '월간 도전자',
    description: '30일 연속 퀴즈 풀기',
    icon: '🚀',
    unlockedAt: null,
    progress: 0,
    target: 30,
  },

  // 정확도 관련 업적들
  {
    id: 'perfect_quiz',
    title: '완벽주의자',
    description: '퀴즈에서 모든 문제 정답',
    icon: '🎯',
    unlockedAt: null,
    progress: 0,
    target: 1,
  },
  {
    id: 'perfect_streak_5',
    title: '완벽한 연승',
    description: '5번 연속으로 완벽한 점수 달성',
    icon: '💫',
    unlockedAt: null,
    progress: 0,
    target: 5,
  },
  {
    id: 'accuracy_king',
    title: '정확도 왕',
    description: '전체 정답률 95% 이상 달성',
    icon: '👑',
    unlockedAt: null,
    progress: 0,
    target: 1,
  },

  // 수량 기반 업적들
  {
    id: 'quiz_beginner',
    title: '퀴즈 입문자',
    description: '10개의 퀴즈 완료',
    icon: '📚',
    unlockedAt: null,
    progress: 0,
    target: 10,
  },
  {
    id: 'quiz_enthusiast',
    title: '퀴즈 애호가',
    description: '50개의 퀴즈 완료',
    icon: '🎓',
    unlockedAt: null,
    progress: 0,
    target: 50,
  },
  {
    id: 'quiz_master',
    title: '퀴즈 마스터',
    description: '100개의 퀴즈 완료',
    icon: '👑',
    unlockedAt: null,
    progress: 0,
    target: 100,
  },
  {
    id: 'quiz_legend',
    title: '퀴즈 전설',
    description: '500개의 퀴즈 완료',
    icon: '🏆',
    unlockedAt: null,
    progress: 0,
    target: 500,
  },

  // 카테고리 관련 업적들
  {
    id: 'category_expert',
    title: '카테고리 전문가',
    description: '한 카테고리에서 90% 이상 정답률 달성',
    icon: '🧠',
    unlockedAt: null,
    progress: 0,
    target: 1,
  },
  {
    id: 'multi_category',
    title: '다재다능',
    description: '3개 이상 카테고리에서 80% 이상 정답률 달성',
    icon: '🌟',
    unlockedAt: null,
    progress: 0,
    target: 3,
  },
  {
    id: 'category_master',
    title: '올라운더',
    description: '모든 카테고리(8개)에서 70% 이상 정답률 달성',
    icon: '🎭',
    unlockedAt: null,
    progress: 0,
    target: 8, // 8개 카테고리
  },
  {
    id: 'category_completionist',
    title: '탐험가',
    description: '모든 카테고리에서 최소 1개 이상의 퀴즈 완료',
    icon: '🗺️',
    unlockedAt: null,
    progress: 0,
    target: 8,
  },
  {
    id: 'balanced_learner',
    title: '균형잡힌 학습자',
    description: '모든 카테고리에서 최소 10개 이상의 문제 풀기',
    icon: '⚖️',
    unlockedAt: null,
    progress: 0,
    target: 8,
  },

  // 속도 관련 업적들
  {
    id: 'speed_demon',
    title: '번개같은 속도',
    description: '평균 답변 시간 3초 이하로 퀴즈 완료',
    icon: '⚡',
    unlockedAt: null,
    progress: 0,
    target: 1,
  },
  {
    id: 'quick_thinker',
    title: '빠른 사고',
    description: '10문제를 평균 5초 이하로 답변',
    icon: '🧩',
    unlockedAt: null,
    progress: 0,
    target: 1,
  },

  // 특별한 도전 업적들
  {
    id: 'comeback_king',
    title: '역전의 제왕',
    description: '처음 3문제를 틀렸지만 나머지는 모두 정답',
    icon: '💪',
    unlockedAt: null,
    progress: 0,
    target: 1,
  },
  {
    id: 'night_owl',
    title: '밤의 학자',
    description: '자정 이후에 퀴즈 10개 완료',
    icon: '🦉',
    unlockedAt: null,
    progress: 0,
    target: 10,
  },
  {
    id: 'early_bird',
    title: '아침형 인간',
    description: '오전 6시 이전에 퀴즈 10개 완료',
    icon: '🐦',
    unlockedAt: null,
    progress: 0,
    target: 10,
  },
  {
    id: 'weekend_warrior',
    title: '주말 전사',
    description: '주말에만 50개 퀴즈 완료',
    icon: '🏖️',
    unlockedAt: null,
    progress: 0,
    target: 50,
  },

  // 학습 관련 업적들
  {
    id: 'improvement_seeker',
    title: '발전하는 마음',
    description: '한 카테고리 정답률을 50%에서 80%로 향상',
    icon: '📈',
    unlockedAt: null,
    progress: 0,
    target: 1,
  },

  // 재미있는 업적들
  {
    id: 'lucky_guess',
    title: '행운의 추측',
    description: '연속으로 5문제 맞히기 (각 문제당 25% 확률)',
    icon: '🍀',
    unlockedAt: null,
    progress: 0,
    target: 1,
  },
  {
    id: 'persistent_player',
    title: '끈기의 승부사',
    description: '한 번에 20문제 이상 연속 풀기',
    icon: '🎯',
    unlockedAt: null,
    progress: 0,
    target: 1,
  },
];

export function GamificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoaded: userLoaded } = useUser();
  const [state, setState] = useState<GamificationState>(defaultState);
  const [newlyUnlockedAchievements, setNewlyUnlockedAchievements] = useState<
    Achievement[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  // Convex 쿼리 및 뮤테이션
  const gamificationData = useQuery(
    api.gamification.getOrCreateGamificationData,
    user?.id ? { userId: user.id } : 'skip'
  );
  const categoryStats = useQuery(
    api.gamification.getCategoryStats,
    user?.id ? { userId: user.id } : 'skip'
  );
  const achievements = useQuery(
    api.gamification.getAchievements,
    user?.id ? { userId: user.id } : 'skip'
  );
  const quizHistory = useQuery(
    api.gamification.getQuizHistory,
    user?.id ? { userId: user.id } : 'skip'
  );

  const updateGamificationData = useMutation(
    api.gamification.updateGamificationData
  );
  const updateCategoryStats = useMutation(api.gamification.updateCategoryStats);
  const updateAchievement = useMutation(api.gamification.updateAchievement);
  const addQuizHistory = useMutation(api.gamification.addQuizHistory);
  const resetGamificationData = useMutation(
    api.gamification.resetGamificationData
  );

  // 데이터 로드
  useEffect(() => {
    if (!userLoaded || !user?.id) {
      setIsLoading(false);
      return;
    }

    if (
      gamificationData &&
      categoryStats &&
      achievements !== undefined &&
      quizHistory
    ) {
      // 업적 데이터 병합 (기본 업적 + 저장된 진행상황)
      const mergedAchievements = defaultAchievements.map((defaultAch) => {
        const savedAch = achievements.find(
          (a) => a.achievementId === defaultAch.id
        );
        return {
          ...defaultAch,
          progress: savedAch?.progress || 0,
          unlockedAt: savedAch?.unlockedAt
            ? new Date(savedAch.unlockedAt)
            : null,
        };
      });

      // 퀴즈 히스토리 변환
      const convertedHistory: QuizHistoryItem[] = quizHistory.map((item) => ({
        id: item.id,
        date: item.date,
        completedAt: item.completedAt,
        category: item.category,
        total: item.total,
        correct: item.correct,
        averageTime: item.averageTime,
        comebackVictory: item.comebackVictory,
        luckyStreak: item.luckyStreak,
        withFriend: item.withFriend,
        relearnedMistakes: item.relearnedMistakes,
      }));

      setState({
        totalPoints: gamificationData.totalPoints,
        level: gamificationData.level,
        pointsToNextLevel: gamificationData.pointsToNextLevel,
        expInCurrentLevel: gamificationData.expInCurrentLevel,
        currentStreak: gamificationData.currentStreak,
        longestStreak: gamificationData.longestStreak,
        lastQuizDate: gamificationData.lastQuizDate || null,
        totalQuizzes: gamificationData.totalQuizzes,
        totalCorrectAnswers: gamificationData.totalCorrectAnswers,
        currentPerfectStreak: gamificationData.currentPerfectStreak,
        achievements: mergedAchievements,
        categoryStats: categoryStats || {},
        quizzesHistory: convertedHistory,
      });

      setIsLoading(false);
    }
  }, [
    userLoaded,
    user?.id,
    gamificationData,
    categoryStats,
    achievements,
    quizHistory,
  ]);

  const addPoints = (points: number) => {
    if (!user?.id) return;

    setState((prev) => {
      const newTotal = prev.totalPoints + points;
      const { level, expInCurrentLevel, pointsToNextLevel } =
        calculateLevel(newTotal);

      if (level > prev.level) console.log(`🎉 Level-Up → L${level}`);

      const newState = {
        ...prev,
        totalPoints: newTotal,
        level,
        expInCurrentLevel,
        pointsToNextLevel,
      };

      // Convex에 저장
      updateGamificationData({
        userId: user.id,
        data: {
          totalPoints: newTotal,
          level,
          pointsToNextLevel,
          expInCurrentLevel,
          currentStreak: prev.currentStreak,
          longestStreak: prev.longestStreak,
          lastQuizDate: prev.lastQuizDate || undefined,
          totalQuizzes: prev.totalQuizzes,
          totalCorrectAnswers: prev.totalCorrectAnswers,
          currentPerfectStreak: prev.currentPerfectStreak,
        },
      });

      return newState;
    });
  };

  const updateStreak = () => {
    if (!user?.id) return;

    const today = new Date().toDateString();
    const lastDate = state.lastQuizDate;

    setState((prev) => {
      let newStreak = prev.currentStreak;
      let newLongestStreak = prev.longestStreak;

      if (!lastDate) {
        // 첫 번째 퀴즈
        newStreak = 1;
        newLongestStreak = Math.max(1, prev.longestStreak);
      } else if (lastDate === today) {
        // 오늘 이미 퀴즈를 품
        return prev;
      } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastDate === yesterday.toDateString()) {
          // 연속 일수 증가
          newStreak = prev.currentStreak + 1;
          newLongestStreak = Math.max(newStreak, prev.longestStreak);
        } else {
          // 스트릭 끊김
          newStreak = 1;
        }
      }

      const newState = {
        ...prev,
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastQuizDate: today,
      };

      // Convex에 저장
      updateGamificationData({
        userId: user.id,
        data: {
          totalPoints: prev.totalPoints,
          level: prev.level,
          pointsToNextLevel: prev.pointsToNextLevel,
          expInCurrentLevel: prev.expInCurrentLevel,
          currentStreak: newStreak,
          longestStreak: newLongestStreak,
          lastQuizDate: today,
          totalQuizzes: prev.totalQuizzes,
          totalCorrectAnswers: prev.totalCorrectAnswers,
          currentPerfectStreak: prev.currentPerfectStreak,
        },
      });

      return newState;
    });
  };

  const recordQuizCompletion = (
    category: string,
    correctAnswers: number,
    totalQuestions: number,
    options?: {
      averageTime?: number;
      comebackVictory?: boolean;
      luckyStreak?: number;
      withFriend?: boolean;
      relearnedMistakes?: boolean;
    }
  ): boolean => {
    if (!user?.id) return false;

    const isPerfect = correctAnswers === totalQuestions;
    const now = new Date();

    setState((prev) => {
      /* ── 카테고리 통계 업데이트 ── */
      const prevCat = prev.categoryStats[category] ?? {
        totalQuestions: 0,
        correctAnswers: 0,
        masteryLevel: 0,
      };
      const totQ = prevCat.totalQuestions + totalQuestions;
      const totC = prevCat.correctAnswers + correctAnswers;
      const newMasteryLevel = Math.round((totC / totQ) * 100);

      // 초기 정답률 설정 (개선 업적용)
      let initialAccuracy = prevCat.initialAccuracy;
      if (initialAccuracy === undefined && prevCat.totalQuestions === 0) {
        initialAccuracy = newMasteryLevel;
      }

      /* ── 포인트 계산 ── */
      const base = correctAnswers * 10;
      const bonus = isPerfect ? 20 : 0;
      const newTotalPoints = prev.totalPoints + base + bonus;

      /* 레벨·경험치 재계산 */
      const { level, expInCurrentLevel, pointsToNextLevel } =
        calculateLevel(newTotalPoints);

      /* 스트릭 처리 */
      const today = new Date().toDateString();
      const newStreak =
        prev.lastQuizDate === today
          ? prev.currentStreak
          : prev.lastQuizDate ===
              new Date(Date.now() - 86_400_000).toDateString()
            ? prev.currentStreak + 1
            : 1;

      /* 완벽한 점수 연속 기록 업데이트 */
      const newPerfectStreak = isPerfect ? prev.currentPerfectStreak + 1 : 0;

      /* ── 히스토리 아이템 생성 ── */
      const historyItem: QuizHistoryItem = {
        id: uuidv4(),
        date: now.toISOString().split('T')[0], // YYYY-MM-DD
        completedAt: now.toISOString(),
        category,
        total: totalQuestions,
        correct: correctAnswers,
        ...options,
      };

      const newState = {
        ...prev,
        /* 포인트·레벨 */
        totalPoints: newTotalPoints,
        level,
        expInCurrentLevel,
        pointsToNextLevel,
        /* 스트릭 */
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, prev.longestStreak),
        lastQuizDate: today,
        /* 완벽한 점수 연속 기록 */
        currentPerfectStreak: newPerfectStreak,
        /* 퀴즈 통계 */
        totalQuizzes: prev.totalQuizzes + 1,
        totalCorrectAnswers: prev.totalCorrectAnswers + correctAnswers,
        categoryStats: {
          ...prev.categoryStats,
          [category]: {
            totalQuestions: totQ,
            correctAnswers: totC,
            masteryLevel: newMasteryLevel,
            initialAccuracy,
          },
        },
        quizzesHistory: [...prev.quizzesHistory, historyItem],
      };

      // Convex에 저장
      // 1. 게이미피케이션 데이터 업데이트
      updateGamificationData({
        userId: user.id,
        data: {
          totalPoints: newTotalPoints,
          level,
          pointsToNextLevel,
          expInCurrentLevel,
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, prev.longestStreak),
          lastQuizDate: today,
          totalQuizzes: prev.totalQuizzes + 1,
          totalCorrectAnswers: prev.totalCorrectAnswers + correctAnswers,
          currentPerfectStreak: newPerfectStreak,
        },
      });

      // 2. 카테고리 통계 업데이트
      updateCategoryStats({
        userId: user.id,
        category,
        totalQuestions: totQ,
        correctAnswers: totC,
        masteryLevel: newMasteryLevel,
        initialAccuracy,
      });

      // 3. 퀴즈 히스토리 추가
      addQuizHistory({
        id: historyItem.id,
        userId: user.id,
        date: historyItem.date,
        completedAt: historyItem.completedAt,
        category: historyItem.category,
        total: historyItem.total,
        correct: historyItem.correct,
        averageTime: historyItem.averageTime,
        comebackVictory: historyItem.comebackVictory,
        luckyStreak: historyItem.luckyStreak,
        withFriend: historyItem.withFriend,
        relearnedMistakes: historyItem.relearnedMistakes,
      });

      return newState;
    });

    return isPerfect;
  };

  const checkAchievements = async (): Promise<Achievement[]> => {
    if (!user?.id) return [];

    return new Promise((resolve) => {
      const unlocked: Achievement[] = [];

      setState((prev) => {
        const updatedAchievements = prev.achievements.map((ach) => {
          if (ach.unlockedAt) return ach;

          let progress = 0;
          let done = false;
          const ALL_CATEGORIES = [
            'general',
            'science-tech',
            'history-culture',
            'kpop-music',
            'arts-literature',
            'sports',
            'entertainment',
            'math-logic',
          ];

          switch (ach.id) {
            // 기본 업적들
            case 'first_quiz':
              progress = prev.totalQuizzes;
              done = progress >= 1;
              break;

            // 연속 도전 업적들
            case 'streak_3':
              progress = prev.currentStreak;
              done = progress >= 3;
              break;
            case 'streak_7':
              progress = prev.currentStreak;
              done = progress >= 7;
              break;
            case 'streak_30':
              progress = prev.currentStreak;
              done = progress >= 30;
              break;

            // 정확도 관련 업적들
            case 'perfect_quiz':
              progress = prev.quizzesHistory.some((q) => q.correct === q.total)
                ? 1
                : 0;
              done = progress === 1;
              break;
            case 'perfect_streak_5':
              progress = prev.currentPerfectStreak;
              done = progress >= 5;
              break;
            // case 'accuracy_king':
            //   const totalCorrect = prev.totalCorrectAnswers;
            //   const totalQuestions = prev.quizzesHistory.reduce(
            //     (sum, q) => sum + q.total,
            //     0
            //   );
            //   const accuracy =
            //     totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
            //   progress = Math.floor(accuracy);
            //   done = accuracy >= 95;
            //   break;

            // 수량 기반 업적들
            case 'quiz_beginner':
              progress = prev.totalQuizzes;
              done = progress >= 10;
              break;
            case 'quiz_enthusiast':
              progress = prev.totalQuizzes;
              done = progress >= 50;
              break;
            case 'quiz_master':
              progress = prev.totalQuizzes;
              done = progress >= 100;
              break;
            case 'quiz_legend':
              progress = prev.totalQuizzes;
              done = progress >= 500;
              break;

            // 카테고리 관련 업적들
            case 'category_expert':
              // 한 카테고리에서 90% 이상 정답률 달성
              progress = Object.values(prev.categoryStats).filter(
                (s) => s.masteryLevel >= 90
              ).length;
              done = progress >= 1;
              break;

            case 'multi_category':
              // 3개 이상 카테고리에서 80% 이상 정답률 달성
              progress = Object.values(prev.categoryStats).filter(
                (s) => s.masteryLevel >= 80
              ).length;
              done = progress >= 3;
              break;

            case 'category_master':
              // 모든 카테고리(8개)에서 70% 이상 정답률 달성
              const totalCategoriesRequired = ALL_CATEGORIES.length; // 8개
              const masteredCategories = ALL_CATEGORIES.filter((category) => {
                const stats = prev.categoryStats[category];
                return stats && stats.masteryLevel >= 70;
              }).length;

              progress = masteredCategories;
              done = masteredCategories === totalCategoriesRequired;
              break;

            case 'category_completionist':
              // 모든 카테고리에서 최소 1개 이상의 퀴즈 완료
              const categoriesWithQuizzes = ALL_CATEGORIES.filter(
                (category) => {
                  const stats = prev.categoryStats[category];
                  return stats && stats.totalQuestions > 0;
                }
              ).length;

              progress = categoriesWithQuizzes;
              done = categoriesWithQuizzes === ALL_CATEGORIES.length;
              break;

            // case 'balanced_learner':
            //   // 모든 카테고리에서 최소 10개 이상의 문제 풀기
            //   const balancedCategories = ALL_CATEGORIES.filter((category) => {
            //     const stats = prev.categoryStats[category];
            //     return stats && stats.totalQuestions >= 10;
            //   }).length;

            //   progress = balancedCategories;
            //   done = balancedCategories === ALL_CATEGORIES.length;
            //   break;

            // 속도 관련 업적들
            case 'speed_demon':
              const speedQuizzes = prev.quizzesHistory.filter(
                (q) => q.averageTime && q.averageTime <= 3
              );
              progress = speedQuizzes.length > 0 ? 1 : 0;
              done = progress === 1;
              break;
            case 'quick_thinker':
              const quickQuizzes = prev.quizzesHistory.filter(
                (q) => q.total >= 10 && q.averageTime && q.averageTime <= 5
              );
              progress = quickQuizzes.length > 0 ? 1 : 0;
              done = progress === 1;
              break;

            // 특별한 도전 업적들
            case 'comeback_king':
              const comebackQuizzes = prev.quizzesHistory.filter(
                (q) => q.comebackVictory
              );
              progress = comebackQuizzes.length > 0 ? 1 : 0;
              done = progress === 1;
              break;
            case 'night_owl':
              const nightQuizzes = prev.quizzesHistory.filter((q) => {
                const hour = new Date(q.completedAt).getHours();
                return hour >= 0 && hour < 6;
              }).length;
              progress = nightQuizzes;
              done = progress >= 10;
              break;
            case 'early_bird':
              const earlyQuizzes = prev.quizzesHistory.filter((q) => {
                const hour = new Date(q.completedAt).getHours();
                return hour >= 5 && hour < 8;
              }).length;
              progress = earlyQuizzes;
              done = progress >= 10;
              break;
            case 'weekend_warrior':
              const weekendQuizzes = prev.quizzesHistory.filter((q) => {
                const day = new Date(q.completedAt).getDay();
                return day === 0 || day === 6;
              }).length;
              progress = weekendQuizzes;
              done = progress >= 50;
              break;

            // 학습 관련 업적들
            case 'improvement_seeker':
              const improvedCategories = Object.values(
                prev.categoryStats
              ).filter(
                (s) =>
                  s.initialAccuracy &&
                  s.initialAccuracy <= 50 &&
                  s.masteryLevel >= 80
              ).length;
              progress = improvedCategories > 0 ? 1 : 0;
              done = progress === 1;
              break;

            // 재미있는 업적들
            case 'lucky_guess':
              const luckyQuizzes = prev.quizzesHistory.filter(
                (q) => q.luckyStreak && q.luckyStreak >= 5
              );
              progress = luckyQuizzes.length > 0 ? 1 : 0;
              done = progress === 1;
              break;
            case 'persistent_player':
              const longQuizzes = prev.quizzesHistory.filter(
                (q) => q.total >= 20
              );
              progress = longQuizzes.length > 0 ? 1 : 0;
              done = progress === 1;
              break;
          }

          const updatedAchievement = {
            ...ach,
            progress: Math.min(progress, ach.target),
            unlockedAt: done && !ach.unlockedAt ? new Date() : ach.unlockedAt,
          };

          if (done && !ach.unlockedAt) {
            unlocked.push(updatedAchievement);
            // Convex에 업적 저장
            updateAchievement({
              userId: user.id,
              achievementId: ach.id,
              progress: Math.min(progress, ach.target),
              unlockedAt: Date.now(),
            });
          } else if (ach.progress !== progress) {
            // 진행도가 변경된 경우에도 저장
            updateAchievement({
              userId: user.id,
              achievementId: ach.id,
              progress: Math.min(progress, ach.target),
              unlockedAt: undefined,
            });
          }

          return updatedAchievement;
        });

        const newState = {
          ...prev,
          achievements: updatedAchievements,
        };

        // 새로 해금된 업적이 있으면 상태 업데이트
        if (unlocked.length > 0) {
          console.log(
            '✅ 새로 해금된 업적:',
            unlocked.map((a) => a.title)
          );
          setTimeout(() => {
            setNewlyUnlockedAchievements(unlocked);
          }, 100);
        }

        resolve(unlocked);
        return newState;
      });
    });
  };

  const clearNewlyUnlockedAchievements = () => {
    setNewlyUnlockedAchievements([]);
  };

  const resetData = () => {
    if (!user?.id) return;

    setState({ ...defaultState, achievements: [...defaultAchievements] });
    setNewlyUnlockedAchievements([]);

    // Convex에서 데이터 삭제
    resetGamificationData({ userId: user.id });
  };

  // 사용자가 로그인하지 않은 경우 기본값 반환
  if (!userLoaded || !user?.id) {
    return (
      <GamificationContext.Provider
        value={{
          /* ─ 상태 값 ─ */
          totalPoints: 0,
          level: 1,
          streak: 0,
          achievements: defaultAchievements,
          newlyUnlockedAchievements: [],
          pointsToNextLevel: 100,
          getPointsForNextLevel: () => 100,
          isLoading: !userLoaded,

          /* ─ 메서드 (빈 함수들) ─ */
          addPoints: () => {},
          updateStreak: () => {},
          recordQuizCompletion: () => false,
          checkAchievements: async () => [],
          resetData: () => {},
          clearNewlyUnlockedAchievements: () => {},
        }}
      >
        {children}
      </GamificationContext.Provider>
    );
  }

  return (
    <GamificationContext.Provider
      value={{
        /* ─ 상태 값 ─ */
        totalPoints: state.totalPoints,
        level: state.level,
        streak: state.currentStreak,
        achievements: state.achievements,
        newlyUnlockedAchievements,
        pointsToNextLevel: state.pointsToNextLevel,
        getPointsForNextLevel: () => state.pointsToNextLevel,
        isLoading,

        /* ─ 메서드 ─ */
        addPoints,
        updateStreak,
        recordQuizCompletion,
        checkAchievements,
        resetData,
        clearNewlyUnlockedAchievements,
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
}

export const useGamification = () => {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error(
      'useGamification must be used within a GamificationProvider'
    );
  }
  return context;
};
