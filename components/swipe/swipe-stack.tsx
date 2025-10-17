import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ResultToast } from '@/components/common/result-toast';
import { ThemedText } from '@/components/themed-text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useSwipeFeed } from '@/lib/feed';

import type { SwipeFeedback } from './swipe-card';
import { SwipeCard } from './swipe-card';

type ToastKind = 'success' | 'error' | 'neutral';

type ToastState = {
  visible: boolean;
  message: string;
  kind: ToastKind;
  scoreDelta?: number;
  streak?: number;
};

const initialToast: ToastState = {
  visible: false,
  message: '',
  kind: 'neutral',
};

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
    fetchMore,
    skip,
    advance,
    submitAnswer,
    toggleBookmark,
    reportQuestion,
    reset,
  } = useSwipeFeed({ category, tags });

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<SwipeFeedback | null>(null);
  const [toast, setToast] = useState<ToastState>(initialToast);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const showToast = useCallback(
    (next: Omit<ToastState, 'visible'> & { visible?: boolean }) => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
        toastTimer.current = null;
      }
      setToast({
        visible: true,
        message: next.message,
        kind: next.kind,
        scoreDelta: next.scoreDelta,
        streak: next.streak,
      });
      toastTimer.current = setTimeout(() => {
        hideToast();
        toastTimer.current = null;
      }, 2500);
    },
    [hideToast]
  );

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const filterKey = useMemo(
    () => [category, ...(tags ?? [])].join('|'),
    [category, tags]
  );
  const previousFilterKey = useRef<string | null>(null);

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
      hideToast();
      return;
    }
    setSelectedIndex(null);
    setFeedback(null);
    hideToast();
    startTimeRef.current = Date.now();
  }, [current, hideToast]);

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
        showToast({
          message: response.isCorrect ? '정답입니다!' : '아쉬워요!',
          kind: response.isCorrect ? 'success' : 'error',
          scoreDelta: response.scoreDelta,
          streak: response.streak,
        });
      } catch (error) {
        console.warn('정답 제출 실패', error);
        setSelectedIndex(null);
        showToast({
          message: '전송 중 오류가 발생했어요',
          kind: 'neutral',
        });
      }
    },
    [current, feedback, showToast, submitAnswer]
  );

  const handleSkip = useCallback(() => {
    if (!current) return;
    skip();
    setSelectedIndex(null);
    setFeedback(null);
    hideToast();
  }, [current, hideToast, skip]);

  const handleNext = useCallback(() => {
    if (!current || !feedback) {
      return;
    }
    advance();
  }, [advance, current, feedback]);

  const handleActions = useCallback(() => {
    if (!current) return;
    Alert.alert('카드 액션', '무엇을 할까요?', [
      {
        text: '문항 저장',
        onPress: () =>
          toggleBookmark({ questionId: current.id })
            .then((result) =>
              showToast({
                message: result.bookmarked ? '저장함에 담았어요.' : '저장을 해제했어요.',
                kind: 'neutral',
              })
            )
            .catch(() =>
              showToast({
                message: '저장에 실패했어요.',
                kind: 'neutral',
              })
            ),
      },
      {
        text: '신고하기',
        onPress: () =>
          Alert.alert('신고 사유', undefined, [
            {
              text: '정답 오류',
              onPress: () =>
                reportQuestion({
                  questionId: current.id,
                  reason: 'answer_issue',
                })
                  .then(() =>
                    showToast({
                      message: '검토 요청을 전달했어요.',
                      kind: 'neutral',
                    })
                  )
                  .catch(() =>
                    showToast({
                      message: '신고 전송 실패',
                      kind: 'neutral',
                    })
                  ),
            },
            {
              text: '부적절한 콘텐츠',
              onPress: () =>
                reportQuestion({
                  questionId: current.id,
                  reason: 'inappropriate',
                })
                  .then(() =>
                    showToast({
                      message: '신고를 접수했어요.',
                      kind: 'neutral',
                    })
                  )
                  .catch(() =>
                    showToast({
                      message: '신고 전송 실패',
                      kind: 'neutral',
                    })
                  ),
            },
            { text: '취소', style: 'cancel' },
          ]),
      },
      { text: '취소', style: 'cancel' },
    ]);
  }, [current, reportQuestion, showToast, toggleBookmark]);

  const hint = useMemo(() => {
    if (!current && isLoading) return '카드를 불러오는 중이에요...';
    if (!current) return '새로운 카드가 준비되고 있어요.';
    if (!feedback) {
      return '보기를 탭해 정답을 선택하세요.';
    }
    return '정답을 확인했어요. 오른쪽으로 스와이프해 다음 카드로 이동!';
  }, [current, feedback, isLoading]);

  if (!current) {
    return (
      <View style={styles.emptyState}>
        {isLoading ? (
          <ActivityIndicator color={Palette.purple600} />
        ) : (
          <>
            <ThemedText style={styles.emptyText}>표시할 카드가 없어요.</ThemedText>
            {hasMore ? (
              <Pressable style={styles.reloadButton} onPress={fetchMore}>
                <ThemedText style={styles.reloadText}>새로고침</ThemedText>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ResultToast
        visible={toast.visible}
        message={toast.message}
        kind={toast.kind}
        scoreDelta={toast.scoreDelta}
        streak={toast.streak}
      />
      <View style={styles.hintRow}>
        <ThemedText style={styles.hintText}>{hint}</ThemedText>
        <ThemedText style={styles.bufferText}>
          다음 카드 {prefetchCount}장 대기 중
        </ThemedText>
      </View>
      <View style={styles.stack}>
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
            onSkip={handleSkip}
            onOpenActions={handleActions}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  stack: {
    flex: 1,
    justifyContent: 'center',
  },
  hintRow: {
    gap: 4,
  },
  hintText: {
    fontWeight: '600',
  },
  bufferText: {
    fontSize: 12,
    color: '#6F6A9F',
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
