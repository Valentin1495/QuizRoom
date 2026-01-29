import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DAILY_CATEGORY_ICONS, DailyCategory, resolveDailyCategoryCopy } from '@/constants/daily';
import { Colors, Palette, Radius, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDailyQuiz } from '@/hooks/use-daily-quiz';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-unified-auth';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { lightHaptic, mediumHaptic, successHaptic, warningHaptic } from '@/lib/haptics';
import { useLogQuizHistory } from '@/lib/supabase-api';
import { supabase } from '@/lib/supabase-index';
import { useMutation } from 'convex/react';

const QUESTION_TIME_LIMIT = 10;

type DailyQuestion = {
  id: string;
  prompt: string;
  correctAnswer: boolean;
  explanation: string;
  difficulty: number;
};

type QuestionResult = {
  questionId: string;
  selection: boolean | null;
  correctAnswer: boolean;
  isCorrect: boolean;
};

type Phase = 'intro' | 'question' | 'reveal' | 'finished';
type TimerMode = 'timed' | 'untimed';

function formatSeconds(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  return `${safeSeconds}초`;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}초`;
  }
  return `${minutes}분 ${seconds.toString().padStart(2, '0')}초`;
}

function formatAverageDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}초`;
  }
  return `${minutes}분 ${seconds.toString().padStart(2, '0')}초`;
}

type ColorMode = 'light' | 'dark';

const getDailyThemeStyles = (mode: ColorMode) => {
  const palette = Colors[mode];
  const isDark = mode === 'dark';

  return {
    introCard: {
      backgroundColor: isDark ? 'rgba(229, 229, 229, 0.08)' : palette.card,
      borderColor: palette.border,
    },
    introButton: {
      backgroundColor: isDark ? 'rgba(229, 229, 229, 0.05)' : 'rgba(26, 26, 26, 0.02)',
      borderColor: palette.border,
    },
    introTimed: {
      backgroundColor: palette.primary,
      borderColor: 'transparent',
    },
    introTimedText: {
      color: palette.primaryForeground,
    },
    introTimedCaption: {
      color: palette.primaryForeground,
    },
    introUntimed: {
      backgroundColor: isDark ? 'rgba(229, 229, 229, 0.08)' : Palette.gray25,
      borderColor: palette.borderStrong,
    },
    introUntimedLabel: {
      color: palette.primary,
    },
    introUntimedCaption: {
      color: palette.textMuted,
    },
    retryButton: {
      backgroundColor: palette.primary,
    },
    retryLabel: {
      color: palette.primaryForeground,
    },
    badge: {
      backgroundColor: isDark ? 'rgba(229, 229, 229, 0.12)' : Palette.gray50,
    },
    badgeText: {
      color: palette.primary,
    },
    timerPill: {
      borderColor: palette.border,
    },
    explanationCard: {
      backgroundColor: isDark ? 'rgba(229, 229, 229, 0.05)' : Palette.gray25,
      borderColor: palette.border,
    },
    secondaryButton: {
      borderColor: palette.borderStrong,
    },
    summaryStatCard: {
      backgroundColor: isDark ? 'rgba(229, 229, 229, 0.06)' : palette.card,
      borderColor: palette.border,
    },
    summaryRow: {
      backgroundColor: isDark ? 'rgba(229, 229, 229, 0.04)' : Palette.gray50,
      borderColor: palette.border,
    },
    summaryResultCorrect: {
      color: palette.success,
    },
    summaryResultIncorrect: {
      color: palette.danger,
    },
    summaryResultSkipped: {
      color: palette.textMuted,
    },
    shareCard: {
      backgroundColor: isDark ? 'rgba(229, 229, 229, 0.06)' : palette.cardElevated,
      borderColor: palette.border,
    },
    shareButton: {
      backgroundColor: palette.primary,
    },
    shareButtonLabel: {
      color: palette.primaryForeground,
    },
  };
};

type ChoiceState = 'default' | 'pressed' | 'correct' | 'wrong' | 'dim';

type ChoiceAppearance = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  gradientColors?: [string, string];
};

const LIGHT_CORRECT_GRADIENT: [string, string] = ['#2D9CDB', '#56CCF2'];
const DARK_CORRECT_GRADIENT: [string, string] = ['#1F7FB8', '#41B5E6'];
const LIGHT_WRONG_GRADIENT: [string, string] = ['#EB5757', '#FF7676'];
const DARK_WRONG_GRADIENT: [string, string] = ['#D94B4B', '#FF6A6A'];
const LIGHT_DEFAULT_BG = '#F5F5F5';
const LIGHT_DEFAULT_BORDER = '#E0E0E0';
const LIGHT_PRESSED_BG = '#E0E0E0';
const LIGHT_PRESSED_BORDER = '#D4D4D4';
const LIGHT_DIM_BG = '#C8C8C8';
const LIGHT_DIM_TEXT = '#5F5F5F';
const DARK_DEFAULT_BG = '#1F1F1F';
const DARK_DEFAULT_BORDER = '#393939';
const DARK_PRESSED_BG = '#2A2A2A';
const DARK_PRESSED_BORDER = '#454545';
const DARK_DIM_BG = '#3A3A3A';
const DARK_DIM_TEXT = '#A3A3A3';

const PER_ANSWER_XP = 10;
const COMPLETION_XP = 50;
const PERFECT_BONUS_XP = 30;

const createChoiceAppearance = (
  backgroundColor: string,
  borderColor: string,
  textColor: string,
  gradientColors?: [string, string]
): ChoiceAppearance => ({
  backgroundColor,
  borderColor,
  textColor,
  gradientColors,
});

