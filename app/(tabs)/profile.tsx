import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { categories } from '@/constants/categories';
import { resolveDailyCategoryCopy } from '@/constants/daily';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { useAuth } from '@/hooks/use-auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useQuery } from 'convex/react';

type AuthedUser = NonNullable<ReturnType<typeof useAuth>['user']>;
type QuizHistoryDoc = Doc<'quizHistory'>;
type HistoryBuckets = (typeof api.history.listHistory)['_returnType'];

export default function ProfileScreen() {
  const { status, user, signOut, signInWithGoogle } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const insets = useSafeAreaInsets();

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

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Palette.purple600} />
        <ThemedText style={styles.loadingLabel}>프로필을 불러오는 중이에요...</ThemedText>
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
          />
        )}

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
  return <View style={[styles.card, { backgroundColor: cardColor }, style]}>{children}</View>;
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

  return (
    <Card>
      <View style={styles.headerRow}>
        <View style={styles.avatarFrame}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <ThemedText style={styles.avatarInitial}>
                {user.handle.slice(0, 1).toUpperCase()}
              </ThemedText>
            </View>
          )}
        </View>
        <View style={styles.headerContent}>
          <ThemedText type="subtitle">{user.handle}</ThemedText>
          <ThemedText lightColor={Palette.slate500} darkColor={Palette.slate500}>
            {statusLine}
          </ThemedText>
        </View>
      </View>
      <View style={styles.headerActions}>
        <ActionButton label="프로필 편집" tone="primary" onPress={onEdit} />
        {/* <ActionButton label="공유 카드 보기" tone="secondary" onPress={onShare} /> */}
      </View>
    </Card>
  );
}

