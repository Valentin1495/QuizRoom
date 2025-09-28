// play.tsx — Gen-Z polish applied (Minimal-Clean base + subtle glass/gradients/micro-interactions)

import { SkeletonBlock, SkeletonTextLine } from '@/components/skeleton';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '@react-native-firebase/auth';
import { useMutation, useQuery } from 'convex/react';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScoreAnimationOptions = {
    duration?: number;
    suppressBounce?: boolean;
};

const COLORS = {
    background: '#f8f7fa', // Slightly warmer off-white
    surface: '#ffffff',
    primary: '#6f1d1b', // Doc: "브랜드 틴트"
    secondary: '#1e1e2f', // Doc: "Icon"
    accentBlue: '#2b7de9', // From Design Doc
    success: '#10b981', // A richer green
    error: '#f43f5e', // A vibrant pink/red
    textPrimary: '#111827',
    textSecondary: '#4b5563',
    border: '#e5e7eb',
    muted: '#f3f4f6',

    // Gradients from design doc
    accentGradient: ['#ff9a9e', '#fad0c4', '#fadadd'],
    timerGradient: ['#1e1e2f', '#1e1e2f'],
};

const SOFT_SHADOW = {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
};

const CARD_SHADOW = {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
};

const LAYOUT = {
    gapSection: 24,
    gapCard: 16,
    paddingLg: 24,
    paddingMd: 20,
    paddingSm: 16,
    paddingXs: 12,
    radiusLg: 20,
    radiusMd: 16,
    radiusSm: 12,
    spacingXs: 8,
    spacingSm: 12,
    spacingLg: 20,
};

const baseCard = {
    backgroundColor: COLORS.surface,
    borderRadius: LAYOUT.radiusLg,
    padding: LAYOUT.paddingLg,
};

// --- Particle Burst (16 dots, wider) ---
function ParticleBurst({ trigger }: { trigger: number }) {
    const particles = Array.from({ length: 16 });
    const anims = useRef(particles.map(() => new Animated.Value(0))).current;

    useEffect(() => {
        if (trigger === 0) return;
        anims.forEach((v, i) => {
            v.setValue(0);
            Animated.timing(v, {
                toValue: 1,
                duration: 600 + i * 15,
                easing: Easing.out(Easing.cubic), // Smoother
                useNativeDriver: true,
            }).start();
        });
    }, [trigger]);

    return (
        <View pointerEvents="none" style={styles.particleLayer}>
            {anims.map((v, i) => {
                const angle = (i / anims.length) * Math.PI * 2;
                const radius = v.interpolate({ inputRange: [0, 1], outputRange: [20, 70] }); // Start further out
                const tx = Animated.multiply(radius, Math.cos(angle));
                const ty = Animated.multiply(radius, Math.sin(angle));
                const opacity = v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] });
                const scale = v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] });
                return (
                    <Animated.View
                        key={i}
                        style={[
                            styles.particle,
                            {
                                opacity,
                                transform: [{ translateX: tx as any }, { translateY: ty as any }, { scale }],
                            },
                        ]}
                    />
                );
            })}
        </View>
    );
}

function FeedbackCard({ isCorrect, isTimeout, rationale, onNext }: { isCorrect: boolean, isTimeout: boolean, rationale?: string | null, onNext: () => void }) {
    const slideAnim = useRef(new Animated.Value(200)).current;

    const title = isTimeout ? '시간 초과!' : (isCorrect ? '정답입니다!' : '오답입니다');
    const icon = isTimeout ? 'timer-outline' : (isCorrect ? 'checkmark-circle' : 'close-circle');
    const color = isTimeout ? COLORS.secondary : (isCorrect ? COLORS.success : COLORS.error);

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: 0,
            friction: 8,
            useNativeDriver: true,
        }).start();
    }, []);

    const cardContent = (
        <View style={styles.feedbackCardInner}>
            <View style={styles.feedbackHeader}>
                <Ionicons name={icon as any} size={24} color={color} />
                <Text style={[styles.feedbackTitle, { color }]}>{title}</Text>
            </View>
            {rationale && <Text style={styles.feedbackRationale}>{rationale}</Text>}
            <Pressable
                onPress={onNext}
                style={({ pressed }) => [styles.nextButton, { opacity: pressed ? 0.8 : 1, backgroundColor: color }]}
            >
                <Text style={styles.nextButtonText}>다음으로</Text>
            </Pressable>
        </View>
    );

    return (
        <Animated.View style={[styles.feedbackCard, { transform: [{ translateY: slideAnim }] }]}>
            {Platform.OS === 'ios' ? (
                <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFillObject} />
            ) : (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.9)' }]} />
            )}
            {cardContent}
        </Animated.View>
    );
}

