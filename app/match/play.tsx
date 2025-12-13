import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, BackHandler, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showResultToast } from '@/components/common/result-toast';
import {
    CompactReactionBar,
    EMOJI_MAP,
    type ReactionEmoji,
} from '@/components/live-match/reaction-bar';
import { ReactionLayer, type ReactionLayerRef } from '@/components/live-match/reaction-layer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LinearGradient } from 'expo-linear-gradient';

import { AlertDialog } from '@/components/ui/alert-dialog';
import { Avatar, GuestAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Elevation, Palette, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useConnectionStatus } from '@/hooks/use-connection-status';
import { computeTimeLeft, getComboMultiplier, useGameActions, useLiveGame } from '@/hooks/use-live-game';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-unified-auth';
import { getDeckIcon } from '@/lib/deck-icons';
import { supabase } from '@/lib/supabase-api';

// computeTimeLeft and getComboMultiplier are now imported from use-live-game

const FORCED_EXIT_MESSAGE = '세션이 더 이상 유지되지 않아 방과의 연결이 종료됐어요. 다시 참여하려면 초대 코드를 입력해 주세요.';
const EXPIRED_MESSAGE = '연결이 오래 끊겼습니다.\n이번 퀴즈는 종료되었어요.';
const TOAST_COOLDOWN_MS = 10000;
type ConnectionState = 'online' | 'reconnecting' | 'grace' | 'expired';
type HostConnectionState = 'online' | 'waiting' | 'expired';
const HOST_GRACE_SECONDS = 30;
const HOST_GRACE_MS = HOST_GRACE_SECONDS * 1000;
const REACTION_BATCH_WINDOW_MS = 250;
const REACTION_TOKEN_BUCKET_CAPACITY = 30;
const REACTION_TOKEN_BUCKET_REFILL_PER_SEC = 20;
const REACTION_MAX_SPAWN_PER_BROADCAST = 30;
// Bandwidth optimization: increased from 7000 to 10000 to accommodate 8-second heartbeat interval
// This value must be greater than HEARTBEAT_INTERVAL_MS (8000) to prevent false offline detection
const HOST_HEARTBEAT_GRACE_MS = 10000;
const HOST_SNAPSHOT_STALE_THRESHOLD_MS = HOST_HEARTBEAT_GRACE_MS * 2;

