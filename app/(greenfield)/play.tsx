import { GlassCard } from '@/components/glass-card';
import ProgressBar from '@/components/progress-bar';
import { SkeletonBlock, SkeletonTextLine } from '@/components/skeleton';
import { TimerRing } from '@/components/timer-ring';
import { Colors } from '@/constants/Colors';
import { api } from '@/convex/_generated/api';
import { getAuth } from '@react-native-firebase/auth';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type ScoreAnimationOptions = {
  duration?: number;
  suppressBounce?: boolean;
};

export default function PlayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ locale?: string }>();
  const locale = (params.locale as string) || 'ko';

  const ensureSet = useMutation(api.daily.ensureTodaySet);
  const todaySet = useQuery(api.daily.getTodaySet, { locale });
  const startSession = useMutation(api.quiz.startSession);
  const submitAnswer = useMutation(api.quiz.submitAnswer);
  const finalize = useMutation(api.quiz.finalize);

  const firebaseUid = getAuth().currentUser?.uid;
  const convexUser = useQuery(
    api.users.getUserByFirebaseUid,
    firebaseUid ? { firebaseUid } : 'skip'
  );

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [locked, setLocked] = useState(false);
  const [displayedScore, setDisplayedScore] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [hiddenChoices, setHiddenChoices] = useState<Set<string>>(new Set());
  const [doubleDown, setDoubleDown] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [showDDOverlay, setShowDDOverlay] = useState(false);
  const ambientPulse = useRef(new Animated.Value(0)).current;

  const tickStart = useRef<number>(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);

  const shakeX = useRef(new Animated.Value(0)).current;
  const scoreScale = useRef(new Animated.Value(1)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const lastScoreRef = useRef<number>(0);
  const doubleDownRef = useRef<boolean>(false);
  const scoreListenerRef = useRef<string>();

  function runShake() {
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 6, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -6, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function animateScoreTransition(nextScore: number, options: ScoreAnimationOptions = {}) {
    const { duration = 260, suppressBounce = false } = options;
    const startScore = lastScoreRef.current;
    lastScoreRef.current = nextScore;

    scoreAnim.stopAnimation();
    if (duration <= 0) {
      scoreAnim.setValue(nextScore);
      setDisplayedScore(Math.round(nextScore));
    } else {
      Animated.timing(scoreAnim, {
        toValue: nextScore,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }

    if (!suppressBounce && nextScore !== startScore) {
      scoreScale.setValue(1);
      Animated.sequence([
        Animated.timing(scoreScale, { toValue: 1.15, duration: 120, useNativeDriver: true }),
        Animated.spring(scoreScale, { toValue: 1, damping: 10, mass: 0.6, useNativeDriver: true }),
      ]).start();
    } else if (suppressBounce) {
      scoreScale.setValue(1);
    }
  }

  useEffect(() => {
    scoreListenerRef.current = scoreAnim.addListener(({ value }) => {
      setDisplayedScore(Math.round(value));
    });
    return () => {
      scoreAnim.stopAnimation();
      if (scoreListenerRef.current) {
        scoreAnim.removeListener(scoreListenerRef.current);
      }
    };
  }, [scoreAnim]);

  useEffect(() => {
    (async () => {
      try {
        await ensureSet({ locale });
      } catch { }
    })();
  }, [locale]);

  const question = useMemo(() => todaySet?.questions?.[index], [todaySet, index]);

  useEffect(() => {
    if (!todaySet || sessionId) return;
    (async () => {
      try {
        if (convexUser?._id) {
          const sid = await startSession({ setId: todaySet._id as any, userId: convexUser._id });
          setSessionId(sid as any);
        } else {
          setSessionId('client-only');
        }
        tickStart.current = Date.now();
        setElapsedMs(0);
        setHintUsed(false);
        setHiddenChoices(new Set());
        animateScoreTransition(0, { suppressBounce: true, duration: 0 });
        doubleDownRef.current = false;
        setDoubleDown(false);
      } catch (e) {
        setSessionId('client-only');
        tickStart.current = Date.now();
        setElapsedMs(0);
      }
    })();
  }, [todaySet, convexUser, sessionId, doubleDown]);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedMs(Date.now() - tickStart.current);
    }, 50);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!question || locked || selectedChoice) return;
    if (elapsedMs >= 20000) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      runShake();
      handleSelect('__timeout__');
    }
  }, [elapsedMs, question, locked, selectedChoice]);

  const secondsLeft = Math.max(0, 20 - Math.floor(elapsedMs / 1000));
  const secondsProgress = Math.min(elapsedMs / 20000, 1);
  const totalQuestions = todaySet?.questions?.length ?? 0;
  const isLastQuestion = totalQuestions > 0 && index === totalQuestions - 1;
  const progress = totalQuestions > 0 ? index / totalQuestions : 0;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(ambientPulse, {
          toValue: 1,
          duration: 2600,
          useNativeDriver: true,
        }),
        Animated.timing(ambientPulse, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [ambientPulse]);

  if (!todaySet) {
    return (
      <View style={{ flex: 1, padding: 20 }}>
        <Stack.Screen options={{ headerShown: true, title: '데일리' }} />
        <SkeletonTextLine width="40%" />
        <SkeletonBlock height={8} />
        <View style={{ marginTop: 16, gap: 10 }}>
          <SkeletonTextLine width="90%" />
          <SkeletonTextLine width="80%" />
          <SkeletonTextLine width="85%" />
          <SkeletonTextLine width="70%" />
        </View>
      </View>
    );
  }

  function handleUseHint() {
    if (!question || hintUsed) return;
    const wrong = (question.choices as any[]).filter((c) => c.id !== (question as any).answerId);
    const toHide = wrong.slice(0, 2).map((c) => c.id);
    const nextHidden = new Set(hiddenChoices);
    toHide.forEach((id) => nextHidden.add(id));
    setHiddenChoices(nextHidden);
    setHintUsed(true);
  }

  async function handleSelect(choiceId: string) {
    if (!question || locked) return;
    doubleDownRef.current = doubleDown;
    setLocked(true);
    setSelectedChoice(choiceId);
    const usedMs = Date.now() - tickStart.current;
    try {
      if (sessionId && sessionId !== 'client-only') {
        const res = await submitAnswer({
          sessionId: sessionId as any,
          qid: question.id,
          choiceId: choiceId === '__timeout__' ? 'timeout' : choiceId,
          elapsedMs: usedMs,
        });
        animateScoreTransition(res.score);
      } else {
        const correct = choiceId !== '__timeout__' && (question as any).answerId === choiceId;
        const base = correct ? 100 : 0;
        const bonus = correct ? Math.max(0, Math.floor((10000 - usedMs) / 200)) : 0;
        const newScore = lastScoreRef.current + base + bonus;
        animateScoreTransition(newScore);
      }
    } finally {
      setTimeout(() => {
        const isLast = isLastQuestion;
        if (!isLast) {
          setLocked(false);
          setSelectedChoice(null);
          setIndex((i) => i + 1);
          tickStart.current = Date.now();
          setElapsedMs(0);
          setHintUsed(false);
          setHiddenChoices(new Set());
          return;
        }

        (async () => {
          let final = lastScoreRef.current;
          const dd = doubleDownRef.current;
          try {
            if (sessionId && sessionId !== 'client-only') {
              const res = await finalize({ sessionId: sessionId as any, doubleDown: dd });
              final = res.final;
            } else if (dd) {
              const lastCorrect = choiceId !== '__timeout__' && (question as any).answerId === choiceId;
              final = lastScoreRef.current * (lastCorrect ? 2 : 0);
            }

            console.log('[DD] debug', {
              doubleDown: dd,
              lastScore: lastScoreRef.current,
              selectedChoice: choiceId,
              answerId: (question as any).answerId,
              isServer: !!(sessionId && sessionId !== 'client-only'),
              final,
            });

            if (dd && final > lastScoreRef.current) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              animateScoreTransition(final, { duration: 320 });

              setShowDDOverlay(true);
            }

            const waitMs = dd && final > lastScoreRef.current ? 1000 : 700;
            console.log('[DD] navigating in', waitMs, 'ms with final', final);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
          } finally {
            router.replace({ pathname: '/(greenfield)/result', params: { score: String(final) } });
          }
        })();
      }, 400);
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1b102e', '#110915']} style={StyleSheet.absoluteFillObject} />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: ambientPulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.22, 0.45],
            }),
            transform: [
              {
                scale: ambientPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.05],
                }),
              },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(255, 154, 158, 0.35)', 'rgba(139, 125, 184, 0.25)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ambientGradient}
        />
      </Animated.View>

      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.safeArea}>
        <View style={styles.hudRow}>
          <GlassCard style={styles.hudCard}>
            <Text style={styles.hudLabel}>⏱ 남은 시간</Text>
            <Text style={styles.hudValue}>{secondsLeft}s</Text>
          </GlassCard>

          <GlassCard style={[styles.hudCard, styles.scoreCard]}>
            <Text style={styles.hudLabel}>현재 점수</Text>
            <Animated.Text
              style={[
                styles.hudValue,
                styles.scoreValue,
                { transform: [{ scale: scoreScale }] },
              ]}
            >
              {displayedScore.toLocaleString()}
            </Animated.Text>
          </GlassCard>

          <GlassCard style={[styles.hudCard, styles.hintCard]}>
            <Text style={styles.hudLabel}>힌트</Text>
            <Pressable
              onPress={handleUseHint}
              disabled={hintUsed}
              style={[styles.hintButton, hintUsed && styles.hintButtonDisabled]}
            >
              <Text style={styles.hintButtonText}>{hintUsed ? '사용됨' : '사용'}</Text>
            </Pressable>
          </GlassCard>
        </View>

        <GlassCard style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>데일리 퀘스트</Text>
            <Text style={styles.progressCount}>
              {index + 1} / {totalQuestions}
            </Text>
          </View>
          <View style={styles.progressBarWrap}>
            <ProgressBar
              value={progress}
              height={10}
              trackColor="rgba(255,255,255,0.12)"
              fillColor={Colors.light.tint}
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.questionCard}>
          <Animated.View style={[styles.questionBlock, { transform: [{ translateX: shakeX }] }]}>
            <Text style={styles.questionStem}>{question?.stem}</Text>
            <View style={styles.choiceList}>
              {question?.choices
                ?.filter((c: any) => !hiddenChoices.has(c.id))
                .map((c: any) => {
                  const isSelected = selectedChoice === c.id;
                  const isCorrect = (question as any).answerId === c.id;
                  const backgroundColor = !locked
                    ? 'rgba(255,255,255,0.78)'
                    : isSelected
                      ? isCorrect
                        ? 'rgba(35, 197, 129, 0.22)'
                        : 'rgba(255, 92, 88, 0.26)'
                      : 'rgba(255,255,255,0.18)';
                  const borderColor = locked && isSelected
                    ? isCorrect
                      ? 'rgba(35,197,129,0.68)'
                      : 'rgba(255,92,88,0.55)'
                    : 'rgba(255,255,255,0.26)';
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => handleSelect(c.id)}
                      disabled={locked}
                      style={[styles.choiceButton, { backgroundColor, borderColor }]}
                    >
                      <Text style={styles.choiceText}>{c.text}</Text>
                    </Pressable>
                  );
                })}
            </View>
          </Animated.View>
        </GlassCard>

        <GlassCard style={styles.timerCard}>
          <TimerRing
            progress={secondsProgress}
            secondsLeft={secondsLeft}
            accentColor={Colors.light.tint}
            trackColor="rgba(255,255,255,0.12)"
          />
          <Text style={styles.timerCaption}>20초 안에 정답을 맞혀 점수를 쌓아요.</Text>
        </GlassCard>

        {isLastQuestion && (
          <GlassCard style={styles.doubleDownCard}>
            <Text style={styles.doubleDownTitle}>더블다운 하이퍼 모드</Text>
            <Text style={styles.doubleDownSubtitle}>마지막 문항 정답 시 총점이 두 배!</Text>
            <Pressable
              onPress={() => {
                if (selectedChoice || locked) return;
                setDoubleDown((prev) => {
                  const next = !prev;
                  doubleDownRef.current = next;
                  return next;
                });
              }}
              disabled={!!selectedChoice || locked}
              style={[styles.doubleDownButton, doubleDown && styles.doubleDownButtonActive, (!!selectedChoice || locked) && styles.doubleDownButtonDisabled]}
            >
              <LinearGradient
                colors={doubleDown ? ['#ff9a9e', '#fad0c4', '#dcb6ff'] : ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.06)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={styles.doubleDownButtonText}>{doubleDown ? '활성화됨' : '활성화'}</Text>
            </Pressable>
          </GlassCard>
        )}
      </View>

      {showDDOverlay && (
        <View pointerEvents="none" style={styles.doubleDownOverlay}>
          <Animated.View
            style={[
              styles.doubleDownBadge,
              {
                transform: [
                  {
                    scale: scoreScale.interpolate({
                      inputRange: [0.9, 1.25],
                      outputRange: [0.9, 1.25],
                    }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['#ffbb70', '#ffcce0', '#dcb6ff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={styles.doubleDownBadgeText}>x2 GENESIS</Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0615',
  },
  ambientGradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 24,
    rowGap: 18,
  },
  hudRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    columnGap: 12,
    flexWrap: 'wrap',
  },
  hudCard: {
    flex: 1,
    minWidth: 120,
  },
  hudCardInner: {
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  hudLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  hudValue: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 22,
    marginTop: 6,
  },
  scoreCard: {
    flex: 1.1,
  },
  scoreValue: {
    fontSize: 28,
    letterSpacing: 0.8,
  },
  hintCard: {
    flex: 0.9,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  hintButton: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(139, 125, 184, 0.88)',
    shadowColor: '#8B7DB8',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  hintButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    shadowOpacity: 0,
    elevation: 0,
  },
  hintButtonText: {
    color: '#0b0615',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.4,
  },
  progressCard: {
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  progressCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarWrap: {
    marginTop: 12,
  },
  questionCard: {
    flex: 1,
    minHeight: 280,
  },
  questionBlock: {
    rowGap: 18,
  },
  questionStem: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: 0.3,
  },
  choiceList: {
    marginTop: 6,
  },
  choiceButton: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1.4,
    marginBottom: 12,
    shadowColor: '#431e82',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  choiceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#180c29',
    letterSpacing: 0.2,
  },
  timerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 20,
    paddingVertical: 18,
  },
  timerCaption: {
    flex: 1,
    color: 'rgba(255,255,255,0.68)',
    fontSize: 14,
    lineHeight: 20,
  },
  doubleDownCard: {
    marginTop: 4,
  },
  doubleDownTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  doubleDownSubtitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.68)',
    fontSize: 14,
    lineHeight: 20,
  },
  doubleDownButton: {
    marginTop: 18,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignSelf: 'flex-start',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  doubleDownButtonActive: {
    shadowColor: '#ffbb70',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  doubleDownButtonDisabled: {
    opacity: 0.6,
  },
  doubleDownButtonText: {
    color: '#120b1f',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.6,
  },
  doubleDownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 3, 22, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  doubleDownBadge: {
    paddingVertical: 22,
    paddingHorizontal: 36,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  doubleDownBadgeText: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#1b0b2a',
  },
});
