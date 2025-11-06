import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar, GuestAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { categories } from '@/constants/categories';
import { resolveDailyCategoryCopy } from '@/constants/daily';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme, useColorSchemeManager } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useQuery } from 'convex/react';

type AuthedUser = NonNullable<ReturnType<typeof useAuth>['user']>;
type QuizHistoryDoc = Doc<'quizHistory'>;
type HistoryBuckets = (typeof api.history.listHistory)['_returnType'];

export default function ProfileScreen() {
  const { status, user, signOut, signInWithGoogle, guestKey, ensureGuestKey } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const mutedColor = useThemeColor({}, 'textMuted');

  const isLoading = status === 'loading';
  const isAuthorizing = status === 'authorizing' || status === 'upgrading';
  const isAuthenticated = status === 'authenticated' && !!user;
  const history = useQuery(
    api.history.listHistory,
    status === 'authenticated' ? { limit: 10 } : 'skip'
  );

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;

    try {
      setIsSigningOut(true);
      await signOut();
    } catch (error) {
      Alert.alert(
        '로그아웃에 실패했어요',
        error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.'
      );
    } finally {
      setIsSigningOut(false);
    }
  }, [isSigningOut, signOut]);

  const handleShareCard = useCallback(() => {
    Alert.alert('공유 카드', '퀴즈 공유 카드는 곧 제공될 예정이에요!');
  }, []);

  const handleEditProfile = useCallback(() => {
    Alert.alert('프로필 편집', '프로필 편집 화면은 아직 준비 중이에요.');
  }, []);

  const handleAppleLogin = useCallback(() => {
    Alert.alert('Apple 로그인', 'Apple 로그인은 준비 중이에요. 잠시만 기다려 주세요!');
  }, []);

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

  useEffect(() => {
    if (status === 'guest' && !guestKey) {
      void ensureGuestKey();
    }
  }, [ensureGuestKey, guestKey, status]);

  const guestAvatarId = useMemo(() => {
    if (!guestKey) return undefined;
    const suffix = guestKey.slice(-4);
    const parsed = parseInt(suffix, 16);
    if (Number.isNaN(parsed)) return undefined;
    return parsed % 100;
  }, [guestKey]);

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={themeColors.primary} />
        <ThemedText style={[styles.loadingLabel, { color: mutedColor }]}>
          프로필을 불러오는 중이에요...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isAuthenticated && user ? (
          <ProfileHeader user={user} onEdit={handleEditProfile} onShare={handleShareCard} />
        ) : (
          <GuestHeader
            onGoogleLogin={handleGoogleLogin}
            onAppleLogin={handleAppleLogin}
            isLoading={isAuthorizing}
            guestId={guestAvatarId}
          />
        )}

        <ThemePreferencesCard />

        <QuizHistoryPanel
          isAuthenticated={isAuthenticated}
          history={history}
          onLogin={handleGoogleLogin}
          loginLoading={isAuthorizing}
        />

        <FooterSection
          isAuthenticated={isAuthenticated}
          onSignOut={handleSignOut}
          isSigningOut={isSigningOut}
          onSupport={() =>
            Alert.alert('문의하기', 'valentink1495@gmail.com으로 연락해주세요.')
          }
          onPolicy={() => Alert.alert('약관 및 정책', '약관 화면은 곧 추가될 예정입니다.')}
          onLogin={handleGoogleLogin}
          loginLoading={isAuthorizing}
        />
      </ScrollView>
    </ThemedView>
  );
}

function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const cardColor = useThemeColor({}, 'card');
  const cardBorder = useThemeColor({}, 'border');
  return (
    <View style={[styles.card, { backgroundColor: cardColor, borderColor: cardBorder }, style]}>
      {children}
    </View>
  );
}

function ProfileHeader({
  user,
  onEdit,
  onShare,
}: {
  user: AuthedUser;
  onEdit: () => void;
  onShare: () => void;
}) {
  const statusLine =
    user.streak > 0
      ? `🔥 연속 ${user.streak}일 출석 중`
      : '퀴즈에 도전하고 스트릭을 쌓아보세요!';
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const mutedColor = useThemeColor({}, 'textMuted');
  const fallbackBackground = themeColors.primary;

  return (
    <Card>
      <View style={styles.headerRow}>
        <Avatar
          uri={user.avatarUrl}
          name={user.handle}
          size="xl"
          radius={Radius.pill}
          backgroundColorOverride={fallbackBackground}
        />
        <View style={styles.headerContent}>
          <ThemedText type="subtitle">{user.handle}</ThemedText>
          <ThemedText style={[styles.statusText, { color: mutedColor }]}>{statusLine}</ThemedText>
        </View>
      </View>
      <View style={styles.headerActions}>
        <Button
          onPress={onEdit}
          variant="secondary"
          fullWidth
        >
          프로필 편집
        </Button>
        {/* <ActionButton label="공유 카드 보기" tone="secondary" onPress={onShare} /> */}
      </View>
    </Card>
  );
}