export default function MatchPlayScreen() {
    const router = useRouter();
    const { user, status: authStatus, guestKey, ensureGuestKey } = useAuth();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ roomId?: string; participantId?: string }>();
    const roomId = useMemo(() => params.roomId?.toString() ?? null, [params.roomId]);
    const initialParticipantId = useMemo(() => params.participantId?.toString() ?? null, [params.participantId]);
    const colorScheme = useColorScheme() ?? 'light';
    const textColor = useThemeColor({}, 'text');
    const textMutedColor = useThemeColor({}, 'textMuted');
    const warningColor = useThemeColor({}, 'warning');
    const dangerColor = useThemeColor({}, 'danger');
    const infoColor = useThemeColor({}, 'info');
    const cardColor = useThemeColor({}, 'card');
    const borderColor = useThemeColor({}, 'border');
    const background = useThemeColor({}, 'background');
    const avatarFallbackColor = useThemeColor({}, 'primary');

    const [hasLeft, setHasLeft] = useState(false);
    const [isLeaveDialogVisible, setLeaveDialogVisible] = useState(false);
    const [disconnectReason, setDisconnectReason] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>('online');
    const [graceRemaining, setGraceRemaining] = useState(120);
    const [isManualReconnectPending, setIsManualReconnectPending] = useState(false);
    const [hostConnectionState, setHostConnectionState] = useState<HostConnectionState>('online');
    const [hostGraceRemaining, setHostGraceRemaining] = useState(HOST_GRACE_SECONDS);

    // Reaction system
    const reactionLayerRef = useRef<ReactionLayerRef>(null);
    const reactionBroadcastChannelRef = useRef<RealtimeChannel | null>(null);
    const reactionBroadcastReadyRef = useRef(false);
    const pendingReactionCountsRef = useRef<Record<ReactionEmoji, number>>({
        clap: 0,
        fire: 0,
        laugh: 0,
        hundred: 0,
        party: 0,
    });
    const reactionFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reactionTokenBucketRef = useRef<{ tokens: number; lastRefillMs: number }>({
        tokens: REACTION_TOKEN_BUCKET_CAPACITY,
        lastRefillMs: Date.now(),
    });
    const reactionBroadcastSeqRef = useRef(0);

    useEffect(() => {
        if (authStatus === 'guest' && !guestKey) {
            void ensureGuestKey();
        }
    }, [ensureGuestKey, guestKey, authStatus]);

    // Participant ID from route params or game state
    const [participantId, setParticipantId] = useState<string | null>(initialParticipantId);

    const shouldFetch = useMemo(() => {
        if (!roomId || hasLeft || disconnectReason) return false;
        if (authStatus === 'authenticated') return !!user;
        if (authStatus === 'guest') return !!guestKey;
        return false;
    }, [authStatus, disconnectReason, guestKey, hasLeft, roomId, user]);

    const isWatchingState = shouldFetch && !!participantId;

    const notifyForcedExit = useCallback(() => {
        setDisconnectReason((prev) => prev ?? FORCED_EXIT_MESSAGE);
    }, []);

    // Use Supabase game state hook
    const { gameState, refetch: refetchGameState } = useLiveGame(
        roomId,
        participantId,
        { enabled: isWatchingState, guestKey: guestKey ?? undefined }
    );

    const roomData = gameState.status === 'ok' ? gameState : null;

    // Update participantId from game state if not set
    useEffect(() => {
        if (roomData?.me?.participantId && !participantId) {
            setParticipantId(roomData.me.participantId);
        }
    }, [roomData?.me?.participantId, participantId]);

    // Use Supabase game actions
    const gameActions = useGameActions();

    useEffect(() => {
        if (!disconnectReason && isWatchingState && gameState.status === 'not_in_room') {
            notifyForcedExit();
        }
    }, [disconnectReason, isWatchingState, notifyForcedExit, gameState.status]);

    const pendingAction = roomData?.room.pendingAction ?? null;
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

    useEffect(() => {
        if (!roomId || hasLeft || disconnectReason) return;

        const channel = supabase.channel(`live-match-reactions-broadcast:${roomId}`, {
            config: {
                broadcast: { self: false },
            },
        });

        channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
            const data = payload as
                | {
                    roomId?: unknown;
                    emoji?: unknown;
                    count?: unknown;
                    senderId?: unknown;
                }
                | null
                | undefined;

            if (!data) return;
            if (data.roomId !== roomId) return;

            const senderId = typeof data.senderId === 'string' ? data.senderId : null;
            if (senderId && meParticipantId && senderId === meParticipantId) return;

            const emojiKey = typeof data.emoji === 'string' ? data.emoji : null;
            const countRaw = typeof data.count === 'number' ? data.count : Number(data.count);
            const count = Number.isFinite(countRaw) ? Math.max(1, Math.floor(countRaw)) : 1;

            if (!emojiKey) return;
            if (emojiKey !== 'clap' && emojiKey !== 'fire' && emojiKey !== 'hundred' && emojiKey !== 'party' && emojiKey !== 'laugh') return;

            const icon = EMOJI_MAP[emojiKey as ReactionEmoji];
            const burst = Math.min(count, REACTION_MAX_SPAWN_PER_BROADCAST);
            for (let i = 0; i < burst; i++) {
                setTimeout(() => {
                    reactionLayerRef.current?.triggerReaction(icon);
                }, i * 18);
            }
        });

        reactionBroadcastChannelRef.current = channel;
        reactionBroadcastReadyRef.current = false;

        channel.subscribe((status) => {
            reactionBroadcastReadyRef.current = status === 'SUBSCRIBED';
        });

        return () => {
            reactionBroadcastReadyRef.current = false;
            reactionBroadcastChannelRef.current = null;
            void supabase.removeChannel(channel);
        };
    }, [disconnectReason, hasLeft, meParticipantId, roomId]);

    const refillReactionTokens = useCallback(() => {
        const now = Date.now();
        const bucket = reactionTokenBucketRef.current;
        const elapsedMs = now - bucket.lastRefillMs;
        if (elapsedMs <= 0) return;

        const refill = (elapsedMs / 1000) * REACTION_TOKEN_BUCKET_REFILL_PER_SEC;
        bucket.tokens = Math.min(REACTION_TOKEN_BUCKET_CAPACITY, bucket.tokens + refill);
        bucket.lastRefillMs = now;
    }, []);

    const consumeReactionTokens = useCallback((requested: number) => {
        refillReactionTokens();
        const bucket = reactionTokenBucketRef.current;
        const allowed = Math.max(0, Math.min(requested, Math.floor(bucket.tokens)));
        bucket.tokens -= allowed;
        return allowed;
    }, [refillReactionTokens]);

    const flushReactionBroadcast = useCallback(() => {
        if (reactionFlushTimerRef.current) {
            clearTimeout(reactionFlushTimerRef.current);
            reactionFlushTimerRef.current = null;
        }

        const channel = reactionBroadcastChannelRef.current;
        if (!channel || !reactionBroadcastReadyRef.current) {
            reactionFlushTimerRef.current = setTimeout(flushReactionBroadcast, REACTION_BATCH_WINDOW_MS);
            return;
        }

        if (!roomId || !meParticipantId) {
            return;
        }

        const counts = pendingReactionCountsRef.current;
        const snapshot: Record<ReactionEmoji, number> = {
            clap: counts.clap,
            fire: counts.fire,
            hundred: counts.hundred,
            party: counts.party,
            laugh: counts.laugh,
        };

        counts.clap = 0;
        counts.fire = 0;
        counts.hundred = 0;
        counts.party = 0;
        counts.laugh = 0;

        const total = snapshot.clap + snapshot.fire + snapshot.hundred + snapshot.party + snapshot.laugh;
        if (total <= 0) return;

        const now = Date.now();
        const senderId = meParticipantId;
        const baseId = `${senderId}-${now}-${reactionBroadcastSeqRef.current++}`;

        (Object.keys(snapshot) as ReactionEmoji[]).forEach((emoji) => {
            const requested = snapshot[emoji] ?? 0;
            if (requested <= 0) return;

            const allowed = consumeReactionTokens(requested);
            if (allowed <= 0) return;

            void channel.send({
                type: 'broadcast',
                event: 'reaction',
                payload: {
                    id: `${baseId}-${emoji}`,
                    roomId,
                    emoji,
                    count: allowed,
                    senderId,
                    ts: now,
                },
            });
        });
    }, [consumeReactionTokens, meParticipantId, roomId]);

    const queueReactionBroadcast = useCallback((emoji: ReactionEmoji) => {
        pendingReactionCountsRef.current[emoji] += 1;
        if (reactionFlushTimerRef.current) return;
        reactionFlushTimerRef.current = setTimeout(flushReactionBroadcast, REACTION_BATCH_WINDOW_MS);
    }, [flushReactionBroadcast]);

    useEffect(() => {
        return () => {
            if (reactionFlushTimerRef.current) {
                clearTimeout(reactionFlushTimerRef.current);
                reactionFlushTimerRef.current = null;
            }
        };
    }, []);

    // History logging (simplified for Supabase)
    const logHistory = useCallback(async (_entry: { mode: string; sessionId?: string; data?: unknown }) => {
        // History logging is now handled by the server
        // This is kept for API compatibility
        return;
    }, []);

    const logStreakProgress = useCallback(async () => {
        // Streak progress is handled by the finish action on the server
    }, []);

    const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
    const answerSubmitLockRef = useRef(false);
    const [serverOffsetMs, setServerOffsetMs] = useState(0);
    const serverOffsetRef = useRef(0);
    const [localNowMs, setLocalNowMs] = useState(() => Date.now());
    const [phaseCountdownMs, setPhaseCountdownMs] = useState<number | null>(null);
    const phaseExpiryKeyRef = useRef<string | null>(null);
    const [isRematchPending, setIsRematchPending] = useState(false);
    const [isLobbyPending, setIsLobbyPending] = useState(false);
    const [isGameStalled, setIsGameStalled] = useState(false);
    const [promotedToHost, setPromotedToHost] = useState(false);
    const [justReconnected, setJustReconnected] = useState(false);
    const [delayPreset] = useState<'rapid' | 'standard' | 'chill'>('chill');
    const [showConnectionWarning, setShowConnectionWarning] = useState(false);
    const serverNowBaseRef = useRef<{ serverNow: number; receivedAt: number } | null>(null);
    const lastServerNowCandidateRef = useRef<number | null>(null);
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
            showToast('연결이 복구됐어요! 마지막 진행 상태로 돌아갑니다.', 'connection_restored');
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

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        if (connectionState === 'reconnecting') {
            timer = setTimeout(() => setShowConnectionWarning(true), 1500);
        } else {
            setShowConnectionWarning(false);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [connectionState]);
    useEffect(() => () => {
        clearConnectionTimers();
    }, [clearConnectionTimers]);
    useEffect(() => () => {
        stopHostGraceTimer();
    }, [stopHostGraceTimer]);

    // 상태 안정화: 깜빡임 방지를 위한 디바운스 로직
    // 초기값을 null로 설정하여 서버 데이터 수신 전 리다이렉트 방지
    const [stableRoomStatus, setStableRoomStatus] = useState<string | null>(null);
    const [stablePauseState, setStablePauseState] = useState<{
        remainingMs?: number;
        previousStatus: string;
        pausedAt: number;
    } | null>(null);
    const statusDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasReceivedInitialStatus = useRef(false);

    const rawRoomStatus = (roomData?.room.status ?? null) as string | null;
    const rawPauseState = roomData?.room.pauseState ?? null;

    useEffect(() => {
        // roomData가 없으면 이전 상태 유지
        if (!rawRoomStatus) return;

        // 첫 번째 상태는 항상 즉시 반영 (초기 로딩)
        if (!hasReceivedInitialStatus.current) {
            hasReceivedInitialStatus.current = true;
            setStableRoomStatus(rawRoomStatus);
            setStablePauseState(rawPauseState);
            return;
        }

        // paused 상태로 진입하는 경우: 즉시 반영
        if (rawRoomStatus === 'paused') {
            if (statusDebounceRef.current) {
                clearTimeout(statusDebounceRef.current);
                statusDebounceRef.current = null;
            }
            setStableRoomStatus('paused');
            setStablePauseState(rawPauseState);
            return;
        }

        // paused에서 다른 상태로 나가는 경우: 디바운스 적용 (깜빡임 방지)
        if (stableRoomStatus === 'paused' && rawRoomStatus !== 'paused') {
            // 300ms 동안 paused가 아닌 상태가 유지되면 전환
            if (!statusDebounceRef.current) {
                statusDebounceRef.current = setTimeout(() => {
                    setStableRoomStatus(rawRoomStatus);
                    setStablePauseState(rawPauseState);
                    statusDebounceRef.current = null;
                }, 300);
            }
            return;
        }

        // 일반 상태 변화: 즉시 반영
        if (statusDebounceRef.current) {
            clearTimeout(statusDebounceRef.current);
            statusDebounceRef.current = null;
        }
        setStableRoomStatus(rawRoomStatus);
        setStablePauseState(rawPauseState);
    }, [rawRoomStatus, rawPauseState, stableRoomStatus]);

    // 컴포넌트 언마운트 시 타이머 정리
    useEffect(() => {
        return () => {
            if (statusDebounceRef.current) {
                clearTimeout(statusDebounceRef.current);
            }
        };
    }, []);

    const roomStatus = stableRoomStatus;
    const pauseState = stablePauseState;
    const isPaused = roomStatus === 'paused';

    const currentRound = roomData?.currentRound ?? null;
    const participants = useMemo(() => roomData?.participants ?? [], [roomData]);
    const participantsById = useMemo(() => {
        const map = new Map<string, (typeof participants)[number]>();
        participants.forEach((participant) => map.set(participant.participantId, participant));
        return map;
    }, [participants]);
    const hostUserId = roomData?.room.hostId ?? null;
    const hostParticipant = useMemo(
        () => (hostUserId ? participants.find((p) => p.odUserId === hostUserId) : null),
        [participants, hostUserId]
    );
    const hostNickname = hostParticipant?.nickname ?? '호스트';
    const hostIsConnected = hostParticipant?.isConnected ?? false;
    const totalRounds = roomData?.room.totalRounds ?? 0;
    const isFinalLeaderboard =
        roomStatus === 'leaderboard' && totalRounds > 0 && (roomData?.room.currentRound ?? 0) + 1 >= totalRounds;

    const pausedPreviousStatus = pauseState?.previousStatus ?? null;

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
    const streakLoggedRef = useRef(false);
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
            await supabase.functions.invoke('room-action', {
                body: { action: 'heartbeat', ...participantArgs },
            });
            handleConnectionRestored();
        } catch {
            beginReconnecting();
            showToast('아직 연결되지 않았어요. 잠시 후 다시 시도해 주세요.', 'manual_reconnect_failed');
        } finally {
            setIsManualReconnectPending(false);
        }
    }, [beginReconnecting, handleConnectionRestored, isManualReconnectPending, participantArgs, showToast]);
    const performLeave = useCallback(() => {
        if (hasLeft) return;
        const shouldNotifyServer = roomStatus !== 'results';
        if (shouldNotifyServer && !disconnectReason && participantArgs) {
            gameActions.leave(participantArgs).catch((err) => {
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
        router.navigate('/(tabs)/live-match');
    }, [disconnectReason, gameActions, hasLeft, participantArgs, roomStatus, router]);

    const handleLeave = useCallback(() => {
        // On results screen, exit immediately without confirmation modal
        if (roomStatus === 'results') {
            performLeave();
            return;
        }
        setLeaveDialogVisible(true);
    }, [performLeave, roomStatus]);

    const handleConfirmLeave = useCallback(() => {
        setLeaveDialogVisible(false);
        performLeave();
    }, [performLeave]);

    const handleCancelLeave = useCallback(() => {
        setLeaveDialogVisible(false);
    }, []);
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
        // Prefer room-scoped serverNow, which only updates on real phase changes.
        // Falling back to per-response now on every poll can cause countdown jitter
        // under variable network latency, so only use it for initial bootstrapping.
        const primaryNow = roomData?.room.serverNow ?? null;
        const fallbackNow = roomData?.now ?? null;
        const hasBase = serverNowBaseRef.current !== null;
        const serverNowCandidate = primaryNow ?? (!hasBase ? fallbackNow : null);
        if (serverNowCandidate == null) return;
        if (hasBase && lastServerNowCandidateRef.current === serverNowCandidate) {
            return;
        }
        lastServerNowCandidateRef.current = serverNowCandidate;

        const receivedAt = Date.now();
        const drift = Math.abs(serverNowCandidate - receivedAt);
        const MAX_DRIFT_MS = 2 * 60 * 1000; // ignore obviously wrong server clocks
        const useServerNow = drift > MAX_DRIFT_MS ? receivedAt : serverNowCandidate;
        if (drift > MAX_DRIFT_MS && __DEV__ && !serverNowWarningShownRef.current) {
            console.warn('[MatchPlay] Ignoring serverNow with large drift', { serverNowCandidate, receivedAt, drift });
            serverNowWarningShownRef.current = true;
        }
        setServerOffsetMs(receivedAt - useServerNow);
        serverNowBaseRef.current = { serverNow: useServerNow, receivedAt };
    }, [roomData?.now, roomData?.room.serverNow]);
    useEffect(() => {
        serverOffsetRef.current = serverOffsetMs;
    }, [serverOffsetMs]);

    useEffect(() => {
        if (!__DEV__) return;
        const status = roomData?.room.status ?? 'unknown';
        const endsAt = roomData?.room.phaseEndsAt ?? null;
        const serverNow = roomData?.room.serverNow ?? roomData?.now ?? null;
        const key = `${status}-${endsAt ?? 'none'}-${serverNow ?? 'none'}`;
        if (lastRoomLogRef.current === key) return;
        lastRoomLogRef.current = key;
        console.log('[MatchPlay] phase', { status, phaseEndsAt: endsAt, serverNow, round: roomData?.room.currentRound });
    }, [roomData?.now, roomData?.room.phaseEndsAt, roomData?.room.serverNow, roomData?.room.status, roomData?.room.currentRound]);

    useEffect(() => {
        if (hasLeft || disconnectReason) {
            setPhaseCountdownMs(null);
            return;
        }
        const deadline = roomData?.room.phaseEndsAt ?? null;
        if (!deadline) {
            setPhaseCountdownMs(null);
            return;
        }
        const update = () => {
            const base = serverNowBaseRef.current;
            const serverNow = base ? base.serverNow + (Date.now() - base.receivedAt) : Date.now() - serverOffsetRef.current;
            setPhaseCountdownMs(deadline - serverNow);
        };
        update();
        const interval = setInterval(update, 100);
        return () => clearInterval(interval);
    }, [disconnectReason, hasLeft, roomData?.room.phaseEndsAt]);


    // Bandwidth optimization: increased heartbeat interval from 5s to 8s
    // Note: HOST_HEARTBEAT_GRACE_MS (10s) must be greater than this value to prevent false offline detection
    // Note: useLiveGame already handles heartbeat internally, this is for additional connection state monitoring
    const HEARTBEAT_INTERVAL_MS = 8000;
    useEffect(() => {
        if (hasLeft || disconnectReason || !participantArgs) return;
        const tick = async () => {
            try {
                await supabase.functions.invoke('room-action', {
                    body: { action: 'heartbeat', ...participantArgs },
                });
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
        const interval = setInterval(tick, HEARTBEAT_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [beginReconnecting, disconnectReason, handleConnectionRestored, hasLeft, notifyForcedExit, participantArgs]);

    // Bandwidth optimization: reduced pendingAction check interval from 200ms to 500ms
    const PENDING_CHECK_INTERVAL_MS = 500;
    useEffect(() => {
        if (hasLeft || disconnectReason) return;
        pendingHeartbeatRef.current = false;
        if (!pendingAction) {
            setPendingMs(0);
            return;
        }

        const update = () => {
            const base = serverNowBaseRef.current;
            const serverNow = base ? base.serverNow + (Date.now() - base.receivedAt) : Date.now() - serverOffsetMs;
            const diff = pendingAction.executeAt - serverNow;
            setPendingMs(Math.max(0, diff));
            if (diff <= 0 && participantArgs && !pendingHeartbeatRef.current) {
                pendingHeartbeatRef.current = true;
                void (async () => {
                    try {
                        await supabase.functions.invoke('room-action', {
                            body: { action: 'heartbeat', ...participantArgs },
                        });
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
        const interval = setInterval(update, PENDING_CHECK_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [beginReconnecting, disconnectReason, handleConnectionRestored, hasLeft, notifyForcedExit, participantArgs, pendingAction, serverOffsetMs]);

    useEffect(() => {
        setSelectedChoice(null);
        answerSubmitLockRef.current = false;
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

    const syncedNow = useMemo(() => {
        const base = serverNowBaseRef.current;
        if (base) {
            return base.serverNow + (Date.now() - base.receivedAt);
        }
        if (roomData) {
            return localNowMs - serverOffsetMs;
        }
        return null;
    }, [localNowMs, roomData, serverOffsetMs]);
    const phaseRemainingMs = useMemo(() => {
        const deadline = roomData?.room.phaseEndsAt ?? null;
        if (!deadline || syncedNow == null) return null;
        return deadline - syncedNow;
    }, [roomData?.room.phaseEndsAt, syncedNow]);
    const timeLeft = useMemo(() => {
        if (phaseCountdownMs !== null) {
            return Math.max(0, Math.ceil(phaseCountdownMs / 1000));
        }
        if (!roomData?.room.phaseEndsAt || syncedNow == null) return null;
        return computeTimeLeft(roomData.room.phaseEndsAt, syncedNow);
    }, [phaseCountdownMs, roomData?.room.phaseEndsAt, syncedNow]);
    const isHostWaitingPhase =
        roomStatus !== null &&
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
        hostDisconnectedAt !== null && syncedNow !== null ? Math.max(0, syncedNow - hostDisconnectedAt) : null;
    const hostLagMs =
        hostLastSeenAt !== null && syncedNow !== null ? Math.max(0, syncedNow - hostLastSeenAt) : null;
    const hostSnapshotAgeMs =
        roomServerNow !== null && syncedNow !== null ? Math.max(0, syncedNow - roomServerNow) : null;
    const hostSnapshotFresh =
        hostSnapshotAgeMs !== null && hostSnapshotAgeMs <= HOST_SNAPSHOT_STALE_THRESHOLD_MS;
    const hostGraceElapsedMs =
        hostDisconnectedElapsedMs ??
        (hostSnapshotFresh && hostLagMs !== null && hostLagMs > HOST_HEARTBEAT_GRACE_MS ? hostLagMs : 0);

    const pausedRemainingSeconds = useMemo(() => {
        if (!pauseState || pauseState.remainingMs == null) return null;
        const baseRemaining = Math.max(0, pauseState.remainingMs);
        if (syncedNow == null || pauseState.pausedAt == null) {
            return Math.ceil(baseRemaining / 1000);
        }
        const elapsed = Math.max(0, syncedNow - pauseState.pausedAt);
        const remaining = Math.max(0, baseRemaining - elapsed);
        return Math.ceil(remaining / 1000);
    }, [pauseState, syncedNow]);

    useEffect(() => {
        const deadline = roomData?.room.phaseEndsAt ?? null;
        const key = deadline ? `${roomId ?? 'none'}-${deadline}-${roomStatus ?? 'unknown'}` : null;
        if (!deadline || phaseCountdownMs === null) {
            phaseExpiryKeyRef.current = null;
            return;
        }
        if (phaseCountdownMs <= 0) {
            if (phaseExpiryKeyRef.current !== key) {
                phaseExpiryKeyRef.current = key;
                if (!isHost) {
                    void refetchGameState();
                }
            }
        } else if (phaseExpiryKeyRef.current && phaseExpiryKeyRef.current !== key) {
            phaseExpiryKeyRef.current = null;
        }
    }, [isHost, phaseCountdownMs, refetchGameState, roomData?.room.phaseEndsAt, roomId, roomStatus]);

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

        if (syncedNow !== null && roomServerNow !== null && syncedNow - roomServerNow > 7000) {
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
                showToast(`${hostNickname}님 연결이 불안정해 잠시 대기 중이에요.`, 'host_disconnect');
            }
            return;
        }

        if (previous && hostAppearsOffline) {
            hostConnectivityRef.current = perceivedOnline;
            beginHostGraceWait(hostGraceElapsedMs);
            showToast(`${hostNickname}님 연결이 불안정해 잠시 대기 중이에요.`, 'host_disconnect');
            return;
        }

        if (!previous && perceivedOnline) {
            hostConnectivityRef.current = perceivedOnline;
            if (hostConnectionState !== 'online') {
                resetHostGraceState();
                showToast(`${hostNickname}님 연결이 복구됐어요. 게임을 다시 시작합니다.`, 'host_reconnect');
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
        hostUserId,
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
            const isHostParticipant = participant.odUserId && hostUserId && participant.odUserId === hostUserId;
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
    }, [
        connectionState,
        disconnectReason,
        hasLeft,
        hostUserId,
        isHostOverlayActive,
        justReconnected,
        meParticipantId,
        participants,
        showToast,
    ]);

    useEffect(() => {
        if (disconnectReason) return;
        // This effect should not run on the initial mount to avoid race conditions on Android.
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        // roomStatus가 null이면 아직 서버 데이터를 받지 못한 상태이므로 리다이렉트하지 않음
        if (roomStatus && roomStatus === 'lobby' && roomData?.room.code) {
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

    // 콤보 달성 시 토스트 및 햅틱 피드백
    const prevStreakRef = useRef<number>(0);
    const comboToastShownForRoundRef = useRef<number | null>(null);
    useEffect(() => {
        if (hasLeft || disconnectReason) return;
        if (roomStatus !== 'reveal') return;

        const me = roomData?.me;
        const myAnswer = currentRound?.myAnswer;
        const roundIndex = currentRound?.index ?? null;

        if (!me || !myAnswer || roundIndex === null) return;
        if (!myAnswer.isCorrect) {
            prevStreakRef.current = 0;
            return;
        }

        // 이미 이 라운드에서 토스트를 보여줬으면 스킵
        if (comboToastShownForRoundRef.current === roundIndex) return;

        const streak = me.currentStreak;

        // 3콤보 이상이고, 새로운 콤보 단계에 도달했을 때
        if (streak >= 3 && streak > prevStreakRef.current) {
            comboToastShownForRoundRef.current = roundIndex;

            // 콤보 단계별 색상 및 햅틱
            let toastKind: 'combo' | 'combo_hot' | 'combo_fire' = 'combo';
            if (streak >= 7) {
                toastKind = 'combo_fire';
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else if (streak >= 5) {
                toastKind = 'combo_hot';
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } else {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }

            showResultToast({
                message: `🔥 ${streak}콤보!`,
                kind: toastKind,
                scoreDelta: myAnswer.scoreDelta,
            });
        }

        prevStreakRef.current = streak;
    }, [hasLeft, disconnectReason, roomStatus, roomData?.me, currentRound]);

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

    // 리액션 핸들러 - 로컬 애니메이션과 서버 호출 분리
    const handleReaction = useCallback((emoji: ReactionEmoji) => {
        // 1. 로컬 애니메이션은 항상 즉시 트리거
        reactionLayerRef.current?.triggerReaction(EMOJI_MAP[emoji]);

        // 2. 외부 단말기엔 batching + realtime broadcast로 전파
        if (!roomId || !meParticipantId) return;
        queueReactionBroadcast(emoji);
    }, [meParticipantId, queueReactionBroadcast, roomId]);

    const handleChoicePress = async (choiceIndex: number) => {
        const isAnswerWindow = roomStatus === 'question' || roomStatus === 'grace';
        if (!roomId || !isAnswerWindow || !currentRound || !participantArgs) return;
        if (answerSubmitLockRef.current) return;
        if (selectedChoice !== null || currentRound.myAnswer !== undefined) return;
        answerSubmitLockRef.current = true;
        setSelectedChoice(choiceIndex);
        try {
            await gameActions.submitAnswer({
                ...participantArgs,
                choiceIndex,
            });
        } catch (err) {
            if (err instanceof Error && err.message.includes('ROUND_NOT_ACTIVE')) {
                Alert.alert('제출 시간이 지났어요', '다음 라운드에서 다시 도전해주세요.');
                return;
            }
            Alert.alert('답안을 제출하지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        }
    };

    const handleAdvance = useCallback(async (): Promise<boolean> => {
        if (!roomId || !meParticipantId) return false;
        if (!isHost) {
            showToast('지금은 호스트가 아니에요. 다른 참가자가 진행을 이어받았어요.', 'not_host_cannot_progress');
            return false;
        }
        if (pendingAction || isPaused) {
            return false;
        }
        try {
            const key = await resolveHostGuestKey();
            await gameActions.progress({ roomId, participantId: meParticipantId, guestKey: key });
            return true;
        } catch (err) {
            if (err instanceof Error && err.message.includes('NOT_AUTHORIZED')) {
                showToast('지금은 호스트가 아니에요. 다른 참가자가 진행을 이어받았어요.', 'not_authorized_progress');
                return false;
            }
            Alert.alert('상태 전환 실패', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
            return false;
        }
    }, [gameActions, isHost, isPaused, meParticipantId, pendingAction, resolveHostGuestKey, roomId, showToast]);

    const autoAdvancePhaseRef = useRef<string | null>(null);
    const autoAdvanceTriggeredRef = useRef(false);
    const phaseSyncRef = useRef<string | null>(null);
    const countdownStallRef = useRef<string | null>(null);
    const serverNowWarningShownRef = useRef(false);
    const lastStateRefetchRef = useRef<number>(0);
    const lastRoomLogRef = useRef<string | null>(null);
    const lastAutoAdvanceLogRef = useRef<string | null>(null);
    const lastAutoAdvanceSecondRef = useRef<number | null>(null);

    useEffect(() => {
        if (hasLeft || connectionState !== 'online') return;
        const guardKey = `${roomId ?? 'none'}-${roomStatus}-${roomData?.room.currentRound ?? 'final'}-${roomData?.room.phaseEndsAt ?? 'none'}`;
        if (autoAdvancePhaseRef.current !== guardKey) {
            autoAdvancePhaseRef.current = guardKey;
            autoAdvanceTriggeredRef.current = false;
        }
        if (__DEV__ && isHost && roomStatus) {
            const secondMark = phaseRemainingMs != null ? Math.floor(phaseRemainingMs / 1000) : null;
            const logKey = `${guardKey}-${secondMark ?? 'null'}-${autoAdvanceTriggeredRef.current}`;
            if (lastAutoAdvanceLogRef.current !== logKey || lastAutoAdvanceSecondRef.current !== secondMark) {
                lastAutoAdvanceLogRef.current = logKey;
                lastAutoAdvanceSecondRef.current = secondMark;
                console.log('[MatchPlay] autoAdvanceCheck', {
                    roomStatus,
                    phaseRemainingMs,
                    secondMark,
                    triggered: autoAdvanceTriggeredRef.current,
                });
            }
        }
        if (!isHost) return;
        if (!roomStatus || !['countdown', 'question', 'grace', 'reveal', 'leaderboard'].includes(roomStatus)) return;
        if (phaseRemainingMs === null) return;
        if (phaseRemainingMs > 0) return;
        if (pendingAction || isPaused) return;
        if (!roomId || !meParticipantId) return;
        if (autoAdvanceTriggeredRef.current) return;
        const attemptKey = guardKey;
        autoAdvanceTriggeredRef.current = true;
        if (__DEV__) {
            console.log('[MatchPlay] autoAdvance', { roomStatus, phaseRemainingMs });
        }
        void handleAdvance().then((ok) => {
            if (!ok && autoAdvancePhaseRef.current === attemptKey) {
                autoAdvanceTriggeredRef.current = false;
            }
        });
    }, [connectionState, handleAdvance, hasLeft, isHost, isPaused, meParticipantId, pendingAction, roomData?.room.currentRound, roomData?.room.phaseEndsAt, roomId, roomStatus, phaseRemainingMs]);

    useEffect(() => {
        if (phaseCountdownMs === null) {
            phaseSyncRef.current = null;
            countdownStallRef.current = null;
            return;
        }
        const key = `${roomId ?? 'none'}-${roomStatus}-${roomData?.room.phaseEndsAt ?? 'none'}`;
        if (phaseCountdownMs <= 600 && phaseSyncRef.current !== key) {
            phaseSyncRef.current = key;
            void refetchGameState();
        }
        if (roomStatus === 'countdown' && phaseCountdownMs <= -1200) {
            if (countdownStallRef.current !== key) {
                countdownStallRef.current = key;
                void refetchGameState();
            }
        }
        if (phaseCountdownMs <= 0) {
            const now = Date.now();
            if (now - lastStateRefetchRef.current > 800) {
                lastStateRefetchRef.current = now;
                void refetchGameState();
            }
        }
        if (roomStatus === 'countdown' && phaseCountdownMs === null) {
            void refetchGameState();
        }
    }, [phaseCountdownMs, refetchGameState, roomData?.room.phaseEndsAt, roomId, roomStatus]);

    useEffect(() => {
        if (hasLeft) return;
        if (roomStatus !== 'results') {
            if (isRematchPending) setIsRematchPending(false);
            if (isLobbyPending) setIsLobbyPending(false);
        }
    }, [hasLeft, isLobbyPending, isRematchPending, roomStatus]);

    const handleRematch = useCallback(async () => {
        if (!roomId || !meParticipantId) return;
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
            await gameActions.rematch({ roomId, participantId: meParticipantId, delayMs: resolveDelay(), guestKey: key });
        } catch (err) {
            Alert.alert('리매치를 시작하지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsRematchPending(false);
        }
    }, [gameActions, isHost, isLobbyPending, isRematchPending, meParticipantId, pendingAction, resolveHostGuestKey, roomId, roomStatus, showToast, resolveDelay]);

    const handleReturnToLobby = useCallback(async () => {
        if (!roomId || !participantArgs || !meParticipantId) return;
        if (!isHost) {
            if (isLobbyPending) return;
            setIsLobbyPending(true);
            try {
                await gameActions.requestLobby({ ...participantArgs, delayMs: resolveDelay() });
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
            await gameActions.resetToLobby({ roomId, participantId: meParticipantId, guestKey: key });
        } catch (err) {
            Alert.alert('대기실로 돌아가지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsLobbyPending(false);
        }
    }, [gameActions, isHost, isLobbyPending, isRematchPending, meParticipantId, participantArgs, pendingAction, resolveHostGuestKey, roomId, roomStatus, showToast, resolveDelay]);

    const handleCancelPending = useCallback(async () => {
        if (!roomId || !meParticipantId || !pendingAction) return;
        try {
            const key = await resolveHostGuestKey();
            await gameActions.cancelPendingAction({ roomId, participantId: meParticipantId, guestKey: key });
            showToast('매치가 취소되었어요');
        } catch (err) {
            Alert.alert('취소하지 못했어요', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        }
    }, [gameActions, meParticipantId, pendingAction, resolveHostGuestKey, roomId, showToast]);

    useEffect(() => {
        if (roomStatus !== 'results') {
            historyLoggedRef.current = null;
            streakLoggedRef.current = false;
            return;
        }
        if (authStatus !== 'authenticated' || !user) return;
        if (!roomData) return;
        const sessionId = `live_match:${roomData.room._id}:results`;
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
                    mode: 'live_match',
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
                if (!streakLoggedRef.current) {
                    await logStreakProgress();
                    streakLoggedRef.current = true;
                }
            } catch (error) {
                console.warn('Failed to log live match history entry', error);
                historyLoggedRef.current = null;
                streakLoggedRef.current = false;
            }
        })();
    }, [
        authStatus,
        logHistory,
        participants,
        roomData,
        roomStatus,
        logStreakProgress,
        user,
    ]);

    const leaveDialogElement = (
        <AlertDialog
            visible={isLeaveDialogVisible}
            onClose={handleCancelLeave}
            title="퀴즈룸을 나가시겠어요?"
            description="진행 중인 매치를 종료하고 이전 화면으로 돌아갑니다."
            actions={[
                { label: '취소', tone: 'secondary', onPress: handleCancelLeave },
                { label: '나가기', tone: 'destructive', onPress: handleConfirmLeave },
            ]}
        />
    );

    if (!roomId) {
        return (
            <>
                {leaveDialogElement}
            </>
        );
    }

    if (disconnectReason) {
        if (disconnectReason === EXPIRED_MESSAGE) {
            return (
                <>
                    <Stack.Screen options={{ headerShown: false }} />
                    <ThemedView style={styles.loadingContainer}>
                        <ThemedText type="title">연결이 종료됐어요</ThemedText>
                        <ThemedText style={[styles.loadingLabel, styles.disconnectLabel]}>{disconnectReason}</ThemedText>
                        <Button variant="default" size="lg" onPress={() => performLeave()}>
                            나가기
                        </Button>
                    </ThemedView>
                    {leaveDialogElement}
                </>
            );
        }
        return (
            <>
                <Stack.Screen options={{ headerShown: false }} />
                <ThemedView style={styles.loadingContainer}>
                    <ThemedText type="title">연결이 종료됐어요</ThemedText>
                    <ThemedText style={[styles.loadingLabel, styles.disconnectLabel]}>{disconnectReason}</ThemedText>
                    <Button variant="default" size="lg" onPress={() => performLeave()}>
                        퀴즈룸 찾기
                    </Button>
                </ThemedView>
                {leaveDialogElement}
            </>
        );
    }

    if (hasLeft) {
        return null;
    }

    if (gameState.status === 'loading') {
        return (
            <>
                <Stack.Screen options={{ headerShown: false }} />
                <ThemedView style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={textColor} />
                    <ThemedText style={[styles.loadingLabel, { color: textMutedColor }]}>퀴즈를 불러오는 중...</ThemedText>
                </ThemedView>
                {leaveDialogElement}
            </>
        );
    }

    if (!roomData) {
        return (
            <>
                <Stack.Screen options={{ headerShown: false }} />
                <ThemedView style={styles.loadingContainer}>
                    <ThemedText type="title">게임 정보를 찾을 수 없어요</ThemedText>
                    <Button variant="default" size="lg" onPress={() => router.navigate('/(tabs)/live-match')}>
                        홈으로 이동
                    </Button>
                </ThemedView>
                {leaveDialogElement}
            </>
        );
    }

    const canSendReaction = connectionState === 'online' && !!participantArgs;
    const persistentReactionBar = (
        <View style={styles.reactionBarInCard}>
            <CompactReactionBar onReaction={handleReaction} disabled={!canSendReaction} />
        </View>
    );

    const renderCountdown = () => (
        <View style={[styles.centerCard, { backgroundColor: cardColor }]}>
            <ThemedText type="title" style={styles.cardTitle}>다음 라운드 준비!</ThemedText>
            <ThemedText style={[styles.centerSubtitle, { color: textMutedColor }]}>
                <ThemedText style={[styles.timerHighlight, { color: textColor }]}>{timeLeft ?? '...'}</ThemedText>초 후 시작
            </ThemedText>
        </View>
    );

    const renderReturning = () => (
        <View style={[styles.centerCard, { backgroundColor: cardColor }]}>
            <ActivityIndicator size="large" color={textColor} />
            <ThemedText style={[styles.centerSubtitle, styles.returningLabel, { color: textMutedColor }]}>대기실로 이동 중...</ThemedText>
        </View>
    );

    const currentRoundIndex = (roomData?.room.currentRound ?? 0) + 1;
    const totalRoundsDisplay = roomData?.room.totalRounds ?? 10;

    const renderQuestion = () => (
        <View style={[styles.questionCard, { backgroundColor: cardColor }]}>
            <View style={styles.questionHeader}>
                <ThemedText style={[styles.roundCaption, { color: textMutedColor }]}>
                    라운드 {currentRoundIndex} / {totalRoundsDisplay}
                </ThemedText>
                <View style={[styles.timerBadge, { backgroundColor: textColor }]}>
                    <ThemedText style={[styles.timerBadgeText, { color: cardColor }]}>
                        {(isPaused && pausedRemainingSeconds !== null ? pausedRemainingSeconds : timeLeft) ?? '-'}초
                    </ThemedText>
                </View>
            </View>
            <ThemedText type="subtitle" style={styles.questionPrompt}>
                {currentRound?.question?.prompt ?? '문제를 불러오는 중...'}
            </ThemedText>
            <View style={styles.choiceList}>
                {currentRound?.question?.choices.map((choice, index) => {
                    const isSelected = selectedChoice === index || currentRound?.myAnswer?.choiceIndex === index;
                    const isDisabled = currentRound?.myAnswer !== undefined || isPaused || selectedChoice !== null;
                    return (
                        <Pressable
                            key={choice.id}
                            onPress={() => handleChoicePress(index)}
                            disabled={isDisabled}
                            style={({ pressed }) => [
                                styles.choiceButton,
                                { backgroundColor: background, borderColor: borderColor },
                                isSelected && { backgroundColor: textColor, borderColor: textColor },
                                pressed && !isDisabled && styles.choicePressed,
                            ]}
                        >
                            <View style={[
                                styles.choiceBadge,
                                { backgroundColor: borderColor },
                                isSelected && { backgroundColor: cardColor }
                            ]}>
                                <ThemedText style={[
                                    styles.choiceBadgeText,
                                    { color: textColor },
                                ]}>
                                    {String.fromCharCode(65 + index)}
                                </ThemedText>
                            </View>
                            <ThemedText style={[
                                styles.choiceLabel,
                                { color: textColor },
                                isSelected && [styles.choiceLabelSelected, { color: cardColor }]
                            ]}>
                                {choice.text}
                            </ThemedText>
                        </Pressable>
                    );
                })}
            </View>
            {participants.length <= 1 ? (
                <Button
                    variant="outline"
                    size="lg"
                    fullWidth
                    onPress={handleAdvance}
                    disabled={isPaused}
                >
                    정답 공개
                </Button>
            ) : null}
        </View>
    );

    const renderGrace = () => (
        <View style={[styles.centerCard, { backgroundColor: cardColor }]}>
            <ThemedText type="title">답안 마감 중</ThemedText>
            <ThemedText style={[styles.centerSubtitle, { color: textMutedColor }]}>{timeLeft !== null ? `${timeLeft}초` : '...'} 후 정답 공개</ThemedText>
        </View>
    );

    const rawCorrectChoiceIndex = currentRound?.reveal?.correctChoice;
    const revealCorrectChoiceIndex =
        typeof rawCorrectChoiceIndex === 'number' && rawCorrectChoiceIndex >= 0
            ? rawCorrectChoiceIndex
            : currentRound?.question?.answerIndex ?? null;
    const revealDistribution =
        currentRound?.reveal?.distribution ??
        (currentRound?.question?.choices
            ? new Array(currentRound.question.choices.length).fill(0)
            : []);

    const renderReveal = () => (
        <View style={[styles.revealCard, { backgroundColor: cardColor }]}>
            <ThemedText type="title" style={styles.cardTitle}>정답 공개</ThemedText>
            <View style={[styles.correctAnswerBadge, { backgroundColor: background, borderColor: textColor }]}>
                <ThemedText style={[styles.correctAnswerLabel, { color: textColor }]}>
                    정답은 <ThemedText style={[styles.correctAnswerHighlight, { color: textColor }]}>
                        {revealCorrectChoiceIndex !== null ? String.fromCharCode(65 + revealCorrectChoiceIndex) : '?'}
                    </ThemedText> 입니다
                </ThemedText>
            </View>
            {currentRound?.question?.explanation ? (
                <ThemedText style={[styles.explanationText, { backgroundColor: background, color: textMutedColor }]}>{currentRound.question.explanation}</ThemedText>
            ) : null}
            <View style={styles.distributionList}>
                {currentRound?.question?.choices.map((choice, index) => {
                    const count = revealDistribution[index] ?? 0;
                    const isCorrect = revealCorrectChoiceIndex === index;
                    const isMine = currentRound?.myAnswer?.choiceIndex === index;
                    const answeredCorrectly = currentRound?.myAnswer?.isCorrect ?? false;
                    const variant: 'correct' | 'incorrect' | 'selected' | 'default' = isCorrect
                        ? 'correct'
                        : isMine
                            ? answeredCorrectly
                                ? 'selected'
                                : 'incorrect'
                            : 'default';
                    const gradientColors =
                        variant === 'correct'
                            ? (['#2D9CDB', '#56CCF2'] as const)
                            : variant === 'incorrect'
                                ? (['#EB5757', '#FF7676'] as const)
                                : null;
                    const labelColor =
                        variant === 'correct' || variant === 'incorrect'
                            ? '#FFFFFF'
                            : textColor;
                    const badgeTextColor = variant === 'correct' || variant === 'incorrect' ? '#FFFFFF' : textColor;
                    const countColor =
                        variant === 'correct' || variant === 'incorrect'
                            ? '#FFFFFF'
                            : textMutedColor;
                    const iconName =
                        variant === 'correct'
                            ? 'checkmark.circle.fill'
                            : variant === 'incorrect'
                                ? 'xmark.circle.fill'
                                : null;
                    const iconColor = '#FFFFFF';
                    const rowContent = (
                        <View style={styles.distributionRowContent}>
                            <View
                                style={[
                                    styles.distributionBadge,
                                    variant === 'default' && { backgroundColor: borderColor },
                                    variant === 'correct' && styles.distributionBadgeElevated,
                                    variant === 'incorrect' && styles.distributionBadgeElevated,
                                    variant === 'selected' && [styles.distributionBadgeSelected, { backgroundColor: borderColor, borderColor: borderColor }],
                                ]}
                            >
                                <ThemedText
                                    style={[
                                        styles.distributionBadgeText,
                                        { color: badgeTextColor },
                                    ]}
                                >
                                    {String.fromCharCode(65 + index)}
                                </ThemedText>
                            </View>
                            <View style={styles.distributionTextGroup}>
                                <ThemedText
                                    style={[
                                        styles.choiceLabel,
                                        styles.distributionLabel,
                                        { color: labelColor },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {choice.text}
                                </ThemedText>
                            </View>
                            <View style={styles.distributionCountGroup}>
                                {iconName ? (
                                    <View style={styles.distributionStatusIcon}>
                                        <IconSymbol name={iconName} size={16} color={iconColor} />
                                    </View>
                                ) : null}
                                <View
                                    style={[
                                        styles.distributionCountBadge,
                                        variant === 'default' && { backgroundColor: cardColor, borderColor: borderColor },
                                        variant === 'selected' && { backgroundColor: cardColor, borderColor: borderColor },
                                        (variant === 'correct' || variant === 'incorrect') &&
                                        styles.distributionCountBadgeGradient,
                                    ]}
                                >
                                    <ThemedText
                                        style={[
                                            styles.distributionCount,
                                            { color: countColor },
                                        ]}
                                    >
                                        {count}명
                                    </ThemedText>
                                </View>
                            </View>
                        </View>
                    );

                    if (gradientColors) {
                        return (
                            <LinearGradient
                                key={choice.id}
                                colors={gradientColors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[
                                    styles.distributionRow,
                                    variant === 'correct' && styles.distributionRowCorrect,
                                    variant === 'incorrect' && styles.distributionRowIncorrect,
                                ]}
                            >
                                {rowContent}
                            </LinearGradient>
                        );
                    }

                    return (
                        <View
                            key={choice.id}
                            style={[
                                styles.distributionRow,
                                styles.distributionRowDefault,
                                { backgroundColor: cardColor, borderColor: borderColor },
                                variant === 'selected' && [styles.distributionRowSelected, { backgroundColor: background, borderColor: borderColor }],
                            ]}
                        >
                            {rowContent}
                        </View>
                    );
                })}
            </View>
            <View style={[styles.scoreResultBadge, { backgroundColor: textColor }]}>
                {currentRound?.myAnswer ? (
                    <View style={styles.scoreResultContent}>
                        <IconSymbol
                            name={currentRound.myAnswer.isCorrect ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
                            size={20}
                            color={currentRound.myAnswer.isCorrect ? '#56CCF2' : '#FF7676'}
                        />
                        <ThemedText style={[styles.scoreResultText, { color: cardColor }]}>
                            {currentRound.myAnswer.isCorrect ? '정답!' : '오답'} {currentRound.myAnswer.scoreDelta > 0 ? `+${currentRound.myAnswer.scoreDelta}점` : ''}
                        </ThemedText>
                        {currentRound.myAnswer.isCorrect && roomData?.me && roomData.me.currentStreak >= 3 && (() => {
                            const streak = roomData.me.currentStreak;
                            const isDark = colorScheme === 'dark';
                            // 라이트모드: scoreResultBadge 배경이 어두움 → 밝은 콤보 배지
                            // 다크모드: scoreResultBadge 배경이 밝음 → 어두운 콤보 배지
                            const comboBg = isDark
                                ? (streak >= 7 ? '#1a1a2e' : streak >= 5 ? '#2d132c' : '#2c2c2c')
                                : (streak >= 7 ? '#FFE8E8' : streak >= 5 ? '#F3E5F5' : '#FFF3E0');
                            const comboTextColor = isDark ? '#FFFFFF' : '#1a1a1a';
                            const multiplierColor = streak >= 7
                                ? (isDark ? '#FF6B6B' : '#D32F2F')
                                : streak >= 5
                                    ? (isDark ? '#E040FB' : '#9C27B0')
                                    : (isDark ? '#FFB74D' : '#E65100');
                            return (
                                <View style={[styles.comboBadge, { backgroundColor: comboBg }]}>
                                    <ThemedText style={[styles.comboBadgeText, { color: comboTextColor }]}>
                                        🔥 {streak}콤보
                                    </ThemedText>
                                    <ThemedText style={[styles.comboMultiplierText, { color: multiplierColor }]}>
                                        ×{getComboMultiplier(streak).toFixed(1)}
                                    </ThemedText>
                                </View>
                            );
                        })()}
                    </View>
                ) : (
                    <ThemedText style={[styles.scoreResultText, { color: cardColor }]}>이번 라운드에 응시하지 않았어요</ThemedText>
                )}
            </View>
        </View>
    );

    const renderParticipantAvatar = (participantId: string) => {
        const participant = participantsById.get(participantId);
        const avatarNode = participant?.odUserId ? (
            <Avatar
                uri={participant.avatarUrl}
                name={participant.nickname}
                size="sm"
                radius={Radius.pill}
                backgroundColorOverride={avatarFallbackColor}
                style={styles.leaderboardAvatar}
            />
        ) : participant ? (
            <GuestAvatar
                guestId={participant.guestAvatarId ?? 0}
                size="sm"
                radius={Radius.pill}
                style={styles.leaderboardAvatar}
            />
        ) : (
            <Avatar
                name="?"
                size="sm"
                radius={Radius.pill}
                backgroundColorOverride={avatarFallbackColor}
                style={styles.leaderboardAvatar}
            />
        );

        return avatarNode;
    };

    const renderLeaderboard = () => (
        <View style={[styles.revealCard, { backgroundColor: cardColor }]}>
            <View style={styles.iconHeadingRow}>
                <IconSymbol
                    name="dot.radiowaves.left.and.right"
                    size={Platform.OS === 'ios' ? 36 : 40}
                    color={textColor}
                    style={Platform.OS === 'ios' && { marginTop: -4 }}
                />
                <ThemedText type="title" style={styles.cardTitle}>리더보드</ThemedText>
            </View>
            <View style={styles.distributionList}>
                {currentRound?.leaderboard?.top.length ? (
                    currentRound.leaderboard.top.map((entry, index) => {
                        const isMe = meParticipantId !== null && entry.participantId === meParticipantId;
                        const rank = entry.rank ?? index + 1;
                        const rankDisplay = rank;
                        const nameDisplay = entry.nickname;
                        return (
                            <View
                                key={entry.participantId}
                                style={[
                                    styles.distributionRow,
                                    { backgroundColor: background },
                                    isMe && [styles.leaderboardMeRow, { borderColor: textColor }],
                                ]}
                                accessibilityRole="text"
                                accessibilityLabel={`${rank}위 ${entry.nickname}`}
                            >
                                <View style={styles.leaderboardNameWrapper}>
                                    <ThemedText
                                        style={styles.rankBadgeText}
                                        lightColor={Palette.gray900}
                                        darkColor={Palette.gray25}
                                    >
                                        {rankDisplay}
                                    </ThemedText>
                                    {renderParticipantAvatar(entry.participantId)}
                                    <View style={styles.leaderboardNameTextGroup}>
                                        <View style={styles.leaderboardNameRow}>
                                            <ThemedText
                                                style={[
                                                    styles.choiceLabel,
                                                    { flexShrink: 1, minWidth: 0 },
                                                    isMe && [styles.leaderboardMeText, { color: textColor }],
                                                ]}
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                            >
                                                {nameDisplay}
                                            </ThemedText>
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.leaderboardScoreWrapper}>
                                    <View style={styles.leaderboardScoreRow}>
                                        <ThemedText
                                            style={[
                                                styles.distributionCount,
                                                styles.leaderboardScore,
                                                isMe && [styles.leaderboardMeText, { color: textColor }],
                                            ]}
                                        >
                                            {entry.totalScore}점
                                        </ThemedText>
                                    </View>
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <ThemedText style={styles.timerText}>집계 중...</ThemedText>
                )}
            </View>
            {currentRound?.leaderboard?.me ? (
                <View style={[styles.myRankBadge, { backgroundColor: background, borderColor: borderColor }]}>
                    <ThemedText style={[styles.myRankText, { color: textMutedColor }]}>
                        현재 순위 #{currentRound.leaderboard.me.rank} · {currentRound.leaderboard.me.totalScore}점
                    </ThemedText>
                </View>
            ) : null}
            <ThemedText style={[styles.nextRoundHint, { color: textMutedColor }]}>
                {isFinalLeaderboard
                    ? `${timeLeft ?? '-'}초 후 최종 결과 화면으로 이동해요`
                    : `다음 라운드 준비까지 ${timeLeft ?? '-'}초`}
            </ThemedText>
        </View>
    );
    const renderResults = () => {
        const deckInfo = roomData?.deck;
        const deckTitle = deckInfo?.title ?? '랜덤 덱';
        const deckDescription =
            deckInfo?.description ?? '방 생성 시 랜덤으로 선택된 덱입니다.';

        return (
            <View style={[styles.revealCard, { backgroundColor: cardColor }]}>
                <View style={styles.iconHeadingRow}>
                    <IconSymbol name="medal" size={Platform.OS === 'ios' ? 36 : 40} color={textColor} style={Platform.OS === 'ios' ? { marginTop: -6 } : { marginTop: -4 }} />
                    <ThemedText type="title" style={styles.cardTitle}>최종 결과</ThemedText>
                </View>
                <View style={[styles.deckSummary, { borderColor: borderColor, backgroundColor: background }]}>
                    <View style={[styles.deckSummaryIcon, { backgroundColor: cardColor, borderColor: borderColor }]}>
                        <IconSymbol name={getDeckIcon(deckInfo?.slug)} size={24} color={textColor} />
                    </View>
                    <View style={styles.deckSummaryText}>
                        <ThemedText style={[styles.deckSummaryTitle, { color: textColor }]}>{deckTitle}</ThemedText>
                        {deckDescription ? (
                            <ThemedText style={[styles.deckSummaryDescription, { color: textMutedColor }]}>{deckDescription}</ThemedText>
                        ) : null}
                    </View>
                </View>
                <View style={styles.distributionList}>
                    {participants.map((player, index) => {
                        const isMe = meParticipantId !== null && player.participantId === meParticipantId;
                        const rank = player.rank ?? index + 1;
                        const usePodiumEmoji = participants.length >= 3;
                        const podiumEmoji =
                            usePodiumEmoji && rank === 1
                                ? '🥇'
                                : usePodiumEmoji && rank === 2
                                    ? '🥈'
                                    : usePodiumEmoji && rank === 3
                                        ? '🥉'
                                        : '';
                        const nameDisplay = player.nickname;
                        return (
                            <View
                                key={player.participantId}
                                style={[
                                    styles.distributionRow,
                                    { backgroundColor: background },
                                    isMe && [styles.leaderboardMeRow, { borderColor: textColor }],
                                ]}
                                accessibilityRole="text"
                                accessibilityLabel={`${rank}위 ${player.nickname}`}
                            >
                                <View style={styles.resultNameWrapper}>
                                    <ThemedText
                                        style={styles.rankBadgeText}
                                        lightColor={Palette.gray900}
                                        darkColor={Palette.gray25}
                                    >
                                        {podiumEmoji || rank}
                                    </ThemedText>
                                    {renderParticipantAvatar(player.participantId)}
                                    <View style={styles.resultNameTextGroup}>
                                        <View style={styles.leaderboardNameRow}>
                                            <ThemedText
                                                style={[
                                                    styles.choiceLabel,
                                                    { flexShrink: 1, minWidth: 0 },
                                                    isMe && [styles.leaderboardMeText, { color: textColor }],
                                                ]}
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                            >
                                                {nameDisplay}
                                            </ThemedText>
                                        </View>
                                        {player.odUserId && hostUserId && player.odUserId === hostUserId && !player.isConnected ? (
                                            <ThemedText style={styles.offlineTag}>오프라인</ThemedText>
                                        ) : null}
                                    </View>
                                </View>
                                <View style={styles.leaderboardScoreWrapper}>
                                    <View style={styles.leaderboardScoreRow}>
                                        <ThemedText
                                            style={[
                                                styles.distributionCount,
                                                styles.leaderboardScore,
                                                isMe && [styles.leaderboardMeText, { color: textColor }],
                                            ]}
                                        >
                                            {player.totalScore}점
                                        </ThemedText>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
                <Button
                    variant="default"
                    size="lg"
                    fullWidth
                    onPress={handleRematch}
                    disabled={isRematchPending || isLobbyPending || roomStatus !== 'results' || !isHost}
                >
                    리매치
                </Button>
                <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onPress={handleReturnToLobby}
                    disabled={isLobbyPending || isRematchPending || roomStatus !== 'results' || !isHost}
                >
                    대기실로
                </Button>
                <Button
                    variant="ghost"
                    size="lg"
                    fullWidth
                    onPress={handleLeave}
                    disabled={isLobbyPending || isRematchPending || roomStatus !== 'results'}
                >
                    나가기
                </Button>
            </View>
        );
    };

    const renderPendingBanner = () => {
        if (!pendingAction) return null;
        const seconds = Math.ceil(pendingMs / 1000);
        return (
            <View style={[styles.pendingBanner, { backgroundColor: background }]}>
                <ThemedText type="subtitle" style={styles.pendingTitle}>
                    {scheduleLabel}
                </ThemedText>
                <ThemedText style={[styles.pendingSubtitle, { color: textMutedColor }]}>
                    {seconds > 0
                        ? `${seconds}초 후 자동 진행됩니다. 호스트가 취소할 수 있어요.`
                        : '잠시 후 자동으로 실행됩니다.'}
                </ThemedText>
                {isHost ? (
                    <Button fullWidth size="sm" onPress={handleCancelPending}>
                        취소
                    </Button>
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
            <View style={[styles.hostBanner, { backgroundColor: background, borderColor: textColor }]}>
                <View style={styles.iconMessageRow}>
                    <IconSymbol name="hourglass" size={20} color={warningColor} />
                    <ThemedText type="subtitle" style={[styles.hostBannerTitle, { color: textColor }]}>
                        재접속 대기 중 ({formattedTime})
                    </ThemedText>
                </View>
                <ThemedText style={[styles.hostBannerSubtitle, { color: textMutedColor }]}>
                    {hostNickname}님 연결을 기다리는 중이에요. 복구되면 자동으로 이어집니다.
                </ThemedText>
            </View>
        );
    };

    const renderConnectionBanner = () => {
        const banners: ReactNode[] = [];
        if (connectionState === 'reconnecting' && showConnectionWarning) {
            banners.push(
                <View key="self_reconnecting" style={[styles.connectionBanner, { backgroundColor: background }]}>
                    <View style={styles.connectionBannerRow}>
                        <IconSymbol name="exclamationmark.triangle.fill" size={18} color={warningColor} />
                        <ThemedText style={[styles.connectionBannerText, { color: textColor }]}>연결이 불안정합니다… 다시 연결 중</ThemedText>
                    </View>
                </View>
            );
        }
        if (!isHost && hostConnectionState === 'waiting') {
            banners.push(
                <View key="host_reconnecting" style={[styles.connectionBanner, { backgroundColor: background }]}>
                    <View style={styles.connectionBannerRow}>
                        <IconSymbol name="exclamationmark.triangle.fill" size={18} color={warningColor} />
                        <ThemedText style={[styles.connectionBannerText, { color: textColor }]}>
                            호스트 연결이 불안정합니다… 다시 연결 중
                        </ThemedText>
                    </View>
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
        const graceRemainingLabel = minutes > 0 ? `${minutes}분` : `${seconds}초`;
        const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        const graceBackdropColor = colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.25)';
        return (
            <View style={styles.graceOverlay}>
                <View style={[styles.graceBackdrop, { backgroundColor: graceBackdropColor }]} />
                <View style={[styles.graceCard, { backgroundColor: cardColor, borderColor, borderWidth: 1 }]}>
                    <ThemedText style={[styles.graceTitle, { color: textColor }]}>연결 대기 중</ThemedText>
                    <ThemedText style={[styles.graceSubtitle, { color: textMutedColor }]}>
                        연결이 끊겼어요.{'\n'}
                        {graceRemainingLabel} 안에 복구되면 이어서 진행돼요.
                    </ThemedText>
                    <ThemedText style={[styles.graceTimer, { color: textColor }]}>{formattedTime}</ThemedText>
                    <View style={[styles.graceProgressBar, { backgroundColor: borderColor }]}>
                        <View style={[styles.graceProgressFill, { width: `${progress * 100}%`, backgroundColor: textColor }]} />
                    </View>
                    <Button
                        variant="default"
                        size="lg"
                        fullWidth
                        onPress={handleManualReconnect}
                        disabled={isManualReconnectPending}
                        loading={isManualReconnectPending}
                    >
                        {isManualReconnectPending ? '재시도 중...' : '재연결 시도'}
                    </Button>
                    <Button variant="ghost" size="lg" fullWidth onPress={handleLeave}>
                        나가기
                    </Button>
                </View>
            </View>
        );
    };

    const renderHostGraceOverlay = () => {
        const nextHostMessage = (() => {
            if (hostParticipant && meParticipantId && hostParticipant.participantId === meParticipantId) {
                return '당신이 진행을 이어받았어요.\n게임을 계속 진행해 주세요!';
            }
            if (hostParticipant) {
                return `${hostNickname}님이 진행을 이어받았어요.`;
            }
            return '다른 참가자가 진행을 이어받았어요.';
        })();
        const graceBackdropColor = colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.25)';
        if (promotedToHost) {
            return (
                <View style={styles.graceOverlay}>
                    <View style={[styles.graceBackdrop, { backgroundColor: graceBackdropColor }]} />
                    <View style={[styles.graceCard, { backgroundColor: cardColor, borderColor, borderWidth: 1 }]}>
                        <View style={styles.graceTitleRow}>
                            <IconSymbol name="crown.fill" size={24} color={warningColor} />
                            <ThemedText style={[styles.graceTitle, { color: textColor }]}>새로운 호스트가 지정되었어요</ThemedText>
                        </View>
                        <ThemedText style={[styles.graceSubtitle, { color: textMutedColor }]}>{nextHostMessage}</ThemedText>
                        <Button
                            variant="default"
                            size="lg"
                            fullWidth
                            onPress={() => setPromotedToHost(false)}
                        >
                            확인
                        </Button>
                        <Button variant="secondary" size="lg" fullWidth onPress={handleLeave}>
                            나가기
                        </Button>
                    </View>
                </View>
            );
        }
        if (connectionState !== 'online') return null;
        if (hostConnectionState === 'online') return null;
        if (isHost) return null;
        if (!hostParticipant && hostConnectionState !== 'expired') return null;
        const progress = Math.max(0, Math.min(1, hostGraceRemaining / HOST_GRACE_SECONDS));
        const minutes = Math.floor(hostGraceRemaining / 60);
        const seconds = hostGraceRemaining % 60;
        const hostGraceRemainingLabel = minutes > 0 ? `${minutes}분` : `${seconds}초`;
        const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (hostConnectionState === 'waiting') {
            return (
                <View style={styles.graceOverlay}>
                    <View style={[styles.graceBackdrop, { backgroundColor: graceBackdropColor }]} />
                    <View style={[styles.graceCard, { backgroundColor: cardColor, borderColor, borderWidth: 1 }]}>
                        <View style={styles.graceTitleRow}>
                            <IconSymbol name="arrow.triangle.2.circlepath" size={24} color={infoColor} />
                            <ThemedText style={[styles.graceTitle, { color: textColor }]}>호스트 연결이 끊겼습니다.</ThemedText>
                        </View>
                        <ThemedText style={[styles.graceSubtitle, { color: textMutedColor }]}>
                            {hostNickname}님 연결을 복구 중이에요.{'\n'}
                            {hostGraceRemainingLabel} 안에 돌아오면 계속 진행돼요.
                        </ThemedText>
                        <View style={[styles.graceProgressBar, { backgroundColor: borderColor }]}>
                            <View style={[styles.graceProgressFill, { width: `${progress * 100}%`, backgroundColor: textColor }]} />
                        </View>
                        <ThemedText style={[styles.graceTimer, { color: textColor }]}>{formattedTime}</ThemedText>
                        <ThemedText style={[styles.graceSubtitle, { color: textMutedColor }]}>자동으로 재시도하고 있어요.</ThemedText>
                        <Button variant="ghost" size="lg" fullWidth onPress={handleLeave}>
                            나가기
                        </Button>
                    </View>
                </View>
            );
        }
        return (
            <View style={styles.graceOverlay}>
                <View style={[styles.graceBackdrop, { backgroundColor: graceBackdropColor }]} />
                <View style={[styles.graceCard, { backgroundColor: cardColor, borderColor, borderWidth: 1 }]}>
                    <View style={styles.graceTitleRow}>
                        <IconSymbol name="face.frown" size={24} color={dangerColor} />
                        <ThemedText style={[styles.graceTitle, { color: textColor }]}>호스트 연결이 오래 끊겼습니다.</ThemedText>
                    </View>
                    <ThemedText style={[styles.graceSubtitle, { color: textMutedColor }]}>{nextHostMessage}</ThemedText>
                    <Button variant="default" size="lg" fullWidth onPress={handleLeave}>
                        나가기
                    </Button>
                </View>
            </View>
        );
    };

    const renderLeaveButton = () => {
        if (roomStatus === 'results') return null;
        return (
            <Button
                variant="ghost"
                size="sm"
                rounded="full"
                style={styles.leaveControl}
                onPress={handleLeave}
                accessibilityLabel="현재 퀴즈룸 나가기"
            >
                나가기
            </Button>
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

    const renderPauseNotice = () => {
        if (!isPaused) return null;
        return (
            <View style={[styles.pauseBanner, { backgroundColor: textColor }]}>
                <View style={styles.iconHeadingRow}>
                    <IconSymbol name="pause.circle.fill" size={24} color={cardColor} />
                    <ThemedText type="subtitle" style={[styles.pauseBannerTitle, { color: cardColor }]}>
                        게임이 일시정지됐어요
                    </ThemedText>
                </View>
                <ThemedText style={[styles.pauseBannerSubtitle, { color: cardColor }]}>
                    호스트가 일시정지를 해제할 때까지 기다려주세요.
                </ThemedText>
                {pausedRemainingSeconds !== null ? (
                    <ThemedText style={[styles.pauseBannerHint, { color: cardColor }]}>재개 시 남은 시간 약 {pausedRemainingSeconds}초</ThemedText>
                ) : null}
            </View>
        );
    };

    const renderBootstrapping = () => (
        <View style={[styles.centerCard, { backgroundColor: cardColor }]}>
            <ActivityIndicator size="large" color={textColor} />
            <ThemedText style={[styles.centerSubtitle, { color: textMutedColor }]}>게임을 준비 중이에요...</ThemedText>
        </View>
    );

    let content: React.ReactNode | null = null;
    if (roomStatus === 'countdown') {
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

    const leaveControl = connectionState === 'online' ? renderLeaveButton() : null;

    return (
        <View style={styles.rootContainer}>
            <Stack.Screen options={{ headerShown: false }} />
            <ThemedView style={[styles.container, { backgroundColor: background, paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
                {/* {isHost ? renderDelaySelector() : null} */}
                {renderConnectionBanner()}
                {connectionState === 'online' ? renderPendingBanner() : null}
                {connectionState === 'online' && hostBannerVisible ? renderHostBanner() : null}
                {leaveControl ? (
                    <View style={styles.sessionControls}>
                        {leaveControl}
                    </View>
                ) : null}
                {connectionState === 'online' ? renderPauseNotice() : null}
                <View style={styles.stageContainer}>
                    {content}
                    {persistentReactionBar}
                </View>
                {renderGraceOverlay()}
                {renderHostGraceOverlay()}
            </ThemedView>
            {/* 실시간 리액션 시스템 - 로컬 애니메이션 오버레이 */}
            <ReactionLayer ref={reactionLayerRef} />
            {leaveDialogElement}
        </View>
    );
}

const styles = StyleSheet.create({
    rootContainer: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
    },
    stageContainer: {
        flex: 1,
        position: 'relative',
    },
    reactionBarInCard: {
        position: 'absolute',
        right: Spacing.md,
        bottom: Spacing.xl,
        zIndex: 100,
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
        color: Palette.gray500,
    },
    delayChip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Palette.gray200,
    },
    delayChipActive: {
        backgroundColor: Palette.gray100,
    },
    delayChipText: {
        color: Palette.gray500,
        fontWeight: '500',
    },
    delayChipTextActive: {
        color: Palette.gray900,
        fontWeight: '700',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingLabel: {
        marginVertical: Spacing.md,
    },
    disconnectLabel: {
        textAlign: 'center',
        marginHorizontal: Spacing.lg,
        lineHeight: 22,
    },
    centerCard: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xxl,
        borderRadius: Radius.lg,
        gap: Spacing.lg,
        ...Elevation.sm,
    },
    cardTitle: {
        marginBottom: Spacing.xs,
    },
    iconHeadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    iconMessageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    graceTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    deckSummary: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
    },
    deckSummaryIcon: {
        width: 48,
        height: 48,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    deckSummaryText: {
        flex: 1,
        gap: Spacing.xs,
    },
    deckSummaryTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    deckSummaryDescription: {
        fontSize: 13,
        lineHeight: 18,
    },
    centerSubtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
    },
    timerHighlight: {
        fontSize: 24,
        fontWeight: '700',
    },
    returningLabel: {
        marginTop: Spacing.md,
    },
    lobbyHint: {
        marginTop: Spacing.sm,
        marginBottom: Spacing.sm,
        textAlign: 'center',
        color: Palette.gray500,
    },
    questionCard: {
        flex: 1,
        padding: Spacing.xl,
        borderRadius: Radius.lg,
        gap: Spacing.lg,
        ...Elevation.sm,
    },
    questionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    roundCaption: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    timerBadge: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.pill,
    },
    timerBadgeText: {
        fontSize: 14,
        fontWeight: '700',
    },
    questionPrompt: {
        fontSize: 18,
        lineHeight: 28,
        fontWeight: '600',
    },
    choiceList: {
        gap: Spacing.md,
    },
    choiceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
        minHeight: 60,
    },
    choicePressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }],
    },
    choiceBadge: {
        width: 32,
        height: 32,
        borderRadius: Radius.sm,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    choiceBadgeText: {
        fontSize: 16,
        fontWeight: '700',
    },
    choiceLabel: {
        flexShrink: 1,
        marginLeft: Spacing.md,
        fontSize: 16,
        fontWeight: '500',
        lineHeight: 22,
        textAlignVertical: 'center',
    },
    choiceLabelSelected: {
        fontWeight: '600',
    },
    timerText: {
        textAlign: 'center',
        color: Palette.gray500,
    },
    revealCard: {
        flex: 1,
        padding: Spacing.xl,
        borderRadius: Radius.lg,
        gap: Spacing.lg,
        ...Elevation.sm,
    },
    correctAnswerBadge: {
        padding: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 2,
    },
    correctAnswerLabel: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    correctAnswerHighlight: {
        fontSize: 24,
        fontWeight: '700',
    },
    explanationText: {
        fontSize: 15,
        lineHeight: 22,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.md,
    },
    scoreResultBadge: {
        padding: Spacing.md,
        borderRadius: Radius.md,
    },
    scoreResultContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    scoreResultText: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    comboBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.pill,
        marginLeft: Spacing.xs,
        gap: 4,
    },
    comboBadgeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    comboMultiplierText: {
        fontSize: 13,
        fontWeight: '800',
    },
    distributionList: {
        gap: Spacing.sm,
    },
    distributionRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.sm,
        gap: Spacing.sm,
    },
    distributionRowDefault: {
        borderRadius: Radius.md,
        borderWidth: 1,
    },
    distributionRowContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
    },
    distributionRowCorrect: {
        borderRadius: Radius.md,
        shadowColor: '#00000050',
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    distributionRowIncorrect: {
        borderRadius: Radius.md,
        shadowColor: '#EB575780',
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    distributionRowSelected: {
        borderRadius: Radius.md,
        borderWidth: 1,
    },
    distributionBadge: {
        width: 32,
        height: 32,
        borderRadius: Radius.sm,
        justifyContent: 'center',
        alignItems: 'center',
    },
    distributionBadgeElevated: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    distributionBadgeSelected: {
        borderWidth: 1,
    },
    distributionBadgeText: {
        fontSize: 14,
        fontWeight: '700',
    },
    distributionLabel: {
        fontSize: 15,
    },
    distributionTextGroup: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        gap: Spacing.xs,
    },
    leaderboardNameWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    rankBadgeText: {
        fontSize: 18,
        fontWeight: '700',
        minWidth: 32,
        textAlign: 'center',
        marginRight: Spacing.xs,
    },
    leaderboardAvatar: {},
    leaderboardNameTextGroup: {
        flex: 1,
        gap: Spacing.xs,
        minWidth: 0,
    },
    leaderboardNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flexWrap: 'nowrap',
        minWidth: 0,
        flexShrink: 1,
    },
    leaderboardScoreWrapper: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        alignSelf: 'stretch',
        minHeight: 24,
        paddingLeft: Spacing.xs,
    },
    leaderboardScoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: Spacing.xs,
    },
    resultNameWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    resultNameTextGroup: {
        flex: 1,
        gap: Spacing.xs,
        minWidth: 0,
    },
    distributionCount: {
        fontSize: 15,
        fontWeight: '600',
    },
    distributionCountGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    distributionStatusIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    distributionCountBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.pill,
        borderWidth: 1,
    },
    distributionCountBadgeGradient: {
        borderColor: 'rgba(255,255,255,0.5)',
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    offlineTag: {
        fontSize: 11,
        color: Palette.gray400,
        fontStyle: 'italic',
    },
    leaderboardMeRow: {
        borderWidth: 2,
    },
    leaderboardMeText: {
        fontWeight: '700',
    },
    leaderboardScore: {
        fontWeight: '700',
    },
    myRankBadge: {
        padding: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
    },
    myRankText: {
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },
    nextRoundHint: {
        fontSize: 14,
        textAlign: 'center',
    },
    sessionControls: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    leaveControl: {
        paddingHorizontal: Spacing.lg,
    },
    pauseBanner: {
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        marginBottom: Spacing.md,
        gap: Spacing.md,
        ...Elevation.sm,
    },
    pauseBannerTitle: {
        fontWeight: '700',
        fontSize: 18,
    },
    pauseBannerSubtitle: {
        fontSize: 15,
        lineHeight: 22,
    },
    pauseBannerHint: {
        fontSize: 14,
    },
    pendingBanner: {
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        marginBottom: Spacing.md,
        alignItems: 'center',
        gap: Spacing.md,
        ...Elevation.xs,
    },
    pendingTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    pendingSubtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    hostBanner: {
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        marginBottom: Spacing.md,
        borderWidth: 2,
        gap: Spacing.sm,
        ...Elevation.xs,
    },
    hostBannerTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    hostBannerSubtitle: {
        fontSize: 14,
        lineHeight: 20,
    },
    connectionBanner: {
        padding: Spacing.md,
        borderRadius: Radius.lg,
        marginBottom: Spacing.md,
        alignItems: 'center',
        ...Elevation.xs,
    },
    connectionBannerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    connectionBannerText: {
        fontSize: 14,
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
    },
    graceCard: {
        width: '90%',
        maxWidth: 400,
        padding: Spacing.xxl,
        borderRadius: Radius.lg,
        alignItems: 'center',
        gap: Spacing.lg,
        ...Elevation.sm,
    },
    graceTitle: {
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
    },
    graceSubtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    graceTimer: {
        fontSize: 32,
        fontWeight: '700',
        lineHeight: 38,
        paddingTop: 2,
    },
    graceProgressBar: {
        width: '100%',
        height: 8,
        borderRadius: Radius.pill,
        overflow: 'hidden',
    },
    graceProgressFill: {
        height: '100%',
    },
});
