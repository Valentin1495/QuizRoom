import { useCallback, useMemo, useState, type ReactNode } from 'react';
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
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useThemeColor } from '@/hooks/use-theme-color';

type ProfileTab = 'summary' | 'history' | 'badges' | 'cosmetics';
type AuthedUser = NonNullable<ReturnType<typeof useAuth>['user']>;

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'summary', label: '활동 요약' },
  { key: 'history', label: '내가 푼 문제' },
  { key: 'badges', label: '획득 배지' },
  { key: 'cosmetics', label: '코스메틱' },
];

export default function ProfileScreen() {
  const { status, user, signOut, signInWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('summary');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const insets = useSafeAreaInsets();

  const isLoading = status === 'loading';
  const isAuthorizing = status === 'authorizing' || status === 'upgrading';
  const isAuthenticated = status === 'authenticated' && !!user;

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

        <View style={styles.section}>
          {isAuthenticated && user ? (
            <AuthenticatedStatGrid user={user} />
          ) : (
            <GuestStatPreviews onLogin={handleGoogleLogin} isLoading={isAuthorizing} />
          )}
        </View>

        <ProfileTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isAuthenticated={isAuthenticated}
          user={user ?? undefined}
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
        <ActionButton label="공유 카드 보기" tone="secondary" onPress={onShare} />
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
        <ActionButton label="Apple 로그인" tone="secondary" onPress={onAppleLogin} />
      </View>
    </Card>
  );
}

function AuthenticatedStatGrid({ user }: { user: AuthedUser }) {
  const stats = useMemo(
    () => [
      {
        icon: '🏆',
        title: '최근 성적',
        value:
          user.totalPlayed > 0
            ? `${Math.round((user.totalCorrect / user.totalPlayed) * 100)}%`
            : '기록 없음',
        description:
          user.totalPlayed > 0
            ? `이번 주 평균 정답률 · ${user.totalPlayed}회 플레이`
            : '퀴즈에 도전해 첫 기록을 만들어보세요',
      },
      {
        icon: '🔥',
        title: '스트릭',
        value: `${user.streak}일`,
        description:
          user.streak > 0 ? '좋아요! 연속 출석 중이에요.' : '오늘 퀴즈를 풀고 스트릭을 시작해요.',
      },
      {
        icon: '🎯',
        title: '관심 카테고리',
        value: user.interests.length > 0 ? user.interests.join(' · ') : '카테고리 설정 필요',
        description:
          user.interests.length > 0
            ? '관심 주제 기반 퀴즈가 추천돼요.'
            : '프로필에서 관심사를 등록해보세요.',
      },
      {
        icon: '🪄',
        title: '보유 코스메틱',
        value: '커밍순',
        description: '획득한 프레임과 이모지를 여기에서 관리할 수 있어요.',
      },
    ],
    [user.totalCorrect, user.totalPlayed, user.streak, user.interests]
  );

  return (
    <View style={styles.statGrid}>
      {stats.map((item) => (
        <StatCard key={item.title} {...item} />
      ))}
    </View>
  );
}

function GuestStatPreviews({
  onLogin,
  isLoading,
}: {
  onLogin: () => void;
  isLoading: boolean;
}) {
  const previews = [
    { title: '내 통계', description: '정확도, 스피드, 스트릭을 확인해보세요.' },
    { title: '획득 배지', description: '도전 미션으로 특별 배지를 모아요.' },
    { title: '코스메틱', description: '프레임과 이모지로 프로필을 꾸며요.' },
  ];

  return (
    <View style={styles.statGrid}>
      {previews.map((item) => (
        <Pressable
          key={item.title}
          onPress={onLogin}
          style={({ pressed }) => [
            styles.lockedCard,
            pressed ? styles.cardPressed : null,
          ]}
        >
          <ThemedText style={styles.lockedIcon}>🔒</ThemedText>
          <ThemedText type="subtitle">{item.title}</ThemedText>
          <ThemedText lightColor={Palette.slate500} darkColor={Palette.slate500}>
            {item.description}
          </ThemedText>
          <ActionButton
            label={isLoading ? '로그인 중...' : '로그인'}
            tone="ghost"
            onPress={onLogin}
            disabled={isLoading}
            loading={isLoading}
          />
        </Pressable>
      ))}
    </View>
  );
}