function GuestHeader({
  onGoogleLogin,
  onAppleLogin,
  isLoading,
  guestId,
}: {
  onGoogleLogin: () => void;
  onAppleLogin: () => void;
  isLoading: boolean;
  guestId?: number;
}) {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const mutedColor = useThemeColor({}, 'textMuted');
  const guestAvatarBorder = themeColors.border;

  return (
    <Card>
      <View style={styles.headerRow}>
        <GuestAvatar
          guestId={guestId}
          size="xl"
          radius={Radius.lg}
          style={{ borderColor: guestAvatarBorder }}
        />
        <View style={styles.headerContent}>
          <ThemedText type="subtitle">게스트 사용자</ThemedText>
          <ThemedText style={[styles.statusText, { color: mutedColor }]}>
            로그인하고 나만의 퀴즈 히스토리를 쌓아보세요!
          </ThemedText>
        </View>
      </View>
      <View style={styles.headerActions}>
        <Button
          onPress={onGoogleLogin}
          loading={isLoading}
          disabled={isLoading}
          fullWidth
          variant='secondary'
        >
          Google 로그인
        </Button>
        {/* <ActionButton label="Apple 로그인" tone="secondary" onPress={onAppleLogin} /> */}
      </View>
    </Card>
  );
}

function GuestHistoryPlaceholder({
  onLogin,
  loginLoading,
}: {
  onLogin: () => void;
  loginLoading: boolean;
}) {
  const textColor = useThemeColor({}, 'text');
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];

  const PlaceholderRow = () => (
    <View
      style={[
        styles.historyRow,
        { backgroundColor: themeColors.cardElevated, borderColor: themeColors.border },
      ]}
    >
      <View
        style={[
          styles.placeholderLine,
          { backgroundColor: textColor, opacity: 0.08, width: '40%' },
        ]}
      />
      <View
        style={[
          styles.placeholderLine,
          { backgroundColor: textColor, opacity: 0.08, width: '70%', marginTop: Spacing.xs },
        ]}
      />
    </View>
  );

  return (
    <View style={styles.guestHistoryContainer}>
      <View style={styles.guestHistoryContent}>
        <View style={styles.historySection}>
          <ThemedText style={styles.historySectionTitle}>데일리 퀴즈</ThemedText>
          <View style={styles.historyList}>
            {[1].map((i) => (
              <PlaceholderRow key={i} />
            ))}
          </View>
        </View>
        <View style={styles.historySection}>
          <ThemedText style={styles.historySectionTitle}>스와이프</ThemedText>
          <View style={styles.historyList}>
            {[1, 2].map((i) => (
              <PlaceholderRow key={i} />
            ))}
          </View>
        </View>
        <BlurView
          pointerEvents="none"
          style={styles.guestHistoryBlur}
          intensity={8}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          experimentalBlurMethod='dimezisBlurView'
        />
      </View>

      <View
        style={styles.modalDialogContainer}
      >
        <View style={styles.modalDialog}>
          <IconSymbol
            name="lock.fill"
            size={28}
            color={textColor}
            style={{ marginBottom: Spacing.sm }}
          />
          <ThemedText type="subtitle" style={{ textAlign: 'center', marginBottom: Spacing.xs }}>
            기록 잠금 해제
          </ThemedText>
          <ThemedText
            style={[
              { color: textColor, textAlign: 'center', marginBottom: Spacing.lg },
            ]}
          >
            로그인하고 나의 퀴즈 기록을 확인해보세요!
          </ThemedText>
          <Button
            onPress={onLogin}
            loading={loginLoading}
            disabled={loginLoading}
          >
            {loginLoading ? '로그인 중...' : 'Google 로그인'}
          </Button>
        </View>
      </View>
    </View>
  );
}

