import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQuery } from 'convex/react';

function computeTimeLeft(expiresAt?: number | null, now?: number) {
    if (!expiresAt || !now) return null;
    const diff = Math.max(0, expiresAt - now);
    return Math.ceil(diff / 1000);
}

export default function PartyPlayScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ roomId?: string }>();
    const roomIdParam = useMemo(() => params.roomId?.toString() ?? null, [params.roomId]);
    const roomId = useMemo(() => (roomIdParam ? (roomIdParam as Id<'partyRooms'>) : null), [roomIdParam]);

    const roomState = useQuery(
        api.rooms.getRoomState,
        user ? (roomId ? { roomId } : 'skip') : 'skip'
    );
    const progressRoom = useMutation(api.rooms.progress);
    const pauseRoom = useMutation(api.rooms.pause);
    const resumeRoom = useMutation(api.rooms.resume);
    const heartbeat = useMutation(api.rooms.heartbeat);
    const submitAnswer = useMutation(api.rooms.submitAnswer);
    const resetRoom = useMutation(api.rooms.resetToLobby);
    const rematchRoom = useMutation(api.rooms.rematch);
    const requestLobby = useMutation(api.rooms.requestLobby);
    const pendingAction = roomState?.room.pendingAction ?? null;
    const cancelPendingAction = useMutation(api.rooms.cancelPendingAction);

    const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
    const [serverOffsetMs, setServerOffsetMs] = useState(0);
    const [localNowMs, setLocalNowMs] = useState(() => Date.now());
    const [isRematchPending, setIsRematchPending] = useState(false);
    const [isLobbyPending, setIsLobbyPending] = useState(false);
    const [isPausePending, setIsPausePending] = useState(false);
    const [isResumePending, setIsResumePending] = useState(false);
    const [delayPreset, setDelayPreset] = useState<'rapid' | 'standard' | 'chill'>('standard');
    const [isGameStalled, setIsGameStalled] = useState(false);

    const resolveDelay = useCallback(() => {
        switch (delayPreset) {
            case 'rapid':
                return 2000;
            case 'chill':
                return 5000;
            case 'standard':
            default:
                return 3000;
        }
    }, [delayPreset]);

    const scheduleLabel = useMemo(() => {
        switch (pendingAction?.type) {
            case 'start':
                return '게임 시작';
            case 'rematch':
                return '리매치';
            case 'toLobby':
                return '대기실로';
            default:
                return '진행';
        }
    }, [pendingAction?.type]);

    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const showToast = useCallback((message: string) => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
        setToastMessage(message);
        toastTimerRef.current = setTimeout(() => {
            setToastMessage(null);
            toastTimerRef.current = null;
        }, 2000);
    }, []);

    const status = roomState?.room.status ?? 'lobby';
    const currentRound = roomState?.currentRound ?? null;
    const participants = roomState?.participants ?? [];
    const hostUserId = roomState?.room.hostId ?? null;
    const hostParticipant = useMemo(
        () => (hostUserId ? participants.find((p) => p.userId === hostUserId) : null),
        [participants, hostUserId]
    );
    const hostNickname = hostParticipant?.nickname ?? '호스트';
    const hostIsConnected = hostParticipant?.isConnected ?? false;
    const totalRounds = roomState?.room.totalRounds ?? 0;
    const isFinalLeaderboard =
        status === 'leaderboard' && totalRounds > 0 && (roomState?.room.currentRound ?? 0) + 1 >= totalRounds;
    const pauseState = roomState?.room.pauseState ?? null;
    const isPaused = status === 'paused';
    const pausedPreviousStatus = pauseState?.previousStatus ?? null;
    const pausedRemainingSeconds =
        pauseState?.remainingMs !== undefined && pauseState.remainingMs !== null
            ? Math.ceil(pauseState.remainingMs / 1000)
            : null;
    const isPausableStatus = status === 'question';

    const [pendingMs, setPendingMs] = useState(0);
    const pendingHeartbeatRef = useRef(false);
    const previousHostIdRef = useRef<string | null>(null);
    const hostConnectivityRef = useRef<boolean | null>(null);
    const waitingToastRef = useRef<{ shownForSession: boolean; lastShownAt: number | null }>({
        shownForSession: false,
        lastShownAt: null,
    });
    const statusRef = useRef<string | null>(null);

    useEffect(() => {
        if (status === 'lobby' && roomState?.room.code) {
            router.replace({ pathname: '/room/[code]', params: { code: roomState.room.code } });
        }
    }, [roomState?.room.code, router, status]);
    useEffect(() => {
        return () => {
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
                toastTimerRef.current = null;
            }
        };
    }, []);
    const isHost = roomState?.room.hostId === user?.id;
    useEffect(() => {
        const interval = setInterval(() => {
            setLocalNowMs(Date.now());
        }, 250);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (roomState?.now) {
            setServerOffsetMs(Date.now() - roomState.now);
        }
    }, [roomState?.now]);

    useEffect(() => {
        if (!roomId || !user) return;
        const interval = setInterval(() => {
            void heartbeat({ roomId });
        }, 5000);
        return () => clearInterval(interval);
    }, [heartbeat, roomId, user]);

    useEffect(() => {
        pendingHeartbeatRef.current = false;
        if (!pendingAction) {
            setPendingMs(0);
            return;
        }

        const update = () => {
            const diff = pendingAction.executeAt - (Date.now() - serverOffsetMs);
            setPendingMs(Math.max(0, diff));
            if (diff <= 0 && roomId && !pendingHeartbeatRef.current) {
                pendingHeartbeatRef.current = true;
                void (async () => {
                    try {
                        await heartbeat({ roomId });
                    } catch (error) {
                        pendingHeartbeatRef.current = false;
                    }
                })();
            }
        };

        update();
        const interval = setInterval(update, 200);
        return () => clearInterval(interval);
    }, [heartbeat, pendingAction, roomId, serverOffsetMs]);

    useEffect(() => {
        setSelectedChoice(null);
    }, [roomState?.currentRound?.index]);

    const syncedNow = roomState ? localNowMs - serverOffsetMs : undefined;
    const timeLeft = computeTimeLeft(roomState?.room.phaseEndsAt ?? null, syncedNow);
    const isHostOffline = !!hostUserId && !hostIsConnected;
    const isHostWaitingPhase =
        ['countdown', 'question', 'grace', 'reveal', 'leaderboard'].includes(status) &&
        timeLeft !== null &&
        timeLeft <= 0 &&
        !isPaused;

    useEffect(() => {
        if (!hostUserId) return;
        const isInitial = previousHostIdRef.current === null;
        if (previousHostIdRef.current !== hostUserId) {
            previousHostIdRef.current = hostUserId;
            hostConnectivityRef.current = hostIsConnected;
            if (!isInitial) {
                if (hostUserId === user?.id) {
                    showToast('당신이 새로운 호스트가 되었어요. 진행을 이어가 주세요!');
                } else {
                    showToast(`${hostNickname}님이 새로운 호스트가 되었어요.`);
                }
            }
        }
        if (previousHostIdRef.current === null) {
            previousHostIdRef.current = hostUserId;
            hostConnectivityRef.current = hostIsConnected;
        }
    }, [hostIsConnected, hostNickname, hostUserId, showToast, user?.id]);

    useEffect(() => {
        if (!hostParticipant) {
            hostConnectivityRef.current = null;
            return;
        }
        if (hostConnectivityRef.current === null) {
            hostConnectivityRef.current = hostIsConnected;
            return;
        }
        if (isHost) {
            hostConnectivityRef.current = hostIsConnected;
            return;
        }
        const shouldNotify = status === 'results' || isHostWaitingPhase;
        if (!shouldNotify) {
            hostConnectivityRef.current = hostIsConnected;
            return;
        }
        const wasConnected = hostConnectivityRef.current;
        if (wasConnected && !hostIsConnected) {
            showToast('호스트 연결이 잠시 끊겼어요. 다른 참가자가 이어받을 때까지 기다려주세요.');
        } else if (!wasConnected && hostIsConnected) {
            showToast('호스트 연결이 복구됐어요. 진행을 이어가요.');
        }
        hostConnectivityRef.current = hostIsConnected;
    }, [hostIsConnected, hostParticipant, isHost, isHostWaitingPhase, showToast, status]);

    useEffect(() => {
        const prevStatus = statusRef.current;
        if (prevStatus !== null && prevStatus !== status && !isHost) {
            if (isPaused) {
                showToast('호스트가 게임을 일시정지했어요');
            } else if (prevStatus === 'paused' && !isPaused) {
                showToast('게임이 다시 시작됐어요');
            }
        }
        statusRef.current = status;
    }, [isHost, isPaused, showToast, status]);

    useEffect(() => {
        if (isHost || isPaused) {
            setIsGameStalled(false);
            return;
        }
        if (isHostWaitingPhase) {
            const timer = setTimeout(() => {
                setIsGameStalled(true);
            }, 1500);
            return () => clearTimeout(timer);
        } else {
            setIsGameStalled(false);
        }
    }, [isHost, isHostWaitingPhase, isPaused, status]);

    useEffect(() => {
        if (isGameStalled) {
            const meta = waitingToastRef.current;
            const now = Date.now();
            const canShow = !meta.shownForSession;
            if (canShow) {
                showToast('호스트 연결을 확인하는 중이에요. 잠시만 기다려주세요.');
                meta.shownForSession = true;
                meta.lastShownAt = now;
            }
        } else {
            waitingToastRef.current.shownForSession = false;
        }
    }, [isGameStalled, showToast]);

    const handleChoicePress = async (choiceIndex: number) => {
        if (!roomId || status !== 'question' || !currentRound) return;
        setSelectedChoice(choiceIndex);
        try {
            await submitAnswer({
                roomId,
                choiceIndex,
                clientTs: Date.now(),
            });
        } catch (err) {
            Alert.alert('답안을 제출하지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        }
    };

    const handleAdvance = useCallback(async () => {
        if (!roomId) return;
        try {
            await progressRoom({ roomId });
        } catch (err) {
            Alert.alert('상태 전환 실패', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        }
    }, [progressRoom, roomId]);

    const handlePause = useCallback(async () => {
        if (!roomId || !isHost) return;
        if (isPausePending) return;
        if (!isPausableStatus) return;
        if (pendingAction) {
            Alert.alert('일시정지할 수 없어요', '예약된 작업을 먼저 취소해주세요.');
            return;
        }
        setIsPausePending(true);
        try {
            await pauseRoom({ roomId });
        } catch (err) {
            Alert.alert('일시정지하지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsPausePending(false);
        }
    }, [isHost, isPausePending, isPausableStatus, pauseRoom, pendingAction, roomId]);

    const handleResume = useCallback(async () => {
        if (!roomId || !isHost || !isPaused) return;
        if (isResumePending) return;
        setIsResumePending(true);
        try {
            await resumeRoom({ roomId });
        } catch (err) {
            Alert.alert('재개하지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsResumePending(false);
        }
    }, [isHost, isPaused, isResumePending, resumeRoom, roomId]);

    const autoAdvancePhaseKey = `${status}-${roomState?.room.currentRound ?? 'final'}`;
    const autoAdvancePhaseRef = useRef<string | null>(null);
    const autoAdvanceTriggeredRef = useRef(false);

    useEffect(() => {
        const guardKey = `${roomId ?? 'none'}-${status}-${roomState?.room.currentRound ?? 'final'}`;
        if (autoAdvancePhaseRef.current !== guardKey) {
            autoAdvancePhaseRef.current = guardKey;
            autoAdvanceTriggeredRef.current = false;
        }
        if (!isHost) return;
        if (!['countdown', 'question', 'grace', 'reveal', 'leaderboard'].includes(status)) return;
        if (timeLeft === null) return;
        if (timeLeft > 0) return;
        if (autoAdvanceTriggeredRef.current) return;
        autoAdvanceTriggeredRef.current = true;
        handleAdvance();
    }, [handleAdvance, isHost, roomId, roomState?.room.currentRound, status, timeLeft]);

    useEffect(() => {
        if (status !== 'results') {
            if (isRematchPending) setIsRematchPending(false);
            if (isLobbyPending) setIsLobbyPending(false);
        }
    }, [isLobbyPending, isRematchPending, status]);

    const handleRematch = useCallback(async () => {
        if (!roomId) return;
        if (!isHost) {
            showToast('호스트가 리매치를 시작하면 진행돼요');
            return;
        }
        if (status !== 'results') return;
        if (pendingAction) {
            Alert.alert('이미 예약된 작업이 있어요');
            return;
        }
        if (isRematchPending || isLobbyPending) return;
        setIsRematchPending(true);
        try {
            await rematchRoom({ roomId, delayMs: resolveDelay() });
        } catch (err) {
            Alert.alert('리매치를 시작하지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsRematchPending(false);
        }
    }, [isHost, isLobbyPending, isRematchPending, pendingAction, rematchRoom, roomId, showToast, status, resolveDelay]);

    const handleReturnToLobby = useCallback(async () => {
        if (!roomId) return;
        if (!isHost) {
            if (isLobbyPending) return;
            setIsLobbyPending(true);
            try {
                await requestLobby({ roomId, delayMs: resolveDelay() });
                showToast('호스트가 대기실로 이동하면 전환돼요');
            } catch (err) {
                Alert.alert('요청을 보내지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
            } finally {
                setIsLobbyPending(false);
            }
            return;
        }
        if (status !== 'results' && status !== 'lobby') return;
        if (isLobbyPending || isRematchPending) return;
        if (pendingAction) {
            Alert.alert('이미 예약된 작업이 있어요');
            return;
        }
        setIsLobbyPending(true);
        try {
            await resetRoom({ roomId });
        } catch (err) {
            Alert.alert('대기실로 돌아가지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsLobbyPending(false);
        }
    }, [isHost, isLobbyPending, isRematchPending, pendingAction, requestLobby, resetRoom, roomId, showToast, status, resolveDelay]);

    const handleLeave = useCallback(() => {
        router.replace('/(tabs)/home');
    }, [router]);

    const handleCancelPending = useCallback(async () => {
        if (!roomId || !pendingAction) return;
        try {
            await cancelPendingAction({ roomId });
            showToast('진행이 취소되었어요');
        } catch (err) {
            Alert.alert('취소하지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        }
    }, [cancelPendingAction, pendingAction, roomId, showToast]);

    if (!roomId) {
        return null;
    }

    if (roomState === undefined) {
        return (
            <ThemedView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Palette.purple600} />
                <ThemedText style={styles.loadingLabel}>게임을 불러오는 중...</ThemedText>
            </ThemedView>
        );
    }

    if (!roomState) {
        return (
            <ThemedView style={styles.loadingContainer}>
                <ThemedText type="title">게임 정보를 찾을 수 없어요</ThemedText>
                <Pressable style={styles.retryButton} onPress={() => router.replace('/(tabs)/home')}>
                    <ThemedText style={styles.retryLabel}>홈으로 이동</ThemedText>
                </Pressable>
            </ThemedView>
        );
    }

    const renderCountdown = () => (
        <View style={styles.centerCard}>
            <ThemedText type="title">다음 라운드 준비!</ThemedText>
            <ThemedText style={styles.centerSubtitle}>{timeLeft !== null ? `${timeLeft}s` : '...'} 후 문제를 읽어요.</ThemedText>
            {isHost ? (
                <Pressable
                    style={[styles.button, styles.secondaryButton, isPaused ? styles.buttonDisabled : null]}
                    onPress={handleAdvance}
                    disabled={isPaused}
                >
                    <ThemedText style={styles.secondaryButtonText}>바로 시작</ThemedText>
                </Pressable>
            ) : null}
        </View>
    );

    const renderReturning = () => (
        <View style={styles.centerCard}>
            <ActivityIndicator size="large" color={Palette.purple600} />
            <ThemedText style={[styles.centerSubtitle, styles.returningLabel]}>대기실로 이동 중...</ThemedText>
        </View>
    );

    const renderQuestion = () => (
        <View style={styles.questionCard}>
            <ThemedText type="subtitle" style={styles.questionPrompt}>
                {currentRound?.question?.prompt ?? '문제를 불러오는 중...'}
            </ThemedText>
            <View style={styles.choiceList}>
                {currentRound?.question?.choices.map((choice, index) => {
                    const isSelected = selectedChoice === index || currentRound?.myAnswer?.choiceIndex === index;
                    return (
                        <Pressable
                            key={choice.id}
                            onPress={() => handleChoicePress(index)}
                            disabled={currentRound?.myAnswer !== undefined || isPaused}
                            style={({ pressed }) => [
                                styles.choiceButton,
                                isSelected ? styles.choiceSelected : null,
                                pressed && currentRound?.myAnswer === undefined && !isPaused ? styles.choicePressed : null,
                            ]}
                        >
                            <View style={styles.choiceBadge}>
                                <ThemedText style={styles.choiceBadgeText}>{String.fromCharCode(65 + index)}</ThemedText>
                            </View>
                            <ThemedText style={styles.choiceLabel}>{choice.text}</ThemedText>
                        </Pressable>
                    );
                })}
            </View>
            <ThemedText style={styles.timerText}>
                답변 시간 {(isPaused && pausedRemainingSeconds !== null ? pausedRemainingSeconds : timeLeft) ?? '-'}초
            </ThemedText>
            {isHost ? (
                <Pressable
                    style={[styles.button, styles.secondaryButton, isPaused ? styles.buttonDisabled : null]}
                    onPress={handleAdvance}
                    disabled={isPaused}
                >
                    <ThemedText style={styles.secondaryButtonText}>정답 공개</ThemedText>
                </Pressable>
            ) : null}
        </View>
    );

    const renderGrace = () => (
        <View style={styles.centerCard}>
            <ThemedText type="title">답안 마감 중</ThemedText>
            <ThemedText style={styles.centerSubtitle}>{timeLeft !== null ? `${timeLeft}s` : '...'} 후 정답 공개</ThemedText>
        </View>
    );

    const renderReveal = () => (
        <View style={styles.revealCard}>
            <ThemedText type="title">정답 공개</ThemedText>
            <ThemedText style={styles.revealSubtitle}>
                정답은 {currentRound?.reveal ? String.fromCharCode(65 + currentRound.reveal.correctChoice) : '?'} 입니다.
            </ThemedText>
            {currentRound?.question?.explanation ? (
                <ThemedText style={styles.explanationText}>{currentRound.question.explanation}</ThemedText>
            ) : null}
            <View style={styles.distributionList}>
                {currentRound?.question?.choices.map((choice, index) => {
                    const count = currentRound?.reveal?.distribution[index] ?? 0;
                    const isCorrect = currentRound?.reveal?.correctChoice === index;
                    const isMine = currentRound?.myAnswer?.choiceIndex === index;
                    return (
                        <View
                            key={choice.id}
                            style={[styles.distributionRow, isCorrect ? styles.distributionCorrect : null, isMine ? styles.distributionMine : null]}
                        >
                            <ThemedText style={styles.choiceBadgeText}>{String.fromCharCode(65 + index)}</ThemedText>
                            <ThemedText style={styles.choiceLabel}>{choice.text}</ThemedText>
                            <ThemedText style={styles.distributionCount}>{count}명</ThemedText>
                        </View>
                    );
                })}
            </View>
            <ThemedText style={styles.deltaText}>
                {currentRound?.myAnswer
                    ? `${currentRound.myAnswer.isCorrect ? '정답!' : '오답'} · ${currentRound.myAnswer.scoreDelta}점`
                    : '이번 라운드에 응시하지 않았어요.'}
            </ThemedText>
            {isHost ? (
                <Pressable
                    style={[styles.button, styles.primaryButton, isPaused ? styles.buttonDisabled : null]}
                    onPress={handleAdvance}
                    disabled={isPaused}
                >
                    <ThemedText style={styles.primaryButtonText}>리더보드</ThemedText>
                </Pressable>
            ) : null}
        </View>
    );

    const renderLeaderboard = () => (
        <View style={styles.revealCard}>
            <ThemedText type="title">리더보드</ThemedText>
            <View style={styles.distributionList}>
                {currentRound?.leaderboard?.top.length ? (
                    currentRound.leaderboard.top.map((entry) => (
                        <View key={entry.userId} style={[styles.distributionRow, styles.leaderboardRow]}>
                            <ThemedText style={styles.choiceBadgeText}>#{entry.rank}</ThemedText>
                            <ThemedText style={styles.choiceLabel}>{entry.nickname}</ThemedText>
                            <ThemedText style={styles.distributionCount}>{entry.totalScore}점</ThemedText>
                        </View>
                    ))
                ) : (
                    <ThemedText style={styles.timerText}>집계 중...</ThemedText>
                )}
            </View>
            {currentRound?.leaderboard?.me ? (
                <ThemedText style={styles.deltaText}>
                    현재 순위 #{currentRound.leaderboard.me.rank} · {currentRound.leaderboard.me.totalScore}점
                </ThemedText>
            ) : null}
            <ThemedText style={styles.timerText}>
                {isFinalLeaderboard
                    ? `${timeLeft ?? '-'}초 후에 최종 결과 화면으로 이동해요`
                    : `다음 라운드까지 ${timeLeft ?? '-'}초`}
            </ThemedText>
            {isHost && !pendingAction ? (
                <Pressable
                    style={[styles.button, styles.secondaryButton, isPaused ? styles.buttonDisabled : null]}
                    onPress={handleAdvance}
                    disabled={isPaused}
                >
                    <ThemedText style={styles.secondaryButtonText}>{isFinalLeaderboard ? '최종 결과' : '다음 라운드'}</ThemedText>
                </Pressable>
            ) : null}
        </View>
    );

    const renderResults = () => (
        <View style={styles.revealCard}>
            <ThemedText type="title">최종 결과</ThemedText>
            <View style={styles.distributionList}>
                {participants.map((player, index) => (
                    <View key={player.userId} style={styles.distributionRow}>
                        <ThemedText style={styles.choiceBadgeText}>#{player.rank ?? index + 1}</ThemedText>
                        <View style={styles.resultNameWrapper}>
                            <ThemedText style={styles.choiceLabel}>{player.nickname}</ThemedText>
                            {player.userId === hostUserId && !player.isConnected ? (
                                <ThemedText style={styles.offlineTag}>오프라인</ThemedText>
                            ) : null}
                        </View>
                        <ThemedText style={styles.distributionCount}>{player.totalScore}점</ThemedText>
                    </View>
                ))}
            </View>
            <Pressable
                style={[
                    styles.button,
                    styles.primaryButton,
                    (isRematchPending || isLobbyPending || status !== 'results' || !isHost) ? styles.buttonDisabled : null,
                ]}
                onPress={handleRematch}
                disabled={isRematchPending || isLobbyPending || status !== 'results'}
            >
                <ThemedText style={styles.primaryButtonText}>리매치</ThemedText>
            </Pressable>
            <Pressable
                style={[styles.button, styles.secondaryButton, (isLobbyPending || isRematchPending || status !== 'results' || !isHost) ? styles.buttonDisabled : null]}
                onPress={handleReturnToLobby}
                disabled={isLobbyPending || isRematchPending || status !== 'results'}
            >
                <ThemedText style={styles.secondaryButtonText}>대기실로</ThemedText>
            </Pressable>
            <Pressable
                style={[styles.ghostButton, isLobbyPending || isRematchPending || status !== 'results' ? styles.ghostButtonDisabled : null]}
                onPress={handleLeave}
                disabled={isLobbyPending || isRematchPending || status !== 'results'}
            >
                <ThemedText style={styles.ghostButtonText}>나가기</ThemedText>
            </Pressable>
        </View>
    );

    const renderPendingBanner = () => {
        if (!pendingAction) return null;
        const seconds = Math.ceil(pendingMs / 1000);
        return (
            <View style={styles.pendingBanner}>
                <ThemedText type="subtitle" style={styles.pendingTitle}>
                    {scheduleLabel}
                </ThemedText>
                <ThemedText style={styles.pendingSubtitle}>
                    {seconds > 0
                        ? `${seconds}초 후 자동 진행됩니다. 호스트가 취소할 수 있어요.`
                        : '잠시 후 자동으로 실행됩니다.'}
                </ThemedText>
                {isHost ? (
                    <Pressable style={styles.pendingCancelButton} onPress={handleCancelPending}>
                        <ThemedText style={styles.pendingCancelLabel}>취소</ThemedText>
                    </Pressable>
                ) : null}
            </View>
        );
    };

    // const renderDelaySelector = () => (
    //     <View style={styles.delayPresetRow}>
    //         <ThemedText style={styles.delayLabel}>카운트다운</ThemedText>
    //         <Pressable
    //             style={[styles.delayChip, delayPreset === 'rapid' ? styles.delayChipActive : null]}
    //             onPress={() => setDelayPreset('rapid')}
    //         >
    //             <ThemedText style={[styles.delayChipText, delayPreset === 'rapid' ? styles.delayChipTextActive : null]}>Rapid 2초</ThemedText>
    //         </Pressable>
    //         <Pressable
    //             style={[styles.delayChip, delayPreset === 'standard' ? styles.delayChipActive : null]}
    //             onPress={() => setDelayPreset('standard')}
    //         >
    //             <ThemedText style={[styles.delayChipText, delayPreset === 'standard' ? styles.delayChipTextActive : null]}>Standard 3초</ThemedText>
    //         </Pressable>
    //         <Pressable
    //             style={[styles.delayChip, delayPreset === 'chill' ? styles.delayChipActive : null]}
    //             onPress={() => setDelayPreset('chill')}
    //         >
    //             <ThemedText style={[styles.delayChipText, delayPreset === 'chill' ? styles.delayChipTextActive : null]}>Chill 5초</ThemedText>
    //         </Pressable>
    //     </View>
    // );

    const renderPauseControls = () => {
        if (!isHost || isPaused || !isPausableStatus) return null;
        const disabled = isPausePending || !!pendingAction;
        return (
            <View style={styles.pauseControls}>
                <Pressable
                    style={[styles.pauseControlButton, disabled ? styles.buttonDisabled : null]}
                    onPress={handlePause}
                    disabled={disabled}
                >
                    <ThemedText style={styles.pauseControlLabel}>일시정지</ThemedText>
                </Pressable>
            </View>
        );
    };

    const renderPauseNotice = () => {
        if (!isPaused) return null;
        return (
            <View style={styles.pauseBanner}>
                <ThemedText type="subtitle" style={styles.pauseBannerTitle}>
                    게임이 일시정지됐어요
                </ThemedText>
                <ThemedText style={styles.pauseBannerSubtitle}>
                    {isHost ? '재개 버튼을 눌러 게임을 이어가세요.' : '호스트가 곧 게임을 다시 시작할 거예요.'}
                </ThemedText>
                {pausedRemainingSeconds !== null ? (
                    <ThemedText style={styles.pauseBannerHint}>재개 시 남은 시간 약 {pausedRemainingSeconds}초</ThemedText>
                ) : null}
                {isHost ? (
                    <Pressable
                        style={[styles.button, styles.primaryButton, isResumePending ? styles.buttonDisabled : null]}
                        onPress={handleResume}
                        disabled={isResumePending}
                    >
                        <ThemedText style={styles.primaryButtonText}>재개</ThemedText>
                    </Pressable>
                ) : null}
            </View>
        );
    };

    const renderBootstrapping = () => (
        <View style={styles.centerCard}>
            <ActivityIndicator size="large" color={Palette.purple600} />
            <ThemedText style={styles.centerSubtitle}>게임을 준비 중이에요...</ThemedText>
        </View>
    );

    let content: React.ReactNode | null = null;
    if (status === 'countdown' && (roomState?.room.currentRound ?? 0) > 0) {
        content = renderCountdown();
    } else if (status === 'lobby') {
        content = renderReturning();
    } else if (status === 'question') {
        content = renderQuestion();
    } else if (status === 'grace') {
        content = renderGrace();
    } else if (status === 'reveal') {
        content = renderReveal();
    } else if (status === 'leaderboard') {
        content = renderLeaderboard();
    } else if (status === 'paused') {
        if (pausedPreviousStatus === 'question') {
            content = renderQuestion();
        } else if (pausedPreviousStatus === 'grace') {
            content = renderGrace();
        } else if (pausedPreviousStatus === 'reveal') {
            content = renderReveal();
        } else if (pausedPreviousStatus === 'leaderboard') {
            content = renderLeaderboard();
        } else if (pausedPreviousStatus === 'countdown' && (roomState?.room.currentRound ?? 0) > 0) {
            content = renderCountdown();
        }
    } else if (status === 'results') {
        content = renderResults();
    }

    if (!content) {
        content = renderBootstrapping();
    }

    return (
        <>
            <Stack.Screen options={{ title: '파티 퀴즈' }} />
            <ThemedView style={[styles.container, { paddingBottom: insets.bottom + Spacing.lg }]}>
                {/* {isHost ? renderDelaySelector() : null} */}
                {renderPendingBanner()}
                {renderPauseControls()}
                {renderPauseNotice()}
                {content}
                {toastMessage ? (
                    <View pointerEvents="none" style={[styles.toastWrapper, { bottom: insets.bottom + Spacing.lg }]}>
                        <View style={styles.toastBubble}>
                            <ThemedText style={styles.toastText}>{toastMessage}</ThemedText>
                        </View>
                    </View>
                ) : null}
            </ThemedView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Palette.surfaceMuted,
    },
    delayPresetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
    },
    delayLabel: {
        fontWeight: '600',
        color: Palette.slate500,
    },
    delayChip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Palette.slate200,
    },
    delayChipActive: {
        backgroundColor: Palette.purple200,
    },
    delayChipText: {
        color: Palette.slate500,
        fontWeight: '500',
    },
    delayChipTextActive: {
        color: Palette.purple600,
        fontWeight: '700',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Palette.surfaceMuted,
    },
    loadingLabel: {
        marginTop: Spacing.md,
    },
    retryButton: {
        marginTop: Spacing.md,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        backgroundColor: Palette.purple600,
        borderRadius: Radius.md,
    },
    retryLabel: {
        color: Palette.surface,
    },
    centerCard: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        shadowColor: '#2F288033',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    centerSubtitle: {
        marginTop: Spacing.sm,
        color: Palette.slate500,
        textAlign: 'center',
    },
    returningLabel: {
        marginTop: Spacing.md,
    },
    lobbyHint: {
        marginTop: Spacing.sm,
        marginBottom: Spacing.sm,
        textAlign: 'center',
        color: Palette.slate500,
    },
    button: {
        marginTop: Spacing.md,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    primaryButton: {
        backgroundColor: Palette.purple600,
    },
    primaryButtonText: {
        color: Palette.surface,
    },
    secondaryButton: {
        backgroundColor: Palette.slate200,
    },
    secondaryButtonText: {
        color: Palette.slate900,
    },
    ghostButton: {
        marginTop: Spacing.sm,
        paddingVertical: Spacing.sm,
        alignItems: 'center',
    },
    ghostButtonDisabled: {
        opacity: 0.6,
    },
    ghostButtonText: {
        color: Palette.slate500,
        textDecorationLine: 'underline',
    },
    questionCard: {
        flex: 1,
        padding: Spacing.lg,
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        shadowColor: '#2F288033',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    questionPrompt: {
        marginBottom: Spacing.md,
    },
    choiceList: {
        marginBottom: Spacing.md,
    },
    choiceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.sm,
        backgroundColor: Palette.surfaceMuted,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Palette.slate200,
    },
    choiceSelected: {
        backgroundColor: Palette.purple200,
        borderColor: Palette.purple600,
    },
    choicePressed: {
        opacity: 0.7,
    },
    choiceBadge: {
        width: 24,
        height: 24,
        borderRadius: Radius.sm,
        backgroundColor: Palette.purple600,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    choiceBadgeText: {
        color: Palette.surface,
        fontSize: 14,
        fontWeight: 'bold',
    },
    choiceLabel: {
        flex: 1,
        fontSize: 16,
        color: Palette.slate900,
    },
    timerText: {
        marginTop: Spacing.md,
        textAlign: 'center',
        color: Palette.slate500,
    },
    revealCard: {
        flex: 1,
        padding: Spacing.lg,
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        shadowColor: '#2F288033',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    revealSubtitle: {
        marginTop: Spacing.sm,
        marginBottom: Spacing.md,
        color: Palette.slate500,
    },
    explanationText: {
        marginBottom: Spacing.md,
        color: Palette.slate900,
        lineHeight: 20,
    },
    distributionList: {
        marginBottom: Spacing.md,
    },
    distributionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Palette.slate200,
    },
    resultNameWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    distributionCorrect: {
        backgroundColor: '#DCFCE7',
        borderBottomColor: Palette.success,
    },
    distributionMine: {
        backgroundColor: Palette.purple200,
        borderBottomColor: Palette.purple600,
    },
    distributionCount: {
        fontSize: 14,
        color: Palette.slate500,
    },
    offlineTag: {
        fontSize: 12,
        color: Palette.slate500,
    },
    deltaText: {
        marginTop: Spacing.md,
        textAlign: 'center',
        color: Palette.slate500,
    },
    leaderboardRow: {
        backgroundColor: Palette.surfaceMuted,
    },
    pauseControls: {
        alignSelf: 'flex-end',
        marginBottom: Spacing.sm,
    },
    pauseControlButton: {
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.pill,
        backgroundColor: Palette.slate900,
    },
    pauseControlLabel: {
        color: Palette.surface,
        fontWeight: '600',
    },
    pauseBanner: {
        padding: Spacing.md,
        backgroundColor: Palette.slate900,
        borderRadius: Radius.md,
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    pauseBannerTitle: {
        color: Palette.surface,
        fontWeight: '700',
    },
    pauseBannerSubtitle: {
        color: Palette.slate200,
    },
    pauseBannerHint: {
        color: Palette.slate200,
    },
    toastWrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    toastBubble: {
        backgroundColor: 'rgba(18, 13, 36, 0.85)',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.pill,
        maxWidth: '90%',
    },
    toastText: {
        color: Palette.surface,
        fontWeight: '600',
        textAlign: 'center',
    },
    pendingBanner: {
        padding: Spacing.md,
        backgroundColor: Palette.purple200,
        borderRadius: Radius.md,
        marginBottom: Spacing.md,
        alignItems: 'center',
    },
    pendingTitle: {
        marginBottom: Spacing.sm,
    },
    pendingSubtitle: {
        marginBottom: Spacing.sm,
        textAlign: 'center',
    },
    pendingCancelButton: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        backgroundColor: Palette.slate200,
        borderRadius: Radius.md,
    },
    pendingCancelLabel: {
        color: Palette.slate900,
    },
});
