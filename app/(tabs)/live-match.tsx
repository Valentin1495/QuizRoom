import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Palette, Radius, Spacing } from '@/constants/theme';
import type { Id } from '@/convex/_generated/dataModel';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { extractJoinErrorMessage, useCreateLiveMatchRoom, useJoinLiveMatchRoom, useLiveMatchDecks } from '@/lib/api';
import { getDeckIcon } from '@/lib/deck-icons';
import { deriveGuestNickname } from '@/lib/guest';

export default function LiveMatchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, status, guestKey, ensureGuestKey } = useAuth();
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const mutedColor = useThemeColor({}, 'textMuted');
  const subtleColor = useThemeColor({}, 'textSubtle');

  const [liveMatchRoomCode, setLiveMatchRoomCode] = useState('');
  const [joinNickname, setJoinNickname] = useState(user?.handle ?? '');
  const [hostNickname, setHostNickname] = useState(user?.handle ?? '');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<Id<'liveMatchDecks'> | null>(null);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const randomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const randomIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createLiveMatchRoom = useCreateLiveMatchRoom();
  const joinLiveMatchRoom = useJoinLiveMatchRoom();
  const { decks: liveMatchDecks, isLoading: isDecksLoading } = useLiveMatchDecks();
  const isGuest = status === 'guest';

  const normalizedCode = useMemo(() => liveMatchRoomCode.trim().toUpperCase(), [liveMatchRoomCode]);
  const normalizedJoinNickname = useMemo(() => joinNickname.trim(), [joinNickname]);
  const normalizedHostNickname = useMemo(() => hostNickname.trim(), [hostNickname]);
  const isJoinEnabled = normalizedCode.length === 6;

  const cardBackground = themeColors.card;
  const cardBorder = themeColors.borderStrong ?? themeColors.border;
  const inputBackground = colorScheme === 'dark' ? themeColors.cardElevated : themeColors.card;
  const inputDisabledBackground = themeColors.cardElevated;
  const inputBorder = themeColors.border;
  const deckOptionBorder = themeColors.border;
  const deckOptionBackground = colorScheme === 'dark' ? themeColors.cardElevated : themeColors.card;
  const deckOptionSelectedBorder = themeColors.primary;
  const deckOptionSelectedBackground =
    colorScheme === 'dark' ? 'rgba(229,229,229,0.12)' : Palette.gray25;
  const deckEmptyTextColor = mutedColor;
  useEffect(() => {
    if (!isDecksLoading && liveMatchDecks.length > 0 && !selectedDeckId) {
      setSelectedDeckId(liveMatchDecks[0].id);
    }
  }, [isDecksLoading, liveMatchDecks, selectedDeckId]);

  useEffect(() => {
    if (isGuest && !guestKey) {
      void ensureGuestKey();
    }
  }, [ensureGuestKey, guestKey, isGuest]);

  const derivedGuestNickname = useMemo(
    () => (isGuest ? deriveGuestNickname(guestKey) : null),
    [guestKey, isGuest]
  );

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
    if (isDecksLoading || liveMatchDecks.length === 0 || isRandomizing) return;
    setIsRandomizing(true);
    let currentIndex = -1;
    randomIntervalRef.current = setInterval(() => {
      const next = Math.floor(Math.random() * liveMatchDecks.length);
      if (next === currentIndex) {
        return;
      }
      currentIndex = next;
      setSelectedDeckId(liveMatchDecks[currentIndex].id);
    }, 120);
    randomTimeoutRef.current = setTimeout(() => {
      if (randomIntervalRef.current) {
        clearInterval(randomIntervalRef.current);
        randomIntervalRef.current = null;
      }
      const finalPick = liveMatchDecks[Math.floor(Math.random() * liveMatchDecks.length)];
      setSelectedDeckId(finalPick.id);
      setIsRandomizing(false);
    }, 1000);
  }, [isDecksLoading, isRandomizing, liveMatchDecks]);

  const handleCreateLiveMatchRoom = useCallback(async () => {
    if (status === 'authenticated' && !user) {
      Alert.alert('로그인이 필요해요', '퀴즈룸을 생성하려면 로그인 후 다시 시도해주세요.');
      return;
    }
    setIsCreating(true);
    try {
      const guestKeyValue =
        status === 'guest'
          ? guestKey ?? (await ensureGuestKey())
          : undefined;
      const result = await createLiveMatchRoom({
        deckId: selectedDeckId ?? undefined,
        nickname: normalizedHostNickname || undefined,
        guestKey: guestKeyValue,
      });
      router.replace(`/room/${result.code}`);
    } catch (err) {
      Alert.alert('퀴즈룸 생성 실패', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  }, [createLiveMatchRoom, ensureGuestKey, guestKey, normalizedHostNickname, router, selectedDeckId, status, user]);

  const handleJoinLiveMatchRoom = useCallback(async () => {
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
      await joinLiveMatchRoom({
        code: normalizedCode,
        nickname: normalizedJoinNickname || undefined,
        guestKey: guestKeyValue,
      });
      router.replace(`/room/${normalizedCode}`);
    } catch (error) {
      const message = extractJoinErrorMessage(error);
      Alert.alert('입장 실패', message);
    } finally {
      setIsJoining(false);
    }
  }, [ensureGuestKey, guestKey, isJoinEnabled, joinLiveMatchRoom, normalizedCode, normalizedJoinNickname, router, status]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
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
            <ThemedText type="title">라이브 매치</ThemedText>
            <ThemedText style={[styles.headerSubtitle, { color: mutedColor }]}>
              친구들과 실시간 퀴즈 배틀을 즐겨보세요
            </ThemedText>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: cardBackground, borderColor: cardBorder },
            ]}
          >
            <ThemedText style={styles.cardTitle}>퀴즈룸 입장</ThemedText>
            <ThemedText style={[styles.cardDescription, { color: mutedColor }]}>
              초대 코드를 입력하고 닉네임을 정해주세요
            </ThemedText>
            <TextInput
              value={liveMatchRoomCode}
              onChangeText={(value) => setLiveMatchRoomCode(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
              placeholder="A1B2C3"
              autoCapitalize="characters"
              maxLength={6}
              style={[
                styles.codeInput,
                {
                  borderColor: inputBorder,
                  backgroundColor: inputBackground,
                  color: themeColors.text,
                },
              ]}
              placeholderTextColor={mutedColor}
            />
            <TextInput
              value={joinNickname}
              onChangeText={setJoinNickname}
              placeholder="닉네임"
              maxLength={24}
              editable={!isGuest}
              selectTextOnFocus={!isGuest}
              style={[
                styles.nicknameInput,
                {
                  borderColor: inputBorder,
                  backgroundColor: inputBackground,
                  color: themeColors.text,
                },
                isGuest && {
                  backgroundColor: inputDisabledBackground,
                  color: subtleColor,
                },
              ]}
              placeholderTextColor={mutedColor}
            />
            <Button
              variant='secondary'
              onPress={handleJoinLiveMatchRoom}
              disabled={isJoining || !isJoinEnabled}
              loading={isJoining}
              size="lg"
            >
              입장하기
            </Button>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: cardBackground, borderColor: cardBorder },
            ]}
          >
            <ThemedText style={styles.cardTitle}>퀴즈룸 생성</ThemedText>
            <ThemedText style={[styles.cardDescription, { color: mutedColor }]}>
              새 퀴즈룸을 열고 친구들에게 초대 코드를 공유하세요
            </ThemedText>
            <View style={styles.deckSectionHeader}>
              <ThemedText style={styles.deckSectionTitle}>덱 선택</ThemedText>
            </View>
            <View style={styles.deckList}>
              {isDecksLoading ? (
                <View style={styles.deckLoading}>
                  <ActivityIndicator color={themeColors.primary} />
                </View>
              ) : liveMatchDecks.length > 0 ? (
                liveMatchDecks.map((deck) => {
                  const isSelected = deck.id === selectedDeckId;
                  const platformCardStyle: ViewStyle =
                    Platform.OS === 'ios'
                      ? {
                        shadowColor: themeColors.primary,
                        shadowOpacity: isSelected ? 0.25 : 0,
                        shadowRadius: isSelected ? 12 : 0,
                        shadowOffset: { width: 0, height: isSelected ? 6 : 0 },
                      }
                      : {};
                  return (
                    <Pressable
                      key={deck.id}
                      onPress={() => !isRandomizing && setSelectedDeckId(deck.id)}
                      disabled={isRandomizing}
                      style={[
                        styles.deckOption,
                        {
                          borderColor: isSelected ? deckOptionSelectedBorder : deckOptionBorder,
                          backgroundColor: isSelected
                            ? deckOptionSelectedBackground
                            : deckOptionBackground,
                          borderWidth: isSelected ? 1.5 : 1,
                          transform: [{ scale: isSelected ? 1.02 : 1 }],
                        },
                        platformCardStyle,
                      ]}
                    >
                      <View style={styles.deckOptionHeader}>
                        <IconSymbol
                          name={getDeckIcon(deck.slug)}
                          size={20}
                          color={isSelected ? themeColors.primary : themeColors.text}
                        />
                        <ThemedText
                          style={styles.deckOptionTitle}
                          lightColor={themeColors.text}
                          darkColor={themeColors.text}
                        >
                          {deck.title}
                        </ThemedText>
                      </View>
                      <ThemedText style={[styles.deckOptionDescription, { color: mutedColor }]}>
                        {deck.description}
                      </ThemedText>
                    </Pressable>
                  );
                })
              ) : (
                <ThemedText style={[styles.deckEmptyText, { color: deckEmptyTextColor }]}>
                  사용 가능한 덱이 없습니다.
                </ThemedText>
              )}
            </View>
            <Button
              variant="outline"
              onPress={handleRandomDeck}
              disabled={isRandomizing || isDecksLoading || liveMatchDecks.length === 0}
              loading={isRandomizing}
              leftIcon={
                <IconSymbol
                  name="shuffle"
                  size={18}
                  color={themeColors.text}
                  style={Platform.OS === 'android' ? { marginTop: 2 } : undefined}
                />
              }
            >
              셔플하기
            </Button>

            <ThemedText style={styles.deckSectionTitle}>닉네임 입력</ThemedText>
            <TextInput
              value={hostNickname}
              onChangeText={setHostNickname}
              placeholder="호스트 닉네임"
              maxLength={24}
              editable={!isGuest}
              selectTextOnFocus={!isGuest}
              style={[
                styles.nicknameInput,
                {
                  borderColor: inputBorder,
                  backgroundColor: inputBackground,
                  color: themeColors.text,
                },
                isGuest && {
                  backgroundColor: inputDisabledBackground,
                  color: subtleColor,
                },
              ]}
              placeholderTextColor={mutedColor}
            />
            <Button
              size="lg"
              onPress={handleCreateLiveMatchRoom}
              disabled={isCreating || (!isDecksLoading && !selectedDeckId)}
              loading={isCreating}
            >
              생성하기
            </Button>
          </View>
        </ScrollView>
      </ThemedView>
    </>
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
    fontSize: 14,
  },
  card: {
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 18,
  },
  cardDescription: {
    fontSize: 14,
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 18,
    letterSpacing: 4,
  },
  nicknameInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    height: 48,
    textAlignVertical: 'center',
  },
  deckSectionHeader: {
    gap: Spacing.xs,
  },
  deckSectionSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    width: '100%',
  },
  deckSectionSubtitleSelected: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  deckSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  deckSectionSubtitle: {
    fontSize: 13,
  },
  deckList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  deckLoading: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  deckOption: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    flexBasis: '48%',
    flexGrow: 1,
  },
  deckOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  deckOptionTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  deckOptionDescription: {
    fontSize: 13,
  },
  deckEmptyText: {
    fontSize: 13,
  },
});
