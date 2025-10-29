import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showResultToast } from '@/components/common/result-toast';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useAuth } from '@/hooks/use-auth';
import { useConnectionStatus } from '@/hooks/use-connection-status';
import { useMutation, useQuery } from 'convex/react';

function computeTimeLeft(expiresAt?: number | null, now?: number) {
    if (!expiresAt || !now) return null;
    const diff = Math.max(0, expiresAt - now);
    return Math.ceil(diff / 1000);
}

const FORCED_EXIT_MESSAGE = '세션이 더 이상 유지되지 않아 방과의 연결이 종료됐어요. 다시 참여하려면 방 코드를 입력해 주세요.';
const EXPIRED_MESSAGE = '😢 연결이 오래 끊겼습니다.\n이번 퀴즈는 종료되었어요.';
const TOAST_COOLDOWN_MS = 10000;
type ConnectionState = 'online' | 'reconnecting' | 'grace' | 'expired';
type HostConnectionState = 'online' | 'waiting' | 'expired';
const HOST_GRACE_SECONDS = 30;
const HOST_GRACE_MS = HOST_GRACE_SECONDS * 1000;
const HOST_HEARTBEAT_GRACE_MS = 7000;
const HOST_SNAPSHOT_STALE_THRESHOLD_MS = HOST_HEARTBEAT_GRACE_MS * 2;

