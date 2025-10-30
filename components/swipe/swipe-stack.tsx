import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { hideResultToast, showResultToast } from '@/components/common/result-toast';
import { ThemedText } from '@/components/themed-text';
import { Colors, Palette, Radius, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSwipeFeed, type SwipeFeedQuestion } from '@/lib/feed';
import { errorHaptic, lightHaptic, mediumHaptic, successHaptic } from '@/lib/haptics';
import { useMutation } from 'convex/react';

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
};

const INITIAL_SESSION_STATS: SessionStats = {
  answered: 0,
  correct: 0,
  totalTimeMs: 0,
  totalScoreDelta: 0,
  maxStreak: 0,
};

const MIN_STACK_HEIGHT = 420;

const createSwipeSessionId = (key: string) => `swipe:${key}:${Date.now()}`;

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
  } = useSwipeFeed({ category, tags, limit: 20 });
  const { signInWithGoogle, status: authStatus } = useAuth();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const logHistory = useMutation(api.history.logEntry);
  const [sessionStats, setSessionStats] = useState<SessionStats>(INITIAL_SESSION_STATS);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<SwipeFeedback | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const [sheetFeedback, setSheetFeedback] = useState<SwipeFeedback | null>(null);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const actionsSheetRef = useRef<BottomSheetModal>(null);
  const reportReasonSheetRef = useRef<BottomSheetModal>(null);
  const reportNotesInputRef = useRef<TextInput>(null);
  const handleSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index);
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
  const previousFilterKey = useRef<string | null>(null);
  const currentQuestionIdRef = useRef<string | null>(null);
  type ReportPayload = Parameters<typeof reportQuestion>[0];
  const [reportReason, setReportReason] = useState<ReportReasonKey | null>(null);
  const [reportNotes, setReportNotes] = useState('');
  const [reportQuestionId, setReportQuestionId] = useState<ReportPayload['questionId'] | null>(null);
  const [reportSubject, setReportSubject] = useState<SwipeFeedQuestion | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [activeCardHeight, setActiveCardHeight] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      hideResultToast();
    };
  }, []);

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
      hideResultToast();
      closeSheet();
      closeActionsSheet();
      closeReportReasonSheet();
      reset();
      setSessionId(createSwipeSessionId(filterKey));
      sessionLoggedRef.current = false;
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
      hideResultToast();
      if (optimisticIsCorrect) {
        lightHaptic(); // 정답 시 가벼운 햅틱
      } else {
        mediumHaptic(); // 오답 시 중간 햅틱
      }
      showResultToast({
        message: optimisticIsCorrect ? '정답' : '오답',
        kind: optimisticIsCorrect ? 'success' : 'error',
      });
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
        const confirmedFeedback: SwipeFeedback = {
          status: 'confirmed',
          isCorrect: response.isCorrect,
          correctChoiceId: response.correctChoiceId,
          correctChoiceIndex:
            confirmedCorrectIndex != null && confirmedCorrectIndex >= 0
              ? confirmedCorrectIndex
              : null,
          explanation: response.explanation,
          scoreDelta: response.scoreDelta,
          streak: response.streak,
        };
        const measuredTimeMs = Math.max(0, response.timeMs ?? timeMs);
        const scoreDelta = response.scoreDelta ?? 0;
        const responseStreak = response.streak ?? 0;
        setSessionStats((prev) => {
          const answered = prev.answered + 1;
          const correct = prev.correct + (response.isCorrect ? 1 : 0);
          const totalTimeMs = prev.totalTimeMs + measuredTimeMs;
          const totalScoreDelta = prev.totalScoreDelta + scoreDelta;
          const maxStreak = Math.max(prev.maxStreak, responseStreak);
          return {
            answered,
            correct,
            totalTimeMs,
            totalScoreDelta,
            maxStreak,
          };
        });
        const stillCurrent = currentQuestionIdRef.current === questionId;
        if (stillCurrent) {
          setFeedback(confirmedFeedback);
          setSheetFeedback(confirmedFeedback);
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
            streak: responseStreak,
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
          kind: 'neutral',
        });
      }
    },
    [current, feedback, submitAnswer]
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

  const handleNext = useCallback(() => {
    if (!current || !feedback) {
      return;
    }
    closeSheet();
    advance();
  }, [advance, closeSheet, current, feedback]);

  const handleToggleBookmarkAction = useCallback(() => {
    if (!current) return;
    closeActionsSheet();
    if (isGuest) {
      showResultToast({
        message: '로그인 후 문항을 저장할 수 있어요.',
        kind: 'neutral',
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
          kind: 'neutral',
        })
      )
      .catch(() =>
        showResultToast({
          message: '저장에 실패했어요.',
          kind: 'neutral',
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

  const averageSeconds = useMemo(() => {
    if (!sessionStats.answered) return null;
    return sessionStats.totalTimeMs / sessionStats.answered / 1000;
  }, [sessionStats.answered, sessionStats.totalTimeMs]);

  const formattedAverageSeconds = useMemo(() => {
    if (averageSeconds === null) return '-';
    const fixed = averageSeconds >= 10 ? averageSeconds.toFixed(1) : averageSeconds.toFixed(2);
    return fixed.replace(/\.0+$/, '');
  }, [averageSeconds]);

  const completionTitle = useMemo(() => {
    const answered = sessionStats.answered;
    if (!answered) return '🎉 스와이프 완주!';
    return `🎉 ${answered}문항 완주!`;
  }, [sessionStats.answered]);

  const completionHighlight = useMemo(() => {
    if (!sessionStats.answered || accuracyPercent === null) {
      return '문항을 풀면 결과 요약을 볼 수 있어요.';
    }
    return `정답률 ${accuracyPercent}% · 평균 반응속도 ${formattedAverageSeconds}초 ⚡`;
  }, [accuracyPercent, formattedAverageSeconds, sessionStats.answered]);

  const totalScoreLabel = useMemo(() => {
    if (!sessionStats.answered) return '+0';
    const value = Math.round(sessionStats.totalScoreDelta);
    return `${value >= 0 ? '+' : ''}${value}`;
  }, [sessionStats.answered, sessionStats.totalScoreDelta]);

  const completionContext = useMemo(() => {
    if (!sessionStats.answered) {
      return '다음 카드도 빠르게 스와이프해보세요!';
    }
    return `정답 ${sessionStats.correct}/${sessionStats.answered}문항`;
  }, [sessionStats.answered, sessionStats.correct]);

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
        await logHistory({
          mode: 'swipe',
          sessionId,
          data: {
            category,
            tags: tags && tags.length ? tags : undefined,
            answered: sessionStats.answered,
            correct: sessionStats.correct,
            maxStreak: sessionStats.maxStreak,
            avgResponseMs,
            totalScoreDelta: sessionStats.totalScoreDelta,
          },
        });
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
  ]);

  const handleOpenSheet = useCallback(() => {
    if (feedback?.status === 'confirmed' && feedback.explanation) {
      setSheetFeedback(feedback);
      bottomSheetRef.current?.present();
    }
  }, [feedback]);

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
        kind: 'neutral',
      });
    } catch (error) {
      console.warn('Report submission failed', error);
      showResultToast({
        message: '신고 전송 실패',
        kind: 'neutral',
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

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.35}
        pressBehavior="close"
      />
    ),
    []
  );

  if (!current && !showCompletion) {
    return (
      <View style={styles.emptyState}>
        {isLoading ? (
          <ActivityIndicator color={palette.secondary} />
        ) : (
          <ThemedText style={styles.emptyText}>카드를 불러오는 중...</ThemedText>
        )}
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
            <View style={styles.completionCard}>
              <ThemedText style={styles.completionTitle}>{completionTitle}</ThemedText>
              <ThemedText
                style={styles.completionHighlight}
                lightColor={palette.primary}
                darkColor={palette.primary}
              >
                {completionHighlight}
              </ThemedText>
              <ThemedText style={styles.completionContext}>{completionContext}</ThemedText>
              <View style={styles.completionMetrics}>
                <View style={styles.completionMetric}>
                  <ThemedText style={styles.completionMetricLabel}>최고 연속 정답</ThemedText>
                  <ThemedText style={styles.completionMetricValue}>
                    {sessionStats.maxStreak}문항
                  </ThemedText>
                </View>
                <View style={styles.completionMetric}>
                  <ThemedText style={styles.completionMetricLabel}>획득 점수</ThemedText>
                  <ThemedText style={styles.completionMetricValue}>{totalScoreLabel}</ThemedText>
                </View>
              </View>
              <ThemedText style={styles.completionNote} lightColor={palette.textMuted} darkColor={palette.textMuted}>
                다시 도전해서 연속 정답 횟수를 늘려보세요.
              </ThemedText>
              <View style={styles.completionActions}>
                <Pressable style={styles.primaryButton} onPress={handleReset}>
                  <ThemedText style={styles.primaryButtonLabel} lightColor="#fff" darkColor="#fff">
                    다시 도전
                  </ThemedText>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => setSelectedCategory(null)}>
                  <ThemedText style={styles.secondaryButtonLabel}>다른 카테고리</ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.statusRow}>
              <ThemedText style={styles.statusText}>남은 카드 {prefetchCount}장</ThemedText>
              <Pressable
                style={[
                  styles.sheetLink,
                  !(feedback?.status === 'confirmed' && feedback.explanation) &&
                  styles.sheetLinkHidden,
                ]}
                onPress={handleOpenSheet}
                disabled={!(feedback?.status === 'confirmed' && feedback.explanation)}
              >
                <ThemedText
                  style={[
                    styles.sheetLinkText,
                    !(feedback?.status === 'confirmed' && feedback.explanation) &&
                    styles.sheetLinkTextHidden,
                  ]}
                >
                  해설 보기
                </ThemedText>
              </Pressable>
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
          backgroundStyle={styles.bottomSheetBackground}
          backdropComponent={renderBackdrop}
          enablePanDownToClose
          enableDynamicSizing
          enableOverDrag={false}
          keyboardBehavior="interactive"
          android_keyboardInputMode="adjustResize"
        >
          <BottomSheetView style={styles.actionsSheetContent}>
            <View style={styles.actionsList}>
              <Pressable style={styles.actionButton} onPress={handleSkip}>
                <ThemedText style={styles.actionButtonLabel}>문항 건너뛰기</ThemedText>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={handleReportAction}>
                <ThemedText style={styles.actionButtonLabel}>신고하기</ThemedText>
              </Pressable>
            </View>
            <Pressable style={styles.actionCancelButton} onPress={closeActionsSheet}>
              <ThemedText style={styles.actionCancelLabel}>취소</ThemedText>
            </Pressable>
          </BottomSheetView>
        </BottomSheetModal>

        <BottomSheetModal
          ref={reportReasonSheetRef}
          onDismiss={handleReportSheetDismiss}
          backgroundStyle={styles.bottomSheetBackground}
          backdropComponent={renderBackdrop}
          enablePanDownToClose
          enableDynamicSizing
          enableOverDrag={false}
          keyboardBehavior="interactive"
          android_keyboardInputMode="adjustResize"
        >
          <BottomSheetView style={styles.reportSheetContent}>
            <ThemedText style={styles.sheetTitle}>문항 신고</ThemedText>
            <ThemedText style={styles.reportSubtitle}>
              신고 사유를 선택해주세요.
            </ThemedText>
            <View style={styles.reportOptions}>
              {REPORT_REASONS.map((option) => {
                const isSelected = reportReason === option.key;
                return (
                  <Pressable
                    key={option.key}
                    style={[
                      styles.reportOption,
                      isSelected && styles.reportOptionSelected,
                    ]}
                    onPress={() => setReportReason(option.key)}
                  >
                    <ThemedText
                      style={[
                        styles.reportOptionLabel,
                        isSelected && styles.reportOptionLabelSelected,
                      ]}
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
                style={styles.reportInput}
                multiline
                placeholder="신고 사유를 자세히 적어주세요."
                placeholderTextColor="#9C96C6"
                value={reportNotes}
                onChangeText={setReportNotes}
                textAlignVertical="top"
                returnKeyType="done"
                editable={!isSubmittingReport}
              />
            ) : null}
            <Pressable
              style={[
                styles.reportSubmitButton,
                !canSubmitReport && styles.reportSubmitButtonDisabled,
              ]}
              onPress={handleSubmitReport}
              disabled={!canSubmitReport}
            >
              {isSubmittingReport ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText
                  style={styles.reportSubmitLabel}
                  lightColor="#fff"
                  darkColor="#fff"
                >
                  신고 제출
                </ThemedText>
              )}
            </Pressable>
          </BottomSheetView>
        </BottomSheetModal>

        <BottomSheetModal
          ref={bottomSheetRef}
          onDismiss={handleSheetDismiss}
          onChange={handleSheetChanges}
          backgroundStyle={styles.bottomSheetBackground}
          backdropComponent={renderBackdrop}
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
                <View style={styles.sheetStat}>
                  <ThemedText style={styles.sheetStatLabel}>점수 변화</ThemedText>
                  <ThemedText style={styles.sheetStatValue}>
                    {sheetFeedback.scoreDelta >= 0
                      ? `+${sheetFeedback.scoreDelta}`
                      : sheetFeedback.scoreDelta}
                  </ThemedText>
                </View>
                <View style={styles.sheetStat}>
                  <ThemedText style={styles.sheetStatLabel}>현재 연속 정답</ThemedText>
                  <ThemedText style={styles.sheetStatValue}>{sheetFeedback.streak}</ThemedText>
                </View>
              </View>
              <Pressable style={styles.sheetCloseButton} onPress={closeSheet}>
                <ThemedText style={styles.sheetCloseLabel}>닫기</ThemedText>
              </Pressable>
            </BottomSheetView>
          ) : (
            <BottomSheetView style={styles.bottomSheetContent}>
              <ThemedText style={styles.sheetBody}>표시할 해설이 없어요.</ThemedText>
            </BottomSheetView>
          )}
        </BottomSheetModal>
      </View>
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
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    marginTop: -Spacing.md,
    position: 'relative',
    zIndex: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.gray500,
  },
  sheetLink: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.gray100 + '55',
  },
  sheetLinkHidden: {
    opacity: 0,
  },
  sheetLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.gray600,
  },
  sheetLinkTextHidden: {
    color: 'transparent',
  },
  completionCard: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.gray100,
    backgroundColor: 'rgba(229, 229, 229, 0.08)', // Neutral tint
  },
  completionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  completionHighlight: {
    fontSize: 14,
    fontWeight: '600',
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
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(229, 229, 229, 0.08)', // Neutral tint
    borderWidth: 1,
    borderColor: Palette.gray100,
  },
  completionMetricLabel: {
    fontSize: 12,
    color: Palette.gray500,
    marginBottom: Spacing.xs,
  },
  completionMetricValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  completionNote: {
    fontSize: 13,
  },
  completionActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Palette.gray900,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  primaryButtonLabel: {
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Palette.gray500,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  secondaryButtonLabel: {
    fontWeight: '600',
    color: Palette.gray500,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
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
    color: Palette.gray500,
  },
  reportOptions: {
    gap: Spacing.sm,
  },
  reportOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.gray100,
  },
  reportOptionSelected: {
    borderColor: Palette.gray600,
    backgroundColor: 'rgba(102, 102, 102, 0.12)', // Neutral tint
  },
  reportOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  reportOptionLabelSelected: {
    color: Palette.gray600,
  },
  reportInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: Palette.gray100,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    lineHeight: 20,
  },
  actionButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.gray100,
  },
  actionButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionCancelButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.gray900,
    alignItems: 'center',
  },
  actionCancelLabel: {
    fontWeight: '600',
    color: '#fff',
  },
  reportSubmitButton: {
    marginTop: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Palette.gray900,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  reportSubmitButtonDisabled: {
    backgroundColor: Palette.gray100,
  },
  reportSubmitLabel: {
    fontWeight: '600',
    color: '#fff',
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
    backgroundColor: 'rgba(229, 229, 229, 0.12)', // Neutral tint
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
  sheetCloseButton: {
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Palette.gray900,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  sheetCloseLabel: {
    fontWeight: '600',
    color: '#fff',
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
});
