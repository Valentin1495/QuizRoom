import {
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
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
  const sheetSnapPoints = useMemo(() => ['90%'], []);
  const actionsSnapPoints = useMemo(() => ['90%'], []);
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

  const filterKey = useMemo(
    () => [category, ...(tags ?? [])].join('|'),
    [category, tags]
  );
  const previousFilterKey = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      hideResultToast();
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
    if (!current) {
      setSelectedIndex(null);
      setFeedback(null);
      hideResultToast();
      closeSheet();
      closeActionsSheet();
      return;
    }
    setSelectedIndex(null);
    setFeedback(null);
    hideResultToast();
    closeSheet();
    closeActionsSheet();
    startTimeRef.current = Date.now();
  }, [closeActionsSheet, closeSheet, current]);

  const handleSelect = useCallback(
    async (choiceIndex: number) => {
      if (!current || feedback) {
        return;
      }
      setSelectedIndex(choiceIndex);
      const timeMs = Date.now() - startTimeRef.current;
      const selectedChoice = current.choices[choiceIndex];
      if (!selectedChoice) {
        return;
      }
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
        const nextFeedback: SwipeFeedback = {
          isCorrect: response.isCorrect,
          correctChoiceId: response.correctChoiceId,
          correctChoiceIndex: correctIndex >= 0 ? correctIndex : null,
          explanation: response.explanation,
          scoreDelta: response.scoreDelta,
          streak: response.streak,
        };
        setFeedback(nextFeedback);
        setSheetFeedback(nextFeedback);
        showResultToast({
          message: response.isCorrect ? '정답입니다!' : '아쉬워요!',
          kind: response.isCorrect ? 'success' : 'error',
          scoreDelta: response.scoreDelta,
          streak: response.streak,
        });
      } catch (error) {
        console.warn('정답 제출 실패', error);
        setSelectedIndex(null);
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
    hideResultToast();
  }, [closeActionsSheet, closeSheet, current, skip]);

  const handleReset = useCallback(async () => {
    closeSheet();
    closeActionsSheet();
    try {
      await reset();
    } catch (error) {
      console.warn('Reset failed:', error);
    }
  }, [closeActionsSheet, closeSheet, reset]);

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
    const questionId = current.id;
    Alert.alert('신고 사유', undefined, [
      {
        text: '정답 오류',
        onPress: () =>
          reportQuestion({
            questionId,
            reason: 'answer_issue',
          })
            .then(() =>
              showResultToast({
                message: '검토 요청을 전달했어요.',
                kind: 'neutral',
              })
            )
            .catch(() =>
              showResultToast({
                message: '신고 전송 실패',
                kind: 'neutral',
              })
            ),
      },
      {
        text: '부적절한 콘텐츠',
        onPress: () =>
          reportQuestion({
            questionId,
            reason: 'inappropriate',
          })
            .then(() =>
              showResultToast({
                message: '신고를 접수했어요.',
                kind: 'neutral',
              })
            )
            .catch(() =>
              showResultToast({
                message: '신고 전송 실패',
                kind: 'neutral',
              })
            ),
      },
      { text: '취소', style: 'cancel' },
    ]);
  }, [closeActionsSheet, current, reportQuestion]);

  const handleActions = useCallback(() => {
    if (!current) return;
    openActionsSheet();
  }, [current, openActionsSheet]);

  const hint = useMemo(() => {
    if (!current && isLoading) return '카드를 불러오는 중이에요...';
    if (!current) return hasMore ? '새로운 카드가 준비되고 있어요.' : '';
    if (!feedback) {
      return '보기를 탭해 정답을 선택하세요.';
    }
    return '정답을 확인했어요. 오른쪽으로 스와이프해 다음 카드로 이동!';
  }, [current, feedback, hasMore, isLoading]);

  const showCompletion = !hasMore && queue.length === 0;

  const handleOpenSheet = useCallback(() => {
    if (feedback?.explanation) {
      setSheetFeedback({ ...feedback });
      bottomSheetRef.current?.present();
    }
  }, [feedback]);

  const handleSheetDismiss = useCallback(() => {
    setSheetFeedback(null);
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
            <View style={styles.hintRow}>
              <View style={styles.hintTextGroup}>
                <ThemedText style={styles.hintText}>{hint}</ThemedText>
                <ThemedText style={styles.bufferText}>남은 카드 {prefetchCount}장</ThemedText>
              </View>
              {feedback?.explanation ? (
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
              />
            ))}
          </View>
        </ScrollView>

        <BottomSheetModal
          ref={actionsSheetRef}
          snapPoints={actionsSnapPoints}
          backgroundStyle={styles.bottomSheetBackground}
          enablePanDownToClose
          enableDynamicSizing
          enableOverDrag={false}
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
          ref={bottomSheetRef}
          snapPoints={sheetSnapPoints}
          onDismiss={handleSheetDismiss}
          onChange={handleSheetChanges}
          backgroundStyle={styles.bottomSheetBackground}
          enablePanDownToClose
          enableDynamicSizing
          enableOverDrag={false}
        >
          {sheetFeedback ? (
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
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  hintTextGroup: {
    flex: 1,
    gap: Spacing.xs,
  },
  hintText: {
    fontWeight: '600',
  },
  bufferText: {
    fontSize: 12,
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