function GuestHeader({
  onGoogleLogin,
  onAppleLogin,
  isLoading,
}: {
  onGoogleLogin: () => void;
  onAppleLogin: () => void;
  isLoading: boolean;
}) {
  return (
    <Card>
      <View style={styles.headerRow}>
        <View style={[styles.avatarFrame, styles.guestAvatar]}>
          <ThemedText style={styles.avatarInitial}>?</ThemedText>
        </View>
        <View style={styles.headerContent}>
          <ThemedText type="subtitle">게스트 사용자</ThemedText>
          <ThemedText lightColor={Palette.slate500} darkColor={Palette.slate500}>
            로그인하고 나만의 퀴즈 히스토리를 쌓아보세요!
          </ThemedText>
        </View>
      </View>
      <View style={styles.headerActions}>
        <ActionButton
          label="Google 로그인"
          tone="primary"
          onPress={onGoogleLogin}
          loading={isLoading}
          disabled={isLoading}
        />
        {/* <ActionButton label="Apple 로그인" tone="secondary" onPress={onAppleLogin} /> */}
      </View>
    </Card>
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
  if (!isAuthenticated) {
    return (
      <Card>
        <View style={styles.sectionStack}>
          <ThemedText type="subtitle">나의 퀴즈 히스토리</ThemedText>
          <ThemedText lightColor={Palette.slate500} darkColor={Palette.slate500}>
            로그인하고 내가 푼 퀴즈 기록을 확인해보세요.
          </ThemedText>
          <ActionButton
            label={loginLoading ? '로그인 중...' : 'Google 로그인'}
            tone="primary"
            onPress={onLogin}
            loading={loginLoading}
            disabled={loginLoading}
          />
        </View>
      </Card>
    );
  }

  if (history === undefined) {
    return (
      <Card>
        <View style={[styles.sectionStack, styles.historyLoading]}>
          <ActivityIndicator color={Palette.purple600} />
          <ThemedText lightColor={Palette.slate500} darkColor={Palette.slate500}>
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
          <ThemedText type="subtitle">나의 퀴즈 히스토리</ThemedText>
          <ThemedText lightColor={Palette.slate500} darkColor={Palette.slate500}>
            아직 저장된 기록이 없어요. 퀴즈를 플레이하면 여기에 기록이 쌓입니다.
          </ThemedText>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.sectionStack}>
        <ThemedText type="subtitle">나의 퀴즈 히스토리</ThemedText>
        <HistorySection
          title="데일리 퀴즈"
          entries={history.daily}
          emptyLabel="데일리 퀴즈를 완료하면 기록이 저장돼요."
          renderItem={renderDailyHistoryEntry}
        />
        <HistorySection
          title="스와이프"
          entries={history.swipe}
          emptyLabel="스와이프 세션을 완주하면 기록을 확인할 수 있어요."
          renderItem={renderSwipeHistoryEntry}
        />
        <HistorySection
          title="파티 라이브"
          entries={history.party}
          emptyLabel="파티 라이브에 참여하면 결과가 기록돼요."
          renderItem={renderPartyHistoryEntry}
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
  return (
    <View style={styles.historySection}>
      <ThemedText style={styles.historySectionTitle}>{title}</ThemedText>
      {entries.length ? (
        <View style={styles.historyList}>{entries.map(renderItem)}</View>
      ) : (
        <ThemedText style={styles.historyEmpty}>{emptyLabel}</ThemedText>
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

function renderDailyHistoryEntry(entry: QuizHistoryDoc) {
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
  return (
    <View key={entry._id} style={styles.historyRow}>
      <View style={styles.historyRowHeader}>
        <ThemedText style={styles.historyRowTitle}>{payload.date}</ThemedText>
        <ThemedText style={styles.historyRowTimestamp}>{formatHistoryTimestamp(entry.createdAt)}</ThemedText>
      </View>
      <ThemedText style={styles.historyRowSummary}>
        정답 {payload.correct}/{payload.total} · 정확도 {accuracy}%
      </ThemedText>
      <ThemedText style={styles.historyRowDetail}>{detailParts.join(' · ')}</ThemedText>
    </View>
  );
}

function renderSwipeHistoryEntry(entry: QuizHistoryDoc) {
  const payload = entry.payload as SwipeHistoryPayload;
  const accuracy = computeAccuracy(payload.correct, payload.answered);
  const avgSecondsLabel = formatAverageSeconds(payload.avgResponseMs);
  const categoryMeta = categories.find((category) => category.slug === payload.category);
  const categoryLabel = categoryMeta ? `${categoryMeta.emoji} ${categoryMeta.title}` : payload.category;
  return (
    <View key={entry._id} style={styles.historyRow}>
      <View style={styles.historyRowHeader}>
        <ThemedText style={styles.historyRowTitle}>{categoryLabel}</ThemedText>
        <ThemedText style={styles.historyRowTimestamp}>{formatHistoryTimestamp(entry.createdAt)}</ThemedText>
      </View>
      <ThemedText style={styles.historyRowSummary}>
        정답 {payload.correct}/{payload.answered} · 정확도 {accuracy}% · 최고 {payload.maxStreak}연속
      </ThemedText>
      <ThemedText style={styles.historyRowDetail}>
        평균 반응속도 {avgSecondsLabel} · 점수 {payload.totalScoreDelta >= 0 ? `+${payload.totalScoreDelta}` : payload.totalScoreDelta}
      </ThemedText>
    </View>
  );
}

function renderPartyHistoryEntry(entry: QuizHistoryDoc) {
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
  return (
    <View key={entry._id} style={styles.historyRow}>
      <View style={styles.historyRowHeader}>
        <ThemedText style={styles.historyRowTitle}>{title}</ThemedText>
        <ThemedText style={styles.historyRowTimestamp}>{formatHistoryTimestamp(entry.createdAt)}</ThemedText>
      </View>
      <ThemedText style={styles.historyRowSummary}>
        {rankLabel} · 총점 {payload.totalScore}점
      </ThemedText>
      <ThemedText style={styles.historyRowDetail}>
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
  onLogin,
  loginLoading,
}: {
  isAuthenticated: boolean;
  onSignOut: () => void;
  isSigningOut: boolean;
  onSupport: () => void;
  onPolicy: () => void;
  onLogin: () => void;
  loginLoading: boolean;
}) {
  if (isAuthenticated) {
    return (
      <Card>
        <ThemedText type="subtitle">계정</ThemedText>
        <View style={styles.footerActions}>
          <FooterButton label="문의하기" onPress={onSupport} />
          <FooterButton label="약관·정책" onPress={onPolicy} />
        </View>
        <ActionButton
          label="로그아웃"
          tone="danger"
          onPress={onSignOut}
          loading={isSigningOut}
          disabled={isSigningOut}
        />
      </Card>
    );
  }

  return (
    <Card>
      <ThemedText type="subtitle">로그인하고 시작하기</ThemedText>
      <ThemedText lightColor={Palette.slate500} darkColor={Palette.slate500}>
        기록을 저장하고 친구와 공유하려면 로그인이 필요해요.
      </ThemedText>
      <ActionButton
        label={loginLoading ? '로그인 중...' : 'Google 로그인'}
        tone="primary"
        onPress={onLogin}
        loading={loginLoading}
        disabled={loginLoading}
      />
    </Card>
  );
}

function FooterButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.footerButton, pressed ? styles.footerButtonPressed : null]}>
      <ThemedText style={styles.footerButtonLabel}>{label}</ThemedText>
    </Pressable>
  );
}

type ActionButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger';

function ActionButton({
  label,
  onPress,
  tone,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  tone: ActionButtonTone;
  disabled?: boolean;
  loading?: boolean;
}) {
  const backgroundStyle = (() => {
    switch (tone) {
      case 'primary':
        return styles.buttonPrimary;
      case 'secondary':
        return styles.buttonSecondary;
      case 'ghost':
        return styles.buttonGhost;
      case 'danger':
        return styles.buttonDanger;
      default:
        return styles.buttonPrimary;
    }
  })();
  const indicatorColor = tone === 'ghost' ? Palette.purple600 : '#ffffff';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        backgroundStyle,
        disabled ? styles.buttonDisabled : null,
        pressed && !disabled ? styles.buttonPressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <ThemedText
          style={styles.buttonLabel}
          lightColor={tone === 'ghost' ? Palette.purple600 : '#ffffff'}
          darkColor={tone === 'ghost' ? Palette.purple400 : '#ffffff'}
        >
          {label}
        </ThemedText>
      )}
    </Pressable>
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarFrame: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.purple200,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.lg,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    backgroundColor: Palette.purple600,
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  guestAvatar: {
    backgroundColor: Palette.slate200,
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
    backgroundColor: Palette.surfaceMuted,
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
    color: Palette.slate500,
  },
  historyLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  footerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  footerButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceMuted,
    alignItems: 'center',
  },
  footerButtonPressed: {
    opacity: 0.85,
  },
  footerButtonLabel: {
    fontWeight: '600',
  },
  buttonBase: {
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonLabel: {
    fontWeight: '600',
  },
  buttonPrimary: {
    backgroundColor: Palette.purple600,
  },
  buttonSecondary: {
    backgroundColor: Palette.pink500,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Palette.purple200,
  },
  buttonDanger: {
    backgroundColor: Palette.danger,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
});
