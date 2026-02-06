import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, BackHandler, Easing, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LevelBadge } from '@/components/common/level-badge';
import { LevelInfoSheet } from '@/components/common/level-info-sheet';
import { showResultToast } from '@/components/common/result-toast';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accordion } from '@/components/ui/accordion';
import { Avatar, GuestAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLiveLobby, useRoomActions } from '@/hooks/use-live-lobby';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-unified-auth';
import { getDeckIcon } from '@/lib/deck-icons';
import { deriveGuestAvatarId } from '@/lib/guest';
import { calculateLevel } from '@/lib/level';
import { saveRecentLiveMatchDeck } from '@/lib/recent-selections';
import { ROOM_IN_PROGRESS_MESSAGE } from '@/lib/supabase-api';

const HIDDEN_HEADER_OPTIONS = { headerShown: false } as const;

export default function MatchLobbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, status, guestKey, ensureGuestKey } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const roomCode = useMemo(() => (params.code ?? '').toString().toUpperCase(), [params.code]);

  const [hasLeft, setHasLeft] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const joinAttemptRef = useRef(false);
  const [optimisticReady, setOptimisticReady] = useState<boolean | null>(null);
  const lastServerReadyState = useRef<boolean | null>(null);
  const [pendingMs, setPendingMs] = useState(0);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const pendingExecutedRef = useRef(false);
  const lastSavedDeckIdRef = useRef<string | null>(null);
  const [selectedDelay, _] = useState<'rapid' | 'standard' | 'chill'>('chill');
  const [pendingBannerHeight, setPendingBannerHeight] = useState(0);
  const [isStarting, setIsStarting] = useState(false);

  const selfGuestAvatarId = useMemo(
    () => (status === 'guest' ? deriveGuestAvatarId(guestKey) : undefined),
    [guestKey, status]
  );


  const shouldFetchLobby = roomCode.length > 0 && !hasLeft;
  const {
    lobby,
    isLoading: isLobbyLoading,
    refetch: refetchLobby,
  } = useLiveLobby(roomCode, { enabled: shouldFetchLobby });
  const roomActions = useRoomActions();
  const roomId = lobby?.room._id ?? null;
  const pendingActionServer = lobby?.room.pendingAction ?? null;
  const [localPendingAction, setLocalPendingAction] = useState<{
    label: string;
    executeAt: number;
  } | null>(null);
  const pendingAction = pendingActionServer ?? localPendingAction;
  const pendingBannerAnim = useRef(new Animated.Value(pendingAction ? 1 : 0)).current;

  useEffect(() => {
    if (pendingActionServer) {
      setLocalPendingAction(null);
    }
  }, [pendingActionServer]);

  useEffect(() => {
    if (!lobby?.deck) return;
    if (!participantId) return;
    if (lastSavedDeckIdRef.current === lobby.deck.id) return;
    lastSavedDeckIdRef.current = lobby.deck.id;
    void saveRecentLiveMatchDeck({
      id: lobby.deck.id,
      slug: lobby.deck.slug,
      title: lobby.deck.title,
      emoji: lobby.deck.emoji,
    });
  }, [lobby?.deck, participantId]);

  useEffect(() => {
    Animated.timing(pendingBannerAnim, {
      toValue: pendingAction ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [pendingAction, pendingBannerAnim]);

  const fallbackBannerHeight = 88;
  const bannerHeight = pendingBannerHeight || fallbackBannerHeight;
  const pendingBannerOffset = pendingBannerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, bannerHeight + Spacing.lg],
    extrapolate: 'clamp',
  });
  const pendingBannerTranslateY = pendingBannerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 0],
  });
  const pendingBannerOpacity = pendingBannerAnim;
  const levelSheetRef = useRef<BottomSheetModal>(null);
  const [levelSheetTarget, setLevelSheetTarget] = useState<{ xp: number; level: number } | null>(null);

  const participants = lobby?.participants ?? [];
  const meParticipant = useMemo(
    () => participants.find((participant) => participant.participantId === participantId) ?? null,
    [participants, participantId]
  );
  const myLevel = useMemo(() => {
    if (status === 'authenticated' && user) {
      return calculateLevel(user.xp).level;
    }
    if (meParticipant?.xp != null) {
      return calculateLevel(meParticipant.xp).level;
    }
    return 1;
  }, [meParticipant?.xp, status, user]);

  const openLevelSheet = useCallback((xp?: number | null) => {
    if (xp == null) return;
    setLevelSheetTarget({ xp, level: calculateLevel(xp).level });
    levelSheetRef.current?.present();
  }, []);

  const closeLevelSheet = useCallback(() => {
    setLevelSheetTarget(null);
    levelSheetRef.current?.dismiss();
  }, []);
  // Track server state and clear optimistic update when it arrives
  useEffect(() => {
    if (meParticipant && meParticipant.isReady !== lastServerReadyState.current) {
      lastServerReadyState.current = meParticipant.isReady;
      // Server state changed - clear optimistic update
      if (optimisticReady !== null) {
        setOptimisticReady(null);
      }
    }
  }, [meParticipant?.isReady, optimisticReady]);

  const identityId = useMemo(() => {
    if (status === 'authenticated' && user?.id) return user.id;
    if (status === 'guest' && guestKey) return `guest:${guestKey}`;
    return null;
  }, [guestKey, status, user?.id]);
  const isSelfReady = optimisticReady !== null ? optimisticReady : (meParticipant?.isReady ?? false);
  const isSelfHost =
    meParticipant?.isHost ??
    (!!identityId && lobby?.room.hostIdentity === identityId);
  const isStartPending = !!pendingAction && (pendingAction as any).type === 'start';
  const shouldShowHostPendingBanner = !!pendingAction && isSelfHost;
  const shouldShowParticipantPendingBanner = !!pendingAction && !isSelfHost && isStartPending;
  const shouldShowPendingBanner = !!pendingAction;

  const readyCount = useMemo(
    () =>
      participants.filter((participant) => {
        if (participant.isHost) return false;
        // Use optimistic state for self
        if (participant.participantId === participantId && optimisticReady !== null) {
          return optimisticReady;
        }
        return participant.isReady;
      }).length,
    [participants, participantId, optimisticReady]
  );
  const readyTotal = useMemo(
    () => participants.filter((participant) => !participant.isHost).length,
    [participants]
  );
  const allReady = useMemo(() => {
    if (readyTotal === 0) {
      return participants.length > 0;
    }
    return readyCount === readyTotal;
  }, [participants.length, readyCount, readyTotal]);
  const readySummaryTotal = useMemo(() => readyTotal, [readyTotal]);
  const pendingSeconds = Math.ceil(pendingMs / 1000);

  useEffect(() => {
    if (status === 'guest' && !guestKey) {
      void ensureGuestKey();
    }
  }, [ensureGuestKey, guestKey, status]);

  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const mutedColor = useThemeColor({}, 'textMuted');

  // Define neutral palette colors based on the theme
  const primaryColor = theme.primary;
  const secondaryColor = colorScheme === 'light' ? theme.secondary : theme.cardElevated;
  const accentColor = theme.accent;
  const destructiveColor = theme.destructive;
  const fallbackAvatarBackground = theme.primary;
  const destructiveMutedColor = colorScheme === 'light' ? '#FEE2E2' : 'rgba(239, 68, 68, 0.2)';
  const destructiveMutedBgColor = colorScheme === 'light' ? '#FEF2F2' : 'rgba(239, 68, 68, 0.1)';
  const infoMutedColor = colorScheme === 'light' ? '#B45309' : '#FCD34D';
  const infoMutedBgColor = colorScheme === 'light' ? '#FEF9C3' : 'rgba(252, 211, 77, 0.1)';
  const neutralBannerBg = colorScheme === 'light' ? '#E8EDFF' : 'rgba(44, 58, 122, 0.9)';
  const neutralBannerText = colorScheme === 'light' ? '#2C3A7A' : '#E5EBFF';
  const accentForegroundColor = theme.accentForeground;
  const borderColor = theme.borderStrong ?? theme.border;
  const readyBadgeReadyColor =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.17)' : primaryColor;
  const readyBadgeWaitingColor =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : mutedColor;
  const participantIconSize = Platform.OS === 'android' ? 22 : 18;
  const isDark = colorScheme === 'dark';

  const renderParticipantAvatar = useCallback(
    (
      participant: (typeof participants)[number],
      isMe: boolean,
      levelInfo?: ReturnType<typeof calculateLevel>
    ) => {
      if (participant.userId) {
        return (
          <Avatar
            uri={participant.avatarUrl}
            name={participant.nickname}
            size="md"
            radius={Radius.pill}
            backgroundColorOverride={fallbackAvatarBackground}
            style={styles.participantAvatar}
          />
        );
      }

      const resolvedGuestId =
        participant.guestAvatarId ?? (isMe ? selfGuestAvatarId : null);

      return (
        <GuestAvatar
          guestId={resolvedGuestId ?? undefined}
          size="md"
          radius={Radius.pill}
          style={styles.participantAvatar}
        />
      );
    },
    [fallbackAvatarBackground, selfGuestAvatarId]
  );


  const resolveDelayMs = useMemo(() => {
    switch (selectedDelay) {
      case 'rapid':
        return 2000;
      case 'chill':
        return 5000;
      case 'standard':
      default:
        return 3000;
    }
  }, [selectedDelay]);

  const resolveHostGuestKey = useCallback(async () => {
    if (status === 'guest') {
      return guestKey ?? (await ensureGuestKey());
    }
    return undefined;
  }, [ensureGuestKey, guestKey, status]);

  const handleCopyCode = useCallback(async () => {
    await Clipboard.setStringAsync(roomCode);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('초대 코드 복사 완료', `코드 ${roomCode}가 클립보드에 복사되었어요.`);
  }, [roomCode]);

  const handleToggleReady = useCallback(async () => {
    if (!roomId || !participantId || isSelfHost) return;

    // Prevent toggling while optimistic update is pending
    if (optimisticReady !== null) return;

    const newReadyState = !isSelfReady;

    // Optimistic update - immediately toggle UI
    setOptimisticReady(newReadyState);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await roomActions.setReady({
        roomId,
        participantId,
        ready: newReadyState,
        guestKey: status === 'guest' ? guestKey ?? undefined : undefined,
      });
      // Success - optimistic state will be cleared by useEffect when server update arrives
    } catch (error) {
      // Rollback on failure
      setOptimisticReady(null);
      Alert.alert(
        '준비 상태 변경 실패',
        error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      );
    }
  }, [guestKey, isSelfHost, isSelfReady, participantId, roomActions, roomId, status, optimisticReady]);

  const handleStart = useCallback(async () => {
    if (!roomId) return;
    if (isStarting) return;
    if (!allReady) {
      Alert.alert('아직 준비되지 않았어요', '모든 참가자가 준비 완료 상태가 되어야 시작할 수 있어요.');
      return;
    }
    if (pendingAction) {
      Alert.alert('이미 예약된 작업이 있어요');
      return;
    }

    setIsStarting(true);

    try {
      // 서버 기준 최신 대기실 상태로 한 번 더 확인
      const freshLobby = await refetchLobby();
      const participantsNow = freshLobby?.participants ?? participants;
      const nonHostNow = participantsNow.filter((participant) => !participant.isHost);
      const allReadyNow =
        nonHostNow.length === 0
          ? participantsNow.length > 0
          : nonHostNow.every((participant) => participant.isReady);

      if (!allReadyNow) {
        Alert.alert(
          '아직 준비되지 않았어요',
          '누군가 방금 준비를 취소했어요. 모두 준비되면 다시 시작해 주세요.'
        );
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const key = await resolveHostGuestKey();
      const executeAt = Date.now() - serverOffsetMs + resolveDelayMs;
      setLocalPendingAction({
        label: '라이브 매치 시작 준비 중...',
        executeAt,
      });
      setPendingMs(resolveDelayMs);
      await roomActions.start({
        roomId,
        participantId: participantId ?? '',
        delayMs: resolveDelayMs,
        guestKey: key,
      });
    } catch (error) {
      setLocalPendingAction(null);
      if (error instanceof Error && error.message.includes('ACTION_PENDING')) {
        Alert.alert('이미 시작을 준비 중이에요', '곧 자동으로 시작돼요. 잠시만 기다려주세요!');
        return;
      }
      Alert.alert(
        '시작 실패',
        error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      );
    } finally {
      setIsStarting(false);
    }
  }, [
    allReady,
    isStarting,
    pendingAction,
    participantId,
    participants,
    refetchLobby,
    resolveDelayMs,
    resolveHostGuestKey,
    roomActions,
    roomId,
    serverOffsetMs,
  ]);

  const handleLeave = useCallback(() => {
    if (hasLeft) return;
    setHasLeft(true);
    if (roomId && participantId) {
      const guestKeyValue = status === 'guest' ? guestKey ?? undefined : undefined;
      roomActions.leave({ roomId, participantId, guestKey: guestKeyValue }).catch((error) => {
        console.warn('Failed to leave room', error);
      });
    }
    router.replace('/(tabs)/live-match');
  }, [guestKey, hasLeft, participantId, roomActions, roomId, router, status]);

  useEffect(() => {
    if (hasLeft) return;
    if (typeof lobby?.now === 'number') {
      setServerOffsetMs(Date.now() - lobby.now);
    }
  }, [hasLeft, lobby?.now]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleLeave();
      return true;
    });
    return () => subscription.remove();
  }, [handleLeave]);

  useEffect(() => {
    if (hasLeft) return;
    if (status === 'guest' && !guestKey) return;
    pendingExecutedRef.current = false;
    if (!pendingAction) {
      setPendingMs(0);
      return;
    }

    const update = () => {
      const diff = pendingAction.executeAt - (Date.now() - serverOffsetMs);
      setPendingMs(Math.max(0, diff));
      if (roomId && participantId && diff <= 0 && !pendingExecutedRef.current) {
        pendingExecutedRef.current = true;
        void (async () => {
          try {
            await roomActions.heartbeat({
              roomId,
              participantId,
              guestKey: status === 'guest' ? guestKey ?? undefined : undefined,
            });
          } catch (error) {
            pendingExecutedRef.current = false;
            if (error instanceof Error && error.message.includes('NOT_IN_ROOM')) {
              setParticipantId(null);
              joinAttemptRef.current = false;
            }
          }
        })();
      }
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [guestKey, hasLeft, participantId, pendingAction, roomActions, roomId, serverOffsetMs, status]);

  useEffect(() => {
    if (hasLeft || !roomId || !participantId) return;
    if (status === 'guest' && !guestKey) return;
    const args = {
      roomId,
      participantId,
      guestKey: status === 'guest' ? guestKey ?? undefined : undefined,
    };
    const sendHeartbeat = () =>
      roomActions.heartbeat(args).catch((error: unknown) => {
        if (error instanceof Error && error.message.includes('NOT_IN_ROOM')) {
          setParticipantId(null);
          joinAttemptRef.current = false;
        }
      });
    void sendHeartbeat();
    const interval = setInterval(() => {
      void sendHeartbeat();
    }, 5000);
    return () => clearInterval(interval);
  }, [guestKey, hasLeft, participantId, roomActions, roomId, status]);

  useEffect(() => {
    if (hasLeft) return;
    if (!roomCode) return;
    if (isLobbyLoading) return;
    if (!lobby) return;
    if (participantId) return;
    if (status === 'guest' && !guestKey) return;
    if (joinAttemptRef.current) return;
    joinAttemptRef.current = true;
    void (async () => {
      try {
        const key = status === 'guest' ? guestKey ?? (await ensureGuestKey()) : undefined;
        const result = await roomActions.join({ code: roomCode, nickname: undefined, guestKey: key });
        setParticipantId(result.participantId ?? null);
      } catch (error) {
        joinAttemptRef.current = false;
        const message = error instanceof Error ? error.message : '';
        if (message.includes(ROOM_IN_PROGRESS_MESSAGE)) {
          Alert.alert('게임이 이미 시작됐어요', ROOM_IN_PROGRESS_MESSAGE, [
            {
              text: '확인',
              onPress: () => {
                setHasLeft(true);
                router.replace('/(tabs)/live-match');
              },
            },
          ]);
          return;
        }
        console.warn('Failed to join room', error);
      }
    })();
  }, [ROOM_IN_PROGRESS_MESSAGE, ensureGuestKey, guestKey, hasLeft, isLobbyLoading, lobby, participantId, roomActions, roomCode, router, status]);

  useEffect(() => {
    if (hasLeft) return;
    if (!lobby) return;
    if (participantId) return;
    if (status !== 'authenticated' || !user) return;
    const me = lobby.participants?.find((participant) => participant.userId && participant.userId === user.id);
    if (me) {
      setParticipantId(me.participantId ?? null);
    }
  }, [hasLeft, lobby, participantId, status, user]);

  useEffect(() => {
    if (hasLeft) return;
    if (!lobby) return;
    if (!participantId) return;
    if (lobby.room.status !== 'lobby') {
      showResultToast({ message: '게임을 시작합니다!' });
      setHasLeft(true);
      router.replace({
        pathname: '/match/play',
        params: { roomId: lobby.room._id, participantId: participantId ?? undefined }
      });
    }
  }, [hasLeft, lobby, participantId, router]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          gap: Spacing.xl,
        },
        centerContainer: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: Spacing.lg,
          gap: Spacing.md,
        },
        statusText: {
          textAlign: 'center',
        },
        contentWrapper: {
          flex: 1,
          position: 'relative',
        },
        contentStack: {
          flex: 1,
        },
        scrollRegion: {
          flex: 1,
        },
        scrollContent: {
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.xl,
        },
        pendingBannerContainer: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          elevation: 2,
          paddingHorizontal: Spacing.lg,
        },
        header: {
          gap: Spacing.sm,
        },
        headerSubtitle: {
          color: mutedColor,
        },
        codeBadgeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm,
        },
        codeBadge: {
          alignSelf: 'flex-start',
          paddingVertical: Spacing.xs,
          paddingHorizontal: Spacing.md,
          borderRadius: Radius.pill,
          backgroundColor: secondaryColor,
        },
        codeBadgeText: {
          fontWeight: '600',
          color: primaryColor,
        },
        codeBadgeHintRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs,
        },
        deckCard: {
          marginTop: Spacing.sm,
          borderRadius: Radius.md,
          backgroundColor: accentColor,
        },
        deckCardTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs,
        },
        deckCardTitle: {
          fontWeight: '700',
          fontSize: 15,
        },
        deckCardDescription: {
          color: mutedColor,
          fontSize: 12,
        },
        deckCardWarning: {
          color: destructiveColor,
          fontSize: 12,
          fontWeight: '600',
        },
        deckCardContent: {
          paddingHorizontal: Spacing.md,
          paddingBottom: Spacing.md,
          paddingTop: Spacing.xs,
          gap: Spacing.xs,
        },
        sectionTitle: {
          fontWeight: '700',
          fontSize: 16,
        },
        sectionTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs,
        },
        participantSection: {
          marginTop: Spacing.xl,
        },
        participantGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: Spacing.md,
          marginTop: Spacing.md,
        },
        participantCard: {
          width: '48%',
          alignItems: 'center',
          padding: Spacing.md,
          borderRadius: Radius.md,
          backgroundColor: theme.accent,
          gap: Spacing.xs,
        },
        participantCardMe: {
          backgroundColor: secondaryColor,
          borderWidth: 2,
          borderColor: primaryColor,
        },
        participantAvatar: {},
        participantTextBlock: {
          alignItems: 'center',
          gap: Platform.OS === 'android' ? Spacing.sm : 2,
          alignSelf: 'stretch',
        },
        participantBottomRow: {
          marginTop: 'auto',
          width: '100%',
          alignItems: 'center',
          paddingTop: Spacing.sm,
        },
        participantName: {
          fontSize: 16,
          fontWeight: '500',
          textAlign: 'center',
          maxWidth: '100%',
        },
        participantNameMe: {
          fontWeight: '700',
        },
        participantNameRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Spacing.xs,
          flexWrap: 'wrap',
        },
        codeBadgeWrapper: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm,
          alignSelf: 'flex-start',
          marginTop: Spacing.sm,
        },
        codeBadgeHint: {
          fontSize: 12,
          color: mutedColor,
        },
        participantStatus: {
          fontSize: 12,
          color: mutedColor,
        },
        statusDisplay: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs,
        },
        statusTextReady: {
          color: primaryColor,
          fontWeight: '600',
          fontSize: 13,
        },
        statusTextWaiting: {
          color: mutedColor,
          fontSize: 12,
        },
        statusTextWaitingMe: {
          color: accentForegroundColor,
        },
        hostBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs,
          paddingHorizontal: Spacing.sm,
          paddingVertical: 2,
          borderRadius: Radius.pill,
          borderWidth: 1,
          borderColor: accentForegroundColor,
        },
        hostBadgeLabel: {
          fontSize: 11,
          fontWeight: '700',
          color: accentForegroundColor,
        },
        emptyText: {
          color: mutedColor,
        },
        gradient: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: -3,
          height: 3,
        },
        controlsSection: {
          gap: Spacing.sm,
          paddingTop: Spacing.md,
          paddingHorizontal: Spacing.lg,
          backgroundColor: theme.background,
        },
        readySummaryText: {
          fontSize: 13,
          color: mutedColor,
        },
        readyButton: {
          marginTop: Spacing.sm,
        },
        hostControls: {
          gap: Spacing.sm,
          marginTop: -Spacing.sm,
        },
        hostHint: {
          fontSize: 12,
          color: mutedColor,
        },
        pendingBanner: {
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.lg,
          borderRadius: Radius.md,
          backgroundColor: neutralBannerBg,
          borderWidth: 0,
          shadowColor: '#00000020',
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
          gap: Spacing.sm,
        },
        pendingTitle: {
          fontWeight: '700',
          color: neutralBannerText,
        },
        pendingSubtitle: {
          color: neutralBannerText,
        },
      }),
    [
      colorScheme,
      mutedColor,
      theme,
      primaryColor,
      secondaryColor,
      accentColor,
      destructiveColor,
      destructiveMutedColor,
      destructiveMutedBgColor,
      infoMutedColor,
      infoMutedBgColor,
      accentForegroundColor,
      neutralBannerBg,
      neutralBannerText,
    ]
  );

  if (hasLeft) {
    return null;
  }

  if (isLobbyLoading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
        <ThemedText style={styles.statusText}>퀴즈룸 정보를 불러오는 중...</ThemedText>
      </ThemedView>
    );
  }

  if (!lobby) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText type="title" style={styles.statusText}>
          퀴즈룸을 찾을 수 없어요
        </ThemedText>
        <ThemedText>코드가 정확한지 확인해주세요.</ThemedText>
        <Button size="lg" onPress={handleLeave}>
          돌아가기
        </Button>
      </ThemedView>
    );
  }

  return (
    <BottomSheetModalProvider>
      <ThemedView
        style={[
          styles.container,
          { paddingTop: insets.top + Spacing.lg },
        ]}
      >
        <Stack.Screen options={HIDDEN_HEADER_OPTIONS} />
        <View style={styles.contentWrapper}>
          <Animated.View
            pointerEvents={shouldShowHostPendingBanner ? 'auto' : 'none'}
            style={[
              styles.pendingBannerContainer,
              {
                opacity: pendingBannerOpacity,
                transform: [{ translateY: pendingBannerTranslateY }],
              },
            ]}
          >
            {shouldShowPendingBanner ? (
              <>
                {shouldShowHostPendingBanner ? (
                  <View
                    style={styles.pendingBanner}
                    onLayout={(event) => {
                      const { height } = event.nativeEvent.layout;
                      if (height && Math.abs(height - pendingBannerHeight) > 0.5) {
                        setPendingBannerHeight(height);
                      }
                    }}
                  >
                    <ThemedText type="subtitle" style={styles.pendingTitle}>
                      {pendingAction.label}
                    </ThemedText>
                    <ThemedText style={styles.pendingSubtitle}>
                      {pendingSeconds > 0
                        ? `${pendingSeconds}초 후 자동으로 진행됩니다.`
                        : '잠시 후 자동으로 실행됩니다.'}
                    </ThemedText>
                  </View>
                ) : null}

                {shouldShowParticipantPendingBanner ? (
                  <View
                    style={styles.pendingBanner}
                    onLayout={(event) => {
                      const { height } = event.nativeEvent.layout;
                      if (height && Math.abs(height - pendingBannerHeight) > 0.5) {
                        setPendingBannerHeight(height);
                      }
                    }}
                  >
                    <ThemedText type="subtitle" style={styles.pendingTitle}>
                      게임이 곧 시작돼요
                    </ThemedText>
                    <ThemedText style={styles.pendingSubtitle}>
                      호스트가 시작을 눌렀어요. 곧 자동으로 시작돼요.
                    </ThemedText>
                  </View>
                ) : null}
              </>
            ) : null}
          </Animated.View>

          <Animated.View
            style={[
              styles.contentStack,
              { marginTop: shouldShowPendingBanner ? pendingBannerOffset : 0 },
            ]}
          >
            <ScrollView
              style={styles.scrollRegion}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.header}>
                <ThemedText type="title">퀴즈룸</ThemedText>
                <ThemedText style={styles.headerSubtitle}>
                  대기실에 입장했어요. {'\n'}게임을 시작하면 화면이 자동으로 넘어가고, {'\n'}네트워크 상황에 따라 1~2초 정도 지연될 수 있어요.
                </ThemedText>
                <View style={styles.codeBadgeWrapper}>
                  <View style={styles.codeBadgeRow}>
                    <View style={styles.codeBadge}>
                      <ThemedText style={styles.codeBadgeText}>{roomCode}</ThemedText>
                    </View>
                    <Pressable style={styles.codeBadgeHintRow} onPress={handleCopyCode}>
                      <IconSymbol name="document.on.document" size={16} color={mutedColor} />
                      <ThemedText style={styles.codeBadgeHint}>코드 복사</ThemedText>
                    </Pressable>
                  </View>
                </View>
	                {lobby.deck ? (
	                  <Accordion
	                    style={styles.deckCard}
	                    contentStyle={styles.deckCardContent}
	                    title={
	                      <View style={styles.deckCardTitleRow}>
	                        <IconSymbol
	                          name={getDeckIcon(lobby.deck.slug)}
                          size={20}
                          color={primaryColor}
                        />
                        <ThemedText style={styles.deckCardTitle}>
                          {lobby.deck.title}
                        </ThemedText>
                      </View>
                    }
                  >
                    <ThemedText style={styles.deckCardDescription}>• 문제를 동시에 풀고 실시간으로 순위를 확인할 수 있어요.</ThemedText>
                    <ThemedText style={styles.deckCardDescription}>
                      • 총 10라운드로 진행돼요.
                    </ThemedText>
                    <ThemedText style={styles.deckCardDescription}>• 최대 10명까지 참여할 수 있어요.</ThemedText>
                    <ThemedText style={styles.deckCardDescription}>
                      • 정답이라도 빨리 고를수록 더 많은 점수를 받아요.
                    </ThemedText>
                    <ThemedText style={styles.deckCardDescription}>
                      • 연속 정답으로 콤보 배수를 쌓아 더 높은 점수를 노려보세요!
                    </ThemedText>
                    <ThemedText style={styles.deckCardWarning}>
                      • 보기는 선택하는 순간 바로 확정됩니다. 신중히 골라주세요!
                    </ThemedText>
                  </Accordion>
                ) : null}
              </View>

              <View style={styles.participantSection}>
                <View style={styles.sectionTitleRow}>
                  <IconSymbol
                    name="person"
                    size={participantIconSize}
                    color={theme.text}
                    style={Platform.OS === 'android' ? { marginTop: 1 } : undefined}
                  />
                  <ThemedText style={styles.sectionTitle}>{participants.length}</ThemedText>
                </View>
                {participants.length === 0 ? (
                  <ThemedText style={styles.emptyText}>
                    친구를 초대해 보세요! 위 코드를 공유해주세요.
                  </ThemedText>
                ) : (
                  <View style={styles.participantGrid}>
                    {participants.map((participant) => {
                      const isMe =
                        participant.participantId === meParticipant?.participantId ||
                        (status === 'authenticated' && user?.id && participant.userId === user.id) ||
                        (identityId != null &&
                          lobby?.room.hostIdentity === identityId &&
                          participant.isHost);
                      const displayXp = isMe && status === 'authenticated' && user ? user.xp : participant.xp;
                      const levelInfo = displayXp != null ? calculateLevel(displayXp) : null;
                      return (
                        <View
                          key={participant.participantId}
                          style={[styles.participantCard, isMe && styles.participantCardMe]}
                        >
                          {renderParticipantAvatar(participant, isMe, levelInfo ?? undefined)}
                          <View style={styles.participantTextBlock}>
                            <View style={styles.participantNameRow}>
                              <ThemedText
                                style={[styles.participantName, isMe && styles.participantNameMe]}
                              >
                                {participant.nickname}
                              </ThemedText>
                            </View>
                            {levelInfo ? (
                              <Pressable
                                onPress={() => {
                                  openLevelSheet(displayXp);
                                }}
                                hitSlop={8}
                              >
                                <LevelBadge xp={displayXp ?? undefined} size="sm" showTitle />
                              </Pressable>
                            ) : null}
                            {!participant.isConnected ? (
                              <ThemedText style={styles.participantStatus}>오프라인</ThemedText>
                            ) : null}
                          </View>
                          <View style={styles.participantBottomRow}>
                            {participant.isHost ? (
                              <View style={styles.hostBadge}>
                                <IconSymbol name="crown.fill" size={18} color={accentForegroundColor} />
                                <ThemedText style={styles.hostBadgeLabel}>호스트</ThemedText>
                              </View>
                            ) : (
                              <View style={styles.statusDisplay}>
                                {(isMe && optimisticReady !== null ? optimisticReady : participant.isReady) ? (
                                  <>
                                    <IconSymbol
                                      name="checkmark.shield"
                                      size={20}
                                      color={primaryColor}
                                    />
                                    <ThemedText style={styles.statusTextReady}>준비 완료</ThemedText>
                                  </>
                                ) : (
                                  <ThemedText
                                    style={[styles.statusTextWaiting, isMe && styles.statusTextWaitingMe]}
                                  >
                                    대기 중
                                  </ThemedText>
                                )}
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>

            <View>
              <LinearGradient
                colors={
                  colorScheme === 'light'
                    ? ['rgba(0,0,0,0.05)', 'transparent']
                    : ['rgba(0,0,0,0.2)', 'transparent']
                }
                style={styles.gradient}
              />
              <View style={[styles.controlsSection, { paddingBottom: insets.bottom + Spacing.xs }]}>
                {readySummaryTotal > 0 ? (
                  <ThemedText style={styles.readySummaryText}>
                    준비 완료 {readyCount}/{readySummaryTotal}
                  </ThemedText>
                ) : null}
                {meParticipant && !isSelfHost ? (
                  <Button
                    variant={isSelfReady ? 'secondary' : 'default'}
                    size="lg"
                    onPress={handleToggleReady}
                    disabled={!!pendingAction}
                  >
                    {isSelfReady ? '준비 취소' : '준비 완료'}
                  </Button>
                ) : null}
                {isSelfHost ? (
                  <View style={styles.hostControls}>
                    {readySummaryTotal > 0 ? (
                      <ThemedText style={styles.hostHint}>
                        {allReady
                          ? '모든 참가자가 준비를 마쳤어요!'
                          : '모든 참가자들이 준비 완료하면 시작할 수 있어요.'}
                      </ThemedText>
                    ) : null}
                    <Button
                      size="lg"
                      onPress={handleStart}
                      loading={isStarting}
                      disabled={!allReady || !!pendingAction}
                    >
                      {isStarting ? '시작 준비 중...' : '게임 시작'}
                    </Button>
                  </View>
                ) : null}
                <Button
                  variant="outline"
                  onPress={handleLeave}
                  size="lg"
                  disabled={!!pendingAction}
                >
                  나가기
                </Button>
              </View>
            </View>
          </Animated.View>
        </View>
        <LevelInfoSheet
          sheetRef={levelSheetRef}
          currentLevel={levelSheetTarget?.level ?? myLevel}
          currentXp={levelSheetTarget?.xp ?? user?.xp ?? meParticipant?.xp ?? 0}
          variant="compact"
          onClose={closeLevelSheet}
        />
      </ThemedView>
    </BottomSheetModalProvider>
  );
}