function ProfileTabs({
  activeTab,
  onTabChange,
  isAuthenticated,
  user,
}: {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  isAuthenticated: boolean;
  user?: AuthedUser;
}) {
  return (
    <Card>
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onTabChange(tab.key)}
              style={[
                styles.tabChip,
                isActive ? styles.tabChipActive : styles.tabChipInactive,
              ]}
            >
              <ThemedText
                style={isActive ? styles.tabLabelActive : styles.tabLabelInactive}
                lightColor={isActive ? '#ffffff' : undefined}
                darkColor={isActive ? '#ffffff' : undefined}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.tabContent}>
        {isAuthenticated && user ? (
          <AuthenticatedTabContent activeTab={activeTab} user={user} />
        ) : (
          <GuestTabPlaceholder />
        )}
      </View>
    </Card>
  );
}

function AuthenticatedTabContent({ activeTab, user }: { activeTab: ProfileTab; user: AuthedUser }) {
  switch (activeTab) {
    case 'summary':
      return (
        <View style={styles.tabStack}>
          <ThemedText type="subtitle">이번 주 하이라이트</ThemedText>
          <ThemedText>
            평균 정답률은{' '}
            <ThemedText style={styles.highlightText}>
              {user.totalPlayed > 0
                ? `${Math.round((user.totalCorrect / user.totalPlayed) * 100)}%`
                : '기록 없음'}
            </ThemedText>{' '}
            이에요. 꾸준히 참여해서 더 많은 배지를 모아보세요!
          </ThemedText>
          <ThemedText lightColor={Palette.slate500} darkColor={Palette.slate500}>
            관심 카테고리: {user.interests.length > 0 ? user.interests.join(', ') : '미설정'}
          </ThemedText>
        </View>
      );
    case 'history':
      return (
        <View style={styles.tabStack}>
          <ThemedText type="subtitle">나의 퀴즈 히스토리</ThemedText>
          <ThemedText lightColor={Palette.slate500} darkColor={Palette.slate500}>
            최근 플레이 기록이 곧 표시됩니다. 흥미로운 퀴즈를 더 풀어보세요!
          </ThemedText>
        </View>
      );
    case 'badges':
      return (
        <View style={styles.tabStack}>
          <ThemedText type="subtitle">획득한 배지</ThemedText>
          <ThemedText lightColor={Palette.slate500} darkColor={Palette.slate500}>
            베타 릴리즈 준비 중이에요. 새로운 도전 과제가 곧 열립니다!
          </ThemedText>
        </View>
      );
    case 'cosmetics':
      return (
        <View style={styles.tabStack}>
          <ThemedText type="subtitle">내 코스메틱</ThemedText>
          <ThemedText lightColor={Palette.slate500} darkColor={Palette.slate500}>
            프레임과 이모지 꾸미기 기능이 순차적으로 적용될 예정입니다.
          </ThemedText>
        </View>
      );
    default:
      return null;
  }
}

function GuestTabPlaceholder() {
  return (
    <View style={styles.tabStack}>
      <ThemedText type="subtitle">로그인하고 내 기록을 저장하세요!</ThemedText>
      <ThemedText lightColor={Palette.slate500} darkColor={Palette.slate500}>
        활동 요약, 내가 푼 문제, 배지, 코스메틱 정보를 모두 모아볼 수 있어요.
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

function StatCard({
  icon,
  title,
  value,
  description,
}: {
  icon: string;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card style={styles.statCard}>
      <ThemedText style={styles.statIcon}>{icon}</ThemedText>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText lightColor={Palette.slate500} darkColor={Palette.slate500}>
        {description}
      </ThemedText>
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
  section: {
    gap: Spacing.lg,
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
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.lg,
  },
  statCard: {
    width: '48%',
    gap: Spacing.sm,
    shadowColor: '#2F288033',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  statIcon: {
    fontSize: 24,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  lockedCard: {
    width: '48%',
    backgroundColor: Palette.surfaceMuted,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.slate200,
  },
  lockedIcon: {
    fontSize: 24,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tabChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabChipActive: {
    backgroundColor: Palette.purple600,
  },
  tabChipInactive: {
    backgroundColor: Palette.surfaceMuted,
  },
  tabLabelActive: {
    fontWeight: '600',
  },
  tabLabelInactive: {
    fontWeight: '500',
  },
  tabContent: {
    marginTop: Spacing.lg,
  },
  tabStack: {
    gap: Spacing.sm,
  },
  highlightText: {
    fontWeight: '700',
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
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
});
