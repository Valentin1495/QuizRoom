import {
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ComboIndicator } from '@/components/common/combo-indicator';
import { hideResultToast, showResultToast } from '@/components/common/result-toast';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Elevation, Palette, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-unified-auth';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { useSwipeFeed, type SwipeFeedQuestion } from '@/lib/feed';
import { errorHaptic, lightHaptic, mediumHaptic, successHaptic } from '@/lib/haptics';
import { useLogQuizHistory } from '@/lib/supabase-api';
import { supabase } from '@/lib/supabase-index';

import type { CategoryMeta } from '@/constants/categories';
import type { SwipeFeedback } from './swipe-card';
import { SwipeCard } from './swipe-card';

export type SwipeStackProps = {
  category: string;
  tags?: string[];
  setSelectedCategory: (category: CategoryMeta | null) => void;
};

const REPORT_REASONS = [
  { key: 'typo', label: '오타가 있어요' },
  { key: 'answer_issue', label: '정답이 잘못됐어요' },
  { key: 'inappropriate', label: '부적절한 콘텐츠' },
  { key: 'other', label: '기타' },
] as const;

type ReportReasonKey = (typeof REPORT_REASONS)[number]['key'];

type SessionStats = {
  answered: number;
  correct: number;
  totalTimeMs: number;
  totalScoreDelta: number;
  maxStreak: number;
  skipped: number;
};

const INITIAL_SESSION_STATS: SessionStats = {
  answered: 0,
  correct: 0,
  totalTimeMs: 0,
  totalScoreDelta: 0,
  maxStreak: 0,
  skipped: 0,
};

const MIN_STACK_HEIGHT = 420;
const ONBOARDING_KEY = '@swipe_onboarding_completed';
const WINDOW_WIDTH = Dimensions.get('window').width;
const ONBOARDING_SLIDE_WIDTH = Math.max(Math.min(WINDOW_WIDTH - Spacing.xl * 2, 400), 280);

const getComboMultiplier = (streak: number) => {
  if (streak >= 10) return 3.0;
  if (streak >= 7) return 2.5;
  if (streak >= 5) return 2.0;
  if (streak >= 3) return 1.5;
  return 1.0;
};

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_API_KEY;

const createSwipeSessionId = (key: string) => `swipe:${key}:${Date.now()}`;

const ONBOARDING_SLIDES = [
  {
    id: 'slide_swipe_right',
    icon: 'hand.point.right' as const,
    title: '오른쪽으로 스와이프',
    body: '다음 문제로 넘어가요',
  },
  {
    id: 'slide_swipe_left',
    icon: 'hand.point.left' as const,
    title: '왼쪽으로 스와이프',
    body: '문제를 건너뛰거나 신고할 수 있어요',
  },
  {
    id: 'slide_2',
    icon: 'checkmark.seal' as const,
    title: '보기를 선택하면 즉시 채점',
    body: '정답 여부와 해설을 바로 확인하고\n끝없이 이어지는 문제를 풀어보세요',
  },
  {
    id: 'slide_score_combo',
    icon: 'star.circle' as const,
    title: '콤보를 이으면 점수 폭발!',
    body: '정답을 연속으로 맞히면 콤보 배수가 발동해 점수와 XP가 크게 올라요',
  },
] as const;

type SwipeHistoryParams = {
  mode: 'swipe';
  sessionId: string;
  data: {
    category: string;
    tags?: string[];
    answered: number;
    correct: number;
    maxStreak: number;
    avgResponseMs: number;
    totalScoreDelta: number;
  };
};

type SwipeStreakParams = { mode: 'swipe'; answered?: number };

function useSwipeLoggers() {
  const logSupabaseHistory = useLogQuizHistory();
  const logHistory = useCallback(
    async (params: SwipeHistoryParams) => {
      await logSupabaseHistory(params);
    },
    [logSupabaseHistory]
  );
  const logStreakProgress = useCallback(
    async (_params: SwipeStreakParams) => undefined,
    []
  );
  return { logHistory, logStreakProgress };
}

