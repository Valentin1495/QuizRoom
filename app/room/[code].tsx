import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQuery } from 'convex/react';

export default function PartyRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, status, guestKey, ensureGuestKey } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const roomCode = useMemo(() => (params.code ?? '').toString().toUpperCase(), [params.code]);

  const [hasLeft, setHasLeft] = useState(false);
  const [participantId, setParticipantId] = useState<Id<'partyParticipants'> | null>(null);
  const joinAttemptRef = useRef(false);
  const shouldFetchLobby = roomCode.length > 0 && !hasLeft;
  const lobby = useQuery(
    api.rooms.getLobby,
    shouldFetchLobby ? { code: roomCode } : 'skip'
  );
  const joinRoom = useMutation(api.rooms.join);
  const leaveRoom = useMutation(api.rooms.leave);
  const heartbeat = useMutation(api.rooms.heartbeat);
  const startRoom = useMutation(api.rooms.start);
  const progressRoom = useMutation(api.rooms.progress);
  const cancelPendingAction = useMutation(api.rooms.cancelPendingAction);
  const roomId = lobby?.room._id ?? null;
  const isHost = lobby?.room.hostId === user?.id;
  const pendingAction = lobby?.room.pendingAction ?? null;

  const [pendingMs, setPendingMs] = useState(0);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const pendingExecutedRef = useRef(false);
  const [selectedDelay, _] = useState<'rapid' | 'standard' | 'chill'>('chill');

  useEffect(() => {
    if (status === 'guest' && !guestKey) {
      void ensureGuestKey();
    }
  }, [ensureGuestKey, guestKey, status]);

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

  const handleLeave = useCallback(() => {
    if (hasLeft) return;
    setHasLeft(true);
    if (roomId && participantId) {
      const guestKeyValue = status === 'guest' ? guestKey ?? undefined : undefined;
      leaveRoom({ roomId, participantId, guestKey: guestKeyValue }).catch((error) => {
        console.warn('Failed to leave room', error);
      });
    }
    router.replace('/(tabs)/party');
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
    const interval = setInterval(() => {
      void heartbeat(args);
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
      router.replace({ pathname: '/party/play', params: { roomId: lobby.room._id } });
    }
  }, [hasLeft, lobby, participantId, router]);

  const handleStart = useCallback(async () => {
    if (!roomId) return;
    if (pendingAction) {
      Alert.alert('이미 예약된 작업이 있어요');
      return;
    }
    try {
      const key = await resolveHostGuestKey();
      await startRoom({
        roomId,
        delayMs: resolveDelayMs,
        guestKey: key,
      });
    } catch (error) {
      Alert.alert('시작 실패', error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }, [pendingAction, resolveDelayMs, resolveHostGuestKey, roomId, startRoom]);

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

  if (hasLeft) {
    return null;
  }

  if (lobby === undefined) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Palette.purple600} />
        <ThemedText style={styles.statusText}>파티 정보를 불러오는 중...</ThemedText>
      </ThemedView>
    );
  }

  if (!lobby) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText type="title" style={styles.statusText}>
          파티를 찾을 수 없어요
        </ThemedText>
        <ThemedText>코드가 정확한지 확인해주세요.</ThemedText>
        <Pressable style={styles.button} onPress={handleLeave}>
          <ThemedText style={styles.buttonText}>돌아가기</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }
  {/* <ThemedText style={styles.lobbyHint}>2차전 준비 중 · 덱/옵션을 확인하세요</ThemedText> */ }
  const participants = lobby.participants ?? [];
  const pendingSeconds = Math.ceil(pendingMs / 1000);

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom + Spacing.lg }]}>
      <Stack.Screen
        options={{
          title: `파티 ${roomCode}`,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable style={styles.headerLeaveButton} onPress={handleLeave}>
              <ThemedText style={styles.headerLeaveLabel}>나가기</ThemedText>
            </Pressable>
          ),
        }}
      />
      {pendingAction ? (
        <View style={styles.pendingBanner}>
          <ThemedText type="subtitle" style={styles.pendingTitle}>
            {pendingAction.label}
          </ThemedText>
          <ThemedText style={styles.pendingSubtitle}>
            {pendingSeconds > 0
              ? `${pendingSeconds}초 후 자동 진행됩니다. 호스트가 취소할 수 있어요.`
              : '잠시 후 자동으로 실행됩니다.'}
          </ThemedText>
          {isHost ? (
            <Pressable style={styles.pendingCancelButton} onPress={handleCancelPending}>
              <ThemedText style={styles.pendingCancelLabel}>취소</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={styles.header}>
        <ThemedText type="title">실시간 파티룸</ThemedText>
        <ThemedText style={styles.headerSubtitle}>친구들과 함께 문제를 풀 준비가 되었나요?</ThemedText>
        <View style={styles.codeBadge}>
          <ThemedText style={styles.codeBadgeText}>코드 {roomCode}</ThemedText>
        </View>
        {lobby.deck ? (
          <View style={styles.deckCard}>
            <ThemedText style={styles.deckCardTitle}>
              {lobby.deck.emoji} {lobby.deck.title}
            </ThemedText>
            <ThemedText style={styles.deckCardDescription}>{lobby.deck.description}</ThemedText>
            <ThemedText style={styles.deckCardMeta}>
              총 10라운드로 진행됩니다.
            </ThemedText>
            <ThemedText style={styles.deckCardWarning}>
              보기는 한 번만 선택할 수 있어요. 신중히 골라주세요!
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.participantSection}>
        <ThemedText style={styles.sectionTitle}>참가자 ({participants.length})</ThemedText>
        {participants.length === 0 ? (
          <ThemedText style={styles.emptyText}>아직 참가자가 없어요.</ThemedText>
        ) : (
          participants.map((participant) => (
            <View key={participant.participantId} style={styles.participantRow}>
              <View style={styles.participantInfo}>
                <ThemedText style={styles.participantName}>{participant.nickname}</ThemedText>
                {!participant.isConnected ? (
                  <ThemedText style={styles.participantStatus}>오프라인</ThemedText>
                ) : null}
              </View>
              {participant.isHost ? <ThemedText style={styles.hostBadge}>HOST</ThemedText> : null}
            </View>
          ))
        )}
      </View>

      {isHost && (
        <View style={styles.hostControls}>
          <Pressable
            style={[styles.button, styles.primaryButton, pendingAction ? styles.buttonDisabled : null]}
            onPress={handleStart}
            disabled={!!pendingAction}
          >
            <ThemedText style={styles.primaryButtonText}>게임 시작</ThemedText>
          </Pressable>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
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
  headerLeaveButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  headerLeaveLabel: {
    color: Palette.purple600,
    fontWeight: '600',
  },
  header: {
    gap: Spacing.sm,
  },
  headerSubtitle: {
    color: Palette.slate500,
  },
  codeBadge: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(91, 46, 255, 0.12)',
  },
  codeBadgeText: {
    fontWeight: '600',
    color: Palette.purple600,
  },
  deckCard: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(91, 46, 255, 0.08)',
    gap: Spacing.xs,
  },
  deckCardTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  deckCardDescription: {
    color: Palette.slate500,
    fontSize: 13,
  },
  deckCardMeta: {
    color: Palette.slate500,
    fontSize: 12,
  },
  deckCardWarning: {
    color: Palette.pink500,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 16,
  },
  participantSection: {
    gap: Spacing.md,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(91, 46, 255, 0.2)',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
  },
  participantStatus: {
    fontSize: 12,
    color: Palette.slate500,
  },
  hostBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.purple600,
  },
  emptyText: {
    color: Palette.slate500,
  },
  hostControls: {
    marginTop: 'auto',
    gap: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  button: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    backgroundColor: Palette.purple600,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: Palette.pink500,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  pendingBanner: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(91, 46, 255, 0.12)',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  pendingTitle: {
    fontWeight: '700',
  },
  pendingSubtitle: {
    color: Palette.slate500,
  },
  pendingCancelButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Palette.slate200,
  },
  pendingCancelLabel: {
    color: Palette.slate900,
    fontWeight: '600',
  },
});