function QuizHistoryPanel({
  isAuthenticated,
  history,
  onLogin,
  loginLoading,
}: {
  isAuthenticated: boolean;
  history: HistoryBuckets | undefined;
  onLogin: () => void;
  loginLoading: boolean;
}) {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const mutedColor = useThemeColor({}, 'textMuted');

  if (!isAuthenticated) {
    return (
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg }}>
          <ThemedText type="subtitle">퀴즈 히스토리</ThemedText>
        </View>
        <GuestHistoryPlaceholder onLogin={onLogin} loginLoading={loginLoading} />
      </Card>
    );
  }

  if (history === undefined) {
    return (
      <Card>
        <View style={[styles.sectionStack, styles.historyLoading]}>
          <ActivityIndicator color={themeColors.primary} />
          <ThemedText style={[styles.statusText, { color: mutedColor }]}>
            기록을 불러오는 중이에요...
          </ThemedText>
        </View>
      </Card>
    );
  }

  const hasAny =
    history.daily.length > 0 || history.swipe.length > 0 || history.party.length > 0;

  if (!hasAny) {
    return (
      <Card>
        <View style={styles.sectionStack}>
          <ThemedText type="subtitle">퀴즈 히스토리</ThemedText>
          <ThemedText style={[styles.statusText, { color: mutedColor }]}>
            아직 저장된 기록이 없어요. 퀴즈를 플레이하면 여기에 기록이 쌓입니다.
          </ThemedText>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.sectionStack}>
        <ThemedText type="subtitle">퀴즈 히스토리</ThemedText>
        <HistorySection
          title="데일리 퀴즈"
          entries={history.daily}
          emptyLabel="데일리 퀴즈를 완료하고 결과를 확인해보세요."
          renderItem={(entry) => <DailyHistoryRow key={entry._id} entry={entry} />}
        />
        <HistorySection
          title="스와이프"
          entries={history.swipe}
          emptyLabel="스와이프 세션을 완주하고 결과를 확인해보세요."
          renderItem={(entry) => <SwipeHistoryRow key={entry._id} entry={entry} />}
        />
        <HistorySection
          title="라이브 매치"
          entries={history.party}
          emptyLabel="라이브 매치에 참여하고 결과를 확인해보세요."
          renderItem={(entry) => <PartyHistoryRow key={entry._id} entry={entry} />}
        />
      </View>
    </Card>
  );
}

function HistorySection({
  title,
  entries,
  renderItem,
  emptyLabel,
}: {
  title: string;
  entries: QuizHistoryDoc[];
  renderItem: (entry: QuizHistoryDoc) => ReactNode;
  emptyLabel: string;
}) {
  const mutedColor = useThemeColor({}, 'textMuted');

  return (
    <View style={styles.historySection}>
      <ThemedText style={styles.historySectionTitle}>{title}</ThemedText>
      {entries.length ? (
        <View style={styles.historyList}>{entries.map(renderItem)}</View>
      ) : (
        <ThemedText style={[styles.historyEmpty, { color: mutedColor }]}>{emptyLabel}</ThemedText>
      )}
    </View>
  );
}

type DailyHistoryPayload = {
  date: string;
  correct: number;
  total: number;
  timerMode?: string;
  durationMs?: number;
  category?: string;
};

type SwipeHistoryPayload = {
  category: string;
  tags?: string[];
  answered: number;
  correct: number;
  maxStreak: number;
  avgResponseMs: number;
  totalScoreDelta: number;
};

type PartyHistoryPayload = {
  deckSlug?: string;
  deckTitle?: string;
  roomCode?: string;
  rank?: number;
  totalParticipants?: number;
  totalScore: number;
  answered?: number;
  correct?: number;
};

