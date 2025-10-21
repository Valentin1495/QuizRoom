import {
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
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
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useSwipeFeed } from '@/lib/feed';

import type { SwipeFeedback } from './swipe-card';
import { SwipeCard } from './swipe-card';

export type SwipeStackProps = {
  category: string;
  tags?: string[];
};

const REPORT_REASONS = [
  { key: 'typo', label: '오타가 있어요' },
  { key: 'answer_issue', label: '정답이 잘못됐어요' },
  { key: 'inappropriate', label: '부적절한 콘텐츠' },
  { key: 'other', label: '기타' },
] as const;

type ReportReasonKey = (typeof REPORT_REASONS)[number]['key'];

export function SwipeStack({ category, tags }: SwipeStackProps) {
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
  } = useSwipeFeed({ category, tags, limit: 20 });

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
  const previousFilterKey = useRef<string | null>(null);
  const currentQuestionIdRef = useRef<string | null>(null);
  type ReportPayload = Parameters<typeof reportQuestion>[0];
  const [reportReason, setReportReason] = useState<ReportReasonKey | null>(null);
  const [reportNotes, setReportNotes] = useState('');
  const [reportQuestionId, setReportQuestionId] = useState<ReportPayload['questionId'] | null>(
    null
  );
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

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
      reset();
    }
  }, [filterKey, reset]);

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
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined
        );
      }
      showResultToast({
        message: optimisticIsCorrect ? '정답! 😄' : '오답 😭',
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
        const stillCurrent = currentQuestionIdRef.current === questionId;
        if (stillCurrent) {
          setFeedback(confirmedFeedback);
          setSheetFeedback(confirmedFeedback);
        }
        if (response.isCorrect !== optimisticIsCorrect) {
          void Haptics.notificationAsync(
            response.isCorrect
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Error
          ).catch(() => undefined);
          if (stillCurrent) {
            setSelectedIndex(choiceIndex);
          }
        }
        if (response.isCorrect !== optimisticIsCorrect) {
          showResultToast({
            message: response.isCorrect ? '정답으로 정정했어요.' : '오답으로 정정했어요.',
            kind: response.isCorrect ? 'success' : 'error',
            scoreDelta: response.scoreDelta,
            streak: response.streak,
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
    try {
      await reset();
    } catch (error) {
      console.warn('Reset failed:', error);
    }
  }, [closeActionsSheet, closeReportReasonSheet, closeSheet, reset]);

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
  }, [closeActionsSheet, current, toggleBookmark]);

  const handleReportAction = useCallback(() => {
    if (!current) return;
    closeActionsSheet();
    if (reportReasonResetTimeoutRef.current) {
      clearTimeout(reportReasonResetTimeoutRef.current);
      reportReasonResetTimeoutRef.current = null;
    }
    setReportQuestionId(current.id);
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
    if (!reportReason || !reportQuestionId) return false;
    if (reportReason === 'other') {
      return reportNotes.trim().length > 0 && !isSubmittingReport;
    }
    return !isSubmittingReport;
  }, [isSubmittingReport, reportNotes, reportQuestionId, reportReason]);

  const handleSubmitReport = useCallback(async () => {
    if (!reportReason || !reportQuestionId) return;
    if (reportReason === 'other' && reportNotes.trim().length === 0) return;
    setIsSubmittingReport(true);
    const reasonPayload =
      reportReason === 'other' ? `other:${reportNotes.trim()}` : reportReason;
    try {
      await reportQuestion({
        questionId: reportQuestionId,
        reason: reasonPayload,
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
    reportQuestionId,
    reportReason,
  ]);

  const handleSwipeBlocked = useCallback(() => {
    showResultToast({
      message: '문제를 풀어야 다음 카드로 이동할 수 있어요.',
    });
  }, []);

  if (!current && !showCompletion) {
    return (
      <View style={styles.emptyState}>
        {isLoading ? (
          <ActivityIndicator color={Palette.purple600} />
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
              <ThemedText style={styles.completionTitle}>🎉 20문항 완주!</ThemedText>
              <ThemedText style={styles.completionSubtitle}>
                정답률과 반응 속도를 업데이트했어요.
              </ThemedText>
              <View style={styles.completionActions}>
                <Pressable style={styles.primaryButton} onPress={handleReset}>
                  <ThemedText style={styles.primaryButtonLabel} lightColor="#fff" darkColor="#fff">
                    다시 도전
                  </ThemedText>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={handleReset}>
                  <ThemedText style={styles.secondaryButtonLabel}>다른 카테고리</ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.statusRow}>
              <ThemedText style={styles.statusText}>남은 카드 {prefetchCount}장</ThemedText>
              {feedback?.status === 'confirmed' && feedback.explanation ? (
                <Pressable style={styles.sheetLink} onPress={handleOpenSheet}>
                  <ThemedText style={styles.sheetLinkText}>해설 보기</ThemedText>
                </Pressable>
              ) : null}
            </View>
          )}
          <View style={styles.stackWrapper}>
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
              />
            ))}
          </View>
        </ScrollView>

        <BottomSheetModal
          ref={actionsSheetRef}
          backgroundStyle={styles.bottomSheetBackground}
          enablePanDownToClose
          enableDynamicSizing
          enableOverDrag={false}
          keyboardBehavior="interactive"
          android_keyboardInputMode="adjustResize"
        >
          <BottomSheetView style={styles.actionsSheetContent}>
            <ThemedText style={styles.sheetTitle}>카드 액션</ThemedText>
            <View style={styles.actionsList}>
              <Pressable style={styles.actionButton} onPress={handleSkip}>
                <ThemedText style={styles.actionButtonLabel}>문항 건너뛰기</ThemedText>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={handleToggleBookmarkAction}>
                <ThemedText style={styles.actionButtonLabel}>문항 저장</ThemedText>
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  stackWrapper: {
    minHeight: 420,
    flexGrow: 1,
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6F6A9F',
  },
  sheetLink: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.purple200 + '55',
  },
  sheetLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.purple600,
  },
  completionCard: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.purple200,
    backgroundColor: Palette.purple200 + '22',
  },
  completionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  completionSubtitle: {
    fontSize: 14,
    color: '#6F6A9F',
  },
  completionActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Palette.purple600,
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
    borderColor: Palette.purple600,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  secondaryButtonLabel: {
    fontWeight: '600',
    color: Palette.purple600,
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
    color: '#6F6A9F',
  },
  reportOptions: {
    gap: Spacing.sm,
  },
  reportOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.purple200,
  },
  reportOptionSelected: {
    borderColor: Palette.purple600,
    backgroundColor: Palette.purple200 + '44',
  },
  reportOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  reportOptionLabelSelected: {
    color: Palette.purple600,
  },
  reportInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: Palette.purple200,
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
    borderColor: Palette.purple200,
  },
  actionButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionCancelButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.purple600,
    alignItems: 'center',
  },
  actionCancelLabel: {
    fontWeight: '600',
    color: '#fff',
  },
  reportSubmitButton: {
    marginTop: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Palette.purple600,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  reportSubmitButtonDisabled: {
    backgroundColor: Palette.purple200,
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
    backgroundColor: Palette.purple200 + '33',
  },
  sheetStatLabel: {
    fontSize: 12,
    marginBottom: 4,
    color: '#6F6A9F',
  },
  sheetStatValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  sheetCloseButton: {
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Palette.purple600,
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
    backgroundColor: Palette.purple600,
  },
  reloadText: {
    color: '#fff',
    fontWeight: '600',
  },
});