export default function PlayScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ locale?: string }>();
    const locale = (params.locale as string) || 'ko';
    const insets = useSafeAreaInsets();

    const ensureSet = useMutation(api.daily.ensureTodaySet);
    const todaySet = useQuery(api.daily.getTodaySet, { locale });
    const startSession = useMutation(api.quiz.startSession);
    const submitAnswer = useMutation(api.quiz.submitAnswer);
    const finalize = useMutation(api.quiz.finalize);
    const consumeHint = useMutation(api.quiz.consumeHint);

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
    const [passUsed, setPassUsed] = useState(false);
    const [hiddenChoices, setHiddenChoices] = useState<Set<string>>(new Set());
    const [helperInventory, setHelperInventory] = useState<{ hint: number; pass: number }>({ hint: 0, pass: 0 });
    const [doubleDown, setDoubleDown] = useState(false);
    const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
    const [showDDOverlay, setShowDDOverlay] = useState(false);
    const [particleTrigger, setParticleTrigger] = useState(0);

    // Feedback state
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
    const [isTimeoutFeedback, setIsTimeoutFeedback] = useState(false);

    // animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    const tickStart = useRef<number>(Date.now());
    const [elapsedMs, setElapsedMs] = useState(0);

    const shakeX = useRef(new Animated.Value(0)).current;
    const scoreScale = useRef(new Animated.Value(1)).current;
    const scoreAnim = useRef(new Animated.Value(0)).current;
    const lastScoreRef = useRef<number>(0);
    const doubleDownRef = useRef<boolean>(false);
    const scoreListenerRef = useRef<string>();

    const timeAnim = useRef(new Animated.Value(1)).current;
    const borderColorAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(borderColorAnim, {
                toValue: 1,
                duration: 3000, // Faster cycle
                easing: Easing.linear,
                useNativeDriver: false, // Required for color animation
            })
        );
        loop.start();
        return () => loop.stop();
    }, []);



    function runShake() {
        shakeX.setValue(0);
        Animated.sequence([
            Animated.timing(shakeX, { toValue: 6, duration: 80, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: -6, duration: 80, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: 0, duration: 80, useNativeDriver: true }),
        ]).start();
    }

    function animateScoreTransition(nextScore: number, options: ScoreAnimationOptions = {}) {
        const { duration = 300, suppressBounce = false } = options;
        lastScoreRef.current = nextScore;

        scoreAnim.stopAnimation();
        if (duration <= 0) {
            scoreAnim.setValue(nextScore);
            setDisplayedScore(Math.round(nextScore));
        } else {
            Animated.timing(scoreAnim, {
                toValue: nextScore,
                duration,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
            }).start();
        }

        if (!suppressBounce) {
            scoreScale.setValue(1);
            Animated.sequence([
                Animated.timing(scoreScale, { toValue: 1.15, duration: 100, useNativeDriver: true }),
                Animated.spring(scoreScale, { toValue: 1, friction: 5, useNativeDriver: true }),
            ]).start();
        }
    }

    useEffect(() => {
        scoreListenerRef.current = scoreAnim.addListener(({ value }) => {
            setDisplayedScore(Math.round(value));
        });
        return () => {
            scoreAnim.stopAnimation();
            if (scoreListenerRef.current) scoreAnim.removeListener(scoreListenerRef.current);
        };
    }, [scoreAnim]);

    useEffect(() => {
        (async () => {
            try {
                await ensureSet({ locale });
            } catch { }
        })();
    }, [locale]);

    const question = useMemo(() => todaySet?.questions?.[index] as Doc<"questionBank"> | undefined, [todaySet, index]);

    useEffect(() => {
        if (!todaySet || sessionId) return;
        (async () => {
            try {
                if (convexUser?._id) {
                    const resp = (await startSession({
                        setId: todaySet._id as any,
                        userId: convexUser._id,
                    })) as unknown;

                    if (typeof resp === 'string') {
                        setSessionId(resp);
                        setHelperInventory({ hint: 1, pass: 1 });
                    } else if (resp && typeof resp === 'object' && 'sessionId' in resp) {
                        const { sessionId: sid, allowance } = resp as {
                            sessionId: string;
                            allowance?: { hint?: number; pass?: number };
                        };
                        setSessionId(sid);
                        setHelperInventory({
                            hint: Math.max(0, allowance?.hint ?? 1),
                            pass: Math.max(0, allowance?.pass ?? 1),
                        });
                    } else {
                        setSessionId('client-only');
                        setHelperInventory({ hint: 1, pass: 1 });
                    }
                } else {
                    setSessionId('client-only');
                    setHelperInventory({ hint: 1, pass: 1 });
                }
                tickStart.current = Date.now();
                setElapsedMs(0);
                setHintUsed(false);
                setPassUsed(false);
                setHiddenChoices(new Set());
                animateScoreTransition(0, { suppressBounce: true, duration: 0 });
                doubleDownRef.current = false;
                setDoubleDown(false);

                fadeAnim.setValue(0);
                slideAnim.setValue(30);
                Animated.parallel([
                    Animated.spring(fadeAnim, {
                        toValue: 1,
                        friction: 7,
                        tension: 60,
                        useNativeDriver: true,
                    }),
                    Animated.spring(slideAnim, {
                        toValue: 0,
                        friction: 7,
                        tension: 60,
                        useNativeDriver: true,
                    }),
                ]).start();

            } catch (e) {
                setSessionId('client-only');
                tickStart.current = Date.now();
                setElapsedMs(0);
                setHelperInventory({ hint: 1, pass: 1 });
            }
        })();
    }, [todaySet, convexUser, sessionId, doubleDown]);

    const secondsLeft = Math.max(0, 20 - Math.floor(elapsedMs / 1000));
    const secondsProgress = Math.min(elapsedMs / 20000, 1);
    const totalQuestions = todaySet?.questions?.length ?? 0;
    const isLastQuestion = totalQuestions > 0 && index === totalQuestions - 1;
    const progress = totalQuestions > 0 ? (index + 1) / totalQuestions : 0;

    useEffect(() => {
        const id = setInterval(() => setElapsedMs(Date.now() - tickStart.current), 50);
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

    useEffect(() => {
        Animated.timing(timeAnim, {
            toValue: 1 - secondsProgress,
            duration: 50,
            easing: Easing.linear,
            useNativeDriver: false,
        }).start();
    }, [secondsProgress]);

    const hintRemaining = Math.max(0, helperInventory.hint - (hintUsed ? 1 : 0));
    const passRemaining = Math.max(0, helperInventory.pass - (passUsed ? 1 : 0));

    const hintIconColor = hintRemaining <= 0 || locked ? 'rgba(71, 85, 105, 0.4)' : COLORS.primary;
    const passIconColor = passRemaining <= 0 || locked ? 'rgba(71, 85, 105, 0.4)' : COLORS.secondary;

    function handleNextQuestion() {
        setShowFeedback(false);

        if (!isLastQuestion) {
            setLocked(false);
            setSelectedChoice(null);
            setIndex((i) => i + 1);
            tickStart.current = Date.now();
            setElapsedMs(0);
            setHintUsed(false);
            // passUsed is NOT reset, it's per session
            setHiddenChoices(new Set());

            fadeAnim.setValue(0);
            slideAnim.setValue(20);
            Animated.parallel([
                Animated.spring(fadeAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
            ]).start();
            return;
        }

        // Finalize and navigate to result
        (async () => {
            let final = lastScoreRef.current;
            const dd = doubleDownRef.current;
            try {
                if (sessionId && sessionId !== 'client-only') {
                    const res = await finalize({ sessionId: sessionId as any, doubleDown: dd });
                    final = res.final;
                } else if (dd) {
                    final = lastScoreRef.current * (lastAnswerCorrect ? 2 : 0);
                }

                if (dd && final > lastScoreRef.current) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    animateScoreTransition(final, { duration: 400 });
                    setShowDDOverlay(true);
                }

                const waitMs = dd && final > lastScoreRef.current ? 1000 : 600;
                await new Promise((resolve) => setTimeout(resolve, waitMs));
            } finally {
                router.replace({ pathname: '/(greenfield)/result', params: { score: String(final) } });
            }
        })();
    }

    if (!todaySet) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
                <Stack.Screen options={{ headerShown: true, title: '데일리 퀴즈' }} />
                <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
                    <View style={styles.shimmerCard}>
                        <SkeletonTextLine width="60%" />
                        <SkeletonBlock height={8} />
                        <View style={{ marginTop: 20, gap: 16 }}>
                            <SkeletonTextLine width="90%" />
                            <SkeletonTextLine width="85%" />
                            <SkeletonTextLine width="80%" />
                            <SkeletonTextLine width="75%" />
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    function handleUseHint() {
        if (!question || hintUsed || helperInventory.hint <= 0 || locked) return;
        const wrong = (question.choices as any[]).filter((c) => c.id !== (question as any).answerId);
        const toHide = wrong.slice(0, 2).map((c) => c.id);
        const nextHidden = new Set(hiddenChoices);
        toHide.forEach((id) => nextHidden.add(id));
        setHiddenChoices(nextHidden);
        setHintUsed(true);
        setHelperInventory((prev) => ({ ...prev, hint: Math.max(0, prev.hint - 1) }));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (sessionId && sessionId !== 'client-only') {
            consumeHint({ sessionId: sessionId as any }).catch(() => {
                setHintUsed(false);
                setHiddenChoices(hiddenChoices);
                setHelperInventory((prev) => ({ ...prev, hint: prev.hint + 1 }));
            });
        }
    }

    async function handleSelect(choiceId: string) {
        if (!question || locked) return;

        doubleDownRef.current = doubleDown;
        setLocked(true);
        setSelectedChoice(choiceId);
        const usedMs = Date.now() - tickStart.current;

        const isTimeout = choiceId === '__timeout__';
        const isPass = choiceId === '__PASS__';

        // Handle Pass action separately
        if (isPass) {
            setPassUsed(true);
            setHelperInventory((prev) => ({ ...prev, pass: Math.max(0, prev.pass - 1) }));

            if (sessionId && sessionId !== 'client-only') {
                // Fire-and-forget submission for 'pass'
                submitAnswer({
                    sessionId: sessionId as any,
                    qid: question.id,
                    choiceId: '__PASS__',
                    elapsedMs: usedMs,
                    usedHint: hintUsed,
                }).catch(e => console.error("Failed to submit pass", e));
            }

            setTimeout(() => handleNextQuestion(), 600); // Advance after a short delay
            return;
        }

        // Handle regular answers and timeouts
        const isCorrectLocal = !isTimeout && (question as any).answerId === choiceId;

        try {
            if (sessionId && sessionId !== 'client-only') {
                const res = await submitAnswer({
                    sessionId: sessionId as any,
                    qid: question.id,
                    choiceId: isTimeout ? 'timeout' : choiceId,
                    elapsedMs: usedMs,
                    usedHint: hintUsed,
                });
                animateScoreTransition(res.score);
                setLastAnswerCorrect(res.correct);

                if (!isTimeout) {
                    if (res.correct) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        setParticleTrigger((t) => t + 1);
                    } else {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        runShake();
                    }
                }
            } else {
                // Client-only logic
                const correct = isCorrectLocal;
                const base = correct ? 100 : 0;
                const bonus = correct ? Math.max(0, Math.floor((10000 - usedMs) / 200)) : 0;
                const newScore = lastScoreRef.current + base + bonus;
                animateScoreTransition(newScore);
                setLastAnswerCorrect(correct);

                if (!isTimeout) {
                    if (correct) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        setParticleTrigger((t) => t + 1);
                    } else {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        runShake();
                    }
                }
            }
        } catch (e) {
            console.error("Error submitting answer:", e);
            setLastAnswerCorrect(isCorrectLocal); // Fallback to local truth
        }

        // Show feedback card for regular answers and timeouts
        setIsTimeoutFeedback(isTimeout);
        setShowFeedback(true);
    }

    const timeWidth = timeAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
    const gradientColors = COLORS.accentGradient;
    const animatedBorderColor = borderColorAnim.interpolate({
        inputRange: [0, 0.33, 0.66, 1],
        outputRange: [gradientColors[0], gradientColors[1], gradientColors[2], gradientColors[0]],
    });

    const doubleDownRimStyle = doubleDown ? {
        borderColor: COLORS.error,
        shadowColor: COLORS.error,
        shadowOpacity: 0.8,
        shadowRadius: 12,
    } : {};

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: insets.top + LAYOUT.paddingLg, paddingBottom: insets.bottom + LAYOUT.paddingLg * 2 }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* 헤더 */}
                <Animated.View
                    style={[
                        styles.header,
                        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                    ]}
                >
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>데일리 퀴즈</Text>

                        {/* 상단 툴바 칩: 헬퍼 인벤토리 */}
                        <View style={styles.toolbarChips}>
                            <Pressable
                                onPress={handleUseHint}
                                disabled={hintRemaining <= 0 || locked}
                                style={({ pressed }) => [
                                    styles.toolbarChip,
                                    { opacity: hintRemaining <= 0 || locked ? 0.4 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }
                                ]}
                            >
                                <Ionicons name="bulb-outline" size={16} color={hintIconColor} />
                                <Text style={styles.toolbarChipText}>{hintRemaining}</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => handleSelect('__PASS__')}
                                disabled={passRemaining <= 0 || locked}
                                style={({ pressed }) => [
                                    styles.toolbarChip,
                                    { opacity: passRemaining <= 0 || locked ? 0.4 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }
                                ]}
                            >
                                <Ionicons name="play-skip-forward-outline" size={16} color={passIconColor} />
                                <Text style={styles.toolbarChipText}>{passRemaining}</Text>
                            </Pressable>

                            {/* 점수 */}
                            <Animated.View style={[styles.scoreContainer, { transform: [{ scale: scoreScale }] }]}>
                                <Text style={styles.scoreLabel}>점수</Text>
                                <Text style={styles.scoreValue}>{displayedScore.toLocaleString()}</Text>
                            </Animated.View>
                        </View>
                    </View>
                </Animated.View>

                {/* 진행도 + 타이머 (그라데이션 바) */}
                <Animated.View
                    style={[
                        styles.progressSection,
                        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                    ]}
                >
                    <View style={styles.progressHeader}>
                        <Text style={styles.progressText}>
                            {index + 1} / {totalQuestions}
                        </Text>
                        <Text style={styles.timeText}>{secondsLeft}초 남음</Text>
                    </View>

                    <View style={styles.progressBarContainer}>
                        {/* 타이머 바 */}
                        <Animated.View style={[styles.progressBar, { width: timeWidth }]}>
                            <LinearGradient
                                colors={COLORS.timerGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                        </Animated.View>
                    </View>
                </Animated.View>

                {/* 질문 카드 (글래스 + 내부 글로우 + 파티클 레이어) */}
                <Animated.View
                    style={[
                        styles.questionSection,
                        { opacity: fadeAnim, transform: [{ translateX: shakeX }, { translateY: slideAnim }] }
                    ]}
                >
                    <View style={styles.glassWrapper}>
                        {Platform.OS === 'ios' ? (
                            <BlurView intensity={20} tint="light" style={styles.blurCard}>
                                <Animated.View style={[styles.innerGlow, { borderColor: animatedBorderColor }]} />
                                <Text style={styles.questionText}>{question?.stem}</Text>

                                <View style={styles.choicesContainer}>
                                    {question?.choices
                                        ?.filter((c: any) => !hiddenChoices.has(c.id))
                                        .map((c: any, idx: number) => {
                                            const isSelected = selectedChoice === c.id;
                                            const isCorrect = (question as any).answerId === c.id;
                                            const showResult = locked && isSelected;
                                            const isOtherChoiceLocked = locked && selectedChoice && selectedChoice !== c.id;

                                            return (
                                                <Pressable
                                                    key={c.id}
                                                    onPress={() => handleSelect(c.id)}
                                                    disabled={locked}
                                                    style={({ pressed }) => [
                                                        styles.choiceButton,
                                                        { transform: [{ scale: pressed ? 0.98 : 1 }] },
                                                        isOtherChoiceLocked && { opacity: 0.5 },
                                                        isSelected && locked && isCorrect && styles.choiceCorrect,
                                                        isSelected && locked && !isCorrect && styles.choiceIncorrect,
                                                    ]}
                                                >
                                                    <View style={styles.choiceContent}>
                                                        <View style={[
                                                            styles.choiceIndex,
                                                            isSelected && locked && isCorrect && styles.choiceIndexCorrect,
                                                            isSelected && locked && !isCorrect && styles.choiceIndexIncorrect,
                                                        ]}>
                                                            <Text style={[styles.choiceIndexText, isSelected && locked && styles.choiceIndexTextSelected]}>{String.fromCharCode(65 + idx)}</Text>
                                                        </View>
                                                        <Text style={[
                                                            styles.choiceText,
                                                            isSelected && locked && isCorrect && styles.choiceTextCorrect,
                                                            isSelected && locked && !isCorrect && styles.choiceTextIncorrect,
                                                        ]}>
                                                            {c.text}
                                                        </Text>
                                                        {showResult && (
                                                            <Ionicons
                                                                name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                                                                size={20}
                                                                color={isCorrect ? COLORS.success : COLORS.error}
                                                                style={styles.resultIcon}
                                                            />
                                                        )}
                                                    </View>
                                                </Pressable>
                                            );
                                        })}
                                </View>

                                {/* Shimmer focus effect */}
                                {/* particles */}
                                <ParticleBurst trigger={particleTrigger} />
                            </BlurView>
                        ) : (
                            // Android fallback: surface card + soft rim
                            <LinearGradient colors={['#ffffff', '#fcfcff']} style={[styles.questionCard, SOFT_SHADOW]}>
                                <Animated.View style={[styles.innerGlow, { borderColor: animatedBorderColor }]} />
                                <Text style={styles.questionText}>{question?.stem}</Text>
                                <View style={styles.choicesContainer}>
                                    {question?.choices
                                        ?.filter((c: any) => !hiddenChoices.has(c.id))
                                        .map((c: any, idx: number) => {
                                            const isSelected = selectedChoice === c.id;
                                            const isCorrect = (question as any).answerId === c.id;
                                            const showResult = locked && isSelected;
                                            const isOtherChoiceLocked = locked && selectedChoice && selectedChoice !== c.id;

                                            return (
                                                <Pressable
                                                    key={c.id}
                                                    onPress={() => handleSelect(c.id)}
                                                    disabled={locked}
                                                    style={({ pressed }) => [
                                                        styles.choiceButton,
                                                        { transform: [{ scale: pressed ? 0.98 : 1 }] },
                                                        isOtherChoiceLocked && { opacity: 0.5 },
                                                        isSelected && locked && isCorrect && styles.choiceCorrect,
                                                        isSelected && locked && !isCorrect && styles.choiceIncorrect,
                                                    ]}
                                                >
                                                    <View style={styles.choiceContent}>
                                                        <View style={[
                                                            styles.choiceIndex,
                                                            isSelected && locked && isCorrect && styles.choiceIndexCorrect,
                                                            isSelected && locked && !isCorrect && styles.choiceIndexIncorrect,
                                                        ]}>
                                                            <Text style={[styles.choiceIndexText, isSelected && locked && styles.choiceIndexTextSelected]}>{String.fromCharCode(65 + idx)}</Text>
                                                        </View>
                                                        <Text style={[
                                                            styles.choiceText,
                                                            isSelected && locked && isCorrect && styles.choiceTextCorrect,
                                                            isSelected && locked && !isCorrect && styles.choiceTextIncorrect,
                                                        ]}>
                                                            {c.text}
                                                        </Text>
                                                        {showResult && (
                                                            <Ionicons
                                                                name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                                                                size={20}
                                                                color={isCorrect ? COLORS.success : COLORS.error}
                                                                style={styles.resultIcon}
                                                            />
                                                        )}
                                                    </View>
                                                </Pressable>
                                            );
                                        })}
                                </View>
                                <ParticleBurst trigger={particleTrigger} />
                            </LinearGradient>
                        )}
                    </View>
                </Animated.View>

                {/* 더블다운 카드 */}
                {isLastQuestion && (
                    <Animated.View
                        style={[
                            styles.doubleDownSection,
                            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                        ]}
                    >
                        <Animated.View style={[styles.doubleDownCard, doubleDown && styles.doubleDownActive, doubleDownRimStyle]}>
                            <Text style={styles.doubleDownTitle}>🔥 더블다운</Text>
                            <Text style={styles.doubleDownDescription}>
                                마지막 문제 정답 시 총점 2배! 실패하면 모든 점수를 잃습니다.
                            </Text>
                            <Pressable
                                onPress={() => {
                                    if (selectedChoice || locked) return;
                                    setDoubleDown((prev) => {
                                        const next = !prev;
                                        doubleDownRef.current = next;
                                        Haptics.impactAsync(next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
                                        return next;
                                    });
                                }}
                                disabled={!!selectedChoice || locked}
                                style={[
                                    styles.doubleDownButton,
                                    doubleDown && styles.doubleDownButtonActive,
                                    (!!selectedChoice || locked) && styles.doubleDownButtonDisabled,
                                ]}
                            >
                                <Text style={[
                                    styles.doubleDownButtonText,
                                    doubleDown && styles.doubleDownButtonTextActive,
                                ]}>
                                    {doubleDown ? '활성화됨' : '활성화하기'}
                                </Text>
                            </Pressable>
                        </Animated.View>
                    </Animated.View>
                )}
            </ScrollView>

            {/* 더블다운 성공 오버레이 */}
            {showDDOverlay && (
                <View style={styles.overlay}>
                    <View style={styles.overlayContent}>
                        <Ionicons name="sparkles-outline" size={32} color={COLORS.primary} style={styles.overlayIcon} />
                        <Text style={styles.overlayTitle}>더블다운 성공</Text>
                        <Text style={styles.overlaySubtitle}>점수가 두 배로 상승했어요</Text>
                    </View>
                </View>
            )}

            {/* 피드백 카드 */}
            {showFeedback && (
                <View style={styles.feedbackBackdrop}>
                    <FeedbackCard
                        isCorrect={lastAnswerCorrect}
                        isTimeout={isTimeoutFeedback}
                        rationale={question?.rationale}
                        onNext={handleNextQuestion}
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    loadingContainer: { flex: 1, padding: LAYOUT.paddingLg, justifyContent: 'center' },
    shimmerCard: { ...baseCard, ...SOFT_SHADOW },
    scrollView: { flex: 1 },
    scrollContent: {
        paddingHorizontal: LAYOUT.paddingLg,
        gap: LAYOUT.gapSection,
    },

    // 헤더
    header: { marginBottom: LAYOUT.gapCard },
    headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.primary },

    toolbarChips: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    toolbarChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    toolbarChipText: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },

    scoreContainer: { alignItems: 'flex-end', marginLeft: 8 },
    scoreLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 0 },
    scoreValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary },

    // 진행도
    progressSection: { gap: LAYOUT.spacingSm },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressText: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
    timeText: { fontSize: 14, color: COLORS.error, fontWeight: '600' },
    progressBarContainer: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: COLORS.border,
    },
    progressBar: { position: 'absolute', left: 0, top: 0, bottom: 0 },

    // 글래스 카드 래퍼
    glassWrapper: { borderRadius: LAYOUT.radiusLg, ...CARD_SHADOW },
    blurCard: {
        overflow: 'hidden',
        borderRadius: LAYOUT.radiusLg,
        padding: LAYOUT.paddingLg,
        backgroundColor: 'rgba(255,255,255,0.6)',
    },
    innerGlow: {
        position: 'absolute',
        left: 0, top: 0, right: 0, bottom: 0,
        borderRadius: LAYOUT.radiusLg,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.7)',
    },


    // 질문
    questionSection: { gap: LAYOUT.spacingSm },
    questionCard: { ...baseCard, ...CARD_SHADOW, position: 'relative', overflow: 'hidden' },
    questionText: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.textPrimary,
        lineHeight: 30,
        marginBottom: LAYOUT.spacingLg,
        textAlign: 'center',
    },

    // 파티클 레이어 & 파티클
    particleLayer: {
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 1, height: 1,
    },
    particle: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.primary,
    },

    choicesContainer: { gap: LAYOUT.spacingSm },
    choiceButton: {
        borderRadius: LAYOUT.radiusSm,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        minHeight: 56,
        transition: 'opacity 0.2s',
    },
    choiceCorrect: {
        borderColor: COLORS.success,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    choiceIncorrect: {
        borderColor: COLORS.error,
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
    },
    choiceContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: LAYOUT.paddingSm,
        gap: LAYOUT.spacingSm,
    },
    choiceIndex: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: COLORS.muted,
        justifyContent: 'center', alignItems: 'center',
    },
    choiceIndexCorrect: { backgroundColor: COLORS.success },
    choiceIndexIncorrect: { backgroundColor: COLORS.error },
    choiceIndexText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
    choiceIndexTextSelected: { color: '#fff' },
    choiceText: { flex: 1, fontSize: 17, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 22 },
    choiceTextCorrect: { color: COLORS.success, fontWeight: '700' },
    choiceTextIncorrect: { color: COLORS.error, fontWeight: '700' },
    resultIcon: { fontSize: 20, fontWeight: '700' },

    // 더블다운
    doubleDownSection: { gap: LAYOUT.spacingSm },
    doubleDownCard: {
        backgroundColor: COLORS.surface,
        borderRadius: LAYOUT.radiusMd,
        padding: LAYOUT.paddingSm,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        ...SOFT_SHADOW,
    },
    doubleDownActive: {
        backgroundColor: 'rgba(244, 63, 94, 0.05)',
    },
    doubleDownTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: LAYOUT.spacingXs },
    doubleDownDescription: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: LAYOUT.spacingSm },
    doubleDownButton: {
        paddingVertical: LAYOUT.paddingXs,
        paddingHorizontal: LAYOUT.paddingSm,
        borderRadius: LAYOUT.radiusSm,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        alignSelf: 'flex-start',
    },
    doubleDownButtonActive: { borderColor: COLORS.error, backgroundColor: COLORS.error },
    doubleDownButtonDisabled: { opacity: 0.5 },
    doubleDownButtonText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
    doubleDownButtonTextActive: { color: COLORS.surface },

    // 오버레이
    overlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
        justifyContent: 'center', alignItems: 'center',
    },
    overlayContent: {
        backgroundColor: COLORS.surface,
        borderRadius: LAYOUT.radiusLg + 4,
        padding: LAYOUT.paddingLg,
        alignItems: 'center',
        ...CARD_SHADOW,
    },
    overlayIcon: { marginBottom: 12 },
    overlayTitle: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
    overlaySubtitle: { fontSize: 16, color: COLORS.secondary },

    // 피드백 카드
    feedbackBackdrop: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: Platform.OS === 'android' ? 'rgba(0,0,0,0.4)' : 'transparent',
        justifyContent: 'flex-end',
    },
    feedbackCard: {
        borderTopLeftRadius: LAYOUT.radiusLg,
        borderTopRightRadius: LAYOUT.radiusLg,
        overflow: 'hidden',
        ...SOFT_SHADOW,
    },
    feedbackCardInner: {
        padding: LAYOUT.paddingLg,
        paddingTop: LAYOUT.paddingMd,
        gap: LAYOUT.gapCard,
    },
    feedbackHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: LAYOUT.spacingSm,
    },
    feedbackTitle: {
        fontSize: 22,
        fontWeight: '800',
    },
    feedbackRationale: {
        fontSize: 16,
        color: COLORS.textSecondary,
        lineHeight: 24,
    },
    nextButton: {
        height: 52,
        borderRadius: LAYOUT.radiusMd,
        justifyContent: 'center',
        alignItems: 'center',
    },
    nextButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
});
