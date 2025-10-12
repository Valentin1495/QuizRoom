import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@/hooks/use-auth';
import { useMutation } from 'convex/react';

export default function PartyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [partyCode, setPartyCode] = useState('');
  const [nickname, setNickname] = useState(user?.handle ?? '');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const createRoom = useMutation(api.rooms.create);
  const joinRoom = useMutation(api.rooms.join);

  const normalizedCode = useMemo(() => partyCode.trim().toUpperCase(), [partyCode]);
  const normalizedNickname = useMemo(() => nickname.trim(), [nickname]);
  const isJoinEnabled = normalizedCode.length === 6;

  const handleCreateParty = useCallback(async () => {
    setIsCreating(true);
    try {
      const result = await createRoom({ deckId: undefined, nickname: normalizedNickname || undefined });
      router.push(`/room/${result.code}`);
    } catch (err) {
      Alert.alert('파티 생성 실패', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  }, [createRoom, normalizedNickname, router]);

  const handleJoinParty = useCallback(async () => {
    if (!isJoinEnabled) {
      Alert.alert('입력 오류', '초대 코드를 정확히 입력해주세요.');
      return;
    }
    setIsJoining(true);
    try {
      await joinRoom({ code: normalizedCode, nickname: normalizedNickname || undefined });
      router.push(`/room/${normalizedCode}`);
    } catch (error) {
      let message = '코드를 확인하거나 방이 이미 시작되었는지 확인해주세요.';
      if (error instanceof Error) {
        message =
          error.message === 'ROOM_FULL'
            ? '파티가 가득 찼어요. 다른 방을 찾아주세요.'
            : error.message;
      }
      Alert.alert('참여 실패', message);
    } finally {
      setIsJoining(false);
    }
  }, [isJoinEnabled, joinRoom, normalizedCode, normalizedNickname, router]);

  return (
    <ThemedView
      style={[styles.container, { paddingTop: insets.top + Spacing.lg, paddingBottom: Spacing.xl + insets.bottom }]}
    >
      <View style={styles.header}>
        <ThemedText type="title">파티 라이브</ThemedText>
        <ThemedText style={styles.headerSubtitle}>친구들과 실시간 퀴즈 배틀을 즐겨보세요.</ThemedText>
      </View>

      <View style={styles.card}>
        <ThemedText style={styles.cardTitle}>방 참여</ThemedText>
        <ThemedText style={styles.cardDescription}>초대 코드를 입력하고 닉네임을 정해주세요.</ThemedText>
        <TextInput
          value={partyCode}
          onChangeText={(value) => setPartyCode(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
          placeholder="ABC123"
          autoCapitalize="characters"
          maxLength={6}
          style={styles.codeInput}
          placeholderTextColor={Palette.slate500}
        />
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder="닉네임 (선택)"
          maxLength={24}
          style={styles.nicknameInput}
          placeholderTextColor={Palette.slate500}
        />
        <Pressable
          onPress={handleJoinParty}
          disabled={isJoining || !isJoinEnabled}
          style={[styles.primaryButton, (!isJoinEnabled || isJoining) && styles.primaryButtonDisabled]}
        >
          <ThemedText style={styles.primaryButtonLabel} lightColor="#ffffff" darkColor="#ffffff">
            {isJoining ? '참여 중...' : '파티 참여'}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.card}>
        <ThemedText style={styles.cardTitle}>새 파티 만들기</ThemedText>
      <ThemedText style={styles.cardDescription}>방을 열고 친구들에게 초대 코드를 공유하세요.</ThemedText>
      <TextInput
        value={nickname}
        onChangeText={setNickname}
        placeholder="호스트 닉네임"
        maxLength={24}
        style={styles.nicknameInput}
        placeholderTextColor={Palette.slate500}
      />
      <Pressable
        onPress={handleCreateParty}
        disabled={isCreating}
          style={[styles.secondaryButton, isCreating && styles.secondaryButtonDisabled]}
        >
          <ThemedText style={styles.secondaryButtonLabel} lightColor="#ffffff" darkColor="#ffffff">
            {isCreating ? '생성 중...' : '새 파티 만들기'}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },
  header: {
    gap: Spacing.sm,
  },
  headerSubtitle: {
    color: Palette.slate500,
  },
  card: {
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(91, 46, 255, 0.12)',
    gap: Spacing.md,
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 18,
  },
  cardDescription: {
    color: Palette.slate500,
    fontSize: 14,
  },
  codeInput: {
    borderWidth: 1,
    borderColor: 'rgba(91, 46, 255, 0.35)',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 18,
    letterSpacing: 4,
    color: Palette.slate900,
    backgroundColor: '#ffffff',
  },
  nicknameInput: {
    borderWidth: 1,
    borderColor: 'rgba(91, 46, 255, 0.2)',
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Palette.slate900,
    backgroundColor: '#ffffff',
  },
  primaryButton: {
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.purple600,
  },
  primaryButtonDisabled: {
    backgroundColor: Palette.purple200,
  },
  primaryButtonLabel: {
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.pink500,
  },
  secondaryButtonDisabled: {
    opacity: 0.7,
  },
  secondaryButtonLabel: {
    fontWeight: '600',
    fontSize: 16,
  },
});
