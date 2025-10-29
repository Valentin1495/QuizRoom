import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Radius, Spacing } from '@/constants/theme';
import type { Id } from '@/convex/_generated/dataModel';
import { useAuth } from '@/hooks/use-auth';
import { useCreateParty, useJoinParty, usePartyDecks } from '@/lib/api';

export default function PartyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, status, guestKey, ensureGuestKey } = useAuth();

  const [partyCode, setPartyCode] = useState('');
  const [joinNickname, setJoinNickname] = useState(user?.handle ?? '');
  const [hostNickname, setHostNickname] = useState(user?.handle ?? '');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<Id<'partyDecks'> | null>(null);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const randomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const randomIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createParty = useCreateParty();
  const joinParty = useJoinParty();
  const { decks: partyDecks, isLoading: isDecksLoading } = usePartyDecks();
  const isGuest = status === 'guest';

  const normalizedCode = useMemo(() => partyCode.trim().toUpperCase(), [partyCode]);
  const normalizedJoinNickname = useMemo(() => joinNickname.trim(), [joinNickname]);
  const normalizedHostNickname = useMemo(() => hostNickname.trim(), [hostNickname]);
  const isJoinEnabled = normalizedCode.length === 6;
  const selectedDeck = useMemo(
    () => partyDecks.find((deck) => deck.id === selectedDeckId) ?? null,
    [partyDecks, selectedDeckId]
  );

  useEffect(() => {
    if (!isDecksLoading && partyDecks.length > 0 && !selectedDeckId) {
      setSelectedDeckId(partyDecks[0].id);
    }
  }, [isDecksLoading, partyDecks, selectedDeckId]);

  useEffect(() => {
    if (isGuest && !guestKey) {
      void ensureGuestKey();
    }
  }, [ensureGuestKey, guestKey, isGuest]);

  const derivedGuestNickname = useMemo(() => {
    if (!isGuest || !guestKey) return null;
    const suffix = guestKey.slice(-4).toUpperCase().padStart(4, '0');
    return `Guest ${suffix}`;
  }, [guestKey, isGuest]);

  useEffect(() => {
    if (!derivedGuestNickname) return;
    setJoinNickname((prev) => (prev === derivedGuestNickname ? prev : derivedGuestNickname));
    setHostNickname((prev) => (prev === derivedGuestNickname ? prev : derivedGuestNickname));
  }, [derivedGuestNickname]);

  useEffect(() => {
    return () => {
      if (randomTimeoutRef.current) {
        clearTimeout(randomTimeoutRef.current);
      }
      if (randomIntervalRef.current) {
        clearInterval(randomIntervalRef.current);
      }
    };
  }, []);

  const handleRandomDeck = useCallback(() => {
    if (isDecksLoading || partyDecks.length === 0 || isRandomizing) return;
    setIsRandomizing(true);
    let currentIndex = -1;
    randomIntervalRef.current = setInterval(() => {
      const next = Math.floor(Math.random() * partyDecks.length);
      if (next === currentIndex) {
        return;
      }
      currentIndex = next;
      setSelectedDeckId(partyDecks[currentIndex].id);
    }, 120);
    randomTimeoutRef.current = setTimeout(() => {
      if (randomIntervalRef.current) {
        clearInterval(randomIntervalRef.current);
        randomIntervalRef.current = null;
      }
      const finalPick = partyDecks[Math.floor(Math.random() * partyDecks.length)];
      setSelectedDeckId(finalPick.id);
      setIsRandomizing(false);
    }, 1000);
  }, [isDecksLoading, isRandomizing, partyDecks]);

  const handleCreateParty = useCallback(async () => {
    if (status === 'authenticated' && !user) {
      Alert.alert('로그인이 필요해요', '파티를 만들려면 로그인 후 다시 시도해주세요.');
      return;
    }
    setIsCreating(true);
    try {
      const guestKeyValue =
        status === 'guest'
          ? guestKey ?? (await ensureGuestKey())
          : undefined;
      const result = await createParty({
        deckId: selectedDeckId ?? undefined,
        nickname: normalizedHostNickname || undefined,
        guestKey: guestKeyValue,
      });
      router.replace(`/room/${result.code}`);
    } catch (err) {
      Alert.alert('파티 생성 실패', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  }, [createParty, ensureGuestKey, guestKey, normalizedHostNickname, router, selectedDeckId, status, user]);

  const handleJoinParty = useCallback(async () => {
    if (!isJoinEnabled) {
      Alert.alert('입력 오류', '초대 코드를 정확히 입력해주세요.');
      return;
    }
    setIsJoining(true);
    try {
      const guestKeyValue =
        status === 'guest'
          ? guestKey ?? (await ensureGuestKey())
          : undefined;
      await joinParty({
        code: normalizedCode,
        nickname: normalizedJoinNickname || undefined,
        guestKey: guestKeyValue,
      });
      router.replace(`/room/${normalizedCode}`);
    } catch (error) {
      let message = '코드를 확인하거나 방이 이미 시작되었는지 확인해주세요.';
      if (error instanceof Error) {
        message = error.message.includes('ROOM_FULL')
          ? '파티가 가득 찼어요. 다른 방을 찾아주세요.'
          : error.message.includes('REJOIN_NOT_ALLOWED')
            ? '퀴즈 진행 중에는 다시 입장할 수 없어요. 게임이 끝난 뒤 다시 시도해 주세요.'
            : error.message;
      }
      Alert.alert('참여 실패', message);
    } finally {
      setIsJoining(false);
    }
  }, [ensureGuestKey, guestKey, isJoinEnabled, joinParty, normalizedCode, normalizedJoinNickname, router, status]);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: Spacing.xl + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
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
            value={joinNickname}
            onChangeText={setJoinNickname}
            placeholder="닉네임 (선택)"
            maxLength={24}
            editable={!isGuest}
            selectTextOnFocus={!isGuest}
            style={[styles.nicknameInput, isGuest && styles.nicknameInputDisabled]}
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
          <View style={styles.deckSectionHeader}>
            <ThemedText style={styles.deckSectionTitle}>덱 선택</ThemedText>
            {selectedDeck ? (
              <ThemedText style={styles.deckSectionSubtitle}>
                {selectedDeck.emoji} {selectedDeck.title}
              </ThemedText>
            ) : null}
          </View>
          <Pressable
            style={[styles.randomButton, isRandomizing && styles.randomButtonActive]}
            onPress={handleRandomDeck}
            disabled={isRandomizing || isDecksLoading || partyDecks.length === 0}
          >
            {isRandomizing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <ThemedText style={styles.randomButtonLabel} lightColor="#ffffff" darkColor="#ffffff">
                랜덤으로 추천받기 🎲
              </ThemedText>
            )}
          </Pressable>
          <View style={styles.deckList}>
            {isDecksLoading ? (
              <ActivityIndicator color={Palette.teal600} />
            ) : partyDecks.length > 0 ? (
              partyDecks.map((deck) => {
                const isSelected = deck.id === selectedDeckId;
                return (
                  <Pressable
                    key={deck.id}
                    onPress={() => !isRandomizing && setSelectedDeckId(deck.id)}
                    disabled={isRandomizing}
                    style={[styles.deckOption, isSelected && styles.deckOptionSelected]}
                  >
                    <ThemedText style={styles.deckOptionTitle}>
                      {deck.emoji} {deck.title}
                    </ThemedText>
                    <ThemedText style={styles.deckOptionDescription}>{deck.description}</ThemedText>
                  </Pressable>
                );
              })
            ) : (
              <ThemedText style={styles.deckEmptyText}>사용 가능한 덱이 없습니다.</ThemedText>
            )}
          </View>
          <TextInput
            value={hostNickname}
            onChangeText={setHostNickname}
            placeholder="호스트 닉네임"
            maxLength={24}
            editable={!isGuest}
            selectTextOnFocus={!isGuest}
            style={[styles.nicknameInput, isGuest && styles.nicknameInputDisabled]}
            placeholderTextColor={Palette.slate500}
          />
          <Pressable
            onPress={handleCreateParty}
            disabled={isCreating || (!isDecksLoading && !selectedDeckId)}
            style={[
              styles.secondaryButton,
              (isCreating || (!isDecksLoading && !selectedDeckId)) && styles.secondaryButtonDisabled,
            ]}
          >
            <ThemedText style={styles.secondaryButtonLabel} lightColor="#ffffff" darkColor="#ffffff">
              {isCreating ? '생성 중...' : '새 파티 만들기'}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
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
    backgroundColor: 'rgba(0, 194, 168, 0.08)',
    borderWidth: 2,
    borderColor: Palette.teal200,
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
    borderColor: Palette.teal400,
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
    borderColor: Palette.teal200,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Palette.slate900,
    backgroundColor: '#ffffff',
  },
  nicknameInputDisabled: {
    backgroundColor: Palette.slate200,
    color: Palette.slate500,
  },
  primaryButton: {
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.teal600,
  },
  primaryButtonDisabled: {
    backgroundColor: Palette.teal200,
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
    backgroundColor: Palette.coral600,
  },
  secondaryButtonDisabled: {
    opacity: 0.7,
  },
  secondaryButtonLabel: {
    fontWeight: '600',
    fontSize: 16,
  },
  randomButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.teal600,
  },
  randomButtonActive: {
    opacity: 0.7,
  },
  randomButtonLabel: {
    fontWeight: '600',
    fontSize: 14,
  },
  deckSectionHeader: {
    gap: Spacing.xs,
  },
  deckSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  deckSectionSubtitle: {
    color: Palette.slate500,
    fontSize: 13,
  },
  deckList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  deckOption: {
    borderWidth: 1,
    borderColor: Palette.teal200,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#ffffff',
    gap: Spacing.xs,
    flexBasis: '48%',
    flexGrow: 1,
  },
  deckOptionSelected: {
    borderColor: Palette.teal600,
    backgroundColor: 'rgba(0, 194, 168, 0.12)',
  },
  deckOptionTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  deckOptionDescription: {
    color: Palette.slate500,
    fontSize: 13,
  },
  deckEmptyText: {
    color: Palette.slate500,
    fontSize: 13,
  },
});
