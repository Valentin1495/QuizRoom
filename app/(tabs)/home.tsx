import { useQuery } from 'convex/react';
import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TextInput as RNTextInput } from 'react-native';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar, GuestAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DailyCategory, resolveDailyCategoryCopy } from '@/constants/daily';
import { Colors, Palette, Radius, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useJoinParty } from '@/lib/api';

const DAILY_CATEGORY_ICONS: Record<DailyCategory, IconSymbolName> = {
  tech_it: 'desktopcomputer',
  variety_reality: 'tv',
  drama_movie: 'film.fill',
  sports_games: 'trophy.fill',
  kpop_music: 'music.note',
  fashion_life: 'bag.fill',
  news_issues: 'newspaper',
};

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
  const { status: authStatus, user, guestKey, ensureGuestKey } = useAuth();
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
  const joinNicknameInputRef = useRef<RNTextInput | null>(null);

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
  const isCodeValid = useMemo(() => partyCode.trim().length === 6, [partyCode]);

  const isLoadingDailyQuiz = dailyQuiz === undefined;
  const hasDailyQuiz = Boolean(dailyQuiz);

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
      const label = dailyCategoryCopy?.label ?? '데일리 퀴즈';
      const icon =
        (dailyQuiz?.category && DAILY_CATEGORY_ICONS[dailyQuiz.category as DailyCategory]) ?? 'sparkles';
      return {
        state: 'ready',
        prefix: '오늘의 카테고리는',
        category: { label, icon },
        suffix: '',
      };
    }
    return { state: 'pending', prefix: '데일리 퀴즈가 준비 중이에요', category: null, suffix: '' };
  }, [
    dailyCategoryCopy?.label,
    dailyQuiz?.category,
    hasDailyQuiz,
    isLoadingDailyQuiz,
  ]);

  const dailyCTA = hasDailyQuiz ? '시작하기' : isLoadingDailyQuiz ? '불러오는 중' : '준비 중';
  const dailyHeadlineSkeletonColor = colorScheme === 'dark' ? palette.border : Palette.gray100;

  const isAuthenticated = authStatus === 'authenticated' && !!user;
  const isGuest = authStatus === 'guest';
  const greetingName = isAuthenticated ? user.handle : '';


  // const handleAppleLogin = useCallback(() => {
  //   Alert.alert('Apple 로그인', 'Apple 로그인은 준비 중이에요. 잠시만 기다려 주세요!');
  // }, []);

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

  const handleJoinPartySubmit = useCallback(() => {
    if (!isCodeValid || isJoining) return;
    void handleJoinParty();
  }, [handleJoinParty, isCodeValid, isJoining]);

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
        <View
          style={[
            styles.welcomeCard,
            { backgroundColor: cardBackground, borderColor },
          ]}
        >
          {isAuthenticated && user?.avatarUrl ? (
            <Avatar
              uri={user.avatarUrl}
              size="lg"
              radius={Radius.pill}
            />
          ) : (
            <GuestAvatar
              size="lg"
              radius={Radius.pill}
            />
          )}
          <View style={styles.welcomeText}>
            <ThemedText type="subtitle" style={styles.welcomeGreeting}>
              안녕하세요. {greetingName}
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="데일리 퀴즈" tagline="60초 OX 퀴즈" muted={muted} />
          <View
            style={[
              styles.dailyCard,
              { backgroundColor: cardBackground, borderColor },
            ]}
          >
            <View style={styles.dailyHeadlineContainer}>
              {dailyHeadline.state === 'loading' ? (
                <View style={styles.dailyHeadlineSkeletonWrapper}>
                  <View
                    style={[
                      styles.dailyHeadlineSkeletonPrimary,
                      { backgroundColor: dailyHeadlineSkeletonColor },
                    ]}
                  />
                  <View
                    style={[
                      styles.dailyHeadlineSkeletonSecondary,
                      { backgroundColor: dailyHeadlineSkeletonColor },
                    ]}
                  />
                </View>
              ) : (
                <>
                  {dailyHeadline.state === 'ready' && dailyHeadline.category ? (
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
                </>
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
              <ThemedText style={styles.timerLabel}>
                {timeLeft} 남음
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="라이브 매치" tagline="친구들과 대결하기" muted={muted} />
          <View style={[styles.partyCard, { backgroundColor: cardBackground, borderColor }]}
          >
            <ThemedText style={styles.partyLabel}>초대 코드</ThemedText>
            <TextInput
              value={partyCode}
              onChangeText={(value) => setPartyCode(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
              placeholder="ABCDEF"
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              importantForAutofill="no"
              blurOnSubmit={false}
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
              onSubmitEditing={handleJoinPartySubmit}
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
              onPress={handleJoinParty}
              disabled={!isCodeValid}
              loading={isJoining}
              fullWidth
            >
              {isJoining ? '참여 중…' : '파티 참여'}
            </Button>
            <Link href="/(tabs)/party" asChild>
              <Button variant='ghost' rounded='full' pressedStyle={{ backgroundColor: palette.card }} rightIcon={<IconSymbol name='arrow.right' size={16} color={textColor} />}>
                새 파티 만들기
              </Button>
            </Link>
          </View>
        </View>
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
  welcomeCard: {
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
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
  welcomeText: {
    alignItems: 'center',
  },
  welcomeGreeting: {
    textAlign: 'center',
  },
  section: {
    gap: Spacing.lg,
  },
  dailyCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1.5,
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
  dailyHeadlineSkeletonWrapper: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  dailyHeadlineSkeletonPrimary: {
    width: '80%',
    height: 24,
    borderRadius: Radius.sm,
  },
  dailyHeadlineSkeletonSecondary: {
    width: '55%',
    height: 16,
    borderRadius: Radius.sm,
  },
  timerPill: {
    borderWidth: 1.5,
    borderRadius: Radius.pill,
    width: '100%',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTagline: {
    fontSize: 14,
  },
  partyCard: {
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  partyLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  partyInput: {
    borderWidth: 1.5,
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
});