const getChoiceAppearance = (mode: ColorMode, state: ChoiceState): ChoiceAppearance => {
  const isDark = mode === 'dark';
  const palette = Colors[mode];

  if (state === 'correct') {
    const gradient = isDark ? DARK_CORRECT_GRADIENT : LIGHT_CORRECT_GRADIENT;
    return createChoiceAppearance(gradient[0], gradient[0], '#FFFFFF', gradient);
  }

  if (state === 'wrong') {
    const gradient = isDark ? DARK_WRONG_GRADIENT : LIGHT_WRONG_GRADIENT;
    return createChoiceAppearance(gradient[0], gradient[0], '#FFFFFF', gradient);
  }

  if (state === 'dim') {
    if (isDark) {
      return createChoiceAppearance(DARK_DIM_BG, DARK_DIM_BG, DARK_DIM_TEXT);
    }
    return createChoiceAppearance(LIGHT_DIM_BG, LIGHT_DIM_BG, LIGHT_DIM_TEXT);
  }

  if (state === 'pressed') {
    if (isDark) {
      return createChoiceAppearance(DARK_PRESSED_BG, DARK_PRESSED_BORDER, palette.text);
    }
    return createChoiceAppearance(LIGHT_PRESSED_BG, LIGHT_PRESSED_BORDER, Palette.gray900);
  }

  // default
  if (isDark) {
    return createChoiceAppearance(DARK_DEFAULT_BG, DARK_DEFAULT_BORDER, palette.text);
  }
  return createChoiceAppearance(LIGHT_DEFAULT_BG, LIGHT_DEFAULT_BORDER, Palette.gray900);
};

type TimerState = 'default' | 'warning' | 'danger';

type TimerAppearance = {
  state: TimerState;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
};

const TIMER_COLORS = {
  default: {
    text: '#4A4A4A',
    lightBg: '#F5F5F5',
    darkBg: 'rgba(112, 112, 112, 0.25)',
    lightBorder: '#E0E0E0',
    darkBorder: 'rgba(112, 112, 112, 0.45)',
  },
  warning: {
    text: '#FFB020',
    lightBg: 'rgba(255, 176, 32, 0.12)',
    darkBg: 'rgba(255, 176, 32, 0.3)',
    lightBorder: 'rgba(255, 176, 32, 0.4)',
    darkBorder: 'rgba(255, 176, 32, 0.55)',
  },
  danger: {
    text: '#E53935',
    lightBg: 'rgba(229, 57, 53, 0.12)',
    darkBg: 'rgba(229, 57, 53, 0.3)',
    lightBorder: 'rgba(229, 57, 53, 0.4)',
    darkBorder: 'rgba(229, 57, 53, 0.55)',
  },
} as const;

const resolveTimerAppearance = (
  mode: ColorMode,
  timerMode: TimerMode | null,
  secondsLeft: number | null
): TimerAppearance => {
  let state: TimerState = 'default';
  if (timerMode === 'timed' && secondsLeft !== null) {
    if (secondsLeft <= 2) {
      state = 'danger';
    } else if (secondsLeft <= 5) {
      state = 'warning';
    }
  }

  const isDark = mode === 'dark';
  const values = TIMER_COLORS[state];

  return {
    state,
    textColor: state === 'default' ? (isDark ? '#FFFFFF' : values.text) : values.text,
    backgroundColor: isDark ? values.darkBg : values.lightBg,
    borderColor: isDark ? values.darkBorder : values.lightBorder,
  };
};

type SummaryStatus = 'correct' | 'incorrect' | 'skipped';

type SummaryAppearance = {
  backgroundColor: string;
  borderColor: string;
  badgeBackgroundColor: string;
  badgeTextColor: string;
  answerTextColor: string;
  explanationBackgroundColor: string;
};

const SUMMARY_STATUS_COLORS = {
  correct: {
    lightBg: 'rgba(76, 195, 138, 0.14)',
    darkBg: 'rgba(76, 195, 138, 0.22)',
    lightBorder: 'rgba(76, 195, 138, 0.4)',
    darkBorder: 'rgba(76, 195, 138, 0.5)',
    badge: '#2E9F6E',
    answer: '#2E9F6E',
  },
  incorrect: {
    lightBg: 'rgba(228, 94, 94, 0.14)',
    darkBg: 'rgba(228, 94, 94, 0.24)',
    lightBorder: 'rgba(228, 94, 94, 0.4)',
    darkBorder: 'rgba(228, 94, 94, 0.5)',
    badge: '#E45E5E',
    answer: '#C44747',
  },
  skipped: {
    lightBg: 'rgba(112, 112, 112, 0.08)',
    darkBg: 'rgba(112, 112, 112, 0.2)',
    lightBorder: 'rgba(112, 112, 112, 0.28)',
    darkBorder: 'rgba(112, 112, 112, 0.4)',
    badge: '#808080',
    answer: '#707070',
  },
} as const;

type DailyHistoryPayload = {
  date: string;
  correct: number;
  total: number;
  timerMode?: string;
  durationMs?: number;
  category?: string;
};

type DailyQuizActions = {
  updateStats: (params: { correct: number; total?: number; sessionId?: string }) => Promise<unknown> | void;
  logStreak: (params: { mode: 'daily'; answered?: number; dateKey?: string }) => Promise<unknown> | void;
  logHistory: (params: {
    mode: 'daily';
    sessionId: string;
    data: DailyHistoryPayload;
  }) => Promise<unknown> | void;
};

const getSummaryAppearance = (mode: ColorMode, status: SummaryStatus): SummaryAppearance => {
  const isDark = mode === 'dark';
  const palette = SUMMARY_STATUS_COLORS[status];
  return {
    backgroundColor: isDark ? palette.darkBg : palette.lightBg,
    borderColor: isDark ? palette.darkBorder : palette.lightBorder,
    badgeBackgroundColor: palette.badge,
    badgeTextColor: '#FFFFFF',
    answerTextColor: palette.answer,
    explanationBackgroundColor: isDark ? 'rgba(255,255,255,0.05)' : Palette.gray25,
  };
};

