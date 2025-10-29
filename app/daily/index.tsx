import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { resolveDailyCategoryCopy } from '@/constants/daily';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@/hooks/use-auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { lightHaptic, mediumHaptic, successHaptic, warningHaptic } from '@/lib/haptics';
import { useMutation, useQuery } from 'convex/react';

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
  const minutes = Math.floor(safeSeconds / 60);
  const leftover = safeSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${pad(minutes)}:${pad(leftover)}`;
}

export default function DailyQuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const resolvedDate = Array.isArray(params.date) ? params.date[0] : params.date;
  const tint = useThemeColor({}, 'tint');
  const dailyQuiz = useQuery(api.daily.getDailyQuiz, { date: resolvedDate });
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('intro');
  const [timerMode, setTimerMode] = useState<TimerMode | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<boolean | null>(null);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const shareTemplate = dailyQuiz?.shareTemplate ?? null;
  const updateStats = useMutation(api.users.updateStats);
  const logHistory = useMutation(api.history.logEntry);
  const { status: authStatus } = useAuth();
  const [quizStartedAt, setQuizStartedAt] = useState<number | null>(null);
  const historyLoggedRef = useRef<string | null>(null);

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
    (value: boolean) => (value ? 'O · 맞아요' : 'X · 아니에요'),
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
      Alert.alert('시간 종료', '답변 시간이 종료되었습니다. 다음 문제로 넘어가볼까요?');
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

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      return;
    }
    if (phase === 'finished' && correctCount > 0) {
      updateStats({ correct: correctCount });
    }
  }, [authStatus, phase, correctCount, updateStats]);

  useEffect(() => {
    if (phase !== 'finished') {
      historyLoggedRef.current = null;
      return;
    }
    if (authStatus !== 'authenticated') return;
    if (!dailyQuiz || !dailySessionKey) return;
    if (historyLoggedRef.current === dailySessionKey) return;

    const dateKey = dailySessionKey.replace(/^daily:/, '');
    const durationMs = quizStartedAt ? Date.now() - quizStartedAt : undefined;
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
    quizStartedAt,
    timerMode,
    totalQuestions,
  ]);
  const unansweredCount = totalQuestions - totalAnswered;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const allAnswered = unansweredCount === 0;

  const handleNext = useCallback(() => {
    if (!dailyQuiz) return;
    if (!isLastQuestion) {
      goToQuestion(currentIndex + 1);
      return;
    }
    setPhase('finished');
    successHaptic(); // 완주 시 성공 햅틱
    // Celebration 애니메이션
    celebrationScale.value = withSequence(
      withTiming(1.05, { duration: 250 }),
      withTiming(1, { duration: 250 })
    );
  }, [celebrationScale, currentIndex, dailyQuiz, goToQuestion, isLastQuestion]);

  const handleReset = useCallback(() => {
    setPhase('intro');
    setTimerMode(null);
    setQuestionTimeLeft(null);
    setResults([]);
    setSelectedAnswer(null);
    setCurrentIndex(0);
    setQuizStartedAt(null);
    historyLoggedRef.current = null;
  }, []);

  const categoryCopy = useMemo(
    () => resolveDailyCategoryCopy(dailyQuiz?.category),
    [dailyQuiz?.category]
  );

  const headerInfo = useMemo(() => {
    if (!dailyQuiz) {
      return null;
    }
    const copy = categoryCopy;
    const emoji = dailyQuiz.shareTemplate?.emoji ?? copy?.emoji ?? '⚡';
    const label = copy?.label ?? '오늘의 퀴즈';
    const subtitle = dailyQuiz.shareTemplate?.headline ?? '오늘의 6문제를 시작해요.';
    const dateLabel = dailyQuiz.availableDate
      ? new Date(`${dailyQuiz.availableDate}T00:00:00`).toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      })
      : null;
    return {
      title: `${emoji} ${label}`,
      subtitle,
      dateLabel,
    };
  }, [categoryCopy, dailyQuiz]);

  const shareEmoji = shareTemplate?.emoji ?? '⚡';
  const shareHeadline = shareTemplate?.headline ?? '문제당 10초 스피드런!';
  const shareCta = shareTemplate?.cta ?? '친구 초대';

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
    setPhase('finished');
  };

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
        <Pressable style={styles.retryButton} onPress={() => router.back()}>
          <ThemedText style={styles.retryLabel} lightColor="#ffffff" darkColor="#ffffff">
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
          <View style={styles.introCard}>
            <ThemedText type="title">오늘의 퀴즈 시작</ThemedText>
            <ThemedText style={styles.introSubtitle}>
              시간 제한을 선택하고 시작해보세요. 타임어택에서는 문제당 10초 안에 답해야 해요.
            </ThemedText>
            <View style={styles.introButtons}>
              <Pressable style={[styles.introButton, styles.introTimed]} onPress={() => startQuiz('timed')}>
                <ThemedText style={styles.introButtonLabel} lightColor="#ffffff" darkColor="#ffffff">
                  10초 타임어택
                </ThemedText>
                <ThemedText style={styles.introButtonCaption} lightColor="#ffffff" darkColor="#ffffff">
                  긴장감 넘치는 시간 제한 모드
                </ThemedText>
              </Pressable>
              <Pressable style={[styles.introButton, styles.introUntimed]} onPress={() => startQuiz('untimed')}>
                <ThemedText style={styles.introButtonLabel} lightColor={Palette.teal600} darkColor={Palette.teal400}>시간 제한 없음</ThemedText>
                <ThemedText style={styles.introButtonCaption} lightColor={Palette.slate500} darkColor={Palette.slate500}>여유롭게 문제를 풀어보세요</ThemedText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  if (phase === 'finished') {
    return (
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.summaryContent,
            { paddingTop: insets.top + Spacing.lg, paddingBottom: Spacing.xl + insets.bottom },
          ]}
        >
          <Animated.View style={celebrationAnimatedStyle}>
            <ThemedText type="title">오늘의 결과</ThemedText>
            <ThemedText style={styles.summaryHeadline}>
              {totalQuestions}문제 중 {correctCount}문제 정답!
            </ThemedText>
          </Animated.View>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStatCard}>
              <ThemedText style={styles.summaryStatLabel}>정답률</ThemedText>
              <ThemedText type="title">
                {totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%
              </ThemedText>
            </View>
          </View>
          <View style={styles.summaryList}>
            {questions.map((question, index) => {
              const result = sortedResults.find((entry) => entry.questionId === question.id);
              const answerLabel = formatBooleanAnswer(question.correctAnswer);
              const selection = result?.selection;
              const hasSelection = selection !== null && selection !== undefined;
              const selectionLabel = hasSelection ? formatBooleanAnswer(selection) : null;
              return (
                <View key={question.id} style={styles.summaryRow}>
                  <ThemedText style={styles.summaryQuestion}>
                    {index + 1}. {question.prompt}
                  </ThemedText>
                  <ThemedText style={styles.summaryAnswer}>정답: {answerLabel}</ThemedText>
                  {selectionLabel ? (
                    <ThemedText style={styles.summaryAnswer}>내 답: {selectionLabel}</ThemedText>
                  ) : null}
                  <ThemedText style={styles.summaryExplanation}>
                    해설: {question.explanation}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.summaryResult,
                      result
                        ? result.isCorrect
                          ? styles.correctText
                          : styles.incorrectText
                        : styles.skippedText,
                    ]}
                  >
                    {result ? (result.isCorrect ? '정답!' : '오답') : '미응답'}
                  </ThemedText>
                </View>
              );
            })}
          </View>
          <View style={styles.shareCard}>
            <ThemedText style={styles.shareEmoji}>{shareEmoji}</ThemedText>
            <ThemedText style={styles.shareHeadline}>{shareHeadline}</ThemedText>
            <ThemedText style={styles.shareBody}>
              {totalQuestions}문제 중 {correctCount}문제 정답! 링크를 공유하면 친구도 오늘 퀴즈에 참여할 수 있어요.
            </ThemedText>
            <Pressable style={styles.shareButton} onPress={handleShare}>
              <ThemedText style={styles.shareButtonLabel} lightColor="#ffffff" darkColor="#ffffff">
                {shareCta}
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
        <View style={styles.footerRow}>
          <Pressable style={[styles.secondaryButton, styles.flexButton]} onPress={handleReset}>
            <ThemedText style={styles.secondaryLabel}>다시 풀기</ThemedText>
          </Pressable>
          <Link href="/(tabs)/home" asChild>
            <Pressable style={[styles.primaryButton, styles.flexButton]}>
              <ThemedText style={styles.primaryLabel} lightColor="#ffffff" darkColor="#ffffff">
                홈으로
              </ThemedText>
            </Pressable>
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
        {headerInfo ? (
          <View style={styles.header}>
            <ThemedText style={styles.headerTitle}>{headerInfo.title}</ThemedText>
            <ThemedText style={styles.headerSubtitle}>{headerInfo.subtitle}</ThemedText>
            {headerInfo.dateLabel ? (
              <ThemedText style={styles.headerMeta}>{headerInfo.dateLabel}</ThemedText>
            ) : null}
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>Q{currentIndex + 1}/{totalQuestions}</ThemedText>
          </View>
          <Animated.View style={[
            styles.timerPill,
            timerMode === 'timed' && (questionTimeLeft ?? 0) <= 5 && styles.timerPillUrgent,
            timerMode === 'timed' && (questionTimeLeft ?? 0) <= 5 && timerAnimatedStyle
          ]}>
            {timerMode === 'timed' ? (
              <ThemedText style={[
                styles.timerText,
                { color: (questionTimeLeft ?? 0) <= 5 ? Palette.coral600 : Palette.teal600 }
              ]}>
                남은 시간 {formatSeconds(questionTimeLeft ?? 0)}
              </ThemedText>
            ) : (
              <ThemedText style={[styles.timerText, { color: Palette.teal600 }]}>
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
            {[{ value: true, label: 'O · 맞아요' }, { value: false, label: 'X · 아니에요' }].map((option) => {
              const isSelected = selectedAnswer === option.value;
              const isCorrectChoice = phase !== 'question' && option.value === correctAnswer;
              const isIncorrectSelection =
                phase !== 'question' && isSelected && option.value !== correctAnswer;
              return (
                <Pressable
                  key={option.value ? 'true' : 'false'}
                  onPress={() => handleAnswerPress(option.value)}
                  disabled={phase !== 'question'}
                  style={({ pressed }) => [
                    styles.choiceButton,
                    pressed && phase === 'question' ? styles.choicePressed : null,
                    isSelected ? styles.choiceSelected : null,
                    isCorrectChoice ? styles.choiceCorrect : null,
                    isIncorrectSelection ? styles.choiceIncorrect : null,
                  ]}
                >
                  <View style={styles.booleanBadge}>
                    <ThemedText style={styles.booleanBadgeText}>{option.value ? 'O' : 'X'}</ThemedText>
                  </View>
                  <ThemedText style={styles.choiceText}>{option.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {phase !== 'question' ? (
          <View style={styles.explanationCard}>
            <ThemedText style={styles.explanationTitle}>해설</ThemedText>
            <ThemedText style={styles.explanationBody}>{currentQuestion.explanation}</ThemedText>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footerRow}>
        {!isLastQuestion ? (
          <Pressable
            style={[styles.primaryButton, styles.flexButton, phase === 'question' ? styles.primaryDisabled : null]}
            disabled={phase === 'question'}
            onPress={handleNext}
          >
            <ThemedText style={styles.primaryLabel} lightColor="#ffffff" darkColor="#ffffff">
              다음 문제
            </ThemedText>
          </Pressable>
        ) : (
          <Pressable
            style={[
              styles.primaryButton,
              styles.flexButton,
              (!allAnswered || phase === 'question') ? styles.primaryDisabled : null,
            ]}
            disabled={!allAnswered || phase === 'question'}
            onPress={handleResultPress}
          >
            <ThemedText style={styles.primaryLabel} lightColor="#ffffff" darkColor="#ffffff">
              결과 보기
            </ThemedText>
          </Pressable>
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
    backgroundColor: 'rgba(255, 111, 97, 0.08)',
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
    borderColor: 'rgba(0,194,168,0.3)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: Spacing.xs,
  },
  introTimed: {
    backgroundColor: Palette.coral600,
    borderColor: 'transparent',
  },
  introUntimed: {
    backgroundColor: 'transparent',
    borderColor: Palette.teal400,
  },
  introButtonLabel: {
    fontWeight: '700',
    fontSize: 18,
  },
  introButtonCaption: {
    fontSize: 13,
    opacity: 0.9,
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    backgroundColor: Palette.teal600,
  },
  retryLabel: {
    fontWeight: '600',
  },
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
  headerMeta: {
    fontSize: 12,
    opacity: 0.7,
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
    backgroundColor: Palette.teal200,
  },
  badgeText: {
    fontWeight: '600',
    color: Palette.teal600,
  },
  timerPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.teal200,
  },
  timerPillUrgent: {
    backgroundColor: Palette.coral200,
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
    gap: Spacing.md,
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  choicePressed: {
    opacity: 0.8,
  },
  choiceSelected: {
    borderColor: Palette.teal600,
    backgroundColor: 'rgba(0, 194, 168, 0.08)',
  },
  choiceCorrect: {
    borderColor: Palette.coral600,
    backgroundColor: 'rgba(255, 111, 97, 0.1)',
  },
  choiceIncorrect: {
    borderColor: Palette.slate500,
    backgroundColor: 'rgba(112, 112, 112, 0.1)',
  },
  booleanBadge: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  booleanBadgeText: {
    fontWeight: '700',
    fontSize: 20,
  },
  choiceText: {
    flex: 1,
  },
  explanationCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
  },
  secondaryButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.slate500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontWeight: '600',
  },
  primaryButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Palette.teal600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDisabled: {
    opacity: 0.6,
  },
  primaryLabel: {
    fontWeight: '600',
  },
  flexButton: {
    flex: 1,
  },
  summaryContent: {
    flexGrow: 1,
    gap: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  summaryHeadline: {
    fontSize: 18,
    fontWeight: '600',
  },
  summaryStats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  summaryStatCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: Spacing.xs,
  },
  summaryStatLabel: {
    fontWeight: '600',
    opacity: 0.8,
  },
  summaryList: {
    gap: Spacing.md,
  },
  summaryRow: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  summaryQuestion: {
    fontWeight: '600',
    lineHeight: 20,
  },
  summaryAnswer: {
    opacity: 0.9,
  },
  summaryExplanation: {
    opacity: 0.75,
    lineHeight: 18,
  },
  summaryResult: {
    fontWeight: '600',
  },
  correctText: {
    color: Palette.success,
  },
  incorrectText: {
    color: Palette.danger,
  },
  skippedText: {
    color: Palette.slate500,
  },
  shareCard: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255, 111, 97, 0.08)',
    borderWidth: 2,
    borderColor: Palette.coral200,
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
    backgroundColor: Palette.coral600,
  },
  shareButtonLabel: {
    fontWeight: '600',
  },
});
