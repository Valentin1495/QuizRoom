import { useQuery } from 'convex/react';
import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { resolveDailyCategoryCopy } from '@/constants/daily';
import { Colors, Palette, Radius, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useJoinParty } from '@/lib/api';

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
  const { status: authStatus, user, signInWithGoogle, guestKey, ensureGuestKey } = useAuth();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const dailyQuiz = useQuery(api.daily.getDailyQuiz, {});
  const joinParty = useJoinParty();
  const [timeLeft, setTimeLeft] = useState(() => {
    const nextReset = new Date();
    nextReset.setHours(24, 0, 0, 0);
    return formatTimeLeft(nextReset);
  });
  const [partyCode, setPartyCode] = useState('');
  const [joinNickname, setJoinNickname] = useState(user?.handle ?? '');
  const [isJoining, setIsJoining] = useState(false);
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
  const borderColor = palette.border;
  const muted = useThemeColor({}, 'textMuted');

  const isCodeValid = useMemo(() => partyCode.trim().length === 6, [partyCode]);

  const isLoadingDailyQuiz = dailyQuiz === undefined;
  const hasDailyQuiz = Boolean(dailyQuiz);

  const dailyCategoryCopy = useMemo(
    () => resolveDailyCategoryCopy(dailyQuiz?.category),
    [dailyQuiz?.category]
  );

  const dailyTitleLabel = useMemo(() => {
    const emoji = dailyQuiz?.shareTemplate?.emoji ?? '⚡';
    const categoryLabel = dailyCategoryCopy?.label ?? '데일리 블링크';
    return `${emoji} 오늘의 ${categoryLabel}`;
  }, [dailyCategoryCopy, dailyQuiz?.shareTemplate?.emoji]);

  const dailyHeadline = useMemo(() => {
    if (isLoadingDailyQuiz) {
      return '오늘의 퀴즈를 불러오는 중…';
    }
    if (dailyQuiz?.shareTemplate?.headline) {
      return dailyQuiz.shareTemplate.headline;
    }
    if (hasDailyQuiz) {
      return '오늘의 5문제, 스트릭을 이어가세요!';
    }
    return '오늘의 퀴즈가 준비 중이에요';
  }, [dailyQuiz?.shareTemplate?.headline, hasDailyQuiz, isLoadingDailyQuiz]);

  const dailyCTA = hasDailyQuiz ? '오늘의 퀴즈 시작' : isLoadingDailyQuiz ? '불러오는 중' : '준비 중';
  const dailyCaption = useMemo(() => {
    if (isLoadingDailyQuiz) {
      return '잠시만 기다려주세요.';
    }
    if (hasDailyQuiz && dailyQuiz?.category) {
      return `카테고리 · ${dailyCategoryCopy?.label ?? dailyQuiz.category}`;
    }
    return '새 퀴즈가 곧 공개됩니다.';
  }, [dailyCategoryCopy?.label, dailyQuiz?.category, hasDailyQuiz, isLoadingDailyQuiz]);

  const isAuthenticated = authStatus === 'authenticated' && !!user;
  const isGuest = authStatus === 'guest';
  const isAuthorizing = authStatus === 'authorizing';
  const greetingName = isAuthenticated ? user.handle : '게스트';
  const streakValue = isAuthenticated ? user.streak : null;
  const streakLabel =
    streakValue !== null && streakValue > 0
      ? `🔥 ${streakValue}일 연속 도전!`
      : '🔥 오늘 퀴즈로 스트릭을 시작해봐요!';

  const handleGoogleLogin = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      Alert.alert(
        '로그인에 실패했어요',
        error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.'
      );
    }
  }, [signInWithGoogle]);

  const handleAppleLogin = useCallback(() => {
    Alert.alert('Apple 로그인', 'Apple 로그인은 준비 중이에요. 잠시만 기다려 주세요!');
  }, []);

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
    setJoinNickname((prev) =>
      prev === derivedGuestNickname || prev.length > 0 ? prev : derivedGuestNickname
    );
  }, [derivedGuestNickname]);

  useEffect(() => {
    if (!isAuthenticated || !user?.handle) return;
    setJoinNickname((prev) => (prev.length === 0 ? user.handle : prev));
  }, [isAuthenticated, user?.handle]);

  const handleJoinParty = useCallback(async () => {
    const normalizedCode = partyCode.trim().toUpperCase();
    if (normalizedCode.length !== 6) {
      Alert.alert('입력 오류', '초대 코드를 정확히 입력해주세요.');
      return;
    }

    setIsJoining(true);
    try {
      const guestKeyValue =
        isGuest ? guestKey ?? (await ensureGuestKey()) : undefined;
      await joinParty({
        code: normalizedCode,
        nickname: joinNickname.trim() || undefined,
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
  }, [ensureGuestKey, guestKey, isGuest, joinNickname, joinParty, partyCode, router]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: Spacing.xl + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.welcomeCard, { backgroundColor: cardBackground, borderColor }]}>
          <View style={styles.welcomeRow}>
            <View style={styles.avatarFrame}>
              {isAuthenticated && user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <ThemedText style={styles.avatarInitial} lightColor="#ffffff" darkColor="#ffffff">
                    {isAuthenticated ? user.handle.slice(0, 1).toUpperCase() : '🙂'}
                  </ThemedText>
                </View>
              )}
            </View>
            <View style={styles.welcomeText}>
              <ThemedText type="subtitle">안녕, {greetingName} 👋</ThemedText>
              <ThemedText style={styles.streakText}>{streakLabel}</ThemedText>
            </View>
          </View>
        </View>

        {!isAuthenticated ? (
          <View style={[styles.guestBanner, { borderColor, backgroundColor: palette.card }]}>
            <ThemedText type="subtitle">로그인하고 내 기록을 저장하세요</ThemedText>
            <ThemedText style={[styles.bannerHelper, { color: muted }]}>
              맞힌 문제, 스트릭, 배지를 모두 모아볼 수 있어요.
            </ThemedText>
            <View style={styles.bannerActions}>
              <Pressable
                style={[styles.bannerButton, styles.bannerButtonPrimary]}
                onPress={handleGoogleLogin}
                disabled={isAuthorizing}
              >
                <ThemedText style={styles.bannerButtonLabel} lightColor="#ffffff" darkColor="#ffffff">
                  {isAuthorizing ? '로그인 중…' : 'Google 로그인'}
                </ThemedText>
              </Pressable>
              {/* <Pressable
                style={[styles.bannerButton, styles.bannerButtonSecondary]}
                onPress={handleAppleLogin}
              >
                <ThemedText style={styles.bannerButtonLabel}>Apple로 로그인</ThemedText>
              </Pressable> */}
            </View>
          </View>
        ) : null}

        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <ThemedText type="title">QuizRoom</ThemedText>
            <ThemedText style={[styles.subtitle, { color: muted }]}>60초 안에 즐기는 오늘의 퀴즈</ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.dailyCard, { backgroundColor: cardBackground }]}>
            <ThemedText type="subtitle" style={styles.dailyTitle} lightColor={Palette.coral600} darkColor={Palette.coral600}>
              {dailyTitleLabel}
            </ThemedText>
            <ThemedText style={styles.dailyHeadline}>
              {dailyHeadline}
            </ThemedText>
            <ThemedText style={[styles.dailyCategory, { color: muted }]}>
              {dailyCaption}
            </ThemedText>
            <View style={styles.timerPill}>
              <ThemedText style={styles.timerLabel} lightColor={Palette.teal600} darkColor={Palette.teal600}>
                {timeLeft} 남음
              </ThemedText>
            </View>
            {hasDailyQuiz ? (
              <Link href="/daily" asChild>
                <Pressable style={styles.primaryButton}>
                  <ThemedText style={styles.primaryButtonLabel} lightColor="#ffffff" darkColor="#ffffff">
                    {dailyCTA}
                  </ThemedText>
                </Pressable>
              </Link>
            ) : (
              <Pressable style={[styles.primaryButton, styles.primaryDisabled]} disabled>
                <ThemedText style={styles.primaryButtonLabel} lightColor="#ffffff" darkColor="#ffffff">
                  {dailyCTA}
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="스와이프 퀴즈" tagline="빠르게 취향 테스트" />
          <View style={[styles.swipeCard, { backgroundColor: cardBackground, borderColor }]}>
            <ThemedText type="subtitle">스와이프로 퀴즈 고르기</ThemedText>
            <ThemedText style={[styles.swipeBody, { color: muted }]}>
              덱을 쓱 넘기고 오늘의 퀴즈를 바로 시작해보세요.
            </ThemedText>
            <Link href="/swipe" asChild>
              <Pressable style={styles.swipeButton}>
                <ThemedText style={styles.swipeButtonLabel} lightColor="#ffffff" darkColor="#ffffff">
                  스와이프 시작
                </ThemedText>
              </Pressable>
            </Link>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="파티 라이브" tagline="친구들과 붙어보기" />
          <View style={[styles.partyCard, { backgroundColor: cardBackground, borderColor }]}
          >
            <ThemedText style={styles.partyLabel}>초대 코드</ThemedText>
            <TextInput
              value={partyCode}
              onChangeText={(value) => setPartyCode(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
              placeholder="ABCDEF"
              autoCapitalize="characters"
              maxLength={6}
              style={[styles.partyInput, { borderColor }]}
              placeholderTextColor={muted}
              editable={!isJoining}
            />
            <TextInput
              value={joinNickname}
              onChangeText={setJoinNickname}
              placeholder="닉네임 (선택)"
              maxLength={24}
              editable={!isGuest}
              selectTextOnFocus={!isGuest}
              style={[
                styles.partyNicknameInput,
                { borderColor },
                isGuest && styles.partyNicknameInputDisabled,
              ]}
              placeholderTextColor={muted}
            />
            <Pressable
              onPress={handleJoinParty}
              disabled={!isCodeValid || isJoining}
              style={[
                styles.joinButton,
                (!isCodeValid || isJoining) && styles.joinButtonDisabled,
              ]}
            >
              <ThemedText
                style={styles.joinButtonLabel}
                lightColor={!isCodeValid || isJoining ? Palette.slate500 : '#ffffff'}
                darkColor={!isCodeValid || isJoining ? Palette.slate500 : '#ffffff'}
              >
                {isJoining ? '참여 중…' : '파티 참여'}
              </ThemedText>
            </Pressable>
            <Link href="/(tabs)/party" asChild>
              <Pressable style={styles.secondaryLink}>
                <ThemedText style={styles.secondaryLinkLabel} lightColor={Palette.teal600} darkColor={Palette.teal400}>
                  새 파티 만들기 →
                </ThemedText>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function SectionHeader({ title, tagline }: { title: string; tagline: string }) {
  const muted = useThemeColor({}, 'textMuted');
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
  welcomeCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarFrame: {
    width: 60,
    height: 60,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.yellow200,
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
    backgroundColor: Palette.yellow600,
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '700',
  },
  welcomeText: {
    flex: 1,
    gap: Spacing.xs,
  },
  streakText: {
    fontWeight: '600',
    color: Palette.yellow600,
  },
  guestBanner: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  bannerHelper: {
    fontSize: 14,
  },
  bannerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  bannerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  bannerButtonPrimary: {
    backgroundColor: Palette.teal600,
  },
  bannerButtonSecondary: {
    backgroundColor: Palette.surfaceMuted,
  },
  bannerButtonLabel: {
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: Spacing.xs,
  },
  subtitle: {
    fontSize: 16,
  },
  section: {
    gap: Spacing.lg,
  },
  dailyCard: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.lg,
    borderWidth: 2,
    borderColor: Palette.coral200,
  },
  dailyTitle: {
    letterSpacing: 1,
  },
  dailyHeadline: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  dailyCategory: {
    fontSize: 13,
    fontWeight: '500',
  },
  timerPill: {
    backgroundColor: Palette.teal200,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  timerLabel: {
    fontWeight: '600',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: Palette.coral600,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryDisabled: {
    opacity: 0.6,
  },
  primaryButtonLabel: {
    fontSize: 16,
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
  swipeCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  swipeBody: {
    fontSize: 14,
  },
  swipeButton: {
    marginTop: Spacing.sm,
    backgroundColor: Palette.teal600,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  swipeButtonLabel: {
    fontWeight: '600',
    fontSize: 16,
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
    paddingVertical: 12,
    paddingHorizontal: 18,
    fontSize: 18,
    letterSpacing: 4,
  },
  partyNicknameInput: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 18,
    fontSize: 16,
  },
  partyNicknameInputDisabled: {
    backgroundColor: Palette.surfaceMuted,
    color: Palette.slate500,
  },
  joinButton: {
    backgroundColor: Palette.teal600,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  joinButtonDisabled: {
    backgroundColor: Palette.teal200,
  },
  joinButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryLink: {
    paddingVertical: 4,
  },
  secondaryLinkLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
