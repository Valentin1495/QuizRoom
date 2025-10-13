import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQuery } from 'convex/react';

export default function PartyRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const roomCode = useMemo(() => (params.code ?? '').toString().toUpperCase(), [params.code]);

  const [hasLeft, setHasLeft] = useState(false);
  const shouldFetchLobby = !!user && roomCode.length > 0 && !hasLeft;
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
  const [selectedDelay, setSelectedDelay] = useState<'rapid' | 'standard' | 'chill'>('standard');

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

  const handleLeave = useCallback(() => {
    if (hasLeft) return;
    setHasLeft(true);
    if (roomId) {
      leaveRoom({ roomId }).catch((error) => {
        console.warn('Failed to leave room', error);
      });
    }
    router.replace('/(tabs)/party');
  }, [hasLeft, leaveRoom, roomId, router]);

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
    pendingExecutedRef.current = false;
    if (!pendingAction) {
      setPendingMs(0);
      return;
    }

    const update = () => {
      const diff = pendingAction.executeAt - (Date.now() - serverOffsetMs);
      setPendingMs(Math.max(0, diff));
      if (roomId && diff <= 0 && !pendingExecutedRef.current) {
        pendingExecutedRef.current = true;
        void (async () => {
          try {
            await heartbeat({ roomId });
          } catch (error) {
            pendingExecutedRef.current = false;
          }
        })();
      }
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [hasLeft, heartbeat, pendingAction, roomId, serverOffsetMs]);

  useEffect(() => {
    if (hasLeft || !roomId || !user) return;
    const interval = setInterval(() => {
      void heartbeat({ roomId });
    }, 5000);
    return () => clearInterval(interval);
  }, [hasLeft, heartbeat, roomId, user]);

  useEffect(() => {
    if (hasLeft) return;
    if (!roomCode || !user) return;
    if (lobby === undefined) return;
    if (!lobby) return;
    const alreadyParticipant = lobby.participants?.some((participant) => participant.userId === user.id);
    if (alreadyParticipant) return;
    void (async () => {
      try {
        await joinRoom({ code: roomCode, nickname: undefined });
      } catch (error) {
        console.warn('Failed to join room', error);
      }
    })();
  }, [hasLeft, joinRoom, lobby, roomCode, user]);

  useEffect(() => {
    if (hasLeft) return;
    if (!lobby) return;
    if (lobby.room.status !== 'lobby') {
      setHasLeft(true);
      router.replace({ pathname: '/party/play', params: { roomId: lobby.room._id } });
      return;
    }
  }, [hasLeft, lobby, router]);

  const handleStart = useCallback(async () => {
    if (!roomId) return;
    if (pendingAction) {
      Alert.alert('이미 예약된 작업이 있어요');
      return;
    }
    try {
      await startRoom({ roomId, delayMs: resolveDelayMs });
    } catch (error) {
      Alert.alert('시작 실패', error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }, [pendingAction, resolveDelayMs, roomId, startRoom]);

  const handleCancelPending = useCallback(async () => {
    if (!roomId) return;
    try {
      await cancelPendingAction({ roomId });
    } catch (error) {
      Alert.alert('취소 실패', error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }, [cancelPendingAction, roomId]);

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
      </View>

      <View style={styles.participantSection}>
        <ThemedText style={styles.sectionTitle}>참가자 ({participants.length})</ThemedText>
        {participants.length === 0 ? (
          <ThemedText style={styles.emptyText}>아직 참가자가 없어요.</ThemedText>
        ) : (
          participants.map((participant) => (
            <View key={participant.userId} style={styles.participantRow}>
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
          {/* <View style={styles.delayPresetRow}>
            <ThemedText style={styles.delayLabel}>카운트다운</ThemedText>
            <Pressable
              style={[styles.delayChip, selectedDelay === 'rapid' ? styles.delayChipActive : null]}
              onPress={() => setSelectedDelay('rapid')}
            >
              <ThemedText style={[styles.delayChipText, selectedDelay === 'rapid' ? styles.delayChipTextActive : null]}>Rapid 2초</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.delayChip, selectedDelay === 'standard' ? styles.delayChipActive : null]}
              onPress={() => setSelectedDelay('standard')}
            >
              <ThemedText style={[styles.delayChipText, selectedDelay === 'standard' ? styles.delayChipTextActive : null]}>Standard 3초</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.delayChip, selectedDelay === 'chill' ? styles.delayChipActive : null]}
              onPress={() => setSelectedDelay('chill')}
            >
              <ThemedText style={[styles.delayChipText, selectedDelay === 'chill' ? styles.delayChipTextActive : null]}>Chill 5초</ThemedText>
            </Pressable>
          </View> */}
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
  delayPresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
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