export default function PartyPlayScreen() {
    const router = useRouter();
    const { user, status: authStatus, guestKey, ensureGuestKey } = useAuth();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ roomId?: string }>();
    const roomIdParam = useMemo(() => params.roomId?.toString() ?? null, [params.roomId]);
    const roomId = useMemo(() => (roomIdParam ? (roomIdParam as Id<'partyRooms'>) : null), [roomIdParam]);

    const [hasLeft, setHasLeft] = useState(false);
    const [disconnectReason, setDisconnectReason] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>('online');
    const [graceRemaining, setGraceRemaining] = useState(120);
    const [isManualReconnectPending, setIsManualReconnectPending] = useState(false);
    const [hostConnectionState, setHostConnectionState] = useState<HostConnectionState>('online');
    const [hostGraceRemaining, setHostGraceRemaining] = useState(HOST_GRACE_SECONDS);
    useEffect(() => {
        if (authStatus === 'guest' && !guestKey) {
            void ensureGuestKey();
        }
    }, [ensureGuestKey, guestKey, authStatus]);
    const queryArgs = useMemo(() => {
        if (!roomId || hasLeft || disconnectReason) {
            return 'skip' as const;
        }
        if (authStatus === 'authenticated') {
            return user ? { roomId } : ('skip' as const);
        }
        if (authStatus === 'guest') {
            return guestKey ? { roomId, guestKey } : ('skip' as const);
        }
        return 'skip' as const;
    }, [authStatus, disconnectReason, guestKey, hasLeft, roomId, user]);
    const isWatchingState = queryArgs !== 'skip';
    const notifyForcedExit = useCallback(() => {
        setDisconnectReason((prev) => prev ?? FORCED_EXIT_MESSAGE);
    }, []);
    const roomState = useQuery(
        api.rooms.getRoomState,
        queryArgs
    );
    const roomData = roomState && roomState.status === 'ok' ? roomState : null;
    const progressRoom = useMutation(api.rooms.progress);
    const pauseRoom = useMutation(api.rooms.pause);
    const resumeRoom = useMutation(api.rooms.resume);
    const heartbeat = useMutation(api.rooms.heartbeat);
    const submitAnswer = useMutation(api.rooms.submitAnswer);
    const resetRoom = useMutation(api.rooms.resetToLobby);
    const rematchRoom = useMutation(api.rooms.rematch);
    const leaveRoom = useMutation(api.rooms.leave);
    const requestLobby = useMutation(api.rooms.requestLobby);
    const logHistory = useMutation(api.history.logEntry);
    useEffect(() => {
        if (!disconnectReason && isWatchingState && roomState?.status === 'not_in_room') {
            notifyForcedExit();
        }
    }, [disconnectReason, isWatchingState, notifyForcedExit, roomState?.status]);

    const pendingAction = roomData?.room.pendingAction ?? null;
    const cancelPendingAction = useMutation(api.rooms.cancelPendingAction);
    const meParticipantId = roomData?.me.participantId ?? null;
    const participantArgs = useMemo(() => {
        if (!roomId || !meParticipantId) {
            return null;
        }
        if (authStatus === 'guest') {
            if (!guestKey) {
                return null;
            }
            return { roomId, participantId: meParticipantId, guestKey };
        }
        return { roomId, participantId: meParticipantId };
    }, [authStatus, guestKey, meParticipantId, roomId]);

    const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
    const [serverOffsetMs, setServerOffsetMs] = useState(0);
    const serverOffsetRef = useRef(0);
    const [localNowMs, setLocalNowMs] = useState(() => Date.now());
    const [isRematchPending, setIsRematchPending] = useState(false);
    const [isLobbyPending, setIsLobbyPending] = useState(false);
    const [isPausePending, setIsPausePending] = useState(false);
    const [isResumePending, setIsResumePending] = useState(false);
    const [isGameStalled, setIsGameStalled] = useState(false);
    const [promotedToHost, setPromotedToHost] = useState(false);
    const [justReconnected, setJustReconnected] = useState(false);
    const [delayPreset, _] = useState<'rapid' | 'standard' | 'chill'>('chill');
    const { phase: socketPhase, hasEverConnected: socketHasEverConnected } = useConnectionStatus();

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

    const resolveHostGuestKey = useCallback(async () => {
        if (authStatus === 'guest') {
            return guestKey ?? (await ensureGuestKey());
        }
        return undefined;
    }, [authStatus, ensureGuestKey, guestKey]);

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

    const lastToastKeyRef = useRef<string | null>(null);
    const lastToastAtRef = useRef<number>(0);
    const showToast = useCallback((message: string, key?: string) => {
        const now = Date.now();
        const toastKey = key ?? message;
        const shouldSkip =
            lastToastKeyRef.current === toastKey && now - lastToastAtRef.current < TOAST_COOLDOWN_MS;
        if (shouldSkip) {
            return;
        }
        lastToastKeyRef.current = toastKey;
        lastToastAtRef.current = now;
        showResultToast({ message });
    }, []);
    const reconnectTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const graceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hostGraceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hostGraceDeadlineRef = useRef<number | null>(null);
    const clearConnectionTimers = useCallback(() => {
        if (reconnectTransitionRef.current) {
            clearTimeout(reconnectTransitionRef.current);
            reconnectTransitionRef.current = null;
        }
        if (graceTimerRef.current) {
            clearInterval(graceTimerRef.current);
            graceTimerRef.current = null;
        }
    }, []);
    const stopHostGraceTimer = useCallback(() => {
        if (hostGraceTimerRef.current) {
            clearInterval(hostGraceTimerRef.current);
            hostGraceTimerRef.current = null;
        }
        hostGraceDeadlineRef.current = null;
    }, []);
    const resetHostGraceState = useCallback(() => {
        stopHostGraceTimer();
        setHostGraceRemaining(HOST_GRACE_SECONDS);
        setHostConnectionState('online');
    }, [stopHostGraceTimer]);
    const beginHostGraceWait = useCallback(
        (elapsedMs = 0) => {
            if (hostConnectionState === 'waiting') {
                return;
            }
            stopHostGraceTimer();
            const clampedElapsed = Math.min(Math.max(elapsedMs, 0), HOST_GRACE_MS);
            const serverNow = Date.now() - serverOffsetRef.current;
            const initialRemainingMs = HOST_GRACE_MS - clampedElapsed;
            if (initialRemainingMs <= 0) {
                hostGraceDeadlineRef.current = serverNow;
                setHostGraceRemaining(0);
                setHostConnectionState('expired');
                return;
            }
            hostGraceDeadlineRef.current = serverNow + initialRemainingMs;
            setHostGraceRemaining(Math.max(0, Math.ceil(initialRemainingMs / 1000)));
            setHostConnectionState('waiting');
            hostGraceTimerRef.current = setInterval(() => {
                const deadline = hostGraceDeadlineRef.current;
                if (deadline === null) {
                    return;
                }
                const now = Date.now() - serverOffsetRef.current;
                const diff = deadline - now;
                if (diff <= 0) {
                    stopHostGraceTimer();
                    setHostGraceRemaining(0);
                    setHostConnectionState('expired');
                    return;
                }
                const nextRemaining = Math.ceil(diff / 1000);
                setHostGraceRemaining((prev) => (prev === nextRemaining ? prev : nextRemaining));
            }, 1000);
        },
        [hostConnectionState, stopHostGraceTimer]
    );
    const handleConnectionRestored = useCallback(() => {
        clearConnectionTimers();
        let shouldAnnounce = false;
        setConnectionState((prev) => {
            if (prev !== 'online') {
                shouldAnnounce = true;
                setJustReconnected(true);
            }
            return 'online';
        });
        setGraceRemaining(120);
        if (shouldAnnounce) {
            showToast('✅ 연결 복구! 마지막 진행 상태로 돌아갑니다.', 'connection_restored');
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    }, [clearConnectionTimers, showToast]);
    const beginReconnecting = useCallback(() => {
        setConnectionState((prev) => {
            if (prev === 'online') return 'reconnecting';
            if (prev === 'reconnecting' || prev === 'grace' || prev === 'expired') return prev;
            return prev;
        });
    }, []);
    useEffect(() => {
        if (!socketHasEverConnected && socketPhase !== 'connected') {
            return;
        }
        if (socketPhase === 'connected') {
            handleConnectionRestored();
        } else {
            beginReconnecting();
        }
    }, [beginReconnecting, handleConnectionRestored, socketHasEverConnected, socketPhase]);
    useEffect(() => () => {
        clearConnectionTimers();
    }, [clearConnectionTimers]);
    useEffect(() => () => {
        stopHostGraceTimer();
    }, [stopHostGraceTimer]);

    const roomStatus = roomData?.room.status ?? 'lobby';
    const currentRound = roomData?.currentRound ?? null;
    const participants = roomData?.participants ?? [];
    const hostUserId = roomData?.room.hostId ?? null;
    const hostParticipant = useMemo(
        () => (hostUserId ? participants.find((p) => p.userId === hostUserId) : null),
        [participants, hostUserId]
    );
    const hostNickname = hostParticipant?.nickname ?? '호스트';
    const hostIsConnected = hostParticipant?.isConnected ?? false;
    const totalRounds = roomData?.room.totalRounds ?? 0;
    const isFinalLeaderboard =
        roomStatus === 'leaderboard' && totalRounds > 0 && (roomData?.room.currentRound ?? 0) + 1 >= totalRounds;
    const pauseState = roomData?.room.pauseState ?? null;
    const isPaused = roomStatus === 'paused';
    const pausedPreviousStatus = pauseState?.previousStatus ?? null;
    const pausedRemainingSeconds =
        pauseState?.remainingMs !== undefined && pauseState.remainingMs !== null
            ? Math.ceil(pauseState.remainingMs / 1000)
            : null;
    const isPausableStatus = roomStatus === 'question';

    const [pendingMs, setPendingMs] = useState(0);
    const pendingHeartbeatRef = useRef(false);
    const previousHostIdRef = useRef<string | null>(null);
    const hostConnectivityRef = useRef<boolean | null>(null);
    const waitingToastRef = useRef<{ shownForSession: boolean; lastShownAt: number | null }>({
        shownForSession: false,
        lastShownAt: null,
    });
    const pauseToastActiveRef = useRef(false);
    const pauseToastHostRef = useRef<string | null>(null);
    const historyLoggedRef = useRef<string | null>(null);
    const participantConnectivityRef = useRef<Map<string, boolean>>(new Map());
    const wasHostRef = useRef<boolean | null>(null);
    const roomStatusRef = useRef<string | null>(null);
    const isInitialMount = useRef(true);
    const lostHostDueToGraceRef = useRef(false);
    const lostHostSkipResumeToastRef = useRef(false);
    const handleManualReconnect = useCallback(async () => {
        if (!participantArgs || isManualReconnectPending) return;
        setIsManualReconnectPending(true);
        try {
            await heartbeat(participantArgs);
            handleConnectionRestored();
        } catch (err) {
            beginReconnecting();
            showToast('아직 연결되지 않았어요. 잠시 후 다시 시도해 주세요.', 'manual_reconnect_failed');
        } finally {
            setIsManualReconnectPending(false);
        }
    }, [beginReconnecting, handleConnectionRestored, heartbeat, isManualReconnectPending, participantArgs, showToast]);
    const handleLeave = useCallback(() => {
        if (hasLeft) return;
        if (!disconnectReason && participantArgs) {
            leaveRoom(participantArgs).catch((err) => {
                if (err instanceof Error && err.message.includes('NOT_IN_ROOM')) {
                    // already removed; just continue
                } else {
                    console.warn('Failed to leave room', err);
                }
            });
        }
        pauseToastActiveRef.current = false;
        pauseToastHostRef.current = null;
        roomStatusRef.current = null;
        lostHostSkipResumeToastRef.current = false;
        setHasLeft(true);
        router.navigate('/(tabs)/party');
    }, [disconnectReason, hasLeft, leaveRoom, participantArgs, router]);
    useEffect(() => {
        if (connectionState === 'reconnecting') {
            if (reconnectTransitionRef.current) return;
            reconnectTransitionRef.current = setTimeout(() => {
                setGraceRemaining(120); setConnectionState((state) => (state === 'reconnecting' ? 'grace' : state));
                reconnectTransitionRef.current = null;
            }, 5000);
            return () => {
                if (reconnectTransitionRef.current) {
                    clearTimeout(reconnectTransitionRef.current);
                    reconnectTransitionRef.current = null;
                }
            };
        }
        if (reconnectTransitionRef.current) {
            clearTimeout(reconnectTransitionRef.current);
            reconnectTransitionRef.current = null;
        }
    }, [connectionState]);
    useEffect(() => {
        if (connectionState !== 'grace') {
            if (graceTimerRef.current) {
                clearInterval(graceTimerRef.current);
                graceTimerRef.current = null;
            }
            return;
        }
        setGraceRemaining(120);
        if (graceTimerRef.current) {
            clearInterval(graceTimerRef.current);
        }
        graceTimerRef.current = setInterval(() => {
            setGraceRemaining((prev) => {
                if (prev <= 1) {
                    if (graceTimerRef.current) {
                        clearInterval(graceTimerRef.current);
                        graceTimerRef.current = null;
                    }
                    setConnectionState('expired');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => {
            if (graceTimerRef.current) {
                clearInterval(graceTimerRef.current);
                graceTimerRef.current = null;
            }
        };
    }, [connectionState]);
    useEffect(() => {
        if (connectionState === 'expired') {
            setDisconnectReason(EXPIRED_MESSAGE);
        }
    }, [connectionState]);
    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            handleLeave();
            return true;
        });
        return () => subscription.remove();
    }, [handleLeave]);
    const isHost = roomData?.me.isHost ?? false;
    useEffect(() => {
        const interval = setInterval(() => {
            setLocalNowMs(Date.now());
        }, 250);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (roomData?.now) {
            setServerOffsetMs(Date.now() - roomData.now);
        }
    }, [roomData?.now]);
    useEffect(() => {
        serverOffsetRef.current = serverOffsetMs;
    }, [serverOffsetMs]);


    useEffect(() => {
        if (hasLeft || disconnectReason || !participantArgs) return;
        const tick = async () => {
            try {
                await heartbeat(participantArgs);
                handleConnectionRestored();
            } catch (err) {
                if (err instanceof Error && err.message.includes('NOT_IN_ROOM')) {
                    notifyForcedExit();
                } else {
                    beginReconnecting();
                    console.warn('Heartbeat failed', err);
                }
            }
        };
        void tick();
        const interval = setInterval(tick, 5000);
        return () => clearInterval(interval);
    }, [beginReconnecting, disconnectReason, handleConnectionRestored, hasLeft, heartbeat, notifyForcedExit, participantArgs]);

    useEffect(() => {
        if (hasLeft || disconnectReason) return;
        pendingHeartbeatRef.current = false;
        if (!pendingAction) {
            setPendingMs(0);
            return;
        }

        const update = () => {
            const diff = pendingAction.executeAt - (Date.now() - serverOffsetMs);
            setPendingMs(Math.max(0, diff));
            if (diff <= 0 && participantArgs && !pendingHeartbeatRef.current) {
                pendingHeartbeatRef.current = true;
                void (async () => {
                    try {
                        await heartbeat(participantArgs);
                        handleConnectionRestored();
                    } catch (error) {
                        pendingHeartbeatRef.current = false;
                        if (error instanceof Error && error.message.includes('NOT_IN_ROOM')) {
                            notifyForcedExit();
                        } else {
                            beginReconnecting();
                        }
                    }
                })();
            }
        };

        update();
        const interval = setInterval(update, 200);
        return () => clearInterval(interval);
    }, [beginReconnecting, disconnectReason, handleConnectionRestored, hasLeft, heartbeat, notifyForcedExit, participantArgs, pendingAction, serverOffsetMs]);

    useEffect(() => {
        setSelectedChoice(null);
    }, [roomData?.currentRound?.index]);

    useEffect(() => {
        if (disconnectReason || !roomData?.me) {
            return;
        }
        const currentHost = roomData.me.isHost;
        const previous = wasHostRef.current;
        wasHostRef.current = currentHost;
        if (previous === null) {
            return;
        }
        if (previous && !currentHost) {
            lostHostDueToGraceRef.current = hostConnectionState !== 'online';
            lostHostSkipResumeToastRef.current = true;
            showToast('연결이 끊긴 동안 다른 참가자가 진행을 이어받았어요.', 'lost_host_role');
        } else if (!previous && currentHost) {

            const lostDueToGrace = lostHostDueToGraceRef.current;
            lostHostDueToGraceRef.current = false;
            lostHostSkipResumeToastRef.current = false;
            if (!lostDueToGrace) {
                setPromotedToHost(true);
            }
        }
    }, [disconnectReason, hostConnectionState, roomData?.me, showToast]);
    useEffect(() => {
        if (disconnectReason || hasLeft) {
            resetHostGraceState();
            hostConnectivityRef.current = null;
        }
    }, [disconnectReason, hasLeft, resetHostGraceState]);

    const syncedNow = roomState ? localNowMs - serverOffsetMs : undefined;
    const timeLeft = computeTimeLeft(roomData?.room.phaseEndsAt ?? null, syncedNow);
    const isHostWaitingPhase =
        ['countdown', 'question', 'grace', 'reveal', 'leaderboard'].includes(roomStatus) &&
        timeLeft !== null &&
        timeLeft <= 0 &&
        !isPaused &&
        !pendingAction;
    const hostBannerVisible = hostConnectionState === 'waiting';
    const isHostOverlayActive = hostConnectionState !== 'online';
    const roomServerNow = roomData?.now ?? null;
    const hostDisconnectedAt = hostParticipant?.disconnectedAt ?? null;
    const hostLastSeenAt = hostParticipant?.lastSeenAt ?? null;
    const hostDisconnectedElapsedMs =
        hostDisconnectedAt !== null && syncedNow !== undefined ? Math.max(0, syncedNow - hostDisconnectedAt) : null;
    const hostLagMs =
        hostLastSeenAt !== null && syncedNow !== undefined ? Math.max(0, syncedNow - hostLastSeenAt) : null;
    const hostSnapshotAgeMs =
        roomServerNow !== null && syncedNow !== undefined ? Math.max(0, syncedNow - roomServerNow) : null;
    const hostSnapshotFresh =
        hostSnapshotAgeMs !== null && hostSnapshotAgeMs <= HOST_SNAPSHOT_STALE_THRESHOLD_MS;
    const hostGraceElapsedMs =
        hostDisconnectedElapsedMs ??
        (hostSnapshotFresh && hostLagMs !== null && hostLagMs > HOST_HEARTBEAT_GRACE_MS ? hostLagMs : 0);

    useEffect(() => {
        if (hasLeft || disconnectReason) return;
        if (!hostUserId) {
            previousHostIdRef.current = null;
            hostConnectivityRef.current = null;
            if (hostConnectionState !== 'expired') {
                resetHostGraceState();
            }
            return;
        }
        const wasHostId = previousHostIdRef.current;
        if (wasHostId !== hostUserId || wasHostId === null) {
            previousHostIdRef.current = hostUserId;
            hostConnectivityRef.current = null;
            if (hostConnectionState !== 'expired') {
                resetHostGraceState();
            }
        }
        if (connectionState !== 'online') {
            return;
        }

        if (syncedNow !== undefined && roomServerNow !== null && syncedNow - roomServerNow > 7000) {
            beginReconnecting();
            return;
        }

        const hostAppearsOffline =
            hostDisconnectedElapsedMs !== null ||
            !hostIsConnected ||
            (hostSnapshotFresh && hostLagMs !== null && hostLagMs > HOST_HEARTBEAT_GRACE_MS);
        const perceivedOnline = !hostAppearsOffline;
        const previous = hostConnectivityRef.current;

        if (previous === null) {
            hostConnectivityRef.current = perceivedOnline;
            if (hostAppearsOffline) {
                beginHostGraceWait(hostGraceElapsedMs);
                showToast(`⚠️ ${hostNickname}님 연결이 불안정해 잠시 대기 중이에요.`, 'host_disconnect');
            }
            return;
        }

        if (previous && hostAppearsOffline) {
            hostConnectivityRef.current = perceivedOnline;
            beginHostGraceWait(hostGraceElapsedMs);
            showToast(`⚠️ ${hostNickname}님 연결이 불안정해 잠시 대기 중이에요.`, 'host_disconnect');
            return;
        }

        if (!previous && perceivedOnline) {
            hostConnectivityRef.current = perceivedOnline;
            if (hostConnectionState !== 'online') {
                resetHostGraceState();
                showToast(`${hostNickname}님 연결이 복구됐어요. 게임을 다시 시작합니다 🚀`, 'host_reconnect');
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
            } else {
                resetHostGraceState();
            }
            return;
        }

        hostConnectivityRef.current = perceivedOnline;
    }, [
        beginHostGraceWait,
        connectionState,
        disconnectReason,
        hasLeft,
        hostConnectionState,
        hostIsConnected,
        hostGraceElapsedMs,
        hostDisconnectedElapsedMs,
        hostLagMs,
        hostSnapshotFresh,
        hostNickname,
        hostParticipant,
        isHost,
        resetHostGraceState,
        showToast,
        beginReconnecting,
        roomServerNow,
        syncedNow,
    ]);
    useEffect(() => {
        if (hostConnectionState !== 'waiting') return;
        if (hostGraceDeadlineRef.current === null) return;
        const clampedElapsed = Math.min(Math.max(hostGraceElapsedMs, 0), HOST_GRACE_MS);
        const serverNow = syncedNow ?? Date.now() - serverOffsetRef.current;
        const desiredRemainingMs = Math.max(0, HOST_GRACE_MS - clampedElapsed);
        const desiredDeadline = serverNow + desiredRemainingMs;
        if (Math.abs(hostGraceDeadlineRef.current - desiredDeadline) > 1000) {
            hostGraceDeadlineRef.current = desiredDeadline;
            setHostGraceRemaining(Math.max(0, Math.ceil(desiredRemainingMs / 1000)));
        }
    }, [hostConnectionState, hostGraceElapsedMs, syncedNow]);

    useEffect(() => {
        if (hasLeft || disconnectReason) {
            participantConnectivityRef.current.clear();
            return;
        }
        const map = participantConnectivityRef.current;
        const currentIds = new Set<string>();
        if (connectionState !== 'online') {
            map.clear();
            return;
        }
        if (justReconnected) {
            participants.forEach((p) => map.set(p.participantId, p.isConnected));
            setJustReconnected(false);
            return;
        }
        participants.forEach((participant) => {
            currentIds.add(participant.participantId);
            const isHostParticipant = participant.userId && hostUserId && participant.userId === hostUserId;
            const isMeParticipant = meParticipantId !== null && participant.participantId === meParticipantId;
            if (isHostParticipant || isMeParticipant) {
                map.set(participant.participantId, participant.isConnected);
                return;
            }
            const previous = map.get(participant.participantId);
            if (previous === undefined) {
                map.set(participant.participantId, participant.isConnected);
                return;
            }
            if (isHostOverlayActive) {
                map.set(participant.participantId, participant.isConnected);
                return;
            }
            if (previous && !participant.isConnected) {
                showToast(
                    `${participant.nickname}님이 잠시 연결이 끊겼어요.`,
                    `participant_disconnect_${participant.participantId}`
                );
            } else if (!previous && participant.isConnected) {
                showToast(
                    `${participant.nickname}님이 다시 연결됐어요.`,
                    `participant_reconnect_${participant.participantId}`
                );
            }
            map.set(participant.participantId, participant.isConnected);
        });
        Array.from(map.keys()).forEach((key) => {
            if (!currentIds.has(key)) {
                map.delete(key);
            }
        });
    }, [connectionState, disconnectReason, hasLeft, hostUserId, isHostOverlayActive, meParticipantId, participants, showToast]);

    useEffect(() => {
        if (disconnectReason) return;
        // This effect should not run on the initial mount to avoid race conditions on Android.
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (roomStatus === 'lobby' && roomData?.room.code) {
            router.replace({ pathname: '/room/[code]', params: { code: roomData.room.code } });

        }
    }, [disconnectReason, roomStatus, roomData?.room.code, router]);

    useEffect(() => {
        if (hasLeft || disconnectReason || connectionState !== 'online') return;
        const prevStatus = roomStatusRef.current;
        if (prevStatus !== null && prevStatus !== roomStatus && !isHost) {
            if (isPaused) {
                showToast('호스트가 게임을 일시정지했어요');
            } else if (prevStatus === 'paused' && !isPaused) {
                if (lostHostSkipResumeToastRef.current) {
                    lostHostSkipResumeToastRef.current = false;
                } else {
                    showToast('게임이 다시 시작됐어요');
                }
            }
        }
        roomStatusRef.current = roomStatus;
    }, [connectionState, disconnectReason, hasLeft, isHost, isPaused, roomStatus, showToast]);

    useEffect(() => {
        if (hasLeft || disconnectReason) return;
        if (isHost || isPaused || hostIsConnected) {
            setIsGameStalled(false);
            return;
        }
        if (isHostWaitingPhase && !hostIsConnected) {
            const timer = setTimeout(() => {
                setIsGameStalled(true);
            }, 1500);
            return () => clearTimeout(timer);
        } else {
            setIsGameStalled(false);
        }
    }, [disconnectReason, hasLeft, hostIsConnected, isHost, isHostWaitingPhase, isPaused, roomStatus]);

    useEffect(() => {
        if (hasLeft || disconnectReason || hostIsConnected) return;
        if (isGameStalled) {
            const meta = waitingToastRef.current;
            const now = Date.now();
            const canShow = !meta.shownForSession;
            if (canShow) {
                showToast(`${hostNickname}님 연결을 확인하는 중이에요. 잠시만 기다려주세요.`, 'host_waiting');
                meta.shownForSession = true;
                meta.lastShownAt = now;
            }
        } else {
            waitingToastRef.current.shownForSession = false;
        }
    }, [disconnectReason, hasLeft, hostIsConnected, hostNickname, isGameStalled, showToast]);

    const handleChoicePress = async (choiceIndex: number) => {
        if (!roomId || roomStatus !== 'question' || !currentRound || !participantArgs) return;
        setSelectedChoice(choiceIndex);
        try {
            await submitAnswer({
                ...participantArgs,
                choiceIndex,
                clientTs: Date.now(),
            });
        } catch (err) {
            if (err instanceof Error && err.message.includes('ROUND_NOT_ACTIVE')) {
                Alert.alert('제출 시간이 지났어요', '다음 라운드에서 다시 도전해주세요.');
                return;
            }
            Alert.alert('답안을 제출하지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        }
    };

    const handleAdvance = useCallback(async () => {
        if (!roomId) return;
        if (!isHost) {
            showToast('지금은 호스트가 아니에요. 다른 참가자가 진행을 이어받았어요.', 'not_host_cannot_progress');
            return;
        }
        try {
            const key = await resolveHostGuestKey();
            await progressRoom({ roomId, guestKey: key });
        } catch (err) {
            if (err instanceof Error && err.message.includes('NOT_AUTHORIZED')) {
                showToast('지금은 호스트가 아니에요. 다른 참가자가 진행을 이어받았어요.', 'not_authorized_progress');
                return;
            }
            Alert.alert('상태 전환 실패', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        }
    }, [isHost, progressRoom, resolveHostGuestKey, roomId, showToast]);

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
            const key = await resolveHostGuestKey();
            await pauseRoom({ roomId, guestKey: key });
        } catch (err) {
            Alert.alert('일시정지하지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsPausePending(false);
        }
    }, [isHost, isPausePending, isPausableStatus, pauseRoom, pendingAction, resolveHostGuestKey, roomId]);

    const handleResume = useCallback(async () => {
        if (!roomId || !isHost || !isPaused) return;
        if (isResumePending) return;
        setIsResumePending(true);
        try {
            const key = await resolveHostGuestKey();
            await resumeRoom({ roomId, guestKey: key });
        } catch (err) {
            Alert.alert('재개하지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsResumePending(false);
        }
    }, [isHost, isPaused, isResumePending, resolveHostGuestKey, resumeRoom, roomId]);

    const autoAdvancePhaseKey = `${roomStatus}-${roomData?.room.currentRound ?? 'final'}`;
    const autoAdvancePhaseRef = useRef<string | null>(null);
    const autoAdvanceTriggeredRef = useRef(false);

    useEffect(() => {
        if (hasLeft || connectionState !== 'online') return;
        const guardKey = `${roomId ?? 'none'}-${roomStatus}-${roomData?.room.currentRound ?? 'final'}`;
        if (autoAdvancePhaseRef.current !== guardKey) {
            autoAdvancePhaseRef.current = guardKey;
            autoAdvanceTriggeredRef.current = false;
        }
        if (!isHost) return;
        if (!['countdown', 'question', 'grace', 'reveal', 'leaderboard'].includes(roomStatus)) return;
        if (timeLeft === null) return;
        if (timeLeft > 0) return;
        if (autoAdvanceTriggeredRef.current) return;
        autoAdvanceTriggeredRef.current = true;
        handleAdvance();
    }, [hasLeft, handleAdvance, isHost, roomData?.room.currentRound, roomId, roomStatus, timeLeft]);

    useEffect(() => {
        if (hasLeft) return;
        if (roomStatus !== 'results') {
            if (isRematchPending) setIsRematchPending(false);
            if (isLobbyPending) setIsLobbyPending(false);
        }
    }, [hasLeft, isLobbyPending, isRematchPending, roomStatus]);

    const handleRematch = useCallback(async () => {
        if (!roomId) return;
        if (!isHost) {
            showToast('호스트가 리매치를 시작하면 진행돼요');
            return;
        }
        if (roomStatus !== 'results') return;
        if (pendingAction) {
            Alert.alert('이미 예약된 작업이 있어요');
            return;
        }
        if (isRematchPending || isLobbyPending) return;
        setIsRematchPending(true);
        try {
            const key = await resolveHostGuestKey();
            await rematchRoom({ roomId, delayMs: resolveDelay(), guestKey: key });
        } catch (err) {
            Alert.alert('리매치를 시작하지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsRematchPending(false);
        }
    }, [isHost, isLobbyPending, isRematchPending, pendingAction, rematchRoom, resolveHostGuestKey, roomId, roomStatus, showToast, resolveDelay]);

    const handleReturnToLobby = useCallback(async () => {
        if (!roomId || !participantArgs) return;
        if (!isHost) {
            if (isLobbyPending) return;
            setIsLobbyPending(true);
            try {
                await requestLobby({ ...participantArgs, delayMs: resolveDelay() });
                showToast('호스트가 대기실로 이동하면 전환돼요');
            } catch (err) {
                Alert.alert('요청을 보내지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
            } finally {
                setIsLobbyPending(false);
            }
            return;
        }
        if (roomStatus !== 'results' && roomStatus !== 'lobby') return;
        if (isLobbyPending || isRematchPending) return;
        if (pendingAction) {
            Alert.alert('이미 예약된 작업이 있어요');
            return;
        }
        setIsLobbyPending(true);
        try {
            const key = await resolveHostGuestKey();
            await resetRoom({ roomId, guestKey: key });
        } catch (err) {
            Alert.alert('대기실로 돌아가지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsLobbyPending(false);
        }
    }, [isHost, isLobbyPending, isRematchPending, participantArgs, pendingAction, requestLobby, resolveHostGuestKey, resetRoom, roomId, roomStatus, showToast, resolveDelay]);

    const handleCancelPending = useCallback(async () => {
        if (!roomId || !pendingAction) return;
        try {
            const key = await resolveHostGuestKey();
            await cancelPendingAction({ roomId, guestKey: key });
            showToast('진행이 취소되었어요');
        } catch (err) {
            Alert.alert('취소하지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        }
    }, [cancelPendingAction, pendingAction, resolveHostGuestKey, roomId, showToast]);

    useEffect(() => {
        if (roomStatus !== 'results') {
            historyLoggedRef.current = null;
            return;
        }
        if (authStatus !== 'authenticated' || !user) return;
        if (!roomData) return;
        const sessionId = `party:${roomData.room._id}:${roomData.room.version ?? 0}`;
        if (historyLoggedRef.current === sessionId) {
            return;
        }
        const meEntry = participants.find(
            (participant) => participant.participantId === roomData.me.participantId
        );
        if (!meEntry) {
            return;
        }
        historyLoggedRef.current = sessionId;
        void (async () => {
            try {
                await logHistory({
                    mode: 'party',
                    sessionId,
                    data: {
                        deckSlug: roomData.deck?.slug ?? undefined,
                        deckTitle: roomData.deck?.title ?? undefined,
                        roomCode: roomData.room.code,
                        rank: meEntry.rank ?? undefined,
                        totalParticipants: participants.length,
                        totalScore: meEntry.totalScore,
                        answered: meEntry.answers,
                    },
                });
            } catch (error) {
                console.warn('Failed to log party history', error);
                historyLoggedRef.current = null;
            }
        })();
    }, [
        authStatus,
        logHistory,
        participants,
        roomData,
        roomStatus,
        user,
    ]);

    if (!roomId) {
        return null;
    }

    if (disconnectReason) {
        if (disconnectReason === EXPIRED_MESSAGE) {
            return (
                <>
                    <Stack.Screen options={{ title: '연결 끊김', headerBackVisible: false }} />
                    <ThemedView style={styles.loadingContainer}>
                        <ThemedText type="title">연결이 종료됐어요</ThemedText>
                        <ThemedText style={[styles.loadingLabel, styles.disconnectLabel]}>{disconnectReason}</ThemedText>
                        <Pressable style={styles.retryButton} onPress={handleLeave}>
                            <ThemedText style={styles.retryLabel}>나가기</ThemedText>
                        </Pressable>
                    </ThemedView>
                </>
            );
        }
        return (
            <>
                <Stack.Screen options={{ title: '연결 끊김', headerBackVisible: false }} />
                <ThemedView style={styles.loadingContainer}>
                    <ThemedText type="title">연결이 종료됐어요</ThemedText>
                    <ThemedText style={[styles.loadingLabel, styles.disconnectLabel]}>{disconnectReason}</ThemedText>
                    <Pressable style={styles.retryButton} onPress={handleLeave}>
                        <ThemedText style={styles.retryLabel}>파티 찾기</ThemedText>
                    </Pressable>
                </ThemedView>
            </>
        );
    }

    if (hasLeft) {
        return null;
    }

    if (roomState === undefined) {
        return (
            <ThemedView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Palette.teal600} />
                <ThemedText style={styles.loadingLabel}>게임을 불러오는 중...</ThemedText>
            </ThemedView>
        );
    }

    if (!roomState) {
        return (
            <ThemedView style={styles.loadingContainer}>
                <ThemedText type="title">게임 정보를 찾을 수 없어요</ThemedText>
                <Pressable style={styles.retryButton} onPress={() => router.navigate('/(tabs)/party')}>
                    <ThemedText style={styles.retryLabel}>홈으로 이동</ThemedText>
                </Pressable>
            </ThemedView>
        );
    }

    const renderCountdown = () => (
        <View style={styles.centerCard}>
            <ThemedText type="title">다음 라운드 준비!</ThemedText>
            <ThemedText style={styles.centerSubtitle}>{timeLeft !== null ? `${timeLeft}s` : '...'} 후 문제를 읽어요.</ThemedText>
            {isHost && !hostIsConnected ? (
                <Pressable
                    style={[styles.button, styles.secondaryButton]}
                    onPress={handleAdvance}
                >
                    <ThemedText style={styles.secondaryButtonText}>다음 진행</ThemedText>
                </Pressable>
            ) : null}
        </View>
    );

    const renderReturning = () => (
        <View style={styles.centerCard}>
            <ActivityIndicator size="large" color={Palette.teal600} />
            <ThemedText style={[styles.centerSubtitle, styles.returningLabel]}>대기실로 이동 중...</ThemedText>
        </View>
    );

    const currentRoundIndex = (roomData?.room.currentRound ?? 0) + 1;
    const totalRoundsDisplay = roomData?.room.totalRounds ?? 10;

    const renderQuestion = () => (
        <View style={styles.questionCard}>
            <ThemedText style={styles.roundCaption}>
                라운드 {currentRoundIndex} / {totalRoundsDisplay}
            </ThemedText>
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
                    currentRound.leaderboard.top.map((entry) => {
                        const isMe = meParticipantId !== null && entry.participantId === meParticipantId;
                        return (
                            <View
                                key={entry.participantId}
                                style={[
                                    styles.distributionRow,
                                    styles.leaderboardRow,
                                    entry.rank === 1 ? styles.leaderboardRankOne : null,
                                    entry.rank === 2 ? styles.leaderboardRankTwo : null,
                                    entry.rank === 3 ? styles.leaderboardRankThree : null,
                                    isMe ? styles.leaderboardMeRow : null,
                                ]}
                            >
                                <View style={styles.leaderboardRankBadge}>
                                    <ThemedText style={styles.leaderboardRankText}>{entry.rank}</ThemedText>
                                </View>
                                <View style={styles.leaderboardNameWrapper}>
                                    <ThemedText
                                        style={[
                                            styles.choiceLabel,
                                            isMe ? styles.leaderboardMeText : null,
                                        ]}
                                    >
                                        {entry.nickname}
                                    </ThemedText>
                                    {isMe ? (
                                        <ThemedText style={styles.leaderboardMeHint}>나</ThemedText>
                                    ) : null}
                                </View>
                                <ThemedText
                                    style={[
                                        styles.distributionCount,
                                        isMe ? styles.leaderboardMeText : null,
                                    ]}
                                >
                                    {entry.totalScore}점
                                </ThemedText>
                            </View>
                        );
                    })
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
                    <View key={player.participantId} style={styles.distributionRow}>
                        <ThemedText style={styles.choiceBadgeText}>#{player.rank ?? index + 1}</ThemedText>
                        <View style={styles.resultNameWrapper}>
                            <ThemedText style={styles.choiceLabel}>{player.nickname}</ThemedText>
                            {player.userId && hostUserId && player.userId === hostUserId && !player.isConnected ? (
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
                    (isRematchPending || isLobbyPending || roomStatus !== 'results' || !isHost) ? styles.buttonDisabled : null,
                ]}
                onPress={handleRematch}
                disabled={isRematchPending || isLobbyPending || roomStatus !== 'results'}
            >
                <ThemedText style={styles.primaryButtonText}>리매치</ThemedText>
            </Pressable>
            <Pressable
                style={[styles.button, styles.secondaryButton, (isLobbyPending || isRematchPending || roomStatus !== 'results' || !isHost) ? styles.buttonDisabled : null]}
                onPress={handleReturnToLobby}
                disabled={isLobbyPending || isRematchPending || roomStatus !== 'results'}
            >
                <ThemedText style={styles.secondaryButtonText}>대기실로</ThemedText>
            </Pressable>
            <Pressable
                style={[styles.ghostButton, isLobbyPending || isRematchPending || roomStatus !== 'results' ? styles.ghostButtonDisabled : null]}
                onPress={handleLeave}
                disabled={isLobbyPending || isRematchPending || roomStatus !== 'results'}
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

    const renderHostBanner = () => {
        if (!hostBannerVisible) return null;
        const minutes = Math.floor(hostGraceRemaining / 60);
        const seconds = hostGraceRemaining % 60;
        const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        return (
            <View style={styles.hostBanner}>
                <ThemedText type="subtitle" style={styles.hostBannerTitle}>
                    ⌛ 재접속 대기 중 ({formattedTime})
                </ThemedText>
                <ThemedText style={styles.hostBannerSubtitle}>
                    {hostNickname}님 연결을 기다리는 중이에요. 복구되면 자동으로 이어집니다.
                </ThemedText>
            </View>
        );
    };

    const renderConnectionBanner = () => {
        const banners: ReactNode[] = [];
        if (connectionState === 'reconnecting') {
            banners.push(
                <View key="self_reconnecting" style={styles.connectionBanner}>
                    <ThemedText style={styles.connectionBannerText}>⚠️ 연결이 불안정합니다… 다시 연결 중</ThemedText>
                </View>
            );
        }
        if (!isHost && hostConnectionState === 'waiting') {
            banners.push(
                <View key="host_reconnecting" style={styles.connectionBanner}>
                    <ThemedText style={styles.connectionBannerText}>
                        ⚠️ 호스트 연결이 불안정합니다… 다시 연결 중
                    </ThemedText>
                </View>
            );
        }
        if (banners.length === 0) return null;
        return <>{banners}</>;
    };

    const renderGraceOverlay = () => {
        if (connectionState !== 'grace') return null;
        const progress = Math.max(0, Math.min(1, graceRemaining / 120));
        const minutes = Math.floor(graceRemaining / 60);
        const seconds = graceRemaining % 60;
        const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        return (
            <View style={styles.graceOverlay}>
                <View style={styles.graceBackdrop} />
                <View style={styles.graceCard}>
                    <ThemedText style={styles.graceTitle}>연결 대기 중</ThemedText>
                    <ThemedText style={styles.graceSubtitle}>
                        연결이 끊겼어요. {graceRemaining}초 안에 복구되면 이어서 진행돼요.
                    </ThemedText>
                    <ThemedText style={styles.graceTimer}>{formattedTime}</ThemedText>
                    <View style={styles.graceProgressBar}>
                        <View style={[styles.graceProgressFill, { width: `${progress * 100}%` }]} />
                    </View>
                    <Pressable
                        style={[styles.button, styles.primaryButton, isManualReconnectPending ? styles.buttonDisabled : null]}
                        onPress={handleManualReconnect}
                        disabled={isManualReconnectPending}
                    >
                        <ThemedText style={styles.primaryButtonText}>
                            {isManualReconnectPending ? '재시도 중...' : '재연결 시도'}
                        </ThemedText>
                    </Pressable>
                    <Pressable style={styles.ghostButton} onPress={handleLeave}>
                        <ThemedText style={styles.ghostButtonText}>나가기</ThemedText>
                    </Pressable>
                </View>
            </View>
        );
    };

    const renderHostGraceOverlay = () => {
        const nextHostMessage = (() => {
            if (hostParticipant && meParticipantId && hostParticipant.participantId === meParticipantId) {
                return '당신이 진행을 이어받았어요. 게임을 계속 진행해 주세요!';
            }
            if (hostParticipant) {
                return `${hostNickname}님이 진행을 이어받았어요.`;
            }
            return '다른 참가자가 진행을 이어받았어요.';
        })();
        if (promotedToHost) {
            return (
                <View style={styles.graceOverlay}>
                    <View style={styles.graceBackdrop} />
                    <View style={styles.graceCard}>
                        <ThemedText style={styles.graceTitle}>👑 새로운 호스트가 지정되었어요</ThemedText>
                        <ThemedText style={styles.graceSubtitle}>{nextHostMessage}</ThemedText>
                        <Pressable
                            style={[styles.button, styles.primaryButton]}
                            onPress={() => setPromotedToHost(false)}
                        >
                            <ThemedText style={styles.primaryButtonText}>확인</ThemedText>
                        </Pressable>
                        <Pressable style={[styles.button, styles.primaryButton]} onPress={handleLeave}>
                            <ThemedText style={styles.primaryButtonText}>나가기</ThemedText>
                        </Pressable>
                    </View>
                </View>
            );
        }
        if (connectionState !== 'online') return null;
        if (hostConnectionState === 'online') return null;
        if (isHost) return null;
        if (!hostParticipant && hostConnectionState !== 'expired') return null;
        const progress = Math.max(0, Math.min(1, hostGraceRemaining / HOST_GRACE_SECONDS));
        const formattedTime = `${Math.floor(hostGraceRemaining / 60)}:${(hostGraceRemaining % 60)
            .toString()
            .padStart(2, '0')}`;

        if (hostConnectionState === 'waiting') {
            return (
                <View style={styles.graceOverlay}>
                    <View style={styles.graceBackdrop} />
                    <View style={styles.graceCard}>
                        <ThemedText style={styles.graceTitle}>🔄 호스트 연결이 끊겼습니다.</ThemedText>
                        <ThemedText style={styles.graceSubtitle}>
                            {hostNickname}님 연결을 복구 중이에요. {formattedTime} 안에 돌아오면 계속 진행돼요.
                        </ThemedText>
                        <View style={styles.graceProgressBar}>
                            <View style={[styles.graceProgressFill, { width: `${progress * 100}%` }]} />
                        </View>
                        <ThemedText style={styles.graceTimer}>{formattedTime}</ThemedText>
                        <ThemedText style={styles.graceSubtitle}>자동으로 재시도하고 있어요.</ThemedText>
                        <Pressable style={styles.ghostButton} onPress={handleLeave}>
                            <ThemedText style={styles.ghostButtonText}>나가기</ThemedText>
                        </Pressable>
                    </View>
                </View>
            );
        }
        return (
            <View style={styles.graceOverlay}>
                <View style={styles.graceBackdrop} />
                <View style={styles.graceCard}>
                    <ThemedText style={styles.graceTitle}>😢 호스트 연결이 오래 끊겼습니다.</ThemedText>
                    <ThemedText style={styles.graceSubtitle}>{nextHostMessage}</ThemedText>
                    <Pressable style={[styles.button, styles.primaryButton]} onPress={handleLeave}>
                        <ThemedText style={styles.primaryButtonText}>나가기</ThemedText>
                    </Pressable>
                </View>
            </View>
        );
    };

    const renderLeaveButton = () => {
        if (roomStatus === 'results') return null;
        return (
            <Pressable style={styles.leaveControl} onPress={handleLeave}>
                <ThemedText style={styles.leaveControlLabel}>나가기</ThemedText>
            </Pressable>
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
            <ActivityIndicator size="large" color={Palette.teal600} />
            <ThemedText style={styles.centerSubtitle}>게임을 준비 중이에요...</ThemedText>
        </View>
    );

    let content: React.ReactNode | null = null;
    if (roomStatus === 'countdown' && (roomData?.room.currentRound ?? 0) > 0) {
        content = renderCountdown();
    } else if (roomStatus === 'lobby') {
        content = renderReturning();
    } else if (roomStatus === 'question') {
        content = renderQuestion();
    } else if (roomStatus === 'grace') {
        content = renderGrace();
    } else if (roomStatus === 'reveal') {
        content = renderReveal();
    } else if (roomStatus === 'leaderboard') {
        content = renderLeaderboard();
    } else if (roomStatus === 'paused') {
        if (pausedPreviousStatus === 'question') {
            content = renderQuestion();
        } else if (pausedPreviousStatus === 'grace') {
            content = renderGrace();
        } else if (pausedPreviousStatus === 'reveal') {
            content = renderReveal();
        } else if (pausedPreviousStatus === 'leaderboard') {
            content = renderLeaderboard();
        } else if (pausedPreviousStatus === 'countdown' && (roomData?.room.currentRound ?? 0) > 0) {
            content = renderCountdown();
        }
    } else if (roomStatus === 'results') {
        content = renderResults();
    }

    if (!content) {
        content = renderBootstrapping();
    }

    return (
        <>
            <Stack.Screen options={{ title: '파티 퀴즈', headerBackVisible: false }} />
            <ThemedView style={[styles.container, { paddingBottom: insets.bottom + Spacing.lg }]}>
                {/* {isHost ? renderDelaySelector() : null} */}
                {renderConnectionBanner()}
                {connectionState === 'online' ? renderPendingBanner() : null}
                {connectionState === 'online' && hostBannerVisible ? renderHostBanner() : null}
                {connectionState === 'online' ? renderLeaveButton() : null}
                {connectionState === 'online' ? renderPauseControls() : null}
                {connectionState === 'online' ? renderPauseNotice() : null}
                {content}
                {renderGraceOverlay()}
                {renderHostGraceOverlay()}
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
        backgroundColor: Palette.teal200,
    },
    delayChipText: {
        color: Palette.slate500,
        fontWeight: '500',
    },
    delayChipTextActive: {
        color: Palette.teal600,
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
    disconnectLabel: {
        textAlign: 'center',
        marginHorizontal: Spacing.lg,
    },
    retryButton: {
        marginTop: Spacing.md,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        backgroundColor: Palette.coral600,
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
        backgroundColor: Palette.coral600,
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
    roundCaption: {
        fontSize: 12,
        fontWeight: '600',
        color: Palette.slate500,
        marginBottom: Spacing.xs,
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
        backgroundColor: Palette.coral200,
        borderColor: Palette.coral600,
    },
    choicePressed: {
        opacity: 0.7,
    },
    choiceBadge: {
        width: 24,
        height: 24,
        borderRadius: Radius.sm,
        backgroundColor: Palette.teal600,
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
    leaderboardNameWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingRight: Spacing.md,
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
        backgroundColor: Palette.coral200,
        borderBottomColor: Palette.coral600,
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
        gap: Spacing.sm,
        paddingHorizontal: Spacing.sm,
    },
    leaderboardRankBadge: {
        width: 32,
        height: 32,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Palette.slate200,
    },
    leaderboardRankText: {
        fontWeight: '700',
        color: Palette.slate500,
    },
    leaderboardRankOne: {
        backgroundColor: '#FBE7C6',
    },
    leaderboardRankTwo: {
        backgroundColor: '#E0ECFF',
    },
    leaderboardRankThree: {
        backgroundColor: '#E8E0FF',
    },
    leaderboardMeRow: {
        borderWidth: 2,
        borderColor: Palette.coral600,
        backgroundColor: Palette.coral200,
    },
    leaderboardMeText: {
        color: Palette.coral600,
        fontWeight: '700',
    },
    leaderboardMeHint: {
        fontSize: 12,
        color: Palette.coral400,
        fontWeight: '600',
    },
    leaveControl: {
        alignSelf: 'flex-end',
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.pill,
        backgroundColor: Palette.slate200,
        marginBottom: Spacing.sm,
    },
    leaveControlLabel: {
        color: Palette.slate900,
        fontWeight: '600',
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
    pendingBanner: {
        padding: Spacing.md,
        backgroundColor: Palette.teal200,
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
    hostBanner: {
        padding: Spacing.md,
        backgroundColor: Palette.teal200,
        borderRadius: Radius.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Palette.teal600,
    },
    hostBannerTitle: {
        color: Palette.teal600,
        fontWeight: '700',
    },
    hostBannerSubtitle: {
        marginTop: Spacing.xs,
        color: Palette.slate500,
    },
    connectionBanner: {
        padding: Spacing.sm,
        backgroundColor: Palette.teal200,
        borderRadius: Radius.md,
        marginBottom: Spacing.sm,
        alignItems: 'center',
    },
    connectionBannerText: {
        color: Palette.teal600,
        fontWeight: '600',
    },
    graceOverlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    graceBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(18, 13, 36, 0.45)',
    },
    graceCard: {
        width: '85%',
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        backgroundColor: Palette.surface,
        alignItems: 'center',
        gap: Spacing.md,
    },
    graceTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Palette.slate900,
    },
    graceSubtitle: {
        textAlign: 'center',
        color: Palette.slate500,
    },
    graceTimer: {
        fontSize: 24,
        fontWeight: '700',
        color: Palette.coral600,
    },
    graceProgressBar: {
        width: '100%',
        height: 8,
        borderRadius: Radius.pill,
        backgroundColor: Palette.slate200,
        overflow: 'hidden',
    },
    graceProgressFill: {
        height: '100%',
        backgroundColor: Palette.coral600,
    },
});
