import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TextInput as RNTextInput } from 'react-native';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SKILL_ASSESSMENT_CHALLENGE } from '@/constants/challenges';
import { DAILY_CATEGORY_ICONS, DailyCategory, resolveDailyCategoryCopy } from '@/constants/daily';
import { Colors, Palette, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDailyQuiz } from '@/hooks/use-daily-quiz';
import { extractJoinErrorMessage, useCreateLiveMatchRoom, useJoinLiveMatchRoom } from '@/hooks/use-live-match-room';
import { useAuth } from '@/hooks/use-unified-auth';
import { getDeckIcon } from '@/lib/deck-icons';
import { deriveGuestNickname } from '@/lib/guest';
import type { RecentLiveMatchDeck, RecentSwipeCategory } from '@/lib/recent-selections';
import { loadRecentLiveMatchDeck, loadRecentSwipeCategory } from '@/lib/recent-selections';

function formatTimeLeft(target: Date) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return '00:00:00';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const { status: authStatus, user, guestKey, ensureGuestKey, isReady } = useAuth();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const dailyQuiz = useDailyQuiz();
  const joinLiveMatchRoom = useJoinLiveMatchRoom();
  const createLiveMatchRoom = useCreateLiveMatchRoom();
  const [timeLeft, setTimeLeft] = useState(() => {
    const nextReset = new Date();
    nextReset.setHours(24, 0, 0, 0);
    return formatTimeLeft(nextReset);
  });
  const [liveMatchRoomCode, setLiveMatchRoomCode] = useState('');
  const [joinNickname, setJoinNickname] = useState(user?.handle ?? '');
  const [isJoining, setIsJoining] = useState(false);
  const [isClearingStorage, setIsClearingStorage] = useState(false);
  const [isQuickCreating, setIsQuickCreating] = useState(false);
  const joinNicknameInputRef = useRef<RNTextInput | null>(null);
  const [recentSwipeCategory, setRecentSwipeCategory] = useState<RecentSwipeCategory | null>(null);
  const [recentLiveMatchDeck, setRecentLiveMatchDeck] = useState<RecentLiveMatchDeck | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      setTimeLeft(formatTimeLeft(tomorrow));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const palette = Colors[colorScheme ?? 'light'];
  const cardBackground = palette.card;
  const borderColor = palette.borderStrong;
  const muted = palette.textMuted;
  const subtle = palette.textSubtle;
  const textColor = palette.text;
  const isCodeValid = useMemo(() => liveMatchRoomCode.trim().length === 6, [liveMatchRoomCode]);

  const isLoadingDailyQuiz = dailyQuiz === undefined;
  const hasDailyQuiz = Boolean(dailyQuiz);
  const [isDailyCompleted, setIsDailyCompleted] = useState(false);
  const [dailyXpEarned, setDailyXpEarned] = useState<number | null>(null);

  const dailyCategoryCopy = useMemo(
    () => resolveDailyCategoryCopy(dailyQuiz?.category),
    [dailyQuiz?.category]
  );

  const dailyHeadline = useMemo<{
    state: 'loading' | 'ready' | 'pending';
    prefix: string;
    category: { label: string; icon: IconSymbolName } | null;
    suffix: string;
  }>(() => {
    if (isLoadingDailyQuiz) {
      return { state: 'loading', prefix: '', category: null, suffix: '' };
    }
    if (hasDailyQuiz) {
      const label = dailyCategoryCopy?.label ?? '오늘의 퀴즈';
      const icon: IconSymbolName = dailyQuiz?.category
        ? DAILY_CATEGORY_ICONS[dailyQuiz.category as DailyCategory] ?? 'sparkles'
        : 'sparkles';
      return {
        state: 'ready',
        prefix: '오늘의 카테고리는',
        category: { label, icon },
        suffix: '',
      };
    }
    return { state: 'pending', prefix: '오늘의 퀴즈가 준비 중이에요', category: null, suffix: '' };
  }, [
    dailyCategoryCopy?.label,
    dailyQuiz?.category,
    hasDailyQuiz,
    isLoadingDailyQuiz,
  ]);

  const dailyCTA = hasDailyQuiz
    ? isDailyCompleted
      ? `완료! +${dailyXpEarned} XP 💪`
      : '시작하기'
    : isLoadingDailyQuiz
      ? '불러오는 중'
      : '준비 중';
  const dailyHeadlineSkeletonColor = colorScheme === 'dark' ? palette.border : Palette.gray100;

  const isAuthenticated = authStatus === 'authenticated' && !!user;
  const isGuest = authStatus === 'guest';

  useEffect(() => {
    const loadCompletion = async () => {
      if (!dailyQuiz?.availableDate) {
        setIsDailyCompleted(false);
        setDailyXpEarned(null);
        return;
      }
      const dateKey = dailyQuiz.availableDate;
      const completionKey = `daily:completed:${dateKey}`;
      const xpKey = `daily:xp:${dateKey}`;
      const [flag, xp] = await Promise.all([
        AsyncStorage.getItem(completionKey),
        AsyncStorage.getItem(xpKey),
      ]);
      setIsDailyCompleted(flag === '1');
      setDailyXpEarned(xp ? Number(xp) : null);
    };
    loadCompletion();
  }, [dailyQuiz?.availableDate]);

  // const handleAppleLogin = useCallback(() => {
  //   Alert.alert('Apple 로그인', 'Apple 로그인은 준비 중이에요. 잠시만 기다려 주세요!');
  // }, []);

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
    if (!isFocused) return;
    void (async () => {
      const [category, deck] = await Promise.all([
        loadRecentSwipeCategory(),
        loadRecentLiveMatchDeck(),
      ]);
      setRecentSwipeCategory(category);
      setRecentLiveMatchDeck(deck);
    })();
  }, [isFocused]);

  useEffect(() => {
    if (!derivedGuestNickname) return;
    setJoinNickname((prev) =>
      prev === derivedGuestNickname || prev.length > 0 ? prev : derivedGuestNickname
    );
  }, [derivedGuestNickname]);

  useEffect(() => {
    if (!isAuthenticated || !user?.handle) return;
    setJoinNickname((prev) => (prev.length === 0 ? user.handle : prev));
  }, [isAuthenticated, user?.handle]);

  const handleJoinLiveMatchRoom = useCallback(async () => {
    const normalizedCode = liveMatchRoomCode.trim().toUpperCase();
    if (normalizedCode.length !== 6) {
      Alert.alert('입력 오류', '초대 코드를 정확히 입력해주세요.');
      return;
    }

    setIsJoining(true);
    try {
      const needsGuestKey = authStatus !== 'authenticated' || isReady === false;
      const guestKeyValue = needsGuestKey ? guestKey ?? (await ensureGuestKey()) : undefined;
      await joinLiveMatchRoom({
        code: normalizedCode,
        nickname: joinNickname.trim() || undefined,
        guestKey: guestKeyValue,
      });
      router.replace(`/room/${normalizedCode}`);
    } catch (error) {
      const message = extractJoinErrorMessage(error);
      Alert.alert('참가 실패', message);
    } finally {
      setIsJoining(false);
    }
  }, [authStatus, ensureGuestKey, guestKey, isReady, joinNickname, joinLiveMatchRoom, liveMatchRoomCode, router]);

  const handleJoinLiveMatchRoomSubmit = useCallback(() => {
    if (!isCodeValid || isJoining) return;
    void handleJoinLiveMatchRoom();
  }, [handleJoinLiveMatchRoom, isCodeValid, isJoining]);

  const handleQuickStartSwipe = useCallback(() => {
    const slug = recentSwipeCategory?.slug;
    if (!slug) {
      router.push('/swipe');
      return;
    }
    router.push({ pathname: '/swipe', params: { category: slug } });
  }, [recentSwipeCategory?.slug, router]);

  const handleQuickCreateRoom = useCallback(async () => {
    if (isQuickCreating) return;
    if (!recentLiveMatchDeck?.id) {
      router.push('/live-match');
      return;
    }

    setIsQuickCreating(true);
    try {
      const needsGuestKey = authStatus !== 'authenticated' || isReady === false;
      const guestKeyValue = needsGuestKey ? guestKey ?? (await ensureGuestKey()) : undefined;
      const nickname = user?.handle ?? derivedGuestNickname ?? undefined;

      const result = await createLiveMatchRoom({
        deckId: recentLiveMatchDeck.id,
        nickname,
        guestKey: guestKeyValue,
      });

      router.replace(`/room/${result.code}`);
    } catch (error) {
      const message = extractJoinErrorMessage(error);
      Alert.alert('생성 실패', message);
    } finally {
      setIsQuickCreating(false);
    }
  }, [
    authStatus,
    createLiveMatchRoom,
    derivedGuestNickname,
    ensureGuestKey,
    guestKey,
    isReady,
    isQuickCreating,
    recentLiveMatchDeck?.id,
    router,
    user?.handle,
  ]);

  const handleClearAsyncStorage = useCallback(() => {
    if (isClearingStorage) return;
    Alert.alert(
      'AsyncStorage 초기화',
      '로컬에 저장된 모든 데이터를 삭제할까요? (되돌릴 수 없어요)',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화',
          style: 'destructive',
          onPress: async () => {
            setIsClearingStorage(true);
            try {
              await AsyncStorage.clear();
              Alert.alert('완료', 'AsyncStorage가 초기화되었습니다.');
            } catch (error) {
              console.warn('Failed to clear AsyncStorage', error);
              Alert.alert('실패', '초기화에 실패했어요. 다시 시도해 주세요.');
            } finally {
              setIsClearingStorage(false);
            }
          },
        },
      ]
    );
  }, [isClearingStorage]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: Spacing.xl + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <SectionHeader title="빠른 시작" tagline="최근 선택으로 바로 플레이" muted={muted} />
          <View style={[styles.quickStartCard, { backgroundColor: cardBackground, borderColor }]}>
            <View style={styles.quickStartRow}>
              <View style={styles.quickStartRowLeft}>
                <IconSymbol
                  name={(recentSwipeCategory?.icon as IconSymbolName) ?? 'rectangle.grid.2x2'}
                  size={24}
                  color={textColor}
                  style={Platform.OS === 'android' ? { marginTop: 1 } : undefined}
                />
                <View style={styles.quickStartRowText}>
                  <ThemedText type="defaultSemiBold">스와이프</ThemedText>
                  <ThemedText style={[styles.quickStartHint, { color: muted }]}>
                    {recentSwipeCategory?.title ?? '최근 카테고리 없음'}
                  </ThemedText>
                </View>
              </View>
              <Button
                variant="secondary"
                size="sm"
                rounded="full"
                onPress={handleQuickStartSwipe}
              >
                시작
              </Button>
            </View>

            <View style={styles.quickStartRow}>
              <View style={styles.quickStartRowLeft}>
                <IconSymbol
                  name={recentLiveMatchDeck?.slug ? getDeckIcon(recentLiveMatchDeck.slug) : 'sparkles'}
                  size={24}
                  color={textColor}
                  style={Platform.OS === 'android' ? { marginTop: 1 } : undefined}
                />
                <View style={styles.quickStartRowText}>
                  <ThemedText type="defaultSemiBold">퀴즈룸 생성</ThemedText>
                  <ThemedText style={[styles.quickStartHint, { color: muted }]}>
                    {recentLiveMatchDeck?.title ?? '최근 덱 없음'}
                  </ThemedText>
                </View>
              </View>
              <Button
                variant="default"
                size="sm"
                rounded="full"
                onPress={handleQuickCreateRoom}
                loading={isQuickCreating}
              >
                {recentLiveMatchDeck ? '생성' : '선택'}
              </Button>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="오늘의 퀴즈" tagline="60초 O/X 퀴즈" muted={muted} />
          <View
            style={[
              styles.dailyCard,
              { backgroundColor: cardBackground, borderColor },
            ]}
          >
            <View style={styles.dailyHeadlineContainer}>
              {dailyHeadline.state === 'loading' ? (
                <View
                  style={[
                    styles.dailyHeadlineSkeleton,
                    { backgroundColor: dailyHeadlineSkeletonColor },
                  ]}
                />
              ) : dailyHeadline.state === 'ready' && dailyHeadline.category ? (
                <View style={styles.dailyHeadlineRow}>
                  <ThemedText style={styles.dailyHeadline}>{dailyHeadline.prefix}</ThemedText>
                  <View
                    style={[
                      styles.dailyHeadlineBadge,
                      { borderColor, backgroundColor: palette.card },
                    ]}
                  >
                    <IconSymbol
                      name={dailyHeadline.category.icon}
                      size={20}
                      color={palette.text}
                    />
                    <ThemedText style={styles.dailyHeadlineBadgeLabel}>
                      {dailyHeadline.category.label}
                    </ThemedText>
                  </View>
                  {dailyHeadline.suffix ? (
                    <ThemedText style={styles.dailyHeadline}>{dailyHeadline.suffix}</ThemedText>
                  ) : null}
                </View>
              ) : (
                <ThemedText style={styles.dailyHeadline}>{dailyHeadline.prefix}</ThemedText>
              )}
            </View>
            {hasDailyQuiz ? (
              <Link href="/daily" asChild>
                <Button
                  variant="default"
                  size="lg"
                  rounded="full"
                  style={styles.primaryButton}
                >
                  {dailyCTA}
                </Button>
              </Link>
            ) : (
              <Button
                variant="default"
                size="lg"
                rounded="full"
                style={styles.primaryButton}
                loading={isLoadingDailyQuiz}
                disabled={!isLoadingDailyQuiz}
              >
                {dailyCTA}
              </Button>
            )}
            <View
              style={[
                styles.timerPill,
                { borderColor },
              ]}
            >
              <IconSymbol
                name='hourglass'
                size={18}
                color={textColor}
                style={Platform.OS === 'android' ? { transform: [{ translateY: 1 }] } : undefined}
              />
              <ThemedText style={styles.timerLabel}>
                {timeLeft}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="챌린지" tagline="특별 모드" muted={muted} />
          <View style={[styles.challengeCard, { backgroundColor: cardBackground, borderColor }]}>
            <View style={styles.challengeHeader}>
              <View style={styles.challengeTitleRow}>
                <IconSymbol name="lightbulb" size={18} color={palette.text} />
                <ThemedText style={styles.challengeTitle}>{SKILL_ASSESSMENT_CHALLENGE.title}</ThemedText>
              </View>
              <ThemedText style={[styles.challengeTagline, { color: muted }]}>
                {SKILL_ASSESSMENT_CHALLENGE.tagline}
              </ThemedText>
            </View>
            <View style={styles.challengePills}>
              {['16문항', '난이도 자동 조정'].map((label) => (
                <View
                  key={label}
                  style={[
                    styles.challengePill,
                    { backgroundColor: palette.cardElevated, borderColor },
                  ]}
                >
                  <ThemedText style={[styles.challengePillText, { color: palette.text }]}>
                    {label}
                  </ThemedText>
                </View>
              ))}
            </View>
            <Link href={SKILL_ASSESSMENT_CHALLENGE.route} asChild>
              <Button variant="default" size="lg" rounded="full" style={styles.primaryButton}>
                {SKILL_ASSESSMENT_CHALLENGE.ctaLabel}
              </Button>
            </Link>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="라이브 매치" tagline="친구들과 대결하기" muted={muted} />
          <View style={[styles.partyCard, { backgroundColor: cardBackground, borderColor }]}
          >
            <ThemedText style={styles.partyLabel}>초대 코드</ThemedText>
            <TextInput
              value={liveMatchRoomCode}
              onChangeText={(value) => setLiveMatchRoomCode(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
              placeholder="A1B2C3"
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              importantForAutofill="no"
              submitBehavior="submit"
              returnKeyType="next"
              onSubmitEditing={() => joinNicknameInputRef.current?.focus()}
              maxLength={6}
              style={[styles.partyInput, { backgroundColor: palette.background, borderColor, color: palette.text, letterSpacing: 4 }]}
              placeholderTextColor={muted}
              editable={!isJoining}
            />
            <TextInput
              ref={joinNicknameInputRef}
              value={joinNickname}
              onChangeText={setJoinNickname}
              placeholder="닉네임"
              maxLength={24}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="nickname"
              returnKeyType="done"
              onSubmitEditing={handleJoinLiveMatchRoomSubmit}
              editable={!isGuest}
              selectTextOnFocus={!isGuest}
              style={[
                styles.partyInput,
                { backgroundColor: palette.background, borderColor, color: palette.text },
                isGuest && { backgroundColor: palette.cardElevated, color: subtle },
              ]}
              placeholderTextColor={muted}
            />
            <Button
              variant="default"
              size="lg"
              rounded="full"
              style={styles.joinButton}
              textStyle={styles.joinButtonLabel}
              onPress={handleJoinLiveMatchRoom}
              disabled={!isCodeValid}
              loading={isJoining}
              fullWidth
            >
              {isJoining ? '참가 중…' : '참가하기'}
            </Button>
            <Link href="/live-match" asChild>
              <Button variant='ghost' rounded='full' rightIcon={<IconSymbol name='arrow.up.forward' size={16} color={textColor} />}>
                퀴즈룸 만들기
              </Button>
            </Link>
          </View>
        </View>

        {__DEV__ ? (
          <View style={styles.section}>
            <SectionHeader title="디버그" tagline="개발 중 전용 도구" muted={muted} />
            <View style={[styles.debugCard, { backgroundColor: cardBackground, borderColor }]}>
              <ThemedText style={styles.debugTitle}>AsyncStorage 초기화</ThemedText>
              <ThemedText style={[styles.debugDescription, { color: muted }]}>
                로컬에 저장된 온보딩, 세션 등 모든 값을 삭제합니다. 개발 중에만 사용하세요.
              </ThemedText>
              <Button
                variant="destructive"
                size="md"
                rounded="full"
                onPress={handleClearAsyncStorage}
                loading={isClearingStorage}
                disabled={isClearingStorage}
                style={styles.debugButton}
                textStyle={styles.debugButtonLabel}
              >
                AsyncStorage 초기화
              </Button>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function SectionHeader({ title, tagline, muted }: { title: string; tagline: string; muted: string }) {

  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText style={[styles.sectionTagline, { color: muted }]}>{tagline}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: Spacing.xl,
  },
  quickStartCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  quickStartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  quickStartRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  quickStartRowText: {
    flex: 1,
    gap: 2,
  },
  quickStartHint: {
    fontSize: 12,
  },
  avatarFrame: {
    width: 60,
    height: 60,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.gray100,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.gray600,
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '700',
  },
  section: {
    gap: Spacing.lg,
  },
  dailyCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
  },
  dailyHeadlineContainer: {
    gap: Spacing.xs,
  },
  dailyHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  dailyHeadline: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 26,
    flexShrink: 1,
  },
  dailyHeadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  dailyHeadlineBadgeLabel: {
    fontWeight: '600',
  },
  dailyHeadlineSkeleton: {
    width: '80%',
    height: 24,
    borderRadius: Radius.sm,
  },
  timerPill: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    width: '100%',
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  timerLabel: {
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 1,
    textAlign: 'center',
  },
  primaryButton: {
    width: '100%',
  },
  challengeCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  challengeHeader: {
    gap: Spacing.xs,
  },
  challengeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  challengeTagline: {
    fontSize: 14,
    fontWeight: '600',
  },
  challengePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  challengePill: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  challengePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTagline: {
    fontSize: 14,
  },
  partyCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  partyLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  partyInput: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    height: 52,
    paddingVertical: 12,
    paddingHorizontal: 18,
    fontSize: 18,
    textAlignVertical: 'center',
  },
  joinButton: {
    marginTop: Spacing.sm,
  },
  joinButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  debugCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  debugDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  debugButton: {
    alignSelf: 'flex-start',
  },
  debugButtonLabel: {
    fontWeight: '700',
  },
});