export function SwipeStack({ category, tags, setSelectedCategory }: SwipeStackProps) {
  const {
    current,
    queue,
    prefetchCount,
    isLoading,
    hasMore,
    skip,
    advance,
    submitAnswer,
    toggleBookmark,
    reportQuestion,
    reset,
    isGuest,
    sessionKey,
  } = useSwipeFeed({ category, tags, limit: 20 });
  const { signInWithGoogle, status: authStatus, applyUserDelta, user } = useAuth();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const sheetSurface = useThemeColor({}, 'card');
  const sheetSurfaceElevated = useThemeColor({}, 'cardElevated');
  const sheetBorderColor = useThemeColor({}, 'border');
  const sheetTextColor = useThemeColor({}, 'text');
  const sheetMutedColor = useThemeColor({}, 'textMuted');
  const onboardingCardBackground = useThemeColor({}, 'cardElevated');
  const onboardingIconBackground = colorScheme === 'dark' ? Palette.gray700 : Palette.gray50;
  const onboardingIconColor = palette.text;
  const onboardingTitleColor = palette.text;
  const onboardingBodyColor = palette.textMuted;
  const onboardingIndicatorActive = palette.text;
  const onboardingIndicatorInactive = colorScheme === 'dark' ? Palette.gray700 : Palette.gray200;
  const dangerColor = palette.danger;
  const sheetStatBackground = colorScheme === 'dark' ? palette.cardElevated : palette.card;
  const sheetStatBorder = palette.border;
  const { logHistory, logStreakProgress } = useSwipeLoggers();
  const [sessionStats, setSessionStats] = useState<SessionStats>(INITIAL_SESSION_STATS);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<SwipeFeedback | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const currentStreakRef = useRef(0);
  const startTimeRef = useRef<number>(Date.now());

  const [sheetFeedback, setSheetFeedback] = useState<SwipeFeedback | null>(null);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const actionsSheetRef = useRef<BottomSheetModal>(null);
  const reportReasonSheetRef = useRef<BottomSheetModal>(null);
  const reportNotesInputRef = useRef<TextInput>(null);
  const handleSheetChanges = useCallback((index: number) => {
    if (__DEV__) {
      console.log('handleSheetChanges', index);
    }
  }, []);
  const closeSheet = useCallback(() => {
    bottomSheetRef.current?.dismiss();
    setSheetFeedback(null);
  }, []);
  const openActionsSheet = useCallback(() => {
    actionsSheetRef.current?.present();
  }, []);
  const closeActionsSheet = useCallback(() => {
    actionsSheetRef.current?.dismiss();
  }, []);
  const openReportReasonSheet = useCallback(() => {
    reportReasonSheetRef.current?.present();
  }, []);
  const reportSheetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeReportReasonSheet = useCallback(() => {
    if (reportSheetTimeoutRef.current) {
      clearTimeout(reportSheetTimeoutRef.current);
      reportSheetTimeoutRef.current = null;
    }
    reportReasonSheetRef.current?.dismiss();
  }, []);
  const reportReasonResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filterKey = useMemo(
    () => [category, ...(tags ?? [])].join('|'),
    [category, tags]
  );
  const [sessionId, setSessionId] = useState<string>(() => createSwipeSessionId(filterKey));
  const sessionLoggedRef = useRef(false);
  const streakLoggedRef = useRef(false);
  const previousFilterKey = useRef<string | null>(null);
  const currentQuestionIdRef = useRef<string | null>(null);
  type ReportPayload = Parameters<typeof reportQuestion>[0];
  const [reportReason, setReportReason] = useState<ReportReasonKey | null>(null);
  const [reportNotes, setReportNotes] = useState('');
  const [reportQuestionId, setReportQuestionId] = useState<ReportPayload['questionId'] | null>(null);
  const [reportSubject, setReportSubject] = useState<SwipeFeedQuestion | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [activeCardHeight, setActiveCardHeight] = useState<number | null>(null);
  const [cardOffset, setCardOffset] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingSlideIndex, setOnboardingSlideIndex] = useState(0);
  const onboardingFadeAnim = useRef(new Animated.Value(0)).current;
  const onboardingTranslateX = useRef(new Animated.Value(0)).current;
  const indicatorAnims = useRef(
    ONBOARDING_SLIDES.map(() => new Animated.Value(8))
  ).current;

  const getFunctionAuthHeaders = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    } catch (err) {
      console.warn('Failed to resolve function auth headers', err);
    }
    return supabaseAnonKey ? { Authorization: `Bearer ${supabaseAnonKey}` } : undefined;
  }, []);

  // 새로 진입/리프레시 시 세션 스트릭 및 스탯을 초기화해 이전 세션이 이어지지 않도록 함
  useEffect(() => {
    setCurrentStreak(0);
    currentStreakRef.current = 0;
    setSessionStats(INITIAL_SESSION_STATS);
    sessionLoggedRef.current = false;
    streakLoggedRef.current = false;
    startTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    return () => {
      hideResultToast();
    };
  }, []);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!completed) {
          setShowOnboarding(true);
          // Initialize first indicator as active
          indicatorAnims[0].setValue(24);
          Animated.timing(onboardingFadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }
      } catch (error) {
        console.warn('Failed to check onboarding status', error);
      }
    };
    void checkOnboarding();
  }, [indicatorAnims, onboardingFadeAnim]);

  useEffect(() => {
    return () => {
      if (reportSheetTimeoutRef.current) {
        clearTimeout(reportSheetTimeoutRef.current);
      }
      if (reportReasonResetTimeoutRef.current) {
        clearTimeout(reportReasonResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (previousFilterKey.current === null) {
      previousFilterKey.current = filterKey;
      return;
    }
    if (previousFilterKey.current !== filterKey) {
      previousFilterKey.current = filterKey;
      setSessionStats(INITIAL_SESSION_STATS);
      setSelectedIndex(null);
      setFeedback(null);
      setSheetFeedback(null);
      setActiveCardHeight(null);
      setCardOffset(0);
      hideResultToast();
      closeSheet();
      closeActionsSheet();
      closeReportReasonSheet();
      reset();
      setSessionId(createSwipeSessionId(filterKey));
      sessionLoggedRef.current = false;
      streakLoggedRef.current = false;
    }
  }, [
    closeActionsSheet,
    closeReportReasonSheet,
    closeSheet,
    filterKey,
    reset,
  ]);

  useEffect(() => {
    currentQuestionIdRef.current = current?.id ?? null;
    if (!current) {
      setSelectedIndex(null);
      setFeedback(null);
      hideResultToast();
      closeSheet();
      closeActionsSheet();
      closeReportReasonSheet();
      return;
    }
    setSelectedIndex(null);
    setFeedback(null);
    hideResultToast();
    closeSheet();
    closeActionsSheet();
    closeReportReasonSheet();
    streakLoggedRef.current = false;
    startTimeRef.current = Date.now();
  }, [closeActionsSheet, closeReportReasonSheet, closeSheet, current]);

  useEffect(() => {
    sessionLoggedRef.current = false;
  }, [sessionId]);

  const handleSelect = useCallback(
    async (choiceIndex: number) => {
      if (!current || feedback) {
        return;
      }
      const timeMs = Date.now() - startTimeRef.current;
      const selectedChoice = current.choices[choiceIndex];
      if (!selectedChoice) {
        return;
      }
      setSelectedIndex(choiceIndex);
      const prevStreakBeforeAnswer = currentStreakRef.current;
      const questionId = current.id;
      const optimisticIsCorrect = selectedChoice.id === current.correctChoiceId;
      const optimisticCorrectIndexRaw =
        current.correctChoiceIndex ??
        current.choices.findIndex((choice) => choice.id === current.correctChoiceId);
      const optimisticFeedback: SwipeFeedback = {
        status: 'optimistic',
        isCorrect: optimisticIsCorrect,
        correctChoiceId: current.correctChoiceId,
        correctChoiceIndex: optimisticCorrectIndexRaw >= 0 ? optimisticCorrectIndexRaw : null,
      };
      setFeedback(optimisticFeedback);
      // Optimistically update streak and sheet data so UI reflects immediately
      const optimisticStreak = optimisticIsCorrect ? prevStreakBeforeAnswer + 1 : 0;
      currentStreakRef.current = optimisticStreak;
      setCurrentStreak(optimisticStreak);
      if (current.explanation) {
        setSheetFeedback({
          status: 'confirmed',
          isCorrect: optimisticIsCorrect,
          correctChoiceId: current.correctChoiceId,
          correctChoiceIndex: optimisticCorrectIndexRaw >= 0 ? optimisticCorrectIndexRaw : null,
          explanation: current.explanation ?? null,
          scoreDelta: optimisticIsCorrect ? 15 : -5,
          streak: optimisticStreak,
        });
      }
      hideResultToast();
      if (optimisticIsCorrect) {
        lightHaptic(); // 정답 시 가벼운 햅틱
      } else {
        mediumHaptic(); // 오답 시 중간 햅틱
      }
      // showResultToast({
      //   message: optimisticIsCorrect ? '정답' : '오답',
      //   kind: optimisticIsCorrect ? 'success' : 'error',
      // });
      try {
        const response = await submitAnswer({
          questionId: current.id,
          choiceId: selectedChoice.id,
          answerToken: current.answerToken,
          timeMs,
        });
        const correctIndex = current.choices.findIndex(
          (choice) => choice.id === response.correctChoiceId
        );
        const confirmedCorrectIndex =
          correctIndex >= 0 ? correctIndex : current.correctChoiceIndex ?? correctIndex;
        const measuredTimeMs = Math.max(0, response.timeMs ?? timeMs);
        const nextStreak = response.isCorrect ? prevStreakBeforeAnswer + 1 : 0;
        const comboMultiplier = response.isCorrect ? getComboMultiplier(nextStreak) : 1;
        const baseScoreDelta = response.scoreDelta ?? (response.isCorrect ? 15 : -5);
        const scoreDelta = response.isCorrect ? Math.round(baseScoreDelta * comboMultiplier) : baseScoreDelta;
        const confirmedFeedback: SwipeFeedback = {
          status: 'confirmed',
          isCorrect: response.isCorrect,
          correctChoiceId: response.correctChoiceId,
          correctChoiceIndex:
            confirmedCorrectIndex != null && confirmedCorrectIndex >= 0
              ? confirmedCorrectIndex
              : null,
          explanation: response.explanation,
          scoreDelta,
          streak: nextStreak,
        };
        if (FEATURE_FLAGS.auth) {
          const safeSessionKey = sessionKey ?? `swipe-${Date.now().toString(36)}`;
          const payload = {
            questionId: current.id?.toString?.() ?? '',
            category: current.category,
            tags: current.tags ?? [],
            choiceId: selectedChoice.id,
            isCorrect: response.isCorrect,
            timeMs: measuredTimeMs,
            answerToken: (current as { answerToken?: string }).answerToken,
            sessionKey: safeSessionKey,
            deckSlug: current.deckSlug,
            prompt: current.prompt,
            difficulty: current.difficulty,
            metadata: { source: 'swipe' },
          };
          try {
            const headers = await getFunctionAuthHeaders();
            const { data, error } = await supabase.functions.invoke('log-swipe-answer', {
              headers,
              body: payload,
            });
            if (error) {
              let bodyText: string | null = null;
              let status: number | undefined;
              try {
                const resp = ((error as any)?.context ?? (error as any)?.response) as Response | undefined;
                status = resp?.status;
                if (resp) bodyText = await resp.text();
              } catch {
                bodyText = null;
              }
              console.warn('Failed to log swipe answer to Supabase', {
                message: error?.message,
                status,
                body: bodyText,
                payload,
              });
            } else if (__DEV__) {
              console.log('Logged swipe answer to Supabase', data);
            }
            const payloadData = (data as { data?: { xpGain?: number; streak?: number; totalCorrect?: number; totalPlayed?: number } })?.data;
            if (payloadData && typeof payloadData.xpGain === 'number' && applyUserDelta) {
              applyUserDelta({
                xp: (user?.xp ?? 0) + (payloadData.xpGain ?? 0),
                streak: payloadData.streak ?? user?.streak,
                totalCorrect: payloadData.totalCorrect ?? user?.totalCorrect,
                totalPlayed: payloadData.totalPlayed ?? user?.totalPlayed,
              });
            }
          } catch (err) {
            console.warn('Failed to log swipe answer to Supabase', err);
          }
        }
        setSessionStats((prev) => {
          const answered = prev.answered + 1;
          const correct = prev.correct + (response.isCorrect ? 1 : 0);
          const totalTimeMs = prev.totalTimeMs + measuredTimeMs;
          const totalScoreDelta = prev.totalScoreDelta + scoreDelta;
          const maxStreak = Math.max(prev.maxStreak, nextStreak);
          return {
            answered,
            correct,
            totalTimeMs,
            totalScoreDelta,
            maxStreak,
            skipped: prev.skipped,
          };
        });
        const stillCurrent = currentQuestionIdRef.current === questionId;
        if (stillCurrent) {
          setFeedback(confirmedFeedback);
          setSheetFeedback(confirmedFeedback);
          setCurrentStreak(nextStreak);
        }
        if (response.isCorrect !== optimisticIsCorrect) {
          if (response.isCorrect) {
            successHaptic(); // 정답으로 정정 시 성공 햅틱
          } else {
            errorHaptic(); // 오답으로 정정 시 에러 햅틱
          }
          if (stillCurrent) {
            setSelectedIndex(choiceIndex);
          }
        }
        if (response.isCorrect !== optimisticIsCorrect) {
          showResultToast({
            message: response.isCorrect ? '정답으로 정정했어요.' : '오답으로 정정했어요.',
            kind: response.isCorrect ? 'success' : 'error',
            scoreDelta,
            streak: nextStreak,
          });
        }
      } catch (error) {
        console.warn('정답 제출 실패', error);
        if (currentQuestionIdRef.current === questionId) {
          setSelectedIndex(null);
          setFeedback(null);
        }
        hideResultToast();
        showResultToast({
          message: '전송 중 오류가 발생했어요',
        });
      }
    },
    [current, feedback, submitAnswer, sessionKey, getFunctionAuthHeaders, applyUserDelta, user]
  );

  const handleSkip = useCallback(() => {
    if (!current) return;
    closeActionsSheet();
    skip();
    setSelectedIndex(null);
    setFeedback(null);
    closeSheet();
    closeReportReasonSheet();
    hideResultToast();
    setCurrentStreak(0);
    setSessionStats((prev) => ({
      ...prev,
      skipped: prev.skipped + 1,
    }));
    setCardOffset((prev) => prev + 1);
  }, [closeActionsSheet, closeReportReasonSheet, closeSheet, current, skip]);

  const handleReset = useCallback(async () => {
    closeSheet();
    closeActionsSheet();
    closeReportReasonSheet();
    hideResultToast();
    setSelectedIndex(null);
    setFeedback(null);
    setSheetFeedback(null);
    setActiveCardHeight(null);
    setReportReason(null);
    setReportNotes('');
    setReportQuestionId(null);
    setReportSubject(null);
    setIsSubmittingReport(false);
    setCurrentStreak(0);
    currentQuestionIdRef.current = null;
    startTimeRef.current = Date.now();
    setSessionStats(INITIAL_SESSION_STATS);
    setSessionId(createSwipeSessionId(filterKey));
    sessionLoggedRef.current = false;
    try {
      await reset();
    } catch (error) {
      console.warn('Reset failed:', error);
    }
  }, [closeActionsSheet, closeReportReasonSheet, closeSheet, filterKey, reset]);

  useEffect(() => {
    currentStreakRef.current = currentStreak;
  }, [currentStreak]);

  const handleNext = useCallback(() => {
    if (!current || !feedback) {
      return;
    }
    closeSheet();
    setSelectedIndex(null);
    setFeedback(null);
    setSheetFeedback(null);
    setCardOffset((prev) => prev + 1);
    advance();
  }, [advance, closeSheet, current, feedback]);

  const handleToggleBookmarkAction = useCallback(() => {
    if (!current) return;
    closeActionsSheet();
    if (isGuest) {
      showResultToast({
        message: '로그인 후 문항을 저장할 수 있어요.',
        ctaLabel: '로그인',
        onPressCta: () => {
          void signInWithGoogle();
        },
      });
      return;
    }
    const questionId = current.id;
    toggleBookmark({ questionId })
      .then((result) =>
        showResultToast({
          message: result.bookmarked ? '저장함에 담았어요.' : '저장을 해제했어요.',
        })
      )
      .catch(() =>
        showResultToast({
          message: '저장에 실패했어요.',

        })
      );
  }, [closeActionsSheet, current, isGuest, toggleBookmark]);

  const handleReportAction = useCallback(() => {
    if (!current) return;
    closeActionsSheet();
    if (reportReasonResetTimeoutRef.current) {
      clearTimeout(reportReasonResetTimeoutRef.current);
      reportReasonResetTimeoutRef.current = null;
    }
    setReportQuestionId(current.id);
    setReportSubject(current);
    setReportReason(null);
    setReportNotes('');
    setIsSubmittingReport(false);
    if (reportSheetTimeoutRef.current) {
      clearTimeout(reportSheetTimeoutRef.current);
    }
    reportSheetTimeoutRef.current = setTimeout(() => {
      openReportReasonSheet();
      reportSheetTimeoutRef.current = null;
    }, 120);
  }, [closeActionsSheet, current, openReportReasonSheet]);

  const handleActions = useCallback(() => {
    if (!current) return;
    openActionsSheet();
  }, [current, openActionsSheet]);

  const showCompletion = !hasMore && queue.length === 0;

  const accuracyPercent = useMemo(() => {
    if (!sessionStats.answered) return null;
    return Math.round((sessionStats.correct / sessionStats.answered) * 100);
  }, [sessionStats.answered, sessionStats.correct]);

  const totalViewed = sessionStats.answered + sessionStats.skipped;

  const processedPercent = useMemo(() => {
    if (!totalViewed) return null;
    return Math.round((sessionStats.answered / totalViewed) * 100);
  }, [sessionStats.answered, totalViewed]);

  const averageSeconds = useMemo(() => {
    if (!sessionStats.answered) return null;
    return sessionStats.totalTimeMs / sessionStats.answered / 1000;
  }, [sessionStats.answered, sessionStats.totalTimeMs]);

  const formattedAverageSeconds = useMemo(() => {
    if (averageSeconds === null) return '-';
    const fixed = averageSeconds >= 10 ? averageSeconds.toFixed(1) : averageSeconds.toFixed(2);
    return fixed.replace(/\.0+$/, '');
  }, [averageSeconds]);

  const totalResponseLabel = useMemo(() => {
    if (!sessionStats.answered) return null;
    const totalSeconds = Math.round(sessionStats.totalTimeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}분 ${seconds}초`;
    }
    return `${seconds}초`;
  }, [sessionStats.answered, sessionStats.totalTimeMs]);

  const totalXpEarned = useMemo(() => {
    if (!sessionStats.answered) return 0;
    const incorrect = sessionStats.answered - sessionStats.correct;
    return sessionStats.correct * 15 + incorrect * 5;
  }, [sessionStats.answered, sessionStats.correct]);

  const completionTitle = useMemo(() => {
    const answered = sessionStats.answered;
    const completed = answered >= 20;
    return {
      icon: completed ? 'party.popper' : 'rectangle.grid.2x2',
      label: completed
        ? `${answered}문항 완주!`
        : answered > 0
          ? `${answered}문항 풀이 요약`
          : '스와이프 요약',
    } as const;
  }, [sessionStats.answered]);

  const totalScoreLabel = useMemo(() => {
    if (!sessionStats.answered) return '+0';
    const value = Math.round(sessionStats.totalScoreDelta);
    return `${value >= 0 ? '+' : ''}${value}`;
  }, [sessionStats.answered, sessionStats.totalScoreDelta]);

  useEffect(() => {
    if (!showCompletion) {
      return;
    }
    if (sessionStats.answered === 0) {
      return;
    }
    if (authStatus !== 'authenticated') {
      return;
    }
    if (sessionLoggedRef.current) {
      return;
    }
    const avgResponseMs =
      sessionStats.answered > 0 ? sessionStats.totalTimeMs / sessionStats.answered : 0;
    sessionLoggedRef.current = true;
    void (async () => {
      try {
        const data = {
          category,
          tags: tags && tags.length ? tags : undefined,
          answered: sessionStats.answered,
          correct: sessionStats.correct,
          maxStreak: sessionStats.maxStreak,
          avgResponseMs,
          totalScoreDelta: sessionStats.totalScoreDelta,
        };

        if (FEATURE_FLAGS.auth) {
          const headers = await getFunctionAuthHeaders();
          const { data: result, error } = await supabase.functions.invoke('log-swipe-result', {
            headers,
            body: { sessionId, data },
          });
          if (error) {
            console.warn('Failed to log swipe result', error);
          }
          const payload = (result as { data?: { xpGain?: number; xp?: number } })?.data;
          if (payload && typeof payload.xp === 'number' && applyUserDelta) {
            applyUserDelta({ xp: payload.xp });
          } else if (payload && typeof payload.xpGain === 'number' && applyUserDelta && user) {
            applyUserDelta({ xp: (user.xp ?? 0) + payload.xpGain });
          }
        } else {
          await logHistory({ mode: 'swipe', sessionId, data });
        }
      } catch (error) {
        console.warn('Failed to log swipe history', error);
        sessionLoggedRef.current = false;
      }
    })();
  }, [
    authStatus,
    category,
    logHistory,
    sessionId,
    sessionStats.answered,
    sessionStats.correct,
    sessionStats.maxStreak,
    sessionStats.totalScoreDelta,
    sessionStats.totalTimeMs,
    showCompletion,
    tags,
    getFunctionAuthHeaders,
    applyUserDelta,
    user,
  ]);

  useEffect(() => {
    if (!showCompletion) return;
    if (sessionStats.answered < 20) return; // 스와이프 완주 조건
    if (authStatus !== 'authenticated') return;
    if (streakLoggedRef.current) return;
    streakLoggedRef.current = true;
    void (async () => {
      try {
        await logStreakProgress({ mode: 'swipe', answered: sessionStats.answered });
      } catch (error) {
        console.warn('Failed to log swipe streak', error);
        streakLoggedRef.current = false;
      }
    })();
  }, [
    authStatus,
    logStreakProgress,
    sessionStats.answered,
    showCompletion,
  ]);

  const handleOpenSheet = useCallback(() => {
    const explanation =
      (feedback && 'explanation' in feedback && feedback.explanation) || current?.explanation || null;
    if (!explanation) return;

    const sheetData: SwipeFeedback = feedback && 'explanation' in feedback
      ? feedback
      : {
        status: 'confirmed',
        isCorrect: feedback?.isCorrect ?? false,
        correctChoiceId: feedback?.correctChoiceId ?? current?.correctChoiceId ?? null,
        correctChoiceIndex: feedback?.correctChoiceIndex ?? current?.correctChoiceIndex ?? null,
        explanation,
        scoreDelta: feedback && 'scoreDelta' in feedback ? Number(feedback.scoreDelta) || 0 : 0,
        streak: feedback && 'streak' in feedback ? Number(feedback.streak) || 0 : currentStreakRef.current,
      };

    setSheetFeedback(sheetData);
    bottomSheetRef.current?.present();
  }, [current, feedback]);

  const handleSheetDismiss = useCallback(() => {
    setSheetFeedback(null);
  }, []);

  const handleReportSheetDismiss = useCallback(() => {
    if (reportSheetTimeoutRef.current) {
      clearTimeout(reportSheetTimeoutRef.current);
      reportSheetTimeoutRef.current = null;
    }
    if (reportReasonResetTimeoutRef.current) {
      clearTimeout(reportReasonResetTimeoutRef.current);
    }
    reportReasonResetTimeoutRef.current = setTimeout(() => {
      setReportReason(null);
      setReportNotes('');
      setReportQuestionId(null);
      setIsSubmittingReport(false);
      setReportSubject(null);
      reportReasonResetTimeoutRef.current = null;
    }, 100);
  }, []);

  useEffect(() => {
    if (reportReason === 'other') {
      const timeout = setTimeout(() => {
        reportNotesInputRef.current?.focus();
      }, 180);
      return () => {
        clearTimeout(timeout);
      };
    }
    return undefined;
  }, [reportReason]);

  const canSubmitReport = useMemo(() => {
    if (!reportReason) return false;
    if (!isGuest && !reportQuestionId) return false;
    if (isGuest && !reportSubject) return false;
    if (reportReason === 'other') {
      return reportNotes.trim().length > 0 && !isSubmittingReport;
    }
    return !isSubmittingReport;
  }, [isGuest, isSubmittingReport, reportNotes, reportQuestionId, reportReason, reportSubject]);

  const handleSubmitReport = useCallback(async () => {
    if (!reportReason) return;
    if (!isGuest && !reportQuestionId) return;
    if (isGuest && !reportSubject) return;
    if (reportReason === 'other' && reportNotes.trim().length === 0) return;
    setIsSubmittingReport(true);
    const reasonPayload =
      reportReason === 'other' ? `other:${reportNotes.trim()}` : reportReason;
    const trimmedNote = reportNotes.trim();
    try {
      await reportQuestion({
        questionId: isGuest ? undefined : reportQuestionId ?? undefined,
        reason: reasonPayload,
        note: trimmedNote.length > 0 ? trimmedNote : undefined,
        guest:
          isGuest && reportSubject
            ? {
              deckSlug: reportSubject.deckSlug,
              category: reportSubject.category,
              prompt: reportSubject.prompt,
              choiceId: undefined,
              explanation: reportSubject.explanation ?? undefined,
              choices: reportSubject.choices,
              metadata: {
                tags: reportSubject.tags,
                source: 'guest_swipe',
              },
            }
            : undefined,
      });
      closeReportReasonSheet();
      showResultToast({
        message: '신고 접수',
      });
    } catch (error) {
      console.warn('Report submission failed', error);
      showResultToast({
        message: '신고 전송 실패',
      });
    } finally {
      setIsSubmittingReport(false);
    }
  }, [
    closeReportReasonSheet,
    reportNotes,
    reportQuestion,
    reportSubject,
    reportQuestionId,
    reportReason,
    isGuest,
  ]);

  const handleSwipeBlocked = useCallback(() => {
    showResultToast({
      message: '문제를 풀어야 다음 카드로 이동할 수 있어요.',
    });
  }, []);

  const handleCloseOnboarding = useCallback(() => {
    Animated.timing(onboardingFadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowOnboarding(false);
      setOnboardingSlideIndex(0);
      onboardingTranslateX.setValue(0);
      // Reset indicators
      indicatorAnims.forEach((anim, index) => {
        anim.setValue(index === 0 ? 24 : 8);
      });
    });
  }, [indicatorAnims, onboardingFadeAnim, onboardingTranslateX]);

  const handleCompleteOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      Animated.timing(onboardingFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowOnboarding(false);
        setOnboardingSlideIndex(0);
        onboardingTranslateX.setValue(0);
        // Reset indicators
        indicatorAnims.forEach((anim, index) => {
          anim.setValue(index === 0 ? 24 : 8);
        });
      });
    } catch (error) {
      console.warn('Failed to save onboarding completion', error);
      setShowOnboarding(false);
    }
  }, [indicatorAnims, onboardingFadeAnim, onboardingTranslateX]);

  const handleNextOnboardingSlide = useCallback(() => {
    if (onboardingSlideIndex < ONBOARDING_SLIDES.length - 1) {
      const nextIndex = onboardingSlideIndex + 1;

      // Slide animation
      Animated.parallel([
        Animated.timing(onboardingTranslateX, {
          toValue: -nextIndex * ONBOARDING_SLIDE_WIDTH,
          duration: 300,
          useNativeDriver: true,
        }),
        // Animate current indicator shrinking
        Animated.timing(indicatorAnims[onboardingSlideIndex], {
          toValue: 8,
          duration: 200,
          useNativeDriver: false,
        }),
        // Animate next indicator expanding
        Animated.timing(indicatorAnims[nextIndex], {
          toValue: 24,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();

      setOnboardingSlideIndex(nextIndex);
    }
  }, [indicatorAnims, onboardingSlideIndex, onboardingTranslateX]);

  const handlePrevOnboardingSlide = useCallback(() => {
    if (onboardingSlideIndex > 0) {
      const prevIndex = onboardingSlideIndex - 1;

      // Slide animation
      Animated.parallel([
        Animated.timing(onboardingTranslateX, {
          toValue: -prevIndex * ONBOARDING_SLIDE_WIDTH,
          duration: 300,
          useNativeDriver: true,
        }),
        // Animate current indicator shrinking
        Animated.timing(indicatorAnims[onboardingSlideIndex], {
          toValue: 8,
          duration: 200,
          useNativeDriver: false,
        }),
        // Animate prev indicator expanding
        Animated.timing(indicatorAnims[prevIndex], {
          toValue: 24,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();

      setOnboardingSlideIndex(prevIndex);
    }
  }, [indicatorAnims, onboardingSlideIndex, onboardingTranslateX]);


  // 스와이프 제스처 핸들러 (PanResponder)
  const onboardingPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          onboardingTranslateX.setOffset(-onboardingSlideIndex * ONBOARDING_SLIDE_WIDTH);
          onboardingTranslateX.setValue(0);
        },
        onPanResponderMove: (_, gesture) => {
          const maxTranslate = onboardingSlideIndex * ONBOARDING_SLIDE_WIDTH;
          const minTranslate =
            -(ONBOARDING_SLIDES.length - 1 - onboardingSlideIndex) * ONBOARDING_SLIDE_WIDTH;
          const clampedValue = Math.max(minTranslate, Math.min(maxTranslate, gesture.dx));
          onboardingTranslateX.setValue(clampedValue);
        },
        onPanResponderRelease: (_, gesture) => {
          const SWIPE_THRESHOLD = 80;

          onboardingTranslateX.flattenOffset();

          // 오른쪽 스와이프 (이전 슬라이드)
          if (gesture.dx > SWIPE_THRESHOLD && onboardingSlideIndex > 0) {
            handlePrevOnboardingSlide();
          }
          // 왼쪽 스와이프 (다음 슬라이드)
          else if (gesture.dx < -SWIPE_THRESHOLD && onboardingSlideIndex < ONBOARDING_SLIDES.length - 1) {
            handleNextOnboardingSlide();
          }
          // 스냅백
          else {
            const currentOffset = -onboardingSlideIndex * ONBOARDING_SLIDE_WIDTH;
            Animated.spring(onboardingTranslateX, {
              toValue: currentOffset,
              useNativeDriver: true,
              tension: 80,
              friction: 10,
            }).start();
          }
        },
      }),
    [onboardingSlideIndex, onboardingTranslateX, handleNextOnboardingSlide, handlePrevOnboardingSlide]
  );

  const handleActiveCardLayout = useCallback((height: number) => {
    setActiveCardHeight((prev) => {
      if (prev === height) {
        return prev;
      }
      return height;
    });
  }, []);

  useEffect(() => {
    if (!queue.length) {
      setActiveCardHeight(null);
    }
  }, [queue.length]);

  const stackHeight = useMemo(
    () => Math.max(activeCardHeight ?? 0, MIN_STACK_HEIGHT),
    [activeCardHeight]
  );

  if (!current && !showCompletion) {
    return (
      <View style={styles.emptyState}>
        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={palette.primary} />
            <ThemedText style={styles.loadingStateLabel}>
              새로운 문제를 불러오는 중이에요...
            </ThemedText>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <BottomSheetModalProvider>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {showCompletion ? (
            <View
              style={[
                styles.completionCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <View style={styles.completionHeader}>
                <IconSymbol name={completionTitle.icon} size={28} color={palette.text} />
                <ThemedText style={styles.completionTitle}>{completionTitle.label}</ThemedText>
              </View>
              <View style={styles.completionMetrics}>
                <View
                  style={[
                    styles.completionMetric,
                    { backgroundColor: palette.cardElevated, borderColor: palette.border },
                  ]}
                >
                  <ThemedText
                    style={styles.completionMetricLabel}
                    lightColor={palette.textMuted}
                    darkColor={Palette.gray200}
                  >
                    최고 연속 정답
                  </ThemedText>
                  <ThemedText style={styles.completionMetricValue}>
                    {sessionStats.maxStreak}문항
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.completionMetric,
                    { backgroundColor: palette.cardElevated, borderColor: palette.border },
                  ]}
                >
                  <ThemedText
                    style={styles.completionMetricLabel}
                    lightColor={palette.textMuted}
                    darkColor={Palette.gray200}
                  >
                    획득 점수
                  </ThemedText>
                  <ThemedText style={styles.completionMetricValue}>{totalScoreLabel}</ThemedText>
                </View>
                <View
                  style={[
                    styles.completionMetric,
                    { backgroundColor: palette.cardElevated, borderColor: palette.border },
                  ]}
                >
                  <ThemedText
                    style={styles.completionMetricLabel}
                    lightColor={palette.textMuted}
                    darkColor={Palette.gray200}
                  >
                    정답률
                  </ThemedText>
                  <ThemedText style={styles.completionMetricValue}>
                    {accuracyPercent !== null ? `${accuracyPercent}%` : '-'}
                  </ThemedText>
                  <ThemedText
                    style={styles.completionMetricHint}
                    lightColor={palette.textMuted}
                    darkColor={Palette.gray200}
                  >
                    {sessionStats.correct}/{Math.max(sessionStats.answered, 1)} {'\n'}정답/응답
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.completionMetric,
                    { backgroundColor: palette.cardElevated, borderColor: palette.border },
                  ]}
                >
                  <ThemedText
                    style={styles.completionMetricLabel}
                    lightColor={palette.textMuted}
                    darkColor={Palette.gray200}
                  >
                    완료율
                  </ThemedText>
                  <ThemedText style={styles.completionMetricValue}>
                    {processedPercent !== null ? `${processedPercent}%` : '-'}
                  </ThemedText>
                  <ThemedText
                    style={styles.completionMetricHint}
                    lightColor={palette.textMuted}
                    darkColor={Palette.gray200}
                  >
                    {sessionStats.answered}/{Math.max(totalViewed, 1)} {'\n'}응답/(응답+스킵)
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.completionMetric,
                    { backgroundColor: palette.cardElevated, borderColor: palette.border },
                  ]}
                >
                  <ThemedText
                    style={styles.completionMetricLabel}
                    lightColor={palette.textMuted}
                    darkColor={Palette.gray200}
                  >
                    총 소요시간
                  </ThemedText>
                  <ThemedText style={styles.completionMetricValue}>
                    {totalResponseLabel ?? '-'}
                  </ThemedText>
                  <ThemedText
                    style={styles.completionMetricHint}
                    lightColor={palette.textMuted}
                    darkColor={Palette.gray200}
                  >
                    평균 {averageSeconds !== null ? `${formattedAverageSeconds}초` : '-'}
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.completionMetric,
                    { backgroundColor: palette.cardElevated, borderColor: palette.border },
                  ]}
                >
                  <ThemedText
                    style={styles.completionMetricLabel}
                    lightColor={palette.textMuted}
                    darkColor={Palette.gray200}
                  >
                    획득 XP
                  </ThemedText>
                  <ThemedText style={styles.completionMetricValue}>+{totalXpEarned}</ThemedText>
                </View>
              </View>
              <View style={styles.completionActions}>
                <Button
                  size="lg"
                  fullWidth
                  onPress={handleReset}
                  style={styles.completionActionButton}
                >
                  다시 도전
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  fullWidth
                  onPress={() => setSelectedCategory(null)}
                  style={styles.completionActionButton}
                >
                  카테고리 변경
                </Button>
              </View>
            </View>
          ) : (
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <View style={styles.statusInfo}>
                  <IconSymbol name="rectangle.stack" size={16} color={palette.textMuted} />
                  <ThemedText
                    style={styles.statusText}
                    lightColor={palette.textMuted}
                    darkColor={palette.textMuted}
                  >
                    남은 카드 {prefetchCount}장
                  </ThemedText>
                </View>
                {currentStreak >= 1 && (
                  <ComboIndicator streak={currentStreak} size="sm" />
                )}
              </View>
              <View style={styles.statusRight}>
                <Button
                  variant="ghost"
                  size="sm"
                  rounded="full"
                  onPress={handleOpenSheet}
                  disabled={selectedIndex === null || !((feedback && 'explanation' in feedback && feedback.explanation) || current?.explanation)}
                  style={
                    (selectedIndex === null ||
                      !((feedback && 'explanation' in feedback && feedback.explanation) || current?.explanation)) &&
                    styles.sheetButtonHidden
                  }
                  textStyle={
                    (selectedIndex === null ||
                      !((feedback && 'explanation' in feedback && feedback.explanation) || current?.explanation)) &&
                    styles.sheetButtonTextHidden
                  }
                >
                  해설 보기
                </Button>
              </View>
            </View>
          )}
          <View style={styles.stackWrapper}>
            <View
              pointerEvents="none"
              style={[styles.cardSizer, { height: stackHeight }]}
            />
            {queue.map((card, index) => (
              <SwipeCard
                key={card.id}
                card={card}
                index={index}
                cardNumber={cardOffset + index + 1}
                isActive={index === 0}
                selectedIndex={index === 0 ? selectedIndex : null}
                feedback={index === 0 ? feedback : null}
                onSelectChoice={index === 0 ? handleSelect : () => undefined}
                onSwipeNext={handleNext}
                onOpenActions={handleActions}
                onSwipeBlocked={index === 0 ? handleSwipeBlocked : undefined}
                onCardLayout={index === 0 ? handleActiveCardLayout : undefined}
              />
            ))}
          </View>
        </ScrollView>

        <BottomSheetModal
          ref={actionsSheetRef}
          backgroundStyle={[
            styles.bottomSheetBackground,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
            },
          ]}
          enablePanDownToClose
          enableDynamicSizing
          enableOverDrag={false}
          keyboardBehavior="interactive"
          android_keyboardInputMode="adjustResize"
        >
          <BottomSheetView style={styles.actionsSheetContent}>
            <View style={styles.actionsList}>
              <Button
                variant="outline"
                size="lg"
                onPress={handleSkip}
                disabled={!!feedback}
                leftIcon={<IconSymbol name="forward.end" size={18} color={palette.text} />}
              >
                건너뛰기
              </Button>
              <Button
                variant="outline"
                size="lg"
                onPress={handleReportAction}
                leftIcon={<IconSymbol name="flag" size={18} color={dangerColor} />}
                textStyle={{ color: dangerColor }}
              >
                신고하기
              </Button>
            </View>
            <Button
              size="lg"
              onPress={closeActionsSheet}
            >
              취소
            </Button>
          </BottomSheetView>
        </BottomSheetModal>

        <BottomSheetModal
          ref={reportReasonSheetRef}
          onDismiss={handleReportSheetDismiss}
          backgroundStyle={[
            styles.bottomSheetBackground,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
            },
          ]}
          enablePanDownToClose
          enableDynamicSizing
          enableOverDrag={false}
          keyboardBehavior="interactive"
          android_keyboardInputMode="adjustResize"
        >
          <BottomSheetView style={styles.reportSheetContent}>
            <ThemedText style={styles.sheetTitle}>문항 신고</ThemedText>
            <ThemedText style={[styles.reportSubtitle, { color: sheetMutedColor }]}>
              신고 사유를 선택해주세요
            </ThemedText>
            <View style={styles.reportOptions}>
              {REPORT_REASONS.map((option) => {
                const isSelected = reportReason === option.key;
                return (
                  <Pressable
                    key={option.key}
                    style={({ pressed }) => [
                      styles.reportOption,
                      {
                        backgroundColor: sheetSurface,
                        borderColor: sheetBorderColor,
                      },
                      isSelected
                        ? {
                          backgroundColor: sheetSurfaceElevated ?? sheetSurface,
                          borderColor: palette.primary,
                        }
                        : null,
                      pressed ? styles.reportOptionPressed : null,
                    ]}
                    onPress={() => setReportReason(option.key)}
                  >
                    <ThemedText
                      style={[
                        styles.reportOptionLabel,
                        isSelected && styles.reportOptionLabelSelected,
                      ]}
                      lightColor={isSelected ? palette.primary : sheetTextColor}
                      darkColor={isSelected ? palette.primary : sheetTextColor}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {reportReason === 'other' ? (
              <TextInput
                ref={reportNotesInputRef}
                style={[
                  styles.reportInput,
                  {
                    backgroundColor: sheetSurface,
                    borderColor: sheetBorderColor,
                    color: sheetTextColor,
                  },
                ]}
                multiline
                placeholder="신고 사유를 자세히 적어주세요."
                placeholderTextColor={sheetMutedColor}
                value={reportNotes}
                onChangeText={setReportNotes}
                textAlignVertical="top"
                returnKeyType="done"
                editable={!isSubmittingReport}
              />
            ) : null}
            <Button
              size="lg"
              onPress={handleSubmitReport}
              disabled={!canSubmitReport}
              loading={isSubmittingReport}
            >
              신고 제출
            </Button>
          </BottomSheetView>
        </BottomSheetModal>

        <BottomSheetModal
          ref={bottomSheetRef}
          onDismiss={handleSheetDismiss}
          onChange={handleSheetChanges}
          backgroundStyle={[
            styles.bottomSheetBackground,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
            },
          ]}
          enablePanDownToClose
          enableDynamicSizing
          enableOverDrag={false}
        >
          {sheetFeedback?.status === 'confirmed' ? (
            <BottomSheetView style={styles.bottomSheetContent}>
              <ThemedText style={styles.sheetTitle}>해설</ThemedText>
              <ThemedText style={styles.sheetBody}>
                {sheetFeedback.explanation ?? '해설이 없습니다.'}
              </ThemedText>
              <View style={styles.sheetStatsRow}>
                <View style={[styles.sheetStat, { backgroundColor: sheetStatBackground, borderColor: sheetStatBorder }]}>
                  <ThemedText style={[styles.sheetStatLabel, { color: sheetMutedColor }]}>점수 변화</ThemedText>
                  <ThemedText style={styles.sheetStatValue}>
                    {sheetFeedback.scoreDelta >= 0
                      ? `+${sheetFeedback.scoreDelta}`
                      : sheetFeedback.scoreDelta}
                  </ThemedText>
                </View>
                <View style={[styles.sheetStat, { backgroundColor: sheetStatBackground, borderColor: sheetStatBorder }]}>
                  <ThemedText style={[styles.sheetStatLabel, { color: sheetMutedColor }]}>현재 연속 정답</ThemedText>
                  <ThemedText style={styles.sheetStatValue}>{sheetFeedback.streak}</ThemedText>
                </View>
              </View>
              <Button
                variant="default"
                fullWidth
                size="md"
                onPress={closeSheet}
              >
                닫기
              </Button>
            </BottomSheetView>
          ) : (
            <BottomSheetView style={styles.bottomSheetContent}>
              <ThemedText style={styles.sheetBody}>표시할 해설이 없어요.</ThemedText>
            </BottomSheetView>
          )}
        </BottomSheetModal>
      </View>

      {showOnboarding ? (
        <Animated.View
          style={[
            styles.onboardingOverlay,
            {
              opacity: onboardingFadeAnim,
            },
          ]}
        >
          <View
            style={[
              styles.onboardingCard,
              { backgroundColor: onboardingCardBackground, borderColor: sheetBorderColor },
            ]}
          >
            <View style={styles.onboardingSlidesViewport}>
              <Animated.View
                {...onboardingPanResponder.panHandlers}
                style={[
                  styles.onboardingSlidesContainer,
                  {
                    width: ONBOARDING_SLIDE_WIDTH * ONBOARDING_SLIDES.length,
                    transform: [{ translateX: onboardingTranslateX }],
                  },
                ]}
              >
                {ONBOARDING_SLIDES.map((slide) => (
                  <View
                    key={slide.id}
                    style={[
                      styles.onboardingSlide,
                      { width: ONBOARDING_SLIDE_WIDTH },
                    ]}
                  >
                    <View style={styles.onboardingContent}>
                      <View
                        style={[
                          styles.onboardingIconContainer,
                          { backgroundColor: onboardingIconBackground },
                        ]}
                      >
                        <IconSymbol
                          name={slide.icon}
                          size={56}
                          color={onboardingIconColor}
                        />
                      </View>
                      <ThemedText style={[styles.onboardingTitle, { color: onboardingTitleColor }]}>
                        {slide.title}
                      </ThemedText>
                      <ThemedText style={[styles.onboardingBody, { color: onboardingBodyColor }]}>
                        {slide.body}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </Animated.View>
            </View>

            <View style={styles.onboardingFooter}>
              <View style={styles.onboardingIndicators}>
                {ONBOARDING_SLIDES.map((_, index) => (
                  <Animated.View
                    key={`indicator-${index}`}
                    style={[
                      styles.onboardingIndicator,
                      {
                        width: indicatorAnims[index],
                        backgroundColor:
                          index === onboardingSlideIndex ? onboardingIndicatorActive : onboardingIndicatorInactive,
                      },
                    ]}
                  />
                ))}
              </View>

              <Button
                variant="outline"
                size="lg"
                fullWidth
                onPress={handleCloseOnboarding}
              >
                닫기
              </Button>
              <Button
                variant="default"
                size="lg"
                fullWidth
                onPress={() => void handleCompleteOnboarding()}
              >
                다시 보지 않기
              </Button>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  stackWrapper: {
    minHeight: MIN_STACK_HEIGHT,
    flexGrow: 1,
    paddingTop: Spacing.xl,
  },
  cardSizer: {
    width: '100%',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    marginTop: 0,
    position: 'relative',
    zIndex: 2,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flexShrink: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sheetButtonHidden: {
    opacity: 0,
  },
  sheetButtonTextHidden: {
    color: 'transparent',
  },
  completionCard: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  completionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  completionContext: {
    fontSize: 13,
    color: Palette.gray500,
  },
  completionMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  completionMetric: {
    flexBasis: '47%',
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: '50%',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.xs / 2,
  },
  completionMetricLabel: {
    fontSize: 12,
    textAlign: 'left',
  },
  completionMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'left',
    lineHeight: 20,
  },
  completionMetricHint: {
    fontSize: 12,
    textAlign: 'left',
  },
  completionActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  completionActionButton: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  loadingState: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingStateLabel: {
    fontSize: 13,
    opacity: 0.85,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSheetBackground: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  bottomSheetContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  actionsSheetContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.lg,
  },
  actionsList: {
    gap: Spacing.sm,
  },
  reportSheetContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  reportSubtitle: {
    fontSize: 13,
  },
  reportOptions: {
    gap: Spacing.sm,
  },
  reportOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  reportOptionPressed: {
    opacity: 0.9,
  },
  reportOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  reportOptionLabelSelected: {
    fontWeight: '700',
  },
  reportInput: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    lineHeight: 20,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sheetBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  sheetStatsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  sheetStat: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  sheetStatLabel: {
    fontSize: 12,
    marginBottom: 4,
    color: Palette.gray500,
  },
  sheetStatValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  reloadButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Palette.gray500,
  },
  reloadText: {
    color: '#fff',
    fontWeight: '600',
  },
  onboardingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  onboardingCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Palette.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xxl,
    gap: Spacing.xxl,
    overflow: 'hidden',
    ...Elevation.sm,
  },
  onboardingSlidesContainer: {
    flexDirection: 'row',
  },
  onboardingSlidesViewport: {
    width: ONBOARDING_SLIDE_WIDTH,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  onboardingSlide: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingContent: {
    alignItems: 'center',
    gap: Spacing.lg,
    width: '100%',
    paddingHorizontal: Spacing.lg,
  },
  onboardingIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Palette.gray50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onboardingTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: Palette.gray900,
  },
  onboardingBody: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    color: Palette.gray600,
  },
  onboardingFooter: {
    gap: Spacing.lg,
  },
  onboardingIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  onboardingIndicator: {
    height: 8,
    borderRadius: 4,
  },
});
