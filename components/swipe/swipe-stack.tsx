import {
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ComboIndicator } from '@/components/common/combo-indicator';
import { hideResultToast, showResultToast } from '@/components/common/result-toast';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors, Elevation, Palette, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-unified-auth';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { useSwipeFeed, type SwipeFeedQuestion } from '@/lib/feed';
import { errorHaptic, lightHaptic, mediumHaptic, successHaptic } from '@/lib/haptics';
import { useLogQuizHistory } from '@/lib/supabase-api';
import { supabase } from '@/lib/supabase-index';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import type { CategoryMeta } from '@/constants/categories';
import type { SwipeFeedback } from './swipe-card';
import { SwipeCard } from './swipe-card';

export type SwipeChallengeConfig = {
  totalQuestions: number;
  allowedMisses: number;
  scorePerCorrect: number;
};

export type SwipeChallengeSummary = {
  answered: number;
  correct: number;
  totalAnswered: number;
  totalCorrect: number;
  missCount: number;
  totalTimeMs: number;
  totalScoreDelta: number;
  maxStreak: number;
  failed: boolean;
  questionIds: string[];
  sessionId: string;
};

export type SwipeStackProps = {
  category: string;
  tags?: string[];
  deckSlug?: string;
  grade?: number;
  eduLevel?: string;
  subject?: string;
  challengeLevelLabel?: string;
  challengeLevelFailedLabel?: string;
  excludeIds?: string[];
  completionTotals?: { answered: number; correct: number } | null;
  cumulativeAnswered?: number;
  cumulativeCorrect?: number;
  isFinalStage?: boolean;
  setSelectedCategory?: (category: CategoryMeta | null) => void;
  challenge?: SwipeChallengeConfig;
  onExit?: () => void;
  onChallengeAdvance?: () => void;
  challengeAdvanceLabel?: string;
  onChallengeComplete?: (summary: SwipeChallengeSummary) => void;
  challengeCompletionLabel?: string;
  challengeProgressLabel?: string;
  challengeSubjectLabel?: string;
  persistLifelines?: boolean;
  lifelinesDisabled?: boolean;
  onChallengeReset?: () => void;
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
    body: '정답을 연속으로 맞히면 콤보 배수가 발동해\n점수와 XP가 크게 올라요',
  },
] as const;

