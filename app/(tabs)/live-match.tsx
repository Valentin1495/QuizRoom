import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type LayoutRectangle, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PullRefreshCompleteStrip, PullRefreshStretchHeader } from '@/components/common/pull-refresh-reveal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Palette, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLiveMatchDecks } from '@/hooks/use-live-match-decks';
import { extractJoinErrorMessage, useCreateLiveMatchRoom, useJoinLiveMatchRoom } from '@/hooks/use-live-match-room';
import { usePullRefreshReveal } from '@/hooks/use-pull-refresh-reveal';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-unified-auth';
import { getDeckIcon } from '@/lib/deck-icons';
import { deriveGuestNickname } from '@/lib/guest';

const HIDDEN_HEADER_OPTIONS = { headerShown: false } as const;
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export default function LiveMatchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, status, guestKey, ensureGuestKey, isReady } = useAuth();
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const mutedColor = useThemeColor({}, 'textMuted');
  const subtleColor = useThemeColor({}, 'textSubtle');

  const [liveMatchRoomCode, setLiveMatchRoomCode] = useState('');
  const [joinNickname, setJoinNickname] = useState(user?.handle ?? '');
  const [hostNickname, setHostNickname] = useState(user?.handle ?? '');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const randomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const randomIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAutoNicknameRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const keyboardHeightRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const createSectionLayoutRef = useRef<LayoutRectangle | null>(null);
  const createButtonLayoutRef = useRef<LayoutRectangle | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const createLiveMatchRoom = useCreateLiveMatchRoom();
  const joinLiveMatchRoom = useJoinLiveMatchRoom();
  const { decks: liveMatchDecks, isLoading: isDecksLoading } = useLiveMatchDecks({ refreshKey });
  const isGuest = status === 'guest' && !user;

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

  const applyAutoNickname = useCallback((nickname: string) => {
    setJoinNickname((prev) => (prev && prev !== lastAutoNicknameRef.current ? prev : nickname));
    setHostNickname((prev) => (prev && prev !== lastAutoNicknameRef.current ? prev : nickname));
    lastAutoNicknameRef.current = nickname;
  }, []);

  useEffect(() => {
    if (!derivedGuestNickname) return;
    applyAutoNickname(derivedGuestNickname);
  }, [applyAutoNickname, derivedGuestNickname]);

  useEffect(() => {
    if (!user?.handle) return;
    applyAutoNickname(user.handle);
  }, [applyAutoNickname, user?.handle]);

  const lastStatusRef = useRef<typeof status | null>(null);
  useEffect(() => {
    const prevStatus = lastStatusRef.current;
    lastStatusRef.current = status;
    if (status !== 'authenticated' || !user?.handle) return;
    if (prevStatus && prevStatus !== 'authenticated') {
      setJoinNickname(user.handle);
      setHostNickname(user.handle);
      lastAutoNicknameRef.current = user.handle;
    }
  }, [status, user?.handle]);

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

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardHeightRef.current = event.endCoordinates?.height ?? 0;
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardHeightRef.current = 0;
      setKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollToCreateSection = useCallback(() => {
    if (!scrollRef.current) return;
    const viewportHeight = scrollViewHeightRef.current;
    const section = createSectionLayoutRef.current;
    if (!viewportHeight || !section) return;
    const button = createButtonLayoutRef.current;
    const visibleHeight = Math.max(0, viewportHeight - keyboardHeightRef.current);
    if (!visibleHeight) return;
    const targetBottom =
      button
        ? section.y + button.y + button.height + Spacing.xxl
        : section.y + section.height + Spacing.xxl;
    const nextY = Math.max(0, targetBottom - visibleHeight);
    scrollRef.current.scrollTo({ y: nextY, animated: true });
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
      const needsGuestKey = status !== 'authenticated' || isReady === false;
      const guestKeyValue = needsGuestKey ? guestKey ?? (await ensureGuestKey()) : undefined;
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
  }, [createLiveMatchRoom, ensureGuestKey, guestKey, isReady, normalizedHostNickname, router, selectedDeckId, status, user]);

  const handleJoinLiveMatchRoom = useCallback(async () => {
    if (!isJoinEnabled) {
      Alert.alert('입력 오류', '초대 코드를 정확히 입력해주세요.');
      return;
    }
    setIsJoining(true);
    try {
      const needsGuestKey = status !== 'authenticated' || isReady === false;
      const guestKeyValue = needsGuestKey ? guestKey ?? (await ensureGuestKey()) : undefined;
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
  }, [ensureGuestKey, guestKey, isJoinEnabled, isReady, joinLiveMatchRoom, normalizedCode, normalizedJoinNickname, router, status]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    const refreshStartedAt = Date.now();
    const MIN_REFRESH_INDICATOR_MS = 1000;
    setIsRefreshing(true);
    try {
      if (isGuest && !guestKey) {
        await ensureGuestKey();
      }
      setRefreshKey((prev) => prev + 1);
      const elapsed = Date.now() - refreshStartedAt;
      if (elapsed < MIN_REFRESH_INDICATOR_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_REFRESH_INDICATOR_MS - elapsed));
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [ensureGuestKey, guestKey, isGuest, isRefreshing]);

  const pullRefresh = usePullRefreshReveal({
    isRefreshing,
    onRefresh: handleRefresh,
  });

  return (
    <>
      <Stack.Screen options={HIDDEN_HEADER_OPTIONS} />
      <ThemedView style={styles.screen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          style={styles.keyboardAvoiding}
        >
          <PullRefreshCompleteStrip
            visible={pullRefresh.showCompletion}
            top={insets.top + Spacing.sm}
            color={themeColors.primary}
            textColor={mutedColor}
            backgroundColor={cardBackground}
            borderColor={cardBorder}
          />
          <PullRefreshStretchHeader
            visible={pullRefresh.showStretchHeader}
            top={insets.top + Spacing.xs}
            distance={pullRefresh.distance}
            progress={pullRefresh.progress}
            label={pullRefresh.label}
            isRefreshing={isRefreshing}
            color={themeColors.primary}
            textColor={mutedColor}
            backgroundColor={cardBackground}
            borderColor={cardBorder}
          />
          <GestureDetector gesture={pullRefresh.gesture}>
            <Animated.View style={[styles.scrollWrapper, pullRefresh.containerAnimatedStyle]}>
              <AnimatedScrollView
                ref={scrollRef}
                onLayout={(event) => {
                  scrollViewHeightRef.current = event.nativeEvent.layout.height;
                }}
                contentContainerStyle={[
                  styles.container,
                  {
                    paddingTop: insets.top + Spacing.lg,
                    paddingBottom: keyboardVisible ? 0 : Spacing.xl + insets.bottom,
                  },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                bounces
                alwaysBounceVertical
                contentInsetAdjustmentBehavior="never"
                onScroll={pullRefresh.onScroll}
                scrollEventThrottle={pullRefresh.scrollEventThrottle}
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
              onLayout={(event) => {
                createSectionLayoutRef.current = event.nativeEvent.layout;
              }}
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
                onFocus={() => {
                  scrollToCreateSection();
                  requestAnimationFrame(scrollToCreateSection);
                  setTimeout(scrollToCreateSection, 180);
                }}
              />
              <View
                onLayout={(event) => {
                  createButtonLayoutRef.current = event.nativeEvent.layout;
                }}
              >
                <Button
                  size="lg"
                  onPress={handleCreateLiveMatchRoom}
                  disabled={isCreating || isRandomizing || isDecksLoading || !selectedDeckId}
                  loading={isCreating}
                >
                  생성하기
                </Button>
              </View>
            </View>
              </AnimatedScrollView>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  scrollWrapper: {
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
