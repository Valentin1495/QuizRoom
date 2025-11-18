import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, BackHandler, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar, GuestAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getDeckIcon } from '@/lib/deck-icons';
import { deriveGuestAvatarId } from '@/lib/guest';
import { useMutation, useQuery } from 'convex/react';

export default function MatchLobbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, status, guestKey, ensureGuestKey } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const roomCode = useMemo(() => (params.code ?? '').toString().toUpperCase(), [params.code]);

  const [hasLeft, setHasLeft] = useState(false);
  const [participantId, setParticipantId] = useState<Id<'partyParticipants'> | null>(null);
  const joinAttemptRef = useRef(false);
  const [pendingMs, setPendingMs] = useState(0);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const pendingExecutedRef = useRef(false);
  const [selectedDelay, _] = useState<'rapid' | 'standard' | 'chill'>('chill');
  const [pendingBannerHeight, setPendingBannerHeight] = useState(0);

  const selfGuestAvatarId = useMemo(
    () => (status === 'guest' ? deriveGuestAvatarId(guestKey) : undefined),
    [guestKey, status]
  );


  const shouldFetchLobby = roomCode.length > 0 && !hasLeft;
  const lobby = useQuery(
    api.rooms.getLobby,
    shouldFetchLobby ? { code: roomCode } : 'skip'
  );
  const joinRoom = useMutation(api.rooms.join);
  const leaveRoom = useMutation(api.rooms.leave);
  const heartbeat = useMutation(api.rooms.heartbeat);
  const startRoom = useMutation(api.rooms.start);
  const setReady = useMutation(api.rooms.setReady);
  const cancelPendingAction = useMutation(api.rooms.cancelPendingAction);
  const roomId = lobby?.room._id ?? null;
  const pendingAction = lobby?.room.pendingAction ?? null;
  const pendingBannerAnim = useRef(new Animated.Value(pendingAction ? 1 : 0)).current;

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

  const participants = lobby?.participants ?? [];
  const meParticipant = useMemo(
    () => participants.find((participant) => participant.participantId === participantId) ?? null,
    [participants, participantId]
  );
  const readyCount = useMemo(
    () =>
      participants.filter((participant) => !participant.isHost && participant.isReady).length,
    [participants]
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
  const isSelfReady = meParticipant?.isReady ?? false;
  const isSelfHost = meParticipant?.isHost ?? false;
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
  const participantAvatarHighlight = theme.primaryForeground ?? theme.primary;
  const destructiveMutedColor = colorScheme === 'light' ? '#FEE2E2' : 'rgba(239, 68, 68, 0.2)';
  const destructiveMutedBgColor = colorScheme === 'light' ? '#FEF2F2' : 'rgba(239, 68, 68, 0.1)';
  const infoMutedColor = colorScheme === 'light' ? '#B45309' : '#FCD34D';
  const infoMutedBgColor = colorScheme === 'light' ? '#FEF9C3' : 'rgba(252, 211, 77, 0.1)';
  const neutralBannerBg = colorScheme === 'light' ? '#E8EDFF' : 'rgba(44, 58, 122, 0.9)';
  const neutralBannerBorder = colorScheme === 'light' ? '#5460B4' : '#C8D0FF';
  const neutralBannerText = colorScheme === 'light' ? '#2C3A7A' : '#E5EBFF';
  const accentForegroundColor = theme.accentForeground;
  const borderColor = theme.borderStrong ?? theme.border;
  const readyBadgeReadyColor =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.17)' : primaryColor;
  const readyBadgeWaitingColor =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : mutedColor;

  const renderParticipantAvatar = useCallback(
    (participant: (typeof participants)[number], isMe: boolean) => {
      if (isMe) {
        return status === 'authenticated' && user ? (
          <Avatar
            uri={user.avatarUrl}
            name={user.handle}
            size="md"
            radius={Radius.pill}
            backgroundColorOverride={fallbackAvatarBackground}
            style={styles.participantAvatar}
          />
        ) : (
          <GuestAvatar
            guestId={selfGuestAvatarId}
            size="md"
            radius={Radius.pill}
            style={styles.participantAvatar}
          />
        );
      }
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
      return (
        <GuestAvatar
          guestId={participant.guestAvatarId}
          size="md"
          radius={Radius.pill}
          style={styles.participantAvatar}
        />
      );
    },
    [fallbackAvatarBackground, selfGuestAvatarId, status, user]
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
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await setReady({
        roomId,
        participantId,
        ready: !isSelfReady,
        guestKey: status === 'guest' ? guestKey ?? undefined : undefined,
      });
    } catch (error) {
      Alert.alert(
        '준비 상태 변경 실패',
        error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      );
    }
  }, [guestKey, isSelfHost, isSelfReady, participantId, roomId, setReady, status]);

  const handleStart = useCallback(async () => {
    if (!roomId) return;
    if (!allReady) {
      Alert.alert('아직 준비되지 않았어요', '모든 참가자가 준비 완료 상태가 되어야 시작할 수 있어요.');
      return;
    }
    if (pendingAction) {
      Alert.alert('이미 예약된 작업이 있어요');
      return;
    }
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const key = await resolveHostGuestKey();
      await startRoom({
        roomId,
        delayMs: resolveDelayMs,
        guestKey: key,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('ACTION_PENDING')) {
        Alert.alert('이미 시작을 준비 중이에요', '곧 자동으로 시작돼요. 잠시만 기다려주세요!');
        return;
      }
      Alert.alert(
        '시작 실패',
        error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      );
    }
  }, [allReady, pendingAction, resolveDelayMs, resolveHostGuestKey, roomId, startRoom]);

  const handleLeave = useCallback(() => {
    if (hasLeft) return;
    setHasLeft(true);
    if (roomId && participantId) {
      const guestKeyValue = status === 'guest' ? guestKey ?? undefined : undefined;
      leaveRoom({ roomId, participantId, guestKey: guestKeyValue }).catch((error) => {
        console.warn('Failed to leave room', error);
      });
    }
    router.replace('/(tabs)/live-match');
  }, [guestKey, hasLeft, leaveRoom, participantId, roomId, router, status]);

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
            await heartbeat({
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
  }, [guestKey, hasLeft, heartbeat, participantId, pendingAction, roomId, serverOffsetMs, status]);

  useEffect(() => {
    if (hasLeft || !roomId || !participantId) return;
    if (status === 'guest' && !guestKey) return;
    const args = {
      roomId,
      participantId,
      guestKey: status === 'guest' ? guestKey ?? undefined : undefined,
    };
    const sendHeartbeat = () =>
      heartbeat(args).catch((error: unknown) => {
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
  }, [guestKey, hasLeft, heartbeat, participantId, roomId, status]);

  useEffect(() => {
    if (hasLeft) return;
    if (!roomCode) return;
    if (lobby === undefined) return;
    if (!lobby) return;
    if (participantId) return;
    if (status === 'guest' && !guestKey) return;
    if (joinAttemptRef.current) return;
    joinAttemptRef.current = true;
    void (async () => {
      try {
        const key = status === 'guest' ? guestKey ?? (await ensureGuestKey()) : undefined;
        const result = await joinRoom({ code: roomCode, nickname: undefined, guestKey: key });
        setParticipantId(result.participantId);
      } catch (error) {
        joinAttemptRef.current = false;
        console.warn('Failed to join room', error);
      }
    })();
  }, [ensureGuestKey, guestKey, hasLeft, joinRoom, lobby, participantId, roomCode, status]);

  useEffect(() => {
    if (hasLeft) return;
    if (!lobby) return;
    if (participantId) return;
    if (status !== 'authenticated' || !user) return;
    const me = lobby.participants?.find((participant) => participant.userId && participant.userId === user.id);
    if (me) {
      setParticipantId(me.participantId);
    }
  }, [hasLeft, lobby, participantId, status, user]);

  useEffect(() => {
    if (hasLeft) return;
    if (!lobby) return;
    if (!participantId) return;
    if (lobby.room.status !== 'lobby') {
      setHasLeft(true);
      router.replace({ pathname: '/match/play', params: { roomId: lobby.room._id } });
    }
  }, [hasLeft, lobby, participantId, router]);

  const handleCancelPending = useCallback(async () => {
    if (!roomId) return;
    try {
      const key = await resolveHostGuestKey();
      await cancelPendingAction({
        roomId,
        guestKey: key,
      });
    } catch (error) {
      Alert.alert('취소 실패', error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }, [cancelPendingAction, resolveHostGuestKey, roomId]);

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
        },
        header: {
          gap: Spacing.sm,
        },
        headerSubtitle: {
          color: mutedColor,
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
        deckCard: {
          marginTop: Spacing.sm,
          padding: Spacing.md,
          borderRadius: Radius.md,
          backgroundColor: accentColor,
          gap: Spacing.xs,
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
        sectionTitle: {
          fontWeight: '700',
          fontSize: 16,
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
          gap: 2,
        },
        participantName: {
          fontSize: 16,
          fontWeight: '500',
        },
        participantNameMe: {
          fontWeight: '700',
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
        pendingCancelButton: {
          alignSelf: 'stretch',
          width: '100%',
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.md,
          borderRadius: Radius.pill,
          backgroundColor: neutralBannerBg,
          borderWidth: 1,
          borderColor: neutralBannerBorder,
        },
        pendingCancelLabel: {
          width: '100%',
          textAlign: 'center',
          color: neutralBannerText,
          fontWeight: '600',
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
      neutralBannerBorder,
      neutralBannerText,
    ]
  );

  if (hasLeft) {
    return null;
  }

  if (lobby === undefined) {
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
    <ThemedView
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.lg },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.contentWrapper}>
        <Animated.View
          pointerEvents={pendingAction ? 'auto' : 'none'}
          style={[
            styles.pendingBannerContainer,
            {
              opacity: pendingBannerOpacity,
              transform: [{ translateY: pendingBannerTranslateY }],
            },
          ]}
        >
          {pendingAction ? (
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
                  ? `${pendingSeconds}초 후 자동 진행됩니다. 호스트가 취소할 수 있어요.`
                  : '잠시 후 자동으로 실행됩니다.'}
              </ThemedText>
              {isSelfHost ? (
                <Pressable style={styles.pendingCancelButton} onPress={handleCancelPending}>
                  <ThemedText style={styles.pendingCancelLabel}>취소</ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Animated.View>

        <Animated.View
          style={[
            styles.contentStack,
            { marginTop: pendingBannerOffset },
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
              <ThemedText style={styles.headerSubtitle}>로비에 입장했어요. 라이브 매치를 시작하세요!</ThemedText>
              <Pressable style={styles.codeBadgeWrapper} onPress={handleCopyCode}>
                <View style={styles.codeBadge}>
                  <ThemedText style={styles.codeBadgeText}>{roomCode}</ThemedText>
                </View>
                <ThemedText style={styles.codeBadgeHint}>탭해서 코드 복사</ThemedText>
              </Pressable>
              {lobby.deck ? (
                <View style={styles.deckCard}>
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
                  <ThemedText style={styles.deckCardDescription}>• 문제를 동시에 풀고 실시간으로 순위를 확인할 수 있어요.</ThemedText>
                  <ThemedText style={styles.deckCardDescription}>
                    • 정답이라도 빨리 고를수록 더 많은 점수를 받아요.
                  </ThemedText>
                  <ThemedText style={styles.deckCardDescription}>
                    • 총 10라운드로 진행됩니다.
                  </ThemedText>
                  <ThemedText style={styles.deckCardWarning}>
                    • 보기는 선택하는 순간 바로 확정됩니다. 신중히 골라주세요!
                  </ThemedText>
                </View>
              ) : null}
            </View>

            <View style={styles.participantSection}>
              <ThemedText style={styles.sectionTitle}>참가자 ({participants.length})</ThemedText>
              {participants.length === 0 ? (
                <ThemedText style={styles.emptyText}>
                  친구를 초대해 보세요! 위 코드를 공유해주세요.
                </ThemedText>
              ) : (
                <View style={styles.participantGrid}>
                  {participants.map((participant) => {
                    const isMe = participant.participantId === meParticipant?.participantId;
                    return (
                      <View
                        key={participant.participantId}
                        style={[styles.participantCard, isMe && styles.participantCardMe]}
                      >
                        {renderParticipantAvatar(participant, isMe)}
                        <View style={styles.participantTextBlock}>
                          <ThemedText
                            style={[styles.participantName, isMe && styles.participantNameMe]}
                          >
                            {participant.nickname}
                            {isMe ? ' (나)' : ''}
                          </ThemedText>
                          {!participant.isConnected ? (
                            <ThemedText style={styles.participantStatus}>오프라인</ThemedText>
                          ) : null}
                        </View>
                        {participant.isHost ? (
                          <View style={styles.hostBadge}>
                            <ThemedText style={styles.hostBadgeLabel}>호스트</ThemedText>
                          </View>
                        ) : (
                          <View style={styles.statusDisplay}>
                            {participant.isReady ? (
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
                    disabled={!allReady || !!pendingAction}
                  >
                    게임 시작
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
    </ThemedView>
  );
}