function formatHistoryTimestamp(value: number) {
  return new Date(value).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSecondsLabel(ms?: number) {
  if (!ms) return null;
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}분 ${seconds}초` : `${minutes}분`;
  }
  return `${seconds}초`;
}

function formatAverageSeconds(ms: number) {
  const seconds = ms / 1000;
  if (seconds >= 10) {
    return `${seconds.toFixed(1)}초`;
  }
  return `${seconds.toFixed(2)}초`;
}

function computeAccuracy(correct: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

function DailyHistoryRow({ entry }: { entry: QuizHistoryDoc }) {
  const payload = entry.payload as DailyHistoryPayload;
  const accuracy = computeAccuracy(payload.correct, payload.total);
  const durationLabel = formatSecondsLabel(payload.durationMs);
  const modeLabel = payload.timerMode === 'timed' ? '타임어택 모드' : '자유 모드';
  const categoryLabel = payload.category
    ? resolveDailyCategoryCopy(payload.category)?.label ?? payload.category
    : null;
  const detailParts = [modeLabel];
  if (categoryLabel) {
    detailParts.push(`${categoryLabel}`);
  }
  if (durationLabel) {
    detailParts.push(durationLabel);
  }

  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const subtleColor = useThemeColor({}, 'textSubtle');

  return (
    <View
      style={[
        styles.historyRow,
        { backgroundColor: themeColors.cardElevated, borderColor: themeColors.border },
      ]}
    >
      <View style={styles.historyRowHeader}>
        <ThemedText style={styles.historyRowTitle}>{payload.date}</ThemedText>
        <ThemedText style={[styles.historyRowTimestamp, { color: subtleColor }]}>
          {formatHistoryTimestamp(entry.createdAt)}
        </ThemedText>
      </View>
      <ThemedText style={styles.historyRowSummary}>
        정답 {payload.correct}/{payload.total} · 정확도 {accuracy}%
      </ThemedText>
      <ThemedText style={[styles.historyRowDetail, { color: subtleColor }]}>
        {detailParts.join(' · ')}
      </ThemedText>
    </View>
  );
}

function SwipeHistoryRow({ entry }: { entry: QuizHistoryDoc }) {
  const payload = entry.payload as SwipeHistoryPayload;
  const accuracy = computeAccuracy(payload.correct, payload.answered);
  const avgSecondsLabel = formatAverageSeconds(payload.avgResponseMs);
  const categoryMeta = categories.find((category) => category.slug === payload.category);
  const categoryLabel = categoryMeta ? `${categoryMeta.emoji} ${categoryMeta.title}` : payload.category;

  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const subtleColor = useThemeColor({}, 'textSubtle');

  return (
    <View
      style={[
        styles.historyRow,
        { backgroundColor: themeColors.cardElevated, borderColor: themeColors.border },
      ]}
    >
      <View style={styles.historyRowHeader}>
        <ThemedText style={styles.historyRowTitle}>{categoryLabel}</ThemedText>
        <ThemedText style={[styles.historyRowTimestamp, { color: subtleColor }]}>
          {formatHistoryTimestamp(entry.createdAt)}
        </ThemedText>
      </View>
      <ThemedText style={styles.historyRowSummary}>
        정답 {payload.correct}/{payload.answered} · 정확도 {accuracy}% · 최고 {payload.maxStreak}연속
      </ThemedText>
      <ThemedText style={[styles.historyRowDetail, { color: subtleColor }]}>
        평균 반응속도 {avgSecondsLabel} · 점수{' '}
        {payload.totalScoreDelta >= 0 ? `+${payload.totalScoreDelta}` : payload.totalScoreDelta}
      </ThemedText>
    </View>
  );
}

function PartyHistoryRow({ entry }: { entry: QuizHistoryDoc }) {
  const payload = entry.payload as PartyHistoryPayload;
  const title = payload.deckTitle ?? '파티 매치';
  const rankLabel =
    payload.rank !== undefined
      ? `순위 #${payload.rank}${payload.totalParticipants ? `/${payload.totalParticipants}` : ''}`
      : '순위 정보 없음';
  const answeredLabel =
    payload.answered !== undefined && payload.answered !== null
      ? `${payload.answered}문항 참여`
      : null;

  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const subtleColor = useThemeColor({}, 'textSubtle');

  return (
    <View
      style={[
        styles.historyRow,
        { backgroundColor: themeColors.cardElevated, borderColor: themeColors.border },
      ]}
    >
      <View style={styles.historyRowHeader}>
        <ThemedText style={styles.historyRowTitle}>{title}</ThemedText>
        <ThemedText style={[styles.historyRowTimestamp, { color: subtleColor }]}>
          {formatHistoryTimestamp(entry.createdAt)}
        </ThemedText>
      </View>
      <ThemedText style={styles.historyRowSummary}>
        {rankLabel} · 총점 {payload.totalScore}점
      </ThemedText>
      <ThemedText style={[styles.historyRowDetail, { color: subtleColor }]}>
        {payload.roomCode ? `코드 ${payload.roomCode}` : '코드 정보 없음'}
        {answeredLabel ? ` · ${answeredLabel}` : ''}
      </ThemedText>
    </View>
  );
}

function FooterSection({
  isAuthenticated,
  onSignOut,
  isSigningOut,
  onSupport,
  onPolicy,
}: {
  isAuthenticated: boolean;
  onSignOut: () => void;
  isSigningOut: boolean;
  onSupport: () => void;
  onPolicy: () => void;
  onLogin: () => void;
  loginLoading: boolean;
}) {
  return (
    <>
      {isAuthenticated ? (
        <Card>
          <ThemedText type="subtitle">계정</ThemedText>
          <View style={styles.footerActions}>
            <FooterButton label="문의하기" onPress={onSupport} />
            <FooterButton label="약관·정책" onPress={onPolicy} />
          </View>
          <Button
            onPress={onSignOut}
            loading={isSigningOut}
            disabled={isSigningOut}
            variant="destructive"
          >
            로그아웃
          </Button>
        </Card>
      ) : null}
    </>
  );
}

function FooterButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.footerButton,
        {
          backgroundColor: themeColors.cardElevated,
          borderColor: themeColors.border,
        },
        pressed ? styles.footerButtonPressed : null,
      ]}
    >
      <ThemedText style={[styles.footerButtonLabel, { color: themeColors.text }]}>{label}</ThemedText>
    </Pressable>
  );
}

function ThemePreferencesCard() {
  const { colorScheme, setColorScheme, isReady } = useColorSchemeManager();
  const themeColors = Colors[colorScheme ?? 'light'];
  const mutedColor = useThemeColor({}, 'textMuted');

  const options = [
    { key: 'light', title: '밝은 테마', icon: 'sun.max.fill' },
    { key: 'dark', title: '어두운 테마', icon: 'moon.fill' },
  ] as const;

  const selectedOption = options.find((option) => option.key === colorScheme);

  return (
    <Card>
      <View style={styles.sectionStack}>
        <ThemedText type="subtitle">화면 테마</ThemedText>
        <ThemedText style={{ color: mutedColor, fontSize: 14, lineHeight: 20 }}>
          앱의 화면 테마를 설정할 수 있어요.
        </ThemedText>
      </View>
      <View style={styles.themeOptionsContainer}>
        {options.map((option) => {
          const isSelected = colorScheme === option.key;
          const iconColor = isSelected ? themeColors.primaryForeground : themeColors.text;
          const labelColor = isSelected ? themeColors.primaryForeground : themeColors.text;
          const dynamicStyle = isSelected
            ? {
                backgroundColor: themeColors.primary,
                borderColor: themeColors.primary,
                borderWidth: 1,
                shadowColor: themeColors.primary,
                shadowOpacity: colorScheme === 'dark' ? 0.35 : 0.2,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 8 },
                elevation: 6,
              }
            : {
                backgroundColor: themeColors.cardElevated,
                borderColor: themeColors.border,
                borderWidth: 1,
                shadowColor: 'transparent',
                shadowOpacity: 0,
                shadowRadius: 0,
                shadowOffset: { width: 0, height: 0 },
                elevation: 0,
              };
          const rightIcon = isSelected ? (
            <IconSymbol
              name="checkmark.circle.fill"
              size={18}
              color={themeColors.primaryForeground}
            />
          ) : undefined;
          return (
            <Button
              key={option.key}
              variant="secondary"
              size="md"
              leftIcon={
                <IconSymbol
                  name={option.icon}
                  size={20}
                  color={iconColor}
                />
              }
              rightIcon={rightIcon}
              onPress={() => setColorScheme(option.key)}
              disabled={!isReady}
              style={[styles.themeOptionButton, dynamicStyle]}
              textStyle={[styles.themeOptionLabel, { color: labelColor }]}
              accessibilityState={{ selected: isSelected, disabled: !isReady }}
            >
              {option.title}
            </Button>
          );
        })}
      </View>
      {selectedOption ? (
        <ThemedText style={[styles.themeCurrentLabel, { color: mutedColor }]}>
          현재 테마: {selectedOption.title}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingLabel: {
    fontSize: 14,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  sectionStack: {
    gap: Spacing.sm,
  },
  historySection: {
    gap: Spacing.sm,
  },
  historySectionTitle: {
    fontWeight: '600',
  },
  historyList: {
    gap: Spacing.sm,
  },
  historyRow: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  historyRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  historyRowTitle: {
    fontWeight: '600',
  },
  historyRowTimestamp: {
    fontSize: 12,
    opacity: 0.7,
  },
  historyRowSummary: {
    fontSize: 14,
    fontWeight: '500',
  },
  historyRowDetail: {
    fontSize: 13,
    opacity: 0.85,
  },
  historyEmpty: {
    fontSize: 13,
  },
  historyLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  guestHistoryContainer: {
    position: 'relative',
    marginTop: Spacing.md,
  },
  guestHistoryContent: {
    overflow: 'hidden',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
    position: 'relative',
  },
  guestHistoryBlur: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.lg,
  },
  modalDialogContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  placeholderLine: {
    height: 12,
    borderRadius: Radius.sm,
  },
  modalDialog: {
    width: '100%',
    padding: Spacing.lg,
    alignItems: 'center',
  },
  themeOptionsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  themeOptionButton: {
    flex: 1,
  },
  themeOptionLabel: {
    fontWeight: '600',
  },
  themeCurrentLabel: {
    marginTop: Spacing.sm,
    fontSize: 13,
  },
  footerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  footerButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  footerButtonPressed: {
    opacity: 0.85,
  },
  footerButtonLabel: {
    fontWeight: '600',
  },
});
