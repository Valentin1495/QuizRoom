import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
  type BottomSheetBackdropProps
} from '@gorhom/bottom-sheet';
import { useIsFocused } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LevelBadge, XpProgressBar } from '@/components/common/level-badge';
import { LevelInfoSheet } from '@/components/common/level-info-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { Avatar, GuestAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { categories } from '@/constants/categories';
import { resolveDailyCategoryCopy } from '@/constants/daily';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme, useColorSchemeManager } from '@/hooks/use-color-scheme';
import { useQuizHistory, type HistoryBuckets, type QuizHistoryDoc } from '@/hooks/use-quiz-history';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-unified-auth';
import { deriveGuestAvatarSeed, deriveGuestNickname } from '@/lib/guest';
import { calculateLevel } from '@/lib/level';
import { useUserActivityStreak, useUserStats } from '@/lib/supabase-api';

type AuthedUser = NonNullable<ReturnType<typeof useAuth>['user']>;
type HistorySectionKey = 'daily' | 'swipe' | 'liveMatch';
type HistoryEntry = QuizHistoryDoc & { id?: string };

const HISTORY_PREVIEW_LIMIT = 3;

export default function ProfileScreen() {
  const { status, user, signOut, signInWithGoogle, guestKey, ensureGuestKey, isReady, refreshUser } = useAuth();
  const { stats: supabaseStats } = useUserStats();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isLogoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const mutedColor = useThemeColor({}, 'textMuted');
  const historySheetRef = useRef<BottomSheetModal>(null);
  const levelSheetRef = useRef<BottomSheetModal>(null);
  const [historySheetSection, setHistorySheetSection] = useState<HistorySectionKey | null>(null);
  const historySheetSnapPoints = useMemo(() => ['50%', '100%'], []);
  const historySheetBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        pressBehavior="close"
        appearsOnIndex={0}
        disappearsOnIndex={-1}
      />
    ),
    []
  );

  const handleOpenLogoutDialog = useCallback(() => {
    setLogoutDialogVisible(true);
  }, []);

  const handleCloseLogoutDialog = useCallback(() => {
    setLogoutDialogVisible(false);
  }, []);

  const isLoading = status === 'loading';
  const isAuthorizing = status === 'authorizing' || status === 'upgrading';
  const isAuthenticated = status === 'authenticated' && !!user;
  const guestAvatarSeed = useMemo(() => deriveGuestAvatarSeed(guestKey) ?? 'guest', [guestKey]);
  const guestNickname = useMemo(() => deriveGuestNickname(guestKey) ?? '게스트 사용자', [guestKey]);
  const history = useQuizHistory({
    limit: 60,
    enabled: status === 'authenticated' && isReady,
  });
  const { streak: activityDayStreak } = useUserActivityStreak(
    isAuthenticated ? user?.id : null,
    { enabled: isAuthenticated && isReady }
  );

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;

    try {
      handleCloseLogoutDialog();
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
  }, [handleCloseLogoutDialog, isSigningOut, signOut]);

  const handleShareCard = useCallback(() => {
    Alert.alert('공유 카드', '퀴즈 공유 카드는 곧 제공될 예정이에요!');
  }, []);

  const handleEditProfile = useCallback(() => {
    Alert.alert('프로필 편집', '프로필 편집 기능은 곧 추가될 예정입니다.');
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

  useEffect(() => {
    if (!isFocused) return;
    if (!isReady) return;
    if (status !== 'authenticated') return;
    void refreshUser();
  }, [isFocused, isReady, refreshUser, status]);

  // Prefer in-memory user (updated via Realtime/applyUserDelta) over cached stats.
  const xpValue = user?.xp ?? supabaseStats?.xp ?? 0;
  const baseStreak = user?.streak ?? supabaseStats?.streak ?? 0;
  const currentLevel = useMemo(() => calculateLevel(xpValue).level, [xpValue]);

  const activityStreak = useMemo(() => {
    if (!history) return null;
    const allEntries = [
      ...(history.daily ?? []),
      ...(history.swipe ?? []),
      ...(history.liveMatch ?? []),
    ];
    if (!allEntries.length) return 0;

    const getKstDayKey = (ms: number) => {
      const kstMs = ms + 9 * 60 * 60 * 1000;
      return new Date(kstMs).toISOString().slice(0, 10);
    };

    const dates = new Set<string>();
    allEntries.forEach((entry) => {
      const d = new Date(entry.createdAt);
      const key = getKstDayKey(d.getTime());
      dates.add(key);
    });
    let streak = 0;
    for (; ;) {
      const key = getKstDayKey(Date.now() - streak * 24 * 60 * 60 * 1000);
      if (dates.has(key)) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  }, [history]);
  const displayStreak = useMemo(() => {
    if (isAuthenticated) {
      if (activityDayStreak !== null) return activityDayStreak;
      return baseStreak;
    }
    if (activityStreak === null) return 0;
    return activityStreak;
  }, [activityDayStreak, activityStreak, baseStreak, isAuthenticated]);

  const handleOpenHistorySheet = useCallback((section: HistorySectionKey) => {
    setHistorySheetSection(section);
  }, []);

  const handleCloseHistorySheet = useCallback(() => {
    historySheetRef.current?.dismiss();
    setHistorySheetSection(null);
  }, []);

  useEffect(() => {
    if (historySheetSection && historySheetRef.current) {
      historySheetRef.current.present();
    }
  }, [historySheetSection]);

  const openLevelSheet = useCallback(() => {
    levelSheetRef.current?.present();
  }, []);

  const closeLevelSheet = useCallback(() => {
    levelSheetRef.current?.dismiss();
  }, []);

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
    <BottomSheetModalProvider>
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.contentContainer,
            { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {isAuthenticated && user ? (
            <ProfileHeader
              user={user}
              xp={xpValue}
              streak={displayStreak}
              onEdit={handleEditProfile}
              onShare={handleShareCard}
              onOpenLevelSheet={openLevelSheet}
            />
          ) : (
            <GuestHeader
              guestAvatarSeed={guestAvatarSeed}
              guestNickname={guestNickname}
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
            onOpenSheet={handleOpenHistorySheet}
            previewLimit={HISTORY_PREVIEW_LIMIT}
          />

          <ThemePreferencesCard />

          <FooterSection
            isAuthenticated={isAuthenticated}
            onSignOut={handleOpenLogoutDialog}
            isSigningOut={isSigningOut}
            onSupport={() =>
              Alert.alert('문의하기', 'valentink1495@gmail.com\n언제든 편하게 연락주세요!')
            }
          />
        </ScrollView>
        <HistoryBottomSheet
          sheetRef={historySheetRef}
          activeSection={historySheetSection}
          history={history}
          renderBackdrop={historySheetBackdrop}
          snapPoints={historySheetSnapPoints}
          topInset={insets.top + Spacing.md}
          onClose={handleCloseHistorySheet}
        />
        <LevelInfoSheet
          sheetRef={levelSheetRef}
          currentLevel={currentLevel}
          currentXp={xpValue}
          onClose={closeLevelSheet}
        />
        <AlertDialog
          visible={isLogoutDialogVisible}
          onClose={handleCloseLogoutDialog}
          title="로그아웃"
          description="계정에서 로그아웃하시겠어요?"
          actions={[
            { label: '취소', tone: 'secondary' },
            { label: '로그아웃', tone: 'destructive', onPress: handleSignOut, disabled: isSigningOut },
          ]}
        />
      </ThemedView>
    </BottomSheetModalProvider>
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
  xp,
  streak,
  onEdit,
  onShare,
  onOpenLevelSheet,
}: {
  user: AuthedUser;
  xp: number;
  streak: number;
  onEdit: () => void;
  onShare: () => void;
  onOpenLevelSheet: () => void;
}) {
  const statusLine =
    streak > 1
      ? `🔥 연속 ${streak}일 출석 중`
      : streak === 1
        ? '🚀 스트릭 시작! 1일 차 돌입'
        : '퀴즈를 매일 플레이하고\n스트릭을 이어가세요!';
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
          <View style={styles.headerNameRow}>
            <ThemedText type="subtitle">{user.handle}</ThemedText>
            <Pressable onPress={onOpenLevelSheet} hitSlop={8}>
              <LevelBadge xp={xp} size="sm" showTitle />
            </Pressable>
          </View>
          <ThemedText style={[styles.statusText, { color: mutedColor }]}>{statusLine}</ThemedText>
        </View>
      </View>
      <XpProgressBar xp={xp} height={6} showLabel />
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
  guestAvatarSeed,
  guestNickname,
  onGoogleLogin,
  onAppleLogin,
  isLoading,
}: {
  guestAvatarSeed: string;
  guestNickname: string;
  onGoogleLogin: () => void;
  onAppleLogin: () => void;
  isLoading: boolean;
}) {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const mutedColor = useThemeColor({}, 'textMuted');
  const guestAvatarBorder = themeColors.border;

  return (
    <Card>
      <View style={styles.headerRow}>
        <GuestAvatar
          seed={guestAvatarSeed}
          size="xl"
          radius={Radius.pill}
          style={{ borderColor: guestAvatarBorder }}
        />
        <View style={styles.headerContent}>
          <ThemedText type="subtitle">{guestNickname}</ThemedText>
          <ThemedText style={[styles.statusText, { color: mutedColor }]}>
            로그인 후 나의 통계를 확인해보세요
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
          {isLoading ? '로그인 중...' : 'Google 로그인'}
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
          <ThemedText style={styles.historySectionTitle}>오늘의 퀴즈</ThemedText>
          <View style={styles.historyList}>
            {[1].map((i) => (
              <PlaceholderRow key={i} />
            ))}
          </View>
        </View>
        <View style={styles.historySection}>
          <ThemedText style={styles.historySectionTitle}>스와이프</ThemedText>
          <View style={styles.historyList}>
            {[1].map((i) => (
              <PlaceholderRow key={i} />
            ))}
          </View>
        </View>
        <View style={styles.historySection}>
          <ThemedText style={styles.historySectionTitle}>라이브 매치</ThemedText>
          <View style={styles.historyList}>
            {[1].map((i) => (
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
            name="lock"
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
            로그인하고 나의 퀴즈 기록을 쌓아보세요!
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
  onOpenSheet,
  previewLimit,
}: {
  isAuthenticated: boolean;
  history: HistoryBuckets | undefined;
  onLogin: () => void;
  loginLoading: boolean;
  onOpenSheet: (section: HistorySectionKey) => void;
  previewLimit: number;
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
    history.daily.length > 0 || history.swipe.length > 0 || history.liveMatch.length > 0;

  if (!hasAny) {
    return (
      <Card>
        <View style={styles.sectionStack}>
          <ThemedText type="subtitle">퀴즈 히스토리</ThemedText>
          <ThemedText style={[styles.statusText, { color: mutedColor }]}>
            아직 기록이 없어요. 퀴즈를 플레이하면 여기에 쌓여요.
          </ThemedText>
        </View>
      </Card>
    );
  }

  const sections = {
    daily: {
      key: 'daily' as const,
      title: '오늘의 퀴즈',
      entries: history.daily,
      emptyLabel: '오늘의 퀴즈를 완료하고 결과를 확인해보세요.',
      renderItem: (entry: HistoryEntry) => <DailyHistoryRow key={entry._id ?? entry.id} entry={entry} />,
    },
    swipe: {
      key: 'swipe' as const,
      title: '스와이프',
      entries: history.swipe,
      emptyLabel: '스와이프 세션을 완주하고 결과를 확인해보세요.',
      renderItem: (entry: HistoryEntry) => <SwipeHistoryRow key={entry._id ?? entry.id} entry={entry} />,
    },
    liveMatch: {
      key: 'liveMatch' as const,
      title: '라이브 매치',
      entries: history.liveMatch,
      emptyLabel: '라이브 매치에 참여하고 결과를 확인해보세요.',
      renderItem: (entry: HistoryEntry) => (
        <LiveMatchHistoryRow key={entry._id ?? entry.id} entry={entry} />
      ),
    },
  };

  return (
    <Card>
      <View style={styles.sectionStack}>
        <ThemedText type="subtitle">퀴즈 히스토리</ThemedText>
        <HistorySection
          title={sections.daily.title}
          entries={sections.daily.entries}
          emptyLabel={sections.daily.emptyLabel}
          renderItem={sections.daily.renderItem}
          previewLimit={previewLimit}
          onSeeAll={() => onOpenSheet('daily')}
        />
        <HistorySection
          title={sections.swipe.title}
          entries={sections.swipe.entries}
          emptyLabel={sections.swipe.emptyLabel}
          renderItem={sections.swipe.renderItem}
          previewLimit={previewLimit}
          onSeeAll={() => onOpenSheet('swipe')}
        />
        <HistorySection
          title={sections.liveMatch.title}
          entries={sections.liveMatch.entries}
          emptyLabel={sections.liveMatch.emptyLabel}
          renderItem={sections.liveMatch.renderItem}
          previewLimit={previewLimit}
          onSeeAll={() => onOpenSheet('liveMatch')}
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
  previewLimit,
  onSeeAll,
}: {
  title: string;
  entries: HistoryEntry[];
  renderItem: (entry: HistoryEntry) => ReactNode;
  emptyLabel: string;
  previewLimit: number;
  onSeeAll: () => void;
}) {
  const mutedColor = useThemeColor({}, 'textMuted');
  const hasOverflow = entries.length > previewLimit;
  const visibleEntries = hasOverflow ? entries.slice(0, previewLimit) : entries;

  return (
    <View style={styles.historySection}>
      <View style={styles.historySectionHeader}>
        <ThemedText style={styles.historySectionTitle}>{title}</ThemedText>
        {hasOverflow ? (
          <Button
            variant="ghost"
            size="sm"
            onPress={onSeeAll}
            textStyle={styles.historySeeAllLabel}
            contentStyle={styles.historySeeAllContent}
          >
            전체 보기
          </Button>
        ) : null}
      </View>
      {visibleEntries.length ? (
        <View style={styles.historyList}>{visibleEntries.map(renderItem)}</View>
      ) : (
        <ThemedText style={[styles.historyEmpty, { color: mutedColor }]}>{emptyLabel}</ThemedText>
      )}
    </View>
  );
}

function HistoryBottomSheet({
  activeSection,
  history,
  sheetRef,
  renderBackdrop,
  snapPoints,
  onClose,
  topInset,
}: {
  activeSection: HistorySectionKey | null;
  history: HistoryBuckets | undefined;
  sheetRef: React.RefObject<BottomSheetModal | null>;
  renderBackdrop: (props: BottomSheetBackdropProps) => ReactNode;
  snapPoints: string[];
  onClose: () => void;
  topInset: number;
}) {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const mutedColor = useThemeColor({}, 'textMuted');

  const sections = useMemo(
    () =>
      history
        ? {
          daily: {
            title: '오늘의 퀴즈 전체 기록',
            entries: history.daily,
            emptyLabel: '아직 데일리 기록이 없어요.',
            renderItem: (entry: QuizHistoryDoc) => <DailyHistoryRow key={entry._id} entry={entry} />,
          },
          swipe: {
            title: '스와이프 전체 기록',
            entries: history.swipe,
            emptyLabel: '아직 스와이프 기록이 없어요.',
            renderItem: (entry: QuizHistoryDoc) => <SwipeHistoryRow key={entry._id} entry={entry} />,
          },
          liveMatch: {
            title: '라이브 매치 전체 기록',
            entries: history.liveMatch,
            emptyLabel: '아직 라이브 매치 기록이 없어요.',
            renderItem: (entry: QuizHistoryDoc) => <LiveMatchHistoryRow key={entry._id} entry={entry} />,
          },
        }
        : null,
    [history]
  );

  const selectedSection = activeSection && sections ? sections[activeSection] : null;

  if (!selectedSection) {
    return null;
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: themeColors.card }}
      handleIndicatorStyle={{ backgroundColor: themeColors.border }}
      onDismiss={onClose}
      topInset={topInset}
    >
      <BottomSheetScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator
        scrollEnabled
        nestedScrollEnabled
      >
        <View style={styles.sheetHeader}>
          <View>
            <ThemedText type="subtitle">{selectedSection.title}</ThemedText>
            <ThemedText style={[styles.sheetSubtitle, { color: mutedColor }]}>
              총 {selectedSection.entries.length}회 | 최신순
            </ThemedText>
          </View>
          <Button
            variant="ghost"
            size="sm"
            onPress={onClose}
            textStyle={styles.historySeeAllLabel}
            contentStyle={styles.historySeeAllContent}
          >
            닫기
          </Button>
        </View>
        {selectedSection.entries.length ? (
          <View style={styles.historyList}>{selectedSection.entries.map(selectedSection.renderItem)}</View>
        ) : (
          <ThemedText style={[styles.historyEmpty, { color: mutedColor }]}>
            {selectedSection.emptyLabel}
          </ThemedText>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

type DailyHistoryPayload = {
  date: string;
  correct: number;
  total: number;
  timerMode?: string;
  durationMs?: number;
  category?: string;
  xpGain?: number;
  xp?: number;
};

type SwipeHistoryPayload = {
  category: string;
  tags?: string[];
  answered: number;
  correct: number;
  maxStreak: number;
  durationMs?: number;
  totalScoreDelta: number;
  bonusXpGain?: number;
  xpGain?: number;
};

type LiveMatchHistoryPayload = {
  deckSlug?: string;
  deckTitle?: string;
  roomCode?: string;
  rank?: number;
  totalParticipants?: number;
  totalScore: number;
  answered?: number;
  correct?: number;
  xpGain?: number;
  maxStreak?: number;
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
  const modeLabel = payload.timerMode === 'timed' ? '타임어택 모드' : '릴랙스 모드';
  const categoryLabel = payload.category
    ? resolveDailyCategoryCopy(payload.category)?.label ?? payload.category
    : null;
  const detailParts = [modeLabel];
  if (durationLabel) {
    detailParts.push(durationLabel);
  }
  if (categoryLabel) {
    detailParts.push(`${categoryLabel}`);
  }
  const xpEarned = payload.xpGain ?? payload.xp;
  const detailLine = [
    modeLabel,
    durationLabel,
    xpEarned ? `XP +${xpEarned}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const mutedColor = useThemeColor({}, 'textMuted');

  return (
    <View
      style={[
        styles.historyRow,
        { backgroundColor: themeColors.cardElevated, borderColor: themeColors.border },
      ]}
    >
      <View style={styles.historyRowHeader}>
        <ThemedText style={styles.historyRowTitle}>{detailParts[2]}</ThemedText>
        <ThemedText style={[styles.historyRowTimestamp, { color: mutedColor }]}>
          {formatHistoryTimestamp(entry.createdAt)}
        </ThemedText>
      </View>
      <ThemedText style={styles.historyRowSummary}>
        정답률 {accuracy}% ({payload.correct}/{payload.total})
      </ThemedText>
      <ThemedText style={[styles.historyRowDetail, { color: mutedColor }]}>
        {detailLine}
      </ThemedText>
    </View>
  );
}

function SwipeHistoryRow({ entry }: { entry: QuizHistoryDoc }) {
  const payload = entry.payload as SwipeHistoryPayload;
  const accuracy = computeAccuracy(payload.correct, payload.answered);
  const categoryMeta = categories.find((category) => category.slug === payload.category);
  const categoryLabel = categoryMeta ? categoryMeta.title : payload.category;
  const categoryIcon = categoryMeta?.icon ?? 'lightbulb';
  const totalDurationLabel = formatSecondsLabel(payload.durationMs);
  const xpEarned =
    typeof payload.bonusXpGain === 'number'
      ? payload.bonusXpGain
      : typeof payload.xpGain === 'number'
        ? payload.xpGain
        : null;
  const totalXpLabel = xpEarned ? `XP +${xpEarned}` : null;

  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const mutedColor = useThemeColor({}, 'textMuted');

  return (
    <View
      style={[
        styles.historyRow,
        { backgroundColor: themeColors.cardElevated, borderColor: themeColors.border },
      ]}
    >
      <View style={styles.historyRowHeader}>
        <View style={styles.historyRowTitleGroup}>
          <IconSymbol name={categoryIcon} size={18} color={themeColors.text} />
          <ThemedText style={styles.historyRowTitle}>{categoryLabel}</ThemedText>
        </View>
        <ThemedText style={[styles.historyRowTimestamp, { color: mutedColor }]}>
          {formatHistoryTimestamp(entry.createdAt)}
        </ThemedText>
      </View>
      <ThemedText style={styles.historyRowSummary}>
        정답률 {accuracy}% ({payload.correct}/{payload.answered}) | 🔥 최고 {payload.maxStreak}연속
      </ThemedText>
      <ThemedText style={[styles.historyRowDetail, { color: mutedColor }]}>
        {totalDurationLabel ? `총 소요 ${totalDurationLabel} | ` : ''}
        점수 {payload.totalScoreDelta >= 0 ? `+${payload.totalScoreDelta}` : payload.totalScoreDelta}
        {totalXpLabel ? ` | ${totalXpLabel}` : ''}
      </ThemedText>
    </View>
  );
}

function LiveMatchHistoryRow({ entry }: { entry: QuizHistoryDoc }) {
  const payload = entry.payload as LiveMatchHistoryPayload;
  const title = payload.deckTitle ?? '라이브 매치';
  const rankLabel =
    payload.rank !== undefined
      ? `순위 #${payload.rank}${payload.totalParticipants ? `/${payload.totalParticipants}` : ''}`
      : '순위 정보 없음';
  const answered = payload.answered ?? null;
  const correct = payload.correct ?? null;
  const hasAccuracy = typeof answered === 'number' && typeof correct === 'number' && answered > 0;
  const accuracy = hasAccuracy ? computeAccuracy(correct, answered) : null;
  const xpLabel =
    typeof payload.xpGain === 'number'
      ? `XP ${payload.xpGain >= 0 ? `+${payload.xpGain}` : payload.xpGain}`
      : null;
  const comboLabel =
    typeof payload.maxStreak === 'number'
      ? `🔥 최고 ${payload.maxStreak}연속`
      : null;

  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const mutedColor = useThemeColor({}, 'textMuted');

  const summaryParts = [rankLabel, `총점 ${payload.totalScore}점`, xpLabel].filter(Boolean);
  const detailParts = [
    payload.roomCode ? `코드 ${payload.roomCode}` : null,
    hasAccuracy ? `정답률 ${accuracy}% (${correct}/${answered})` : null,
    comboLabel,
  ].filter(Boolean);

  return (
    <View
      style={[
        styles.historyRow,
        { backgroundColor: themeColors.cardElevated, borderColor: themeColors.border },
      ]}
    >
      <View style={styles.historyRowHeader}>
        <ThemedText style={styles.historyRowTitle}>{title}</ThemedText>
        <ThemedText style={[styles.historyRowTimestamp, { color: mutedColor }]}>
          {formatHistoryTimestamp(entry.createdAt)}
        </ThemedText>
      </View>
      <ThemedText style={styles.historyRowSummary}>
        {summaryParts.join(' | ')}
      </ThemedText>
      {detailParts.length ? (
        <ThemedText style={[styles.historyRowDetail, { color: mutedColor }]}>
          {detailParts.join(' | ')}
        </ThemedText>
      ) : null}
    </View>
  );
}

function FooterSection({
  isAuthenticated,
  onSignOut,
  isSigningOut,
  onSupport,
}: {
  isAuthenticated: boolean;
  onSignOut: () => void;
  isSigningOut: boolean;
  onSupport: () => void;
}) {
  return (
    <>
      {isAuthenticated ? (
        <View style={styles.footerStandalone}>
          <Button
            variant="outline"
            style={styles.footerButton}
            onPress={onSupport}
          >
            문의하기
          </Button>
          <Button
            onPress={onSignOut}
            loading={isSigningOut}
            disabled={isSigningOut}
            variant="destructive"
          >
            로그아웃
          </Button>
        </View>
      ) : null}
    </>
  );
}

function ThemePreferencesCard() {
  const { colorScheme, setColorScheme, isReady } = useColorSchemeManager();
  const themeColors = Colors[colorScheme ?? 'light'];
  const mutedColor = useThemeColor({}, 'textMuted');

  const options = [
    { key: 'light', title: '밝은 테마', icon: 'sun.max' },
    { key: 'dark', title: '어두운 테마', icon: 'moon' },
  ] as const;

  return (
    <Card>
      <View style={styles.sectionStack}>
        <ThemedText type="subtitle">화면 테마</ThemedText>
        <ThemedText style={{ color: mutedColor, fontSize: 14, lineHeight: 20 }}>
          앱의 화면 테마를 설정할 수 있어요
        </ThemedText>
      </View>
      <View style={styles.themeOptionsContainer}>
        {options.map((option) => {
          const isSelected = colorScheme === option.key;
          const dynamicStyle = isSelected
            ? {
              borderColor: themeColors.primary,
              borderWidth: 2,
            }
            : {
              borderColor: themeColors.border,
              borderWidth: 1,
            };
          const rightIcon = isSelected ? (
            <IconSymbol
              name="checkmark.circle.fill"
              size={18}
              color={themeColors.text}
            />
          ) : undefined;
          return (
            <Button
              key={option.key}
              variant="outline"
              size="md"
              leftIcon={
                <IconSymbol
                  name={option.icon}
                  size={20}
                  color={themeColors.text}
                />
              }
              rightIcon={rightIcon}
              onPress={() => setColorScheme(option.key)}
              disabled={!isReady}
              style={[styles.themeOptionButton, { backgroundColor: themeColors.cardElevated }, dynamicStyle]}
              accessibilityState={{ selected: isSelected, disabled: !isReady }}
            >
              {option.title}
            </Button>
          );
        })}
      </View>
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
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
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
    gap: Spacing.xl,
  },
  historySection: {
    gap: Spacing.sm,
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historySectionTitle: {
    fontWeight: '600',
  },
  historySeeAllLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  historySeeAllContent: {
    paddingHorizontal: Spacing.xs,
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
  historyRowTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
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
  footerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  footerButton: {
    flex: 1,
  },
  footerStandalone: {
    gap: Spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetSubtitle: {
    fontSize: 13,
    marginTop: Spacing.xs / 2,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
});