function DailyQuizScreenContent({ updateStats, logStreak, logHistory }: DailyQuizActions) {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const resolvedDate = Array.isArray(params.date) ? params.date[0] : params.date;
  const tint = useThemeColor({}, 'tint');
  const dailyQuiz = useDailyQuiz(resolvedDate);
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const mutedText = useThemeColor({}, 'textMuted');
  const themedStyles = useMemo(() => getDailyThemeStyles(colorScheme), [colorScheme]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [timerMode, setTimerMode] = useState<TimerMode | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<boolean | null>(null);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const shareTemplate = dailyQuiz?.shareTemplate ?? null;
  const { status: authStatus } = useAuth();
  const [quizStartedAt, setQuizStartedAt] = useState<number | null>(null);
  const [quizDurationMs, setQuizDurationMs] = useState<number | null>(null);
  const historyLoggedRef = useRef<string | null>(null);
  const streakLoggedRef = useRef(false);
  const statsLoggedRef = useRef<string | null>(null);
  const xpStoredRef = useRef<string | null>(null);
  const perfectCelebratedRef = useRef(false);
  const [awardedXp, setAwardedXp] = useState<number | null>(null);

  // 타이머 pulse 애니메이션
  const timerPulseOpacity = useSharedValue(1);
  const timerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: timerPulseOpacity.value,
    };
  });

  // 완주 celebration 애니메이션
  const celebrationScale = useSharedValue(1);
  const celebrationAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: celebrationScale.value }],
    };
  });

  const trueChoiceScale = useSharedValue(1);
  const falseChoiceScale = useSharedValue(1);
  const trueChoiceTranslate = useSharedValue(0);
  const falseChoiceTranslate = useSharedValue(0);

  const trueChoiceAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: trueChoiceTranslate.value },
        { scale: trueChoiceScale.value },
      ],
    };
  });

  const falseChoiceAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: falseChoiceTranslate.value },
        { scale: falseChoiceScale.value },
      ],
    };
  });

  useEffect(() => {
    if (!dailyQuiz) {
      return;
    }
    setPhase('intro');
    setTimerMode(null);
    setQuestionTimeLeft(null);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setResults([]);
    setQuizStartedAt(null);
    setQuizDurationMs(null);
    historyLoggedRef.current = null;
  }, [dailyQuiz]);

  const questions = useMemo<DailyQuestion[]>(() => {
    if (!dailyQuiz?.questions) {
      return [];
    }
    return dailyQuiz.questions as unknown as DailyQuestion[];
  }, [dailyQuiz?.questions]);
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];
  const correctAnswer = currentQuestion ? currentQuestion.correctAnswer : null;
  const dailySessionKey = useMemo(() => {
    if (!dailyQuiz) {
      return null;
    }
    const dateKey =
      dailyQuiz.availableDate ??
      resolvedDate ??
      new Date().toISOString().slice(0, 10);
    return `daily:${dateKey}`;
  }, [dailyQuiz, resolvedDate]);
  const formatBooleanAnswer = useCallback(
    (value: boolean) => (value ? 'O' : 'X'),
    []
  );

  const recordResult = useCallback((question: DailyQuestion, selection: boolean | null, isCorrect: boolean) => {
    setResults((prev) => {
      const filtered = prev.filter((entry) => entry.questionId !== question.id);
      return [
        ...filtered,
        {
          questionId: question.id,
          selection,
          correctAnswer: question.correctAnswer,
          isCorrect,
        },
      ];
    });
  }, []);

  const handleReveal = useCallback(
    (question: DailyQuestion, selection: boolean | null) => {
      const isCorrect = selection !== null && selection === question.correctAnswer;
      recordResult(question, selection, Boolean(isCorrect));
      setSelectedAnswer(selection);
      setPhase('reveal');

      // 햅틱 피드백
      if (isCorrect) {
        lightHaptic(); // 정답 시 가벼운 햅틱
      } else {
        mediumHaptic(); // 오답 시 중간 햅틱
      }
    },
    [recordResult],
  );

  useEffect(() => {
    if (phase === 'intro' || phase === 'question') {
      trueChoiceScale.value = withTiming(1, { duration: 150 });
      falseChoiceScale.value = withTiming(1, { duration: 150 });
      trueChoiceTranslate.value = withTiming(0, { duration: 150 });
      falseChoiceTranslate.value = withTiming(0, { duration: 150 });
      return;
    }
    if (correctAnswer === null) {
      return;
    }

    const correctScale = correctAnswer ? trueChoiceScale : falseChoiceScale;
    correctScale.value = withSequence(
      withTiming(1.08, { duration: 180 }),
      withTiming(1, { duration: 220 })
    );

    if (selectedAnswer !== null && selectedAnswer !== correctAnswer) {
      const wrongTranslate = selectedAnswer ? trueChoiceTranslate : falseChoiceTranslate;
      wrongTranslate.value = withSequence(
        withTiming(-6, { duration: 70 }),
        withTiming(6, { duration: 70 }),
        withTiming(-3, { duration: 60 }),
        withTiming(0, { duration: 110 })
      );
    }
  }, [
    correctAnswer,
    falseChoiceScale,
    falseChoiceTranslate,
    phase,
    selectedAnswer,
    trueChoiceScale,
    trueChoiceTranslate,
  ]);

  useEffect(() => {
    if (timerMode !== 'timed') return;
    if (phase === 'intro' || phase === 'finished') return;
    if (phase !== 'question') return;
    const timer = setInterval(() => {
      setQuestionTimeLeft((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        const next = prev - 1;
        // 5초, 4초, 3초일 때 경고 햅틱
        if (next <= 5 && next >= 3) {
          warningHaptic();
          // Pulse 애니메이션 시작
          timerPulseOpacity.value = withSequence(
            withTiming(0.5, { duration: 250 }),
            withTiming(1, { duration: 250 })
          );
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, timerMode]);

  useEffect(() => {
    if (timerMode !== 'timed') return;
    if (phase === 'intro' || phase === 'finished') return;
    if (phase !== 'question') return;
    if (!currentQuestion) return;
    if (questionTimeLeft === 0) {
      handleReveal(currentQuestion, null);
    }
  }, [currentQuestion, handleReveal, phase, questionTimeLeft, timerMode]);

  const handleAnswerPress = useCallback(
    (value: boolean) => {
      if (!currentQuestion || phase !== 'question') return;
      handleReveal(currentQuestion, value);
    },
    [currentQuestion, handleReveal, phase],
  );

  const goToQuestion = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalQuestions) {
        return;
      }
      setCurrentIndex(index);
      setSelectedAnswer(null);
      setQuestionTimeLeft(timerMode === 'timed' ? QUESTION_TIME_LIMIT : null);
      setPhase('question');
    },
    [timerMode, totalQuestions],
  );

  const startQuiz = useCallback(
    (mode: TimerMode) => {
      if (!dailyQuiz) return;
      setTimerMode(mode);
      setQuestionTimeLeft(mode === 'timed' ? QUESTION_TIME_LIMIT : null);
      setResults([]);
      setSelectedAnswer(null);
      setCurrentIndex(0);
      setPhase('question');
      setQuizStartedAt(Date.now());
      setQuizDurationMs(null);
      historyLoggedRef.current = null;
    },
    [dailyQuiz],
  );

  const sortedResults = useMemo(() => {
    const order = new Map(questions.map((q, index) => [q.id, index]));
    return [...results].sort((a, b) => {
      const aIndex = order.get(a.questionId) ?? 0;
      const bIndex = order.get(b.questionId) ?? 0;
      return aIndex - bIndex;
    });
  }, [questions, results]);

  const correctCount = sortedResults.filter((entry) => entry.isCorrect).length;
  const totalAnswered = sortedResults.length;
  const isPerfect = totalQuestions > 0 && correctCount === totalQuestions;
  useEffect(() => {
    if (!dailySessionKey) {
      setAwardedXp(null);
      return;
    }
    const dateKey = dailySessionKey.replace(/^daily:/, '');
    void AsyncStorage.getItem(`daily:xp:${dateKey}`)
      .then((value) => {
        setAwardedXp(value ? Number(value) : null);
      })
      .catch(() => setAwardedXp(null));
  }, [dailySessionKey]);
  const totalDurationDisplay = useMemo(() => {
    if (quizDurationMs === null) {
      return '--';
    }
    return formatDuration(quizDurationMs);
  }, [quizDurationMs]);

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      statsLoggedRef.current = null;
      return;
    }
    if (phase !== 'finished' || correctCount <= 0 || !dailySessionKey) return;
    if (statsLoggedRef.current === dailySessionKey) return;

    statsLoggedRef.current = dailySessionKey;
    void (async () => {
      try {
        await updateStats({ correct: correctCount, total: totalQuestions, sessionId: dailySessionKey });
      } catch (err) {
        console.warn('Failed to update daily stats', err);
        statsLoggedRef.current = null;
      }
    })();
  }, [authStatus, phase, correctCount, totalQuestions, updateStats, dailySessionKey]);

  useEffect(() => {
    if (phase !== 'finished') {
      streakLoggedRef.current = false;
      return;
    }
    if (authStatus !== 'authenticated') return;
    if (streakLoggedRef.current) return;
    streakLoggedRef.current = true;
    void (async () => {
      try {
        await logStreak({ mode: 'daily' });
        if (dailySessionKey) {
          const dateKey = dailySessionKey.replace(/^daily:/, '');
          await AsyncStorage.setItem(`daily:completed:${dateKey}`, '1');
        }
      } catch (error) {
        console.warn('Failed to log daily streak', error);
        streakLoggedRef.current = false;
      }
    })();
  }, [authStatus, phase, logStreak, dailySessionKey]);

  useEffect(() => {
    if (phase === 'finished' && quizDurationMs === null && quizStartedAt !== null) {
      setQuizDurationMs(Date.now() - quizStartedAt);
    }
  }, [phase, quizDurationMs, quizStartedAt]);

  useEffect(() => {
    if (phase !== 'finished') {
      historyLoggedRef.current = null;
      xpStoredRef.current = null;
      return;
    }
    if (authStatus !== 'authenticated') return;
    if (!dailyQuiz || !dailySessionKey) return;
    if (historyLoggedRef.current === dailySessionKey) return;

    const dateKey = dailySessionKey.replace(/^daily:/, '');
    const durationMs = quizDurationMs ?? (quizStartedAt ? Date.now() - quizStartedAt : undefined);
    historyLoggedRef.current = dailySessionKey;
    void (async () => {
      try {
        await logHistory({
          mode: 'daily',
          sessionId: dailySessionKey,
          data: {
            date: dateKey,
            correct: correctCount,
            total: totalQuestions,
            timerMode: timerMode ?? 'untimed',
            durationMs,
            category: dailyQuiz.category ?? undefined,
          },
        });
      } catch (error) {
        console.warn('Failed to log daily history', error);
        historyLoggedRef.current = null;
      }
    })();
  }, [
    authStatus,
    correctCount,
    dailyQuiz,
    dailySessionKey,
    logHistory,
    phase,
    quizDurationMs,
    quizStartedAt,
    timerMode,
    totalQuestions,
  ]);

  useEffect(() => {
    if (phase !== 'finished') return;
    if (!dailySessionKey) return;
    if (xpStoredRef.current === dailySessionKey) return;
    const dateKey = dailySessionKey.replace(/^daily:/, '');
    const perAnswerXp = correctCount * PER_ANSWER_XP;
    const completionXp = totalQuestions > 0 ? COMPLETION_XP : 0;
    const perfectXp = isPerfect ? PERFECT_BONUS_XP : 0;
    const totalXpEarned = perAnswerXp + completionXp + perfectXp;
    xpStoredRef.current = dailySessionKey;
    void AsyncStorage.setItem(`daily:xp:${dateKey}`, String(totalXpEarned))
      .then(() => setAwardedXp(totalXpEarned))
      .catch(() => {
        xpStoredRef.current = null;
      });
  }, [correctCount, dailySessionKey, isPerfect, phase, totalQuestions]);
  const unansweredCount = totalQuestions - totalAnswered;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const allAnswered = unansweredCount === 0;

  const handleNext = useCallback(() => {
    if (!dailyQuiz) return;
    if (!isLastQuestion) {
      goToQuestion(currentIndex + 1);
      return;
    }
    if (quizStartedAt !== null) {
      setQuizDurationMs(Date.now() - quizStartedAt);
    }
    setPhase('finished');
    successHaptic(); // 완주 시 성공 햅틱
  }, [currentIndex, dailyQuiz, goToQuestion, isLastQuestion, quizStartedAt]);

  const handleReset = useCallback(() => {
    setPhase('intro');
    setTimerMode(null);
    setQuestionTimeLeft(null);
    setResults([]);
    setSelectedAnswer(null);
    setCurrentIndex(0);
    setQuizStartedAt(null);
    setQuizDurationMs(null);
    historyLoggedRef.current = null;
  }, []);

  useEffect(() => {
    if (phase === 'finished') {
      celebrationScale.value = 1;
      celebrationScale.value = withSequence(
        withTiming(1.05, { duration: 450 }),
        withTiming(1, { duration: 450 })
      );
      if (isPerfect && !perfectCelebratedRef.current) {
        perfectCelebratedRef.current = true;
        successHaptic();
      }
    } else {
      perfectCelebratedRef.current = false;
    }
  }, [celebrationScale, isPerfect, phase]);

  const shareEmoji = shareTemplate?.emoji ?? '⚡';
  const shareHeadline = shareTemplate?.headline ?? '문제당 10초 스피드런!';
  const shareCta = shareTemplate?.cta ?? '친구 초대';
  const categoryDisplay = useMemo(() => {
    const fallback: { label: string; icon: IconSymbolName } = { label: '--', icon: 'lightbulb' };
    if (!dailyQuiz?.category) {
      return fallback;
    }
    const resolved = resolveDailyCategoryCopy(dailyQuiz.category);
    const label = resolved?.label ?? dailyQuiz.category ?? fallback.label;
    const icon = DAILY_CATEGORY_ICONS[dailyQuiz.category as DailyCategory] ?? fallback.icon;
    return { label, icon };
  }, [dailyQuiz?.category]);

  const deepLink = useMemo(() => {
    if (!dailyQuiz?.availableDate) {
      return 'quizroom://daily';
    }
    return `quizroom://daily?date=${dailyQuiz.availableDate}`;
  }, [dailyQuiz?.availableDate]);

  const handleShare = useCallback(async () => {
    if (!dailyQuiz) return;
    const shareMessage =
      `${shareEmoji} ${shareHeadline}\n` +
      `오늘 퀴즈에서 ${totalQuestions}문제 중 ${correctCount}문제를 맞췄어요!\n` +
      `같이 도전해볼래? ${deepLink}`;
    try {
      await Share.share({
        message: shareMessage,
      });
    } catch (error) {
      Alert.alert(
        '공유에 실패했어요',
        error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.'
      );
    }
  }, [correctCount, dailyQuiz, deepLink, shareEmoji, shareHeadline, totalQuestions]);

  const handleResultPress = () => {
    if (!allAnswered) {
      Alert.alert('아직 풀지 않은 문제가 있어요', '모든 문제를 풀고 결과를 확인해보세요.');
      return;
    }
    if (quizStartedAt !== null) {
      setQuizDurationMs(Date.now() - quizStartedAt);
    }
    setPhase('finished');
  };

  const timerAppearance = useMemo(
    () => resolveTimerAppearance(colorScheme, timerMode, questionTimeLeft),
    [colorScheme, questionTimeLeft, timerMode]
  );
  const shouldPulse =
    timerMode === 'timed' &&
    (timerAppearance.state === 'warning' || timerAppearance.state === 'danger');

  useEffect(() => {
    if (!shouldPulse) {
      timerPulseOpacity.value = withTiming(1, { duration: 150 });
    }
  }, [shouldPulse, timerPulseOpacity]);

  if (dailyQuiz === undefined) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tint} />
        <ThemedText style={styles.loadingLabel}>오늘의 퀴즈를 불러오는 중…</ThemedText>
      </ThemedView>
    );
  }

  if (!dailyQuiz || totalQuestions === 0) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText type="title">오늘의 퀴즈가 준비되지 않았어요</ThemedText>
        <ThemedText style={styles.loadingLabel}>잠시 후 다시 시도해주세요.</ThemedText>
        <Pressable style={[styles.retryButton, themedStyles.retryButton]} onPress={() => router.back()}>
          <ThemedText style={[styles.retryLabel, themedStyles.retryLabel]}>
            돌아가기
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (phase === 'intro') {
    return (
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + Spacing.xl, paddingBottom: Spacing.xl + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.introCard, themedStyles.introCard]}>
            <ThemedText type="title">오늘의 퀴즈 시작</ThemedText>
            <ThemedText style={styles.introSubtitle}>
              시간 제한을 선택하고 시작해보세요. 타임어택에서는 문항당 10초 안에 답해야 해요.
            </ThemedText>
            <View
              style={[
                styles.xpCard,
                { backgroundColor: palette.cardElevated, borderColor: palette.border },
              ]}
            >
              <View style={styles.xpCardHeader}>
                <IconSymbol name="sparkles" size={18} color={palette.primary} />
                <ThemedText style={styles.xpCardTitle}>XP 지급 규칙</ThemedText>
              </View>
              <View style={styles.xpRewards}>
                <ThemedText style={styles.xpRewardRow}>정답 1개당 +{PER_ANSWER_XP} XP</ThemedText>
                <ThemedText style={styles.xpRewardRow}>끝까지 완주하면 +{COMPLETION_XP} XP</ThemedText>
                <ThemedText style={styles.xpRewardRow}>전부 정답이면 추가 +{PERFECT_BONUS_XP} XP</ThemedText>
              </View>
              <ThemedText style={[styles.xpFootnote, { color: mutedText }]}>
                XP는 하루 1회만 지급돼요
              </ThemedText>
            </View>
            <View style={styles.introButtons}>
              <Button
                size="lg"
                fullWidth
                style={[styles.introButton, themedStyles.introButton, themedStyles.introTimed]}
                textStyle={[styles.introButtonLabel, themedStyles.introTimedText]}
                contentStyle={styles.introButtonContent}
                pressedStyle={styles.introButtonPressed}
                onPress={() => startQuiz('timed')}
              >
                <>
                  10초 타임어택
                  {'\n'}
                  <Text style={[styles.introButtonCaption, themedStyles.introTimedCaption]}>
                    긴장감 넘치는 시간 제한 모드
                  </Text>
                </>
              </Button>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                style={[styles.introButton, themedStyles.introButton, themedStyles.introUntimed]}
                textStyle={[styles.introButtonLabel, themedStyles.introUntimedLabel]}
                contentStyle={styles.introButtonContent}
                pressedStyle={styles.introButtonPressed}
                onPress={() => startQuiz('untimed')}
              >
                <>
                  시간 제한 없음
                  {'\n'}
                  <Text style={[styles.introButtonCaption, themedStyles.introUntimedCaption]}>
                    여유롭게 문제를 풀어보세요
                  </Text>
                </>
              </Button>
            </View>
          </View>
        </ScrollView>
        <View style={styles.footerRow}>
          <Button
            variant="outline"
            fullWidth
            size="lg"
            style={styles.flexButton}
            onPress={() => router.back()}
          >
            돌아가기
          </Button>
        </View>
      </ThemedView>
    );
  }

  if (phase === 'finished') {
    const perAnswerXp = correctCount * PER_ANSWER_XP;
    const completionXp = totalQuestions > 0 ? COMPLETION_XP : 0;
    const perfectXp = isPerfect ? PERFECT_BONUS_XP : 0;
    const totalXpEarned = perAnswerXp + completionXp + perfectXp;

    return (
      <ThemedView style={[styles.container, styles.summaryContainer]}>
        <ScrollView
          contentContainerStyle={[
            styles.summaryContent,
            { paddingTop: insets.top + Spacing.lg, paddingBottom: Spacing.xl + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <ThemedText type="title">
              오늘의 퀴즈 결과
            </ThemedText>
          </View>
          {isPerfect ? (
            <Animated.View
              style={[
                styles.perfectBanner,
                celebrationAnimatedStyle,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.primary,
                  borderWidth: 1,
                },
              ]}
            >
              <ThemedText
                style={styles.perfectBannerText}
                lightColor={palette.primary}
                darkColor={palette.primary}
              >
                퍼펙트! 💯
              </ThemedText>
            </Animated.View>
          ) : null}
          <View style={styles.summaryStats}>
            <View style={styles.summaryStatsRow}>
              <View style={[styles.summaryStatCard, themedStyles.summaryStatCard]}>
                <ThemedText style={styles.summaryStatLabel}>카테고리</ThemedText>
                <View style={styles.summaryCategoryRow}>
                  <IconSymbol name={categoryDisplay.icon} size={22} color={palette.text} />
                  <ThemedText type="subtitle">{categoryDisplay.label}</ThemedText>
                </View>
              </View>
              <View style={[styles.summaryStatCard, themedStyles.summaryStatCard]}>
                <ThemedText style={styles.summaryStatLabel}>정답률</ThemedText>
                <ThemedText type="subtitle">
                  {totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}% - {correctCount}/{totalQuestions}
                </ThemedText>
              </View>
            </View>
            <View style={styles.summaryStatsRow}>
              {awardedXp === null ? (
                <View style={[styles.summaryStatCard, themedStyles.summaryStatCard]}>
                  <ThemedText style={styles.summaryStatLabel}>획득 XP</ThemedText>
                  <ThemedText type="subtitle">{totalXpEarned}</ThemedText>
                </View>
              ) : null}
              <View style={[styles.summaryStatCard, themedStyles.summaryStatCard]}>
                <ThemedText style={styles.summaryStatLabel}>소요 시간</ThemedText>
                <ThemedText type="subtitle">{totalDurationDisplay}</ThemedText>
              </View>
            </View>
          </View>
          <View style={styles.summaryList}>
            {questions.map((question, index) => {
              const result = sortedResults.find((entry) => entry.questionId === question.id);
              const answerLabel = formatBooleanAnswer(question.correctAnswer);
              const selection = result?.selection;
              const hasSelection = selection !== null && selection !== undefined;
              const selectionLabel = hasSelection ? formatBooleanAnswer(selection) : null;
              const summaryStatus: SummaryStatus = result
                ? result.isCorrect
                  ? 'correct'
                  : 'incorrect'
                : 'skipped';
              const appearance = getSummaryAppearance(colorScheme, summaryStatus);
              const statusLabel = result ? (result.isCorrect ? '정답' : '오답') : '미응답';
              return (
                <View
                  key={question.id}
                  style={[
                    styles.summaryRow,
                    {
                      backgroundColor: appearance.backgroundColor,
                      borderColor: appearance.borderColor,
                    },
                  ]}
                >
                  <View style={styles.summaryRowHeader}>
                    <ThemedText style={styles.summaryRowIndex}>Q{index + 1}</ThemedText>
                    <View
                      style={[styles.summaryStatusBadge, { backgroundColor: appearance.badgeBackgroundColor }]}
                    >
                      <ThemedText
                        style={[styles.summaryStatusBadgeText, { color: appearance.badgeTextColor }]}
                      >
                        {statusLabel}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={styles.summaryQuestion}>{question.prompt}</ThemedText>
                  <View style={styles.summaryAnswers}>
                    <View style={styles.summaryAnswerRow}>
                      <ThemedText style={styles.summaryAnswerLabel}>정답</ThemedText>
                      <ThemedText style={styles.summaryAnswerValue}>{answerLabel}</ThemedText>
                    </View>
                    <View style={styles.summaryAnswerRow}>
                      <ThemedText style={styles.summaryAnswerLabel}>내 답</ThemedText>
                      <ThemedText
                        style={[styles.summaryAnswerValue, { color: appearance.answerTextColor }]}
                      >
                        {selectionLabel ?? '응답 없음'}
                      </ThemedText>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.summaryExplanationBox,
                      { backgroundColor: appearance.explanationBackgroundColor },
                    ]}
                  >
                    <ThemedText style={styles.summaryExplanationLabel}>해설</ThemedText>
                    <ThemedText style={styles.summaryExplanationText}>{question.explanation}</ThemedText>
                  </View>
                </View>
              );
            })}
          </View>
          {/* <View style={[styles.shareCard, themedStyles.shareCard]}>
            <ThemedText style={styles.shareEmoji}>{shareEmoji}</ThemedText>
            <ThemedText style={styles.shareHeadline}>{shareHeadline}</ThemedText>
            <ThemedText style={styles.shareBody}>
              {totalQuestions}문제 중 {correctCount}문제 정답! 링크를 공유하면 친구도 오늘 퀴즈에 참여할 수 있어요.
            </ThemedText>
            <Pressable style={[styles.shareButton, themedStyles.shareButton]} onPress={handleShare}>
              <ThemedText style={[styles.shareButtonLabel, themedStyles.shareButtonLabel]}>
                {shareCta}
              </ThemedText>
            </Pressable>
          </View> */}
        </ScrollView>
        <View style={styles.footerRow}>
          <Button
            variant="outline"
            size="lg"
            style={styles.flexButton}
            onPress={handleReset}
          >
            다시 풀기
          </Button>
          <Link href="/(tabs)/home" asChild>
            <Button size="lg" style={styles.flexButton}>
              홈으로
            </Button>
          </Link>
        </View>
      </ThemedView>
    );
  }

  if (!currentQuestion) {
    Alert.alert('퀴즈를 불러오지 못했습니다.', '잠시 후 다시 시도해주세요.', [
      { text: '확인', onPress: () => router.back() },
    ]);
    return null;
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.md,
            paddingBottom: Spacing.xxl + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metaRow}>
          <View style={[styles.badge, themedStyles.badge]}>
            <ThemedText style={[styles.badgeText, themedStyles.badgeText]}>Q{currentIndex + 1} / {totalQuestions}</ThemedText>
          </View>
          <Animated.View
            style={[
              styles.timerPill,
              themedStyles.timerPill,
              {
                backgroundColor: timerAppearance.backgroundColor,
                borderColor: timerAppearance.borderColor,
              },
              shouldPulse ? timerAnimatedStyle : null,
            ]}
          >
            {timerMode === 'timed' ? (
              <ThemedText
                style={styles.timerText}
                lightColor={timerAppearance.textColor}
                darkColor={timerAppearance.textColor}
              >
                남은 시간 {formatSeconds(questionTimeLeft ?? 0)}
              </ThemedText>
            ) : (
              <ThemedText
                style={styles.timerText}
                lightColor={timerAppearance.textColor}
                darkColor={timerAppearance.textColor}
              >
                시간 제한 없음
              </ThemedText>
            )}
          </Animated.View>
        </View>

        <View style={styles.questionCard}>
          <ThemedText type="subtitle" style={styles.questionPrompt}>
            {currentQuestion.prompt}
          </ThemedText>
          <View style={styles.choiceList}>
            {[true, false].map((value) => {
              const isSelected = selectedAnswer === value;
              const isCorrectChoice = phase !== 'question' && value === correctAnswer;
              const isIncorrectSelection =
                phase !== 'question' && isSelected && value !== correctAnswer;
              return (
                <Pressable
                  key={value ? 'true' : 'false'}
                  onPress={() => handleAnswerPress(value)}
                  disabled={phase !== 'question'}
                >
                  {({ pressed }) => {
                    const state: ChoiceState =
                      phase === 'question'
                        ? (pressed ? 'pressed' : 'default')
                        : isCorrectChoice
                          ? 'correct'
                          : isIncorrectSelection
                            ? 'wrong'
                            : 'dim';
                    const appearance = getChoiceAppearance(colorScheme, state);
                    const glyph = value ? 'O' : 'X';
                    const borderColor = appearance.gradientColors
                      ? appearance.gradientColors[1]
                      : appearance.borderColor;
                    const shellBackground =
                      appearance.gradientColors?.[0] ?? appearance.backgroundColor;
                    const animatedStyle =
                      value ? trueChoiceAnimatedStyle : falseChoiceAnimatedStyle;
                    let glowStyle =
                      state === 'correct'
                        ? styles.choiceGlowSuccess
                        : state === 'wrong'
                          ? styles.choiceGlowError
                          : null;

                    let feedbackLabel: string | null = null;
                    let feedbackColor = appearance.textColor;
                    if (phase !== 'question') {
                      if (isCorrectChoice) {
                        feedbackLabel = isSelected ? '정답!' : '정답';
                        feedbackColor = '#FFFFFF';
                      } else if (isIncorrectSelection) {
                        feedbackLabel = '오답';
                        feedbackColor = '#FFFFFF';
                      }
                    }

                    return (
                      <Animated.View
                        style={[
                          styles.choiceButton,
                          animatedStyle,
                          glowStyle,
                          { borderColor, backgroundColor: shellBackground },
                        ]}
                      >
                        {appearance.gradientColors ? (
                          <LinearGradient
                            colors={appearance.gradientColors}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={styles.choiceInner}
                          >
                            <ThemedText
                              style={styles.choiceGlyph}
                              lightColor={appearance.textColor}
                              darkColor={appearance.textColor}
                            >
                              {glyph}
                            </ThemedText>
                            {feedbackLabel ? (
                              <ThemedText
                                style={styles.choiceFeedback}
                                lightColor={feedbackColor}
                                darkColor={feedbackColor}
                              >
                                {feedbackLabel}
                              </ThemedText>
                            ) : null}
                          </LinearGradient>
                        ) : (
                          <View
                            style={[
                              styles.choiceInner,
                              { backgroundColor: appearance.backgroundColor },
                            ]}
                          >
                            <ThemedText
                              style={styles.choiceGlyph}
                              lightColor={appearance.textColor}
                              darkColor={appearance.textColor}
                            >
                              {glyph}
                            </ThemedText>
                            {feedbackLabel ? (
                              <ThemedText
                                style={styles.choiceFeedback}
                                lightColor={feedbackColor}
                                darkColor={feedbackColor}
                              >
                                {feedbackLabel}
                              </ThemedText>
                            ) : null}
                          </View>
                        )}
                      </Animated.View>
                    );
                  }}
                </Pressable>
              );
            })}
          </View>
        </View>

        {phase !== 'question' ? (
          <View style={[styles.explanationCard, themedStyles.explanationCard]}>
            <ThemedText style={styles.explanationTitle}>해설</ThemedText>
            <ThemedText style={styles.explanationBody}>{currentQuestion.explanation}</ThemedText>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footerRow}>
        <Button
          variant="outline"
          size="lg"
          style={styles.flexButton}
          onPress={() => router.back()}
        >
          나가기
        </Button>
        {!isLastQuestion ? (
          <Button
            size="lg"
            style={styles.flexButton}
            disabled={phase === 'question'}
            onPress={handleNext}
          >
            다음 문제
          </Button>
        ) : (
          <Button
            size="lg"
            style={styles.flexButton}
            disabled={!allAnswered || phase === 'question'}
            onPress={handleResultPress}
          >
            결과 보기
          </Button>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    gap: Spacing.lg,
  },
  content: {
    flexGrow: 1,
    gap: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  loadingLabel: {
    textAlign: 'center',
  },
  introCard: {
    gap: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  introSubtitle: {
    lineHeight: 22,
    opacity: 0.9,
  },
  introButtons: {
    gap: Spacing.md,
  },
  introButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  introButtonContent: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: Spacing.xs,
  },
  introButtonLabel: {
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'left',
  },
  introButtonCaption: {
    fontSize: 13,
    opacity: 0.9,
  },
  introButtonPressed: {
    opacity: 0.96,
  },
  xpCard: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.gray200,
    backgroundColor: Palette.gray50,
    gap: Spacing.xs,
  },
  xpCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  xpCardTitle: {
    fontWeight: '700',
  },
  xpRewards: {
    gap: 4,
  },
  xpRewardRow: {
    fontWeight: '500',
  },
  xpTotal: {
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
  xpFootnote: {
    fontSize: 12,
    color: Palette.gray600,
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
  },
  retryLabel: {
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  badgeText: {
    fontWeight: '600',
  },
  timerPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  timerText: {
    fontWeight: '600',
  },
  questionCard: {
    gap: Spacing.lg,
  },
  questionPrompt: {
    fontSize: 20,
    lineHeight: 28,
  },
  choiceList: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginVertical: Spacing.xl,
  },
  choiceButton: {
    flexBasis: '48%',
    aspectRatio: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  choiceInner: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  choiceGlyph: {
    fontWeight: '700',
    fontSize: 64,
    lineHeight: 64,
  },
  choiceFeedback: {
    fontWeight: '600',
    fontSize: 15,
    marginTop: Spacing.xs,
  },
  choiceGlowSuccess: {
    borderWidth: 2,
    shadowColor: '#56CCF2',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  choiceGlowError: {
    borderWidth: 2,
    shadowColor: '#FF6A6A',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  explanationCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  explanationTitle: {
    fontWeight: '600',
  },
  explanationBody: {
    lineHeight: 20,
  },
  footerRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  flexButton: {
    flex: 1,
  },
  summaryContent: {
    flexGrow: 1,
    gap: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  summaryContainer: {
    paddingTop: 0,
    gap: 0,
  },
  summaryStats: {
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  summaryStatCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
    minWidth: 160,
  },
  summaryCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryStatLabel: {
    fontWeight: '600',
    opacity: 0.8,
  },
  summaryList: {
    gap: Spacing.xl,
  },
  perfectBanner: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
  },
  perfectBannerText: {
    fontWeight: '700',
  },
  summaryRow: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  summaryRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryRowIndex: {
    fontWeight: '700',
  },
  summaryStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  summaryStatusBadgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  summaryQuestion: {
    fontWeight: '600',
    lineHeight: 22,
  },
  summaryAnswers: {
    gap: Spacing.xs,
  },
  summaryAnswerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryAnswerLabel: {
    fontWeight: '600',
    opacity: 0.7,
    minWidth: 56,
  },
  summaryAnswerValue: {
    flex: 1,
    fontWeight: '500',
  },
  summaryExplanationBox: {
    padding: Spacing.sm,
    borderRadius: Radius.md,
    gap: 4,
  },
  summaryExplanationLabel: {
    fontWeight: '600',
    opacity: 0.75,
  },
  summaryExplanationText: {
    lineHeight: 18,
  },
  shareCard: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  shareEmoji: {
    fontSize: 32,
  },
  shareHeadline: {
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
  },
  shareBody: {
    textAlign: 'center',
    opacity: 0.85,
    lineHeight: 20,
  },
  shareButton: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
  },
  shareButtonLabel: {
    fontWeight: '600',
  },
});

function ConvexDailyQuizScreen() {
  const updateStats = useMutation(api.users.updateStats);
  const logStreak = useMutation(api.users.logStreakProgress);
  const logHistory = useMutation(api.history.logEntry);

  return (
    <DailyQuizScreenContent
      updateStats={updateStats}
      logStreak={logStreak}
      logHistory={logHistory}
    />
  );
}

function SupabaseDailyQuizScreen() {
  const logSupabaseHistory = useLogQuizHistory();
  const { status: authStatus, applyUserDelta, user } = useAuth();
  const noopUpdateStats = useCallback(
    async (_params: { correct: number; total?: number; sessionId?: string }) => undefined,
    []
  );
  const noopLogStreak = useCallback(
    async (_params: { mode: 'daily'; answered?: number; dateKey?: string }) => undefined,
    []
  );
  const handleLogHistory = useCallback(
    async (params: { mode: 'daily'; sessionId: string; data: DailyHistoryPayload }) => {
      await logSupabaseHistory(params);
    },
    [logSupabaseHistory]
  );

  const updateStats = useCallback(
    async (params: { correct: number; total?: number; sessionId?: string }) => {
      if (authStatus !== 'authenticated') return;
      if (!params.sessionId) return;
      try {
        const { data, error } = await supabase.functions.invoke('log-daily-result', {
          body: { correct: params.correct, total: params.total, sessionId: params.sessionId },
        });
        if (error) {
          console.warn('log-daily-result error', error);
          return;
        }
        const payload = (data as {
          data?: { xpGain?: number; totalCorrect?: number; totalPlayed?: number; xp?: number; streak?: number };
        })?.data;
        if (payload && applyUserDelta) {
          applyUserDelta({
            xp: payload.xp ?? (user?.xp ?? 0) + (payload.xpGain ?? 0),
            streak: payload.streak ?? user?.streak,
            totalCorrect: payload.totalCorrect ?? user?.totalCorrect,
            totalPlayed: payload.totalPlayed ?? user?.totalPlayed,
          });
        }
      } catch (err) {
        console.warn('Failed to update daily stats', err);
      }
    },
    [applyUserDelta, authStatus, user?.streak, user?.totalCorrect, user?.totalPlayed, user?.xp]
  );

  return (
    <DailyQuizScreenContent
      updateStats={updateStats}
      logStreak={noopLogStreak}
      logHistory={handleLogHistory}
    />
  );
}

export default function DailyQuizScreen() {
  if (FEATURE_FLAGS.dailyQuiz) {
    return <SupabaseDailyQuizScreen />;
  }
  return <ConvexDailyQuizScreen />;
}