const CHALLENGE_ONBOARDING_SLIDES = [
  {
    id: 'assessment_difficulty',
    icon: 'sparkles' as const,
    title: '단계별 실력 측정',
    body: '초등학교부터 대학교+까지 단계별로 문제를 풀며 수준을 확인해요.',
  },
  {
    id: 'assessment_swipe_right',
    icon: 'hand.point.right' as const,
    title: '오른쪽 스와이프',
    body: '다음 문제로 이동해요.',
  },
  {
    id: 'assessment_swipe_left',
    icon: 'hand.point.left' as const,
    title: '왼쪽 스와이프',
    body: '치트 아이템을 사용할 수 있어요.',
  },
  {
    id: 'assessment_result',
    icon: 'checkmark.seal' as const,
    title: '측정 결과 확인',
    body: '획득한 점수와 XP를 한눈에 확인하세요.',
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

export function SwipeStack({
  category,
  tags,
  deckSlug,
  grade,
  eduLevel,
  subject,
  cumulativeAnswered,
  cumulativeCorrect,
  isFinalStage,
  setSelectedCategory,
  challenge,
  onExit,
  onChallengeAdvance,
  challengeAdvanceLabel,
  onChallengeComplete,
  challengeCompletionLabel,
  challengeProgressLabel,
  challengeSubjectLabel,
  persistLifelines,
  lifelinesDisabled,
  onChallengeReset,
  excludeIds,
  challengeLevelLabel,
  challengeLevelFailedLabel,
  completionTotals: completionTotalsOverride,
}: SwipeStackProps) {
  const isChallenge = Boolean(challenge);
  const onboardingSlides = isChallenge ? CHALLENGE_ONBOARDING_SLIDES : ONBOARDING_SLIDES;
  const onboardingKey = isChallenge ? '@swipe_onboarding_skill_assessment' : ONBOARDING_KEY;
  const sessionLimit = challenge?.totalQuestions;
  const seenQuestionIdsRef = useRef<Set<string>>(new Set());
  const [activeExcludeIds, setActiveExcludeIds] = useState<string[]>(excludeIds ?? []);
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
  } = useSwipeFeed({
    category,
    tags,
    deckSlug,
    grade,
    eduLevel,
    subject,
    excludeIds: activeExcludeIds,
    excludeTag: isChallenge ? undefined : 'mode:fifth_grader',
    limit: sessionLimit,
  });
  const { signInWithGoogle, status: authStatus, applyUserDelta, user } = useAuth();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const palette = Colors[colorScheme ?? 'light'];
  const sheetSurface = useThemeColor({}, 'card');
  const sheetSurfaceElevated = useThemeColor({}, 'cardElevated');
  const sheetBorderColor = useThemeColor({}, 'border');
  const sheetTextColor = useThemeColor({}, 'text');
  const sheetMutedColor = useThemeColor({}, 'textMuted');
  const onboardingCardBackground = useThemeColor({}, 'cardElevated');
  const onboardingIconBackground = colorScheme === 'dark' ? Palette.gray700 : Palette.gray50;
  const onboardingIconColor = palette.text;
  const onboardingButtonIconColor = palette.icon;
  const onboardingTitleColor = palette.text;
  const onboardingBodyColor = palette.textMuted;
  const onboardingIndicatorActive = palette.text;
  const onboardingIndicatorInactive = colorScheme === 'dark' ? Palette.gray700 : Palette.gray200;
  const dangerColor = palette.danger;
  const sheetStatBackground = colorScheme === 'dark' ? palette.cardElevated : palette.card;
  const sheetStatBorder = palette.border;
  const { logHistory, logStreakProgress } = useSwipeLoggers();
  const [sessionStats, setSessionStats] = useState<SessionStats>(INITIAL_SESSION_STATS);
  const [missCount, setMissCount] = useState(0);
  const [pendingAnswerCorrect, setPendingAnswerCorrect] = useState<boolean | null>(null);
  const [completionPending, setCompletionPending] = useState(false);
  const [completionTotals, setCompletionTotals] = useState<{ answered: number; correct: number } | null>(null);
  const [isStageTransitioning, setIsStageTransitioning] = useState(false);
  const stageTransitionFromKeyRef = useRef<string | null>(null);
  const stageTransitionStartIdRef = useRef<string | null>(null);
  const stageTransitionStartedAtRef = useRef<number | null>(null);
  const stageTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedSessionIdRef = useRef<string | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const [eliminatedChoiceIds, setEliminatedChoiceIds] = useState<string[] | null>(null);
  const [lifelinesUsed, setLifelinesUsed] = useState({ fifty: false, hint: false });
  const challengeCompletionNotifiedRef = useRef(false);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<SwipeFeedback | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const currentStreakRef = useRef(0);
  const startTimeRef = useRef<number>(Date.now());

  const [sheetFeedback, setSheetFeedback] = useState<SwipeFeedback | null>(null);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const actionsSheetRef = useRef<BottomSheetModal>(null);
  const reportReasonSheetRef = useRef<BottomSheetModal>(null);
  const reportNotesInputRef = useRef<ComponentRef<typeof BottomSheetTextInput>>(null);
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

  useEffect(() => {
    seenQuestionIdsRef.current.clear();
    setActiveExcludeIds(excludeIds ?? []);
  }, [eduLevel]);

  const filterKey = useMemo(() => {
    const parts = [
      category,
      deckSlug ?? 'default',
      grade != null ? `grade:${grade}` : 'grade:any',
      eduLevel ? `edu:${eduLevel}` : 'edu:any',
      subject ? `subject:${subject}` : 'subject:any',
      activeExcludeIds.length ? `exclude:${activeExcludeIds.length}` : 'exclude:none',
      ...(tags ?? []),
    ];
    return parts.join('|');
  }, [activeExcludeIds.length, category, deckSlug, eduLevel, grade, subject, tags]);
  const [sessionId, setSessionId] = useState<string>(() => createSwipeSessionId(filterKey));
  const sessionLoggedRef = useRef(false);
  const streakLoggedRef = useRef(false);
  const previousFilterKey = useRef<string | null>(null);
  const isFilterChanging =
    previousFilterKey.current !== null && previousFilterKey.current !== filterKey;
  const currentQuestionIdRef = useRef<string | null>(null);
  const lastAdvancedQuestionIdRef = useRef<string | null>(null);
  const sessionEpochRef = useRef(0);
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
  const allowedMisses = challenge?.allowedMisses ?? 0;
  const failAfterMisses = allowedMisses + 1;
  const scorePerCorrect = challenge?.scorePerCorrect ?? 100;
  const onboardingFadeAnim = useRef(new Animated.Value(0)).current;
  const onboardingTranslateX = useRef(new Animated.Value(0)).current;
  const indicatorAnims = useRef(
    onboardingSlides.map(() => new Animated.Value(8))
  ).current;
  const [skeletonShimmerAnim, setSkeletonShimmerAnim] = useState(() => new Animated.Value(0));
  const skeletonVisibleRef = useRef(false);

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
      if (stageTransitionTimeoutRef.current) {
        clearTimeout(stageTransitionTimeoutRef.current);
        stageTransitionTimeoutRef.current = null;
      }
      hideResultToast();
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    let animation: Animated.CompositeAnimation | null = null;

    const run = () => {
      if (!isActive) return;
      skeletonShimmerAnim.setValue(0);
      animation = Animated.timing(skeletonShimmerAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      });
      animation.start(({ finished }) => {
        if (finished && isActive) {
          run();
        }
      });
    };

    run();

    return () => {
      isActive = false;
      if (animation) {
        animation.stop();
      }
    };
  }, [skeletonShimmerAnim]);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = await AsyncStorage.getItem(onboardingKey);
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
  }, [indicatorAnims, onboardingFadeAnim, onboardingKey]);

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
      sessionEpochRef.current += 1;
      setSessionStats(INITIAL_SESSION_STATS);
      setMissCount(0);
      if (!persistLifelines) {
        setLifelinesUsed({ fifty: false, hint: false });
      }
      setHintText(null);
      setEliminatedChoiceIds(null);
      setPendingAnswerCorrect(null);
      setCompletionPending(false);
      setCompletionTotals(null);
      completedSessionIdRef.current = null;
      setSelectedIndex(null);
      setFeedback(null);
      setSheetFeedback(null);
      setCurrentStreak(0);
      currentStreakRef.current = 0;
      challengeCompletionNotifiedRef.current = false;
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
    persistLifelines,
    reset,
  ]);

  useEffect(() => {
    if (!isStageTransitioning) return;
    if (!stageTransitionFromKeyRef.current) return;
    if (stageTransitionFromKeyRef.current === filterKey) return;
    if (!current) return;
    if (stageTransitionStartIdRef.current && current.id === stageTransitionStartIdRef.current) {
      return;
    }
    const finishTransition = () => {
      if (__DEV__) {
        console.log('[SwipeStack] stage transition end', {
          fromKey: stageTransitionFromKeyRef.current,
          toKey: filterKey,
          startId: stageTransitionStartIdRef.current,
          currentId: current.id,
        });
      }
      setIsStageTransitioning(false);
      stageTransitionFromKeyRef.current = null;
      stageTransitionStartIdRef.current = null;
      stageTransitionStartedAtRef.current = null;
      stageTransitionTimeoutRef.current = null;
    };
    const MIN_TRANSITION_MS = 500;
    const startedAt = stageTransitionStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, MIN_TRANSITION_MS - elapsed);
    if (remaining === 0) {
      finishTransition();
    } else {
      if (stageTransitionTimeoutRef.current) {
        clearTimeout(stageTransitionTimeoutRef.current);
      }
      stageTransitionTimeoutRef.current = setTimeout(finishTransition, remaining);
    }
  }, [current, filterKey, isStageTransitioning]);

  useEffect(() => {
    currentQuestionIdRef.current = current?.id ?? null;
    if (!current) {
      setSelectedIndex(null);
      setFeedback(null);
      setHintText(null);
      setEliminatedChoiceIds(null);
      lastAdvancedQuestionIdRef.current = null;
      hideResultToast();
      closeSheet();
      closeActionsSheet();
      closeReportReasonSheet();
      return;
    }
    setSelectedIndex(null);
    setFeedback(null);
    setHintText(null);
    setEliminatedChoiceIds(null);
    lastAdvancedQuestionIdRef.current = null;
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
      if (current.id) {
        seenQuestionIdsRef.current.add(current.id);
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
      const optimisticMissDelta = isChallenge && !optimisticIsCorrect ? 1 : 0;
      const optimisticScoreDelta = isChallenge
        ? (optimisticIsCorrect ? scorePerCorrect : 0)
        : (optimisticIsCorrect ? 15 : -5);
      setFeedback(optimisticFeedback);
      setPendingAnswerCorrect(optimisticIsCorrect);
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
          scoreDelta: optimisticScoreDelta,
          streak: optimisticStreak,
        });
      }
      hideResultToast();
      if (optimisticIsCorrect) {
        lightHaptic(); // 정답 시 가벼운 햅틱
      } else {
        mediumHaptic(); // 오답 시 중간 햅틱
      }
      if (optimisticMissDelta) {
        setMissCount((prev) => prev + optimisticMissDelta);
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
        const challengeScoreDelta = response.isCorrect ? scorePerCorrect : 0;
        const scoreDelta = isChallenge
          ? challengeScoreDelta
          : response.isCorrect
            ? Math.round(baseScoreDelta * comboMultiplier)
            : baseScoreDelta;
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
        setPendingAnswerCorrect(null);
        if (isChallenge) {
          if (response.isCorrect !== optimisticIsCorrect) {
            setMissCount((prev) => prev + (response.isCorrect ? -1 : 1));
          }
        }
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
        setPendingAnswerCorrect(null);
        if (optimisticMissDelta) {
          setMissCount((prev) => Math.max(0, prev - optimisticMissDelta));
        }
        hideResultToast();
        showResultToast({
          message: '전송 중 오류가 발생했어요',
        });
      }
    },
    [current, feedback, submitAnswer, sessionKey, getFunctionAuthHeaders, applyUserDelta, isChallenge, scorePerCorrect, user]
  );

  const handleSkip = useCallback(() => {
    if (!current || isChallenge) return;
    closeActionsSheet();
    skip();
    setSelectedIndex(null);
    setFeedback(null);
    closeSheet();
    closeReportReasonSheet();
    hideResultToast();
    // Keep streak when skipping in swipe mode.
    setSessionStats((prev) => ({
      ...prev,
      skipped: prev.skipped + 1,
    }));
    setCardOffset((prev) => prev + 1);
  }, [closeActionsSheet, closeReportReasonSheet, closeSheet, current, isChallenge, skip]);

  const handleReset = useCallback(async () => {
    if (__DEV__) {
      console.log('[SwipeStack] handleReset', {
        sessionId,
        missCount,
        cardOffset,
        totalQuestions: challenge?.totalQuestions ?? null,
      });
    }
    sessionEpochRef.current += 1;
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
    setCardOffset(0);
    setMissCount(0);
    setHintText(null);
    setEliminatedChoiceIds(null);
    setLifelinesUsed({ fifty: false, hint: false });
    setCurrentStreak(0);
    setCompletionPending(false);
    setCompletionTotals(null);
    completedSessionIdRef.current = null;
    lastAdvancedQuestionIdRef.current = null;
    challengeCompletionNotifiedRef.current = false;
    currentQuestionIdRef.current = null;
    startTimeRef.current = Date.now();
    setSessionStats(INITIAL_SESSION_STATS);
    seenQuestionIdsRef.current.clear();
    setActiveExcludeIds(excludeIds ?? []);
    setSessionId(createSwipeSessionId(filterKey));
    sessionLoggedRef.current = false;
    if (isChallenge) {
      onChallengeReset?.();
    }
    try {
      await reset();
    } catch (error) {
      console.warn('Reset failed:', error);
    }
  }, [
    closeActionsSheet,
    closeReportReasonSheet,
    closeSheet,
    filterKey,
    isChallenge,
    onChallengeReset,
    persistLifelines,
    reset,
  ]);

  const handleUseFifty = useCallback(() => {
    if (!isChallenge || lifelinesDisabled || !current || feedback || lifelinesUsed.fifty) {
      return;
    }
    if (!current.correctChoiceId) {
      return;
    }
    const incorrectChoices = current.choices.filter(
      (choice) => choice.id !== current.correctChoiceId
    );
    const removableCount = Math.min(2, Math.max(0, incorrectChoices.length - 1));
    if (removableCount === 0) {
      return;
    }
    const shuffled = [...incorrectChoices].sort(() => Math.random() - 0.5);
    setEliminatedChoiceIds(shuffled.slice(0, removableCount).map((choice) => choice.id));
    setLifelinesUsed((prev) => ({ ...prev, fifty: true }));
    lightHaptic();
  }, [current, feedback, isChallenge, lifelinesDisabled, lifelinesUsed.fifty]);

  const handleUseHint = useCallback(() => {
    if (!isChallenge || lifelinesDisabled || !current || feedback || lifelinesUsed.hint) {
      return;
    }
    const trimmedHint = typeof current.hint === 'string' ? current.hint.trim() : '';
    if (trimmedHint.length > 0) {
      setHintText(`힌트: ${trimmedHint}`);
    } else {
      const resolvedIndex =
        current.correctChoiceIndex ??
        current.choices.findIndex((choice) => choice.id === current.correctChoiceId);
      if (resolvedIndex >= 0) {
        setHintText(`힌트: ${resolvedIndex + 1}번 보기가 맞을 확률이 높아 보여요.`);
      } else {
        setHintText('힌트: 이 보기 쪽이 맞을 확률이 높아 보여요.');
      }
    }
    setLifelinesUsed((prev) => ({ ...prev, hint: true }));
    lightHaptic();
  }, [current, feedback, isChallenge, lifelinesDisabled, lifelinesUsed.hint]);

  useEffect(() => {
    currentStreakRef.current = currentStreak;
  }, [currentStreak]);

  const handleNext = useCallback((questionId?: string, epoch?: number) => {
    if (!current || !feedback) {
      return;
    }
    if (epoch !== undefined && epoch !== sessionEpochRef.current) {
      return;
    }
    if (questionId && current.id && questionId !== current.id) {
      return;
    }
    if (current.id && lastAdvancedQuestionIdRef.current === current.id) {
      return;
    }
    lastAdvancedQuestionIdRef.current = current.id ?? null;
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

  const totalQuestions = challenge?.totalQuestions ?? 0;
  const isChallengeFailed = isChallenge && missCount >= failAfterMisses;
  const answeredForCompletion = sessionStats.answered + (feedback ? 1 : 0);
  const answeredForMetrics = sessionStats.answered + (pendingAnswerCorrect !== null ? 1 : 0);
  const correctForMetrics =
    sessionStats.correct + (pendingAnswerCorrect ? 1 : 0);
  const feedExhausted = !hasMore && queue.length === 0;
  const completionReady = isChallenge
    ? isChallengeFailed ||
    (totalQuestions > 0 && answeredForMetrics >= totalQuestions) ||
    (totalQuestions === 0 && feedExhausted && answeredForMetrics > 0)
    : feedExhausted;
  const effectiveCardOffset = Math.min(cardOffset, answeredForCompletion);
  const hasSwipedLastAnswered =
    answeredForCompletion > 0 && effectiveCardOffset >= answeredForCompletion;
  const hasSwipedToLimit = totalQuestions > 0 && effectiveCardOffset >= totalQuestions;
  // Debug-only: flip to true to force completion card in swipe mode.
  const forceCompletion = __DEV__ && false && !isChallenge;
  const showCompletion = isChallenge
    ? completionPending
    : feedExhausted;
  const shouldShowCompletion = showCompletion || completionPending || forceCompletion;
  const initialLives =
    eduLevel === 'college_basic' || eduLevel === 'college_plus' ? 1 : 2;
  const livesRemaining = Math.max(0, initialLives - missCount);
  const missLabel = `${livesRemaining}`;
  const missLabelColor = livesRemaining === 0 ? palette.textMuted : palette.error;
  const missSummaryHint = useMemo(() => {
    if (!isChallenge) return null;
    return initialLives === 1 ? '목숨 1개 · 오답 1번이면 종료' : '목숨 2개 · 오답 2번이면 종료';
  }, [initialLives, isChallenge]);

  const showAccuracyCard = isChallenge && (isChallengeFailed || Boolean(isFinalStage));
  const useCumulativeAccuracy =
    showAccuracyCard &&
    typeof cumulativeAnswered === 'number' &&
    typeof cumulativeCorrect === 'number';
  const shouldIncludeCurrentStage = isChallenge && shouldShowCompletion;
  const cumulativeAnsweredTotal = useCumulativeAccuracy
    ? cumulativeAnswered + (shouldIncludeCurrentStage ? answeredForMetrics : 0)
    : 0;
  const cumulativeCorrectTotal = useCumulativeAccuracy
    ? cumulativeCorrect + (shouldIncludeCurrentStage ? correctForMetrics : 0)
    : 0;
  const computedAnswered = useCumulativeAccuracy ? cumulativeAnsweredTotal : answeredForMetrics;
  const computedCorrect = useCumulativeAccuracy ? cumulativeCorrectTotal : correctForMetrics;
  const resolvedCompletionTotals = completionTotalsOverride ?? completionTotals;
  const effectiveAnswered = resolvedCompletionTotals?.answered ?? computedAnswered;
  const effectiveCorrect = resolvedCompletionTotals?.correct ?? computedCorrect;
  useEffect(() => {
    if (!__DEV__ || !shouldShowCompletion) return;
    console.log('[SwipeStack] completion visible', {
      sessionId,
      isChallenge,
      isChallengeFailed,
      totalQuestions,
      cardOffset,
      answeredForMetrics,
      effectiveAnswered,
      effectiveCorrect,
      completionReady,
      showCompletion,
      completionPending,
      hasSwipedToLimit,
      hasSwipedLastAnswered,
      feedExhausted,
      hasMore,
      queueLength: queue.length,
      currentId: current?.id ?? null,
    });
  }, [
    answeredForMetrics,
    cardOffset,
    completionPending,
    completionReady,
    current?.id,
    effectiveAnswered,
    effectiveCorrect,
    feedExhausted,
    hasMore,
    hasSwipedLastAnswered,
    hasSwipedToLimit,
    isChallenge,
    isChallengeFailed,
    queue.length,
    sessionId,
    shouldShowCompletion,
    showCompletion,
    totalQuestions,
  ]);
  const accuracyPercent = useMemo(() => {
    if (!effectiveAnswered) return null;
    return Math.round((effectiveCorrect / effectiveAnswered) * 100);
  }, [effectiveAnswered, effectiveCorrect]);
  const normalizedAccuracy = useMemo(
    () => Math.max(0, Math.min(100, accuracyPercent ?? 0)),
    [accuracyPercent]
  );
  const donutSize = 56;
  const donutStroke = 8;
  const donutRadius = (donutSize - donutStroke) / 2;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const correctArcLength = donutCircumference * (normalizedAccuracy / 100);
  const correctRingColor = colorScheme === 'dark' ? '#56CCF2' : '#2D9CDB';

  const totalViewed = sessionStats.answered + sessionStats.skipped;

  const skipPercent = useMemo(() => {
    if (!totalViewed) return null;
    return Math.round((sessionStats.skipped / totalViewed) * 100);
  }, [sessionStats.skipped, totalViewed]);

  const totalXpEarned = useMemo(() => {
    if (!sessionStats.answered) return 0;
    const incorrect = sessionStats.answered - sessionStats.correct;
    return sessionStats.correct * 15 + incorrect * 5;
  }, [sessionStats.answered, sessionStats.correct]);

  const completionTitle = useMemo(() => {
    const answered = effectiveAnswered ?? sessionStats.answered;
    if (isChallenge) {
      const completed = totalQuestions > 0 && answered >= totalQuestions && !isChallengeFailed;
      if (isChallengeFailed) {
        return { icon: 'xmark.seal', label: '챌린지 실패' } as const;
      }
      if (completed) {
        const completionLabel = challengeCompletionLabel ?? '';
        const completionIcon =
          completionLabel === '단계 통과' ? 'checkmark.rectangle.stack' : 'party.popper';
        return {
          icon: completionIcon,
          label: completionLabel,
        } as const;
      }
      return {
        icon: 'rectangle.stack',
        label: '챌린지 결과',
      } as const;
    }
    const completed = answered >= 20;
    return {
      icon: completed ? 'party.popper' : 'rectangle.grid.2x2',
      label: completed
        ? `${answered}문항 완주!`
        : answered > 0
          ? `${answered}문항 풀이 요약`
          : '스와이프 요약',
    } as const;
  }, [
    challengeCompletionLabel,
    effectiveAnswered,
    isChallenge,
    isChallengeFailed,
    sessionStats.answered,
    totalQuestions,
  ]);

  const completionIconName = useMemo<IconSymbolName>(() => {
    switch (completionTitle.icon) {
      case 'xmark.seal':
      case 'party.popper':
      case 'checkmark.rectangle.stack':
      case 'rectangle.stack':
      case 'rectangle.grid.2x2':
        return completionTitle.icon;
      default:
        return 'sparkles';
    }
  }, [completionTitle.icon]);

  const completionProgressLabel = useMemo(() => {
    if (!isChallenge || !showAccuracyCard) return null;
    if (!effectiveAnswered) return null;
    return `${effectiveCorrect} / ${effectiveAnswered} 문항`;
  }, [effectiveAnswered, effectiveCorrect, isChallenge, showAccuracyCard]);
  const completionLevelLabel = useMemo(() => {
    if (!isChallenge) return null;
    return isChallengeFailed
      ? (challengeLevelFailedLabel ?? challengeLevelLabel)
      : challengeLevelLabel;
  }, [challengeLevelFailedLabel, challengeLevelLabel, isChallenge, isChallengeFailed]);

  useEffect(() => {
    if (completionTotalsOverride) {
      if (completionTotals) {
        setCompletionTotals(null);
      }
      return;
    }
    if (!shouldShowCompletion) {
      if (completionTotals) {
        setCompletionTotals(null);
      }
      return;
    }
    if (completionTotals) return;
    if (__DEV__) {
      console.log('[SwipeStack] completionTotals snapshot', {
        computedAnswered,
        computedCorrect,
        cumulativeAnswered,
        cumulativeCorrect,
        answeredForMetrics,
        correctForMetrics,
        shouldShowCompletion,
      });
    }
    setCompletionTotals({ answered: computedAnswered, correct: computedCorrect });
  }, [
    completionTotals,
    completionTotalsOverride,
    computedAnswered,
    computedCorrect,
    pendingAnswerCorrect,
    shouldShowCompletion,
  ]);

  const challengeSummary = useMemo(
    () => ({
      answered: answeredForMetrics,
      correct: correctForMetrics,
      totalAnswered: computedAnswered,
      totalCorrect: computedCorrect,
      missCount,
      totalTimeMs: sessionStats.totalTimeMs,
      totalScoreDelta: sessionStats.totalScoreDelta,
      maxStreak: sessionStats.maxStreak,
      failed: isChallengeFailed,
      sessionId,
    }),
    [
      answeredForMetrics,
      correctForMetrics,
      computedAnswered,
      computedCorrect,
      isChallengeFailed,
      missCount,
      sessionStats.maxStreak,
      sessionStats.totalScoreDelta,
      sessionStats.totalTimeMs,
      sessionId,
    ]
  );

  useEffect(() => {
    if (!isChallenge || !shouldShowCompletion) return;
    if (challengeCompletionNotifiedRef.current) return;
    if (completedSessionIdRef.current === sessionId) return;
    challengeCompletionNotifiedRef.current = true;
    completedSessionIdRef.current = sessionId;
    const questionIds = Array.from(seenQuestionIdsRef.current);
    seenQuestionIdsRef.current.clear();
    if (__DEV__) {
      console.log('[SwipeStack] onChallengeComplete', {
        answered: challengeSummary.answered,
        correct: challengeSummary.correct,
        totalAnswered: challengeSummary.totalAnswered,
        totalCorrect: challengeSummary.totalCorrect,
        missCount: challengeSummary.missCount,
        failed: challengeSummary.failed,
        sessionId,
      });
      console.log('[SwipeStack] completion debug', {
        eduLevel,
        challengeLevelLabel,
        isFinalStage,
        isChallengeFailed,
        answeredForMetrics,
        correctForMetrics,
        computedAnswered,
        computedCorrect,
        cumulativeAnswered,
        cumulativeCorrect,
        completionTotalsOverride,
        completionTotals,
        effectiveAnswered,
        effectiveCorrect,
        showCompletion,
        completionPending,
        shouldShowCompletion,
        totalQuestions,
        cardOffset,
        sessionAnswered: sessionStats.answered,
        sessionCorrect: sessionStats.correct,
        pendingAnswerCorrect,
      });
    }
    onChallengeComplete?.({
      ...challengeSummary,
      questionIds,
    });
  }, [
    challengeSummary,
    eduLevel,
    isChallenge,
    onChallengeComplete,
    shouldShowCompletion,
    sessionId,
  ]);

  useEffect(() => {
    if (!showCompletion && !completionReady && completionPending) {
      setCompletionPending(false);
    }
  }, [completionPending, completionReady, showCompletion]);

  const challengeSecondaryLabel = useMemo(() => {
    if (isChallengeFailed) {
      return onExit ? '과목 선택으로' : null;
    }
    if (onChallengeAdvance) {
      return challengeAdvanceLabel ?? '다음 학년';
    }
    return onExit ? '과목 선택으로' : null;
  }, [challengeAdvanceLabel, isChallengeFailed, onChallengeAdvance, onExit]);

  const handleChallengeSecondary = useCallback(() => {
    if (!isChallengeFailed && onChallengeAdvance) {
      stageTransitionFromKeyRef.current = filterKey;
      stageTransitionStartIdRef.current = current?.id ?? null;
      stageTransitionStartedAtRef.current = Date.now();
      if (stageTransitionTimeoutRef.current) {
        clearTimeout(stageTransitionTimeoutRef.current);
        stageTransitionTimeoutRef.current = null;
      }
      if (__DEV__) {
        console.log('[SwipeStack] stage transition start', {
          filterKey,
          currentId: current?.id ?? null,
          isStageTransitioning,
        });
      }
      setIsStageTransitioning(true);
      onChallengeAdvance();
      return;
    }
    onExit?.();
  }, [current?.id, filterKey, isChallengeFailed, isStageTransitioning, onChallengeAdvance, onExit]);

  const totalScoreLabel = useMemo(() => {
    if (!sessionStats.answered) return '+0';
    const value = Math.round(sessionStats.totalScoreDelta);
    return `${value >= 0 ? '+' : ''}${value}`;
  }, [sessionStats.answered, sessionStats.totalScoreDelta]);

  useEffect(() => {
    if (!shouldShowCompletion) {
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
    shouldShowCompletion,
    tags,
    getFunctionAuthHeaders,
    applyUserDelta,
    user,
  ]);

  useEffect(() => {
    if (!shouldShowCompletion) return;
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
    shouldShowCompletion,
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
    if (completionReady && feedback) {
      setCompletionPending(true);
      return;
    }
    showResultToast({
      message: '문제를 풀어야 다음 카드로 이동할 수 있어요.',
    });
  }, [completionReady, feedback]);

  const handleOpenCompletion = useCallback(() => {
    if (!completionReady) return;
    setCompletionPending(true);
  }, [completionReady]);

  const handleOpenOnboarding = useCallback(() => {
    if (showOnboarding) return;
    setShowOnboarding(true);
    setOnboardingSlideIndex(0);
    onboardingTranslateX.setValue(0);
    indicatorAnims.forEach((anim, index) => {
      anim.setValue(index === 0 ? 24 : 8);
    });
    Animated.timing(onboardingFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [indicatorAnims, onboardingFadeAnim, onboardingTranslateX, showOnboarding]);

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
  }, [indicatorAnims, onboardingFadeAnim, onboardingKey, onboardingTranslateX]);

  const handleCompleteOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(onboardingKey, 'true');
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
    if (onboardingSlideIndex < onboardingSlides.length - 1) {
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
  }, [indicatorAnims, onboardingSlideIndex, onboardingSlides.length, onboardingTranslateX]);

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
            -(onboardingSlides.length - 1 - onboardingSlideIndex) * ONBOARDING_SLIDE_WIDTH;
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
          else if (gesture.dx < -SWIPE_THRESHOLD && onboardingSlideIndex < onboardingSlides.length - 1) {
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
    [onboardingSlideIndex, onboardingSlides.length, onboardingTranslateX, handleNextOnboardingSlide, handlePrevOnboardingSlide]
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

  const skeletonBlockColor = colorScheme === 'dark' ? Palette.gray600 : Palette.gray150;
  const renderSkeletonCard = useCallback(() => {
    const skeletonWidth = Math.max(0, WINDOW_WIDTH - Spacing.xl * 2);
    const shimmerWidth = Math.max(80, Math.floor(skeletonWidth * 0.35));
    const shimmerTranslateX = skeletonShimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-shimmerWidth, skeletonWidth + shimmerWidth],
    });
    const shimmerCoreColor =
      colorScheme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.45)';
    const shimmerEdgeColor =
      colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.18)';
    return (
      <View style={styles.skeletonWrapper}>
        <View
          style={[
            styles.skeletonCard,
            {
              height: stackHeight,
              backgroundColor: palette.cardElevated,
              borderColor: palette.border,
            },
          ]}
        >
          <View style={styles.skeletonHeader}>
            <View style={[styles.skeletonBadge, { backgroundColor: skeletonBlockColor }]} />
            <View
              style={[
                styles.skeletonBadge,
                styles.skeletonBadgeSmall,
                { backgroundColor: skeletonBlockColor },
              ]}
            />
          </View>
          <View style={styles.skeletonPrompt}>
            <View style={[styles.skeletonLine, { backgroundColor: skeletonBlockColor }]} />
            <View
              style={[
                styles.skeletonLine,
                { width: '92%', backgroundColor: skeletonBlockColor },
              ]}
            />
            <View
              style={[
                styles.skeletonLine,
                { width: '74%', backgroundColor: skeletonBlockColor },
              ]}
            />
          </View>
          <View style={styles.skeletonChoices}>
            <View style={[styles.skeletonChoice, { backgroundColor: skeletonBlockColor }]} />
            <View style={[styles.skeletonChoice, { backgroundColor: skeletonBlockColor }]} />
            <View style={[styles.skeletonChoice, { backgroundColor: skeletonBlockColor }]} />
            <View style={[styles.skeletonChoice, { backgroundColor: skeletonBlockColor }]} />
          </View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.skeletonShimmer,
              { width: shimmerWidth, transform: [{ translateX: shimmerTranslateX }] },
            ]}
          >
            <LinearGradient
              colors={['transparent', shimmerEdgeColor, shimmerCoreColor, shimmerEdgeColor, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.skeletonShimmerGradient}
            />
          </Animated.View>
        </View>
      </View>
    );
  }, [
    colorScheme,
    palette.cardElevated,
    palette.border,
    skeletonBlockColor,
    skeletonShimmerAnim,
    stackHeight,
  ]);

  const isTransitioning = isStageTransitioning || isFilterChanging;
  const forceSkeleton = __DEV__ && false;
  const shouldShowLoading = !current && !shouldShowCompletion && (isLoading || hasMore);
  const isShowingSkeleton = isTransitioning || forceSkeleton || shouldShowLoading;
  const skeletonTopOffset =
    Spacing.sm + (isChallenge ? Spacing.lg : Spacing.md + Spacing.md) + 4;

  useEffect(() => {
    if (!isShowingSkeleton) {
      skeletonVisibleRef.current = false;
      return;
    }
    if (skeletonVisibleRef.current) return;
    skeletonVisibleRef.current = true;
    setSkeletonShimmerAnim(new Animated.Value(0));
  }, [isShowingSkeleton]);

  if (isTransitioning || forceSkeleton) {
    return (
      <View style={styles.emptyState}>
        <View style={{ height: skeletonTopOffset }} />
        {renderSkeletonCard()}
      </View>
    );
  }

  const shouldShowLoadingWithForce =
    forceSkeleton || (!current && !shouldShowCompletion && (isLoading || hasMore));

  if (!current && !shouldShowCompletion) {
    return (
      <View style={styles.emptyState}>
        {shouldShowLoadingWithForce ? (
          <>
            <View style={{ height: skeletonTopOffset }} />
            {renderSkeletonCard()}
          </>
        ) : null}
      </View>
    );
  }

  const swipeEpoch = sessionEpochRef.current;

  return (
    <BottomSheetModalProvider>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={
            shouldShowCompletion
              ? [styles.scrollContent, styles.scrollContentCompletion]
              : styles.scrollContent
          }
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {shouldShowCompletion ? (
            <View
              style={[
                styles.completionCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <View style={styles.completionHeader}>
                <View style={styles.completionHeaderLeft}>
                  <IconSymbol name={completionIconName} size={28} color={palette.text} />
                  <ThemedText style={styles.completionTitle}>{completionTitle.label}</ThemedText>
                </View>
                {challengeSubjectLabel ? (
                  <View
                    style={[
                      styles.completionSubjectChip,
                      { backgroundColor: palette.cardElevated, borderColor: palette.border },
                    ]}
                  >
                    <ThemedText
                      style={styles.completionSubjectText}
                      lightColor={palette.textMuted}
                      darkColor={Palette.gray200}
                    >
                      {challengeSubjectLabel}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <View style={styles.completionMetrics}>
                {isChallenge && completionLevelLabel && (isChallengeFailed || isFinalStage) ? (
                  <View
                    style={[
                      styles.completionMetric,
                      styles.completionMetricFull,
                      styles.completionLevelCard,
                      { backgroundColor: palette.cardElevated, borderColor: palette.border },
                    ]}
                  >
                    <View style={styles.completionLevelHeader}>
                      <View
                        style={[
                          styles.completionLevelIcon,
                          { backgroundColor: palette.card, borderColor: palette.border },
                        ]}
                      >
                        <IconSymbol name="brain" size={18} color={palette.text} />
                      </View>
                      <ThemedText
                        style={styles.completionMetricLabel}
                        lightColor={palette.textMuted}
                        darkColor={Palette.gray200}
                      >
                        내 수준
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.completionMetricValue}>{completionLevelLabel}</ThemedText>
                  </View>
                ) : null}
                {showAccuracyCard ? (
                  <View
                    style={[
                      styles.completionMetric,
                      styles.completionMetricFull,
                      { backgroundColor: palette.cardElevated, borderColor: palette.border },
                    ]}
                  >
                    <View style={styles.completionAccuracyHeader}>
                      <View
                        style={[
                          styles.completionAccuracyIcon,
                          { backgroundColor: palette.card, borderColor: palette.border },
                        ]}
                      >
                        <IconSymbol name="target" size={18} color={palette.text} />
                      </View>
                      <ThemedText
                        style={styles.completionMetricLabel}
                        lightColor={palette.textMuted}
                        darkColor={Palette.gray200}
                      >
                        정답률
                      </ThemedText>
                    </View>
                    <View style={styles.completionAccuracyRow}>
                      <View style={styles.completionAccuracyText}>
                        {completionProgressLabel ? (
                          <ThemedText style={styles.completionAccuracyValue}>
                            {completionProgressLabel}
                          </ThemedText>
                        ) : null}
                      </View>
                      <View style={styles.completionDonut}>
                        <Svg width={donutSize} height={donutSize}>
                          <Circle
                            cx={donutSize / 2}
                            cy={donutSize / 2}
                            r={donutRadius}
                            stroke={palette.danger}
                            strokeWidth={donutStroke}
                            fill="none"
                            strokeLinecap="butt"
                            transform={`rotate(-90 ${donutSize / 2} ${donutSize / 2})`}
                          />
                          <Circle
                            cx={donutSize / 2}
                            cy={donutSize / 2}
                            r={donutRadius}
                            stroke={correctRingColor}
                            strokeWidth={donutStroke}
                            fill="none"
                            strokeDasharray={`${correctArcLength} ${Math.max(0, donutCircumference - correctArcLength)}`}
                            strokeLinecap="butt"
                            transform={`rotate(-90 ${donutSize / 2} ${donutSize / 2})`}
                          />
                        </Svg>
                        <View style={styles.completionDonutCenter}>
                          <ThemedText style={styles.completionDonutText}>
                            {accuracyPercent !== null ? `${accuracyPercent}%` : '-'}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : null}
                {isGuest ? (
                  <View
                    style={[
                      styles.completionMetric,
                      styles.completionMetricFull,
                      { backgroundColor: palette.cardElevated, borderColor: palette.border },
                    ]}
                  >
                    <View style={styles.completionAccuracyHeader}>
                      <View
                        style={[
                          styles.completionAccuracyIcon,
                          { backgroundColor: palette.card, borderColor: palette.border },
                        ]}
                      >
                        <IconSymbol name="lock" size={18} color={palette.text} />
                      </View>
                      <ThemedText
                        style={styles.completionMetricLabel}
                        lightColor={palette.textMuted}
                        darkColor={Palette.gray200}
                      >
                        로그인 필요
                      </ThemedText>
                    </View>
                    <View style={styles.completionInfoRow}>
                      <ThemedText style={styles.completionMetricValue}>
                        점수/XP는 로그인 후 제공
                      </ThemedText>
                    </View>
                  </View>
                ) : (
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
                )}
                {!isChallenge ? (
                  <>
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
                      <View style={styles.completionMetricInline}>
                        <ThemedText style={styles.completionMetricValue}>
                          {accuracyPercent !== null ? `${accuracyPercent}%` : '-'}
                        </ThemedText>
                        <ThemedText
                          style={styles.completionMetricInlineHint}
                          lightColor={palette.textMuted}
                          darkColor={Palette.gray200}
                        >
                          {sessionStats.correct}/{Math.max(sessionStats.answered, 1)}
                        </ThemedText>
                      </View>
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
                        스킵율
                      </ThemedText>
                      <View style={styles.completionMetricInline}>
                        <ThemedText style={styles.completionMetricValue}>
                          {skipPercent !== null ? `${skipPercent}%` : '-'}
                        </ThemedText>
                        <ThemedText
                          style={styles.completionMetricInlineHint}
                          lightColor={palette.textMuted}
                          darkColor={Palette.gray200}
                        >
                          {sessionStats.skipped}/{Math.max(totalViewed, 1)}
                        </ThemedText>
                      </View>
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
                        최고 스트릭
                      </ThemedText>
                      <ThemedText style={styles.completionMetricValue}>
                        {sessionStats.maxStreak}
                      </ThemedText>
                    </View>
                  </>
                ) : null}
                {isGuest ? null : (
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
                )}
              </View>
              <View style={styles.completionActions}>
                {!isChallenge || isChallengeFailed ? (
                  <Button
                    size="lg"
                    fullWidth
                    onPress={handleReset}
                    style={styles.completionActionButton}
                  >
                    다시 도전
                  </Button>
                ) : null}
                {isChallenge ? (
                  <>
                    {challengeSecondaryLabel ? (
                      <Button
                        size="lg"
                        variant="outline"
                        fullWidth
                        onPress={handleChallengeSecondary}
                        style={styles.completionActionButton}
                      >
                        {challengeSecondaryLabel}
                      </Button>
                    ) : null}
                    {!isChallengeFailed && isGuest ? (
                      <Button
                        size="lg"
                        variant="default"
                        fullWidth
                        onPress={() => void signInWithGoogle()}
                        style={styles.completionActionButton}
                      >
                        로그인
                      </Button>
                    ) : null}
                  </>
                ) : isGuest ? (
                  <Button
                    size="lg"
                    variant="outline"
                    fullWidth
                    onPress={() => void signInWithGoogle()}
                    style={styles.completionActionButton}
                  >
                    로그인
                  </Button>
                ) : null}
              </View>
            </View>
          ) : isChallenge ? (
            <View style={styles.challengeStatusWrapper}>
              <View style={styles.challengeStatusRow}>
                <View style={styles.challengeStatusLeft}>
                  <Button
                    variant="ghost"
                    size="icon"
                    rounded="full"
                    onPress={handleOpenOnboarding}
                    disabled={showOnboarding}
                    accessibilityLabel="룰 다시보기"
                    leftIcon={<IconSymbol name="questionmark.circle" size={22} color={onboardingButtonIconColor} />}
                    style={styles.onboardingButton}
                  />
                </View>
                <View style={styles.challengeStatusRight}>
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
                  <IconSymbol name="heart.fill" size={16} color={missLabelColor} />
                  <ThemedText style={[styles.statusText, { color: missLabelColor }]}>
                    {missLabel}
                  </ThemedText>
                </View>
              </View>
              {completionReady && !shouldShowCompletion ? (
                <Pressable
                  onPress={handleOpenCompletion}
                  style={[
                    styles.completionCta,
                    { backgroundColor: palette.cardElevated, borderColor: palette.border },
                  ]}
                >
                  <View style={styles.completionCtaContent}>
                    <ThemedText style={styles.completionCtaLabel}>단계 종료</ThemedText>
                    <View style={styles.completionCtaAction}>
                      <ThemedText style={styles.completionCtaActionText}>결과 보기</ThemedText>
                      <IconSymbol name="chevron.right" size={16} color={palette.text} />
                    </View>
                  </View>
                </Pressable>
              ) : null}
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
                <Button
                  variant="ghost"
                  size="icon"
                  rounded="full"
                  onPress={handleOpenOnboarding}
                  disabled={showOnboarding}
                  accessibilityLabel="룰 다시보기"
                  leftIcon={<IconSymbol name="questionmark.circle" size={22} color={onboardingButtonIconColor} />}
                  style={styles.onboardingButton}
                />
              </View>
            </View>
          )}
          {shouldShowCompletion ? null : (
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
                  showDifficultyBadge={!isChallenge}
                  hintText={index === 0 ? hintText : null}
                  eliminatedChoiceIds={index === 0 ? eliminatedChoiceIds ?? undefined : undefined}
                  selectedIndex={index === 0 ? selectedIndex : null}
                  feedback={index === 0 ? feedback : null}
                  onSelectChoice={index === 0 ? handleSelect : () => undefined}
                  onSwipeNext={index === 0 ? () => handleNext(card.id, swipeEpoch) : () => undefined}
                  onOpenActions={handleActions}
                  onSwipeBlocked={index === 0 ? handleSwipeBlocked : undefined}
                  swipeEnabled={index === 0 ? !completionReady : false}
                  blockSwipeNext={index === 0 ? completionReady : false}
                  onCardLayout={index === 0 ? handleActiveCardLayout : undefined}
                />
              ))}
            </View>
          )}
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
          bottomInset={isChallenge ? insets.bottom + Spacing.lg : 0}
          enablePanDownToClose
          enableDynamicSizing
          enableOverDrag={false}
          keyboardBehavior="interactive"
          android_keyboardInputMode="adjustResize"
        >
          <BottomSheetView style={styles.actionsSheetContent}>
            {isChallenge ? (
              <>
                <View style={styles.actionsHeader}>
                  <ThemedText style={styles.sheetTitle}>치트 아이템</ThemedText>
                  <ThemedText style={[styles.lifelineSubtitle, { color: sheetMutedColor }]}>
                    {lifelinesDisabled
                      ? '대학 단계는 치트를 사용할 수 없어요.'
                      : '초등~고등 각 단계에서 50:50, 힌트 각 1회씩 사용 가능해요.'}
                  </ThemedText>
                </View>
                <View style={styles.actionsList}>
                  <Button
                    variant="outline"
                    size="lg"
                    onPress={handleUseFifty}
                    disabled={!current || !!feedback || lifelinesDisabled || lifelinesUsed.fifty}
                  >
                    {lifelinesUsed.fifty ? '50:50 (사용 완료)' : '50:50'}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onPress={handleUseHint}
                    disabled={!current || !!feedback || lifelinesDisabled || lifelinesUsed.hint}
                  >
                    {lifelinesUsed.hint ? '힌트 (사용 완료)' : '힌트'}
                  </Button>
                </View>
                <Button
                  size="lg"
                  onPress={closeActionsSheet}
                >
                  닫기
                </Button>
              </>
            ) : (
              <>
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
              </>
            )}
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
              <BottomSheetTextInput
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
          bottomInset={insets.bottom + Spacing.lg}
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
              {!isChallenge ? (
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
              ) : null}
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
                    width: ONBOARDING_SLIDE_WIDTH * onboardingSlides.length,
                    transform: [{ translateX: onboardingTranslateX }],
                  },
                ]}
              >
                {onboardingSlides.map((slide) => (
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
                {onboardingSlides.map((_, index) => (
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
  scrollContentCompletion: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
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
    gap: 0,
  },
  onboardingButton: {
    width: 36,
    height: 36,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  challengeStatusWrapper: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    marginTop: 0,
    position: 'relative',
    zIndex: 2,
  },
  challengeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  challengeStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  challengeStatusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  lifelineGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
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
  completionSubtitle: {
    fontSize: 13,
  },
  completionMeta: {
    fontSize: 12,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  completionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  completionSubjectChip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  completionSubjectText: {
    fontSize: 12,
    fontWeight: '600',
  },
  completionAccuracyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  completionAccuracyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionAccuracyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
  },
  completionAccuracyText: {
    flexShrink: 0,
    gap: Spacing.xs,
    alignItems: 'flex-start',
  },
  completionAccuracyValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  completionInfoRow: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionDonut: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  completionDonutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionDonutText: {
    fontSize: 14,
    fontWeight: '700',
  },
  completionContext: {
    fontSize: 13,
    color: Palette.gray500,
  },
  completionMetrics: {
    flexDirection: 'column',
    gap: Spacing.sm,
  },
  completionMetric: {
    width: '100%',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.xs / 2,
    alignItems: 'center',
  },
  completionLevelCard: {
    gap: Spacing.sm,
  },
  completionLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  completionLevelIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionMetricFull: {
    flexBasis: '100%',
    maxWidth: '100%',
  },
  completionMetricLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  completionMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
  },
  completionMetricHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  completionMetricInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  completionMetricInlineHint: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'left',
  },
  completionCta: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  completionCtaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completionCtaLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  completionCtaAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  completionCtaActionText: {
    fontSize: 13,
    fontWeight: '600',
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
    justifyContent: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  skeletonWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  skeletonCard: {
    width: '100%',
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    shadowColor: '#2F288040',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    overflow: 'hidden',
  },
  skeletonShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
  },
  skeletonShimmerGradient: {
    flex: 1,
    width: '100%',
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  skeletonBadge: {
    height: 22,
    borderRadius: Radius.pill,
    width: 88,
    opacity: 0.9,
  },
  skeletonBadgeSmall: {
    width: 56,
  },
  skeletonPrompt: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  skeletonLine: {
    height: 14,
    borderRadius: Radius.pill,
    width: '100%',
    opacity: 0.85,
  },
  skeletonChoices: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  skeletonChoice: {
    height: 44,
    borderRadius: Radius.md,
    opacity: 0.8,
  },
  bottomSheetBackground: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  bottomSheetContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  actionsSheetContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  actionsHeader: {
    gap: Spacing.xs,
  },
  actionsList: {
    gap: Spacing.sm,
  },
  lifelineSubtitle: {
    fontSize: 13,
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
