import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-unified-auth';

type AuthGateProps = {
  children: ReactNode;
};

const appIcon = require('../assets/images/app-icon.png');

export function AuthGate({ children }: AuthGateProps) {
  const { status, user, guestKey, error, signInWithGoogle, enterGuestMode } = useAuth();
  const primaryColor = useThemeColor({}, 'primary');
  const iconBackground = useThemeColor(
    {
      light: 'rgba(0, 0, 0, 0.65)',
      dark: 'rgba(255, 255, 255, 0.18)',
    },
    'cardElevated',
  );
  const insets = useSafeAreaInsets();
  const [showBanner, setShowBanner] = useState(false);
  const hasEnteredAppRef = useRef(false);

  useEffect(() => {
    if (!error) {
      setShowBanner(false);
      return;
    }
    setShowBanner(true);
    const timeout = setTimeout(() => setShowBanner(false), 3000);
    return () => clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    if ((status === 'authenticated' && !!user) || status === 'guest' || status === 'upgrading') {
      hasEnteredAppRef.current = true;
    }
  }, [status, user]);

  const { isLoading, headline, helper } = useMemo(() => {
    if (status === 'authenticated' && user) {
      return { isLoading: false, headline: null, helper: null };
    }
    if (status === 'guest') {
      return { isLoading: false, headline: null, helper: null };
    }
    if (status === 'authorizing' || status === 'loading') {
      return {
        isLoading: true,
        headline: '사용자 정보를 확인하는 중',
        helper: '잠시만 기다려주세요…',
      } as const;
    }
    if (status === 'error') {
      return {
        isLoading: false,
        headline: '로그인에 문제가 발생했어요',
        helper: error ?? '잠시 후 다시 시도해주세요',
      } as const;
    }
    return {
      isLoading: false,
      headline: 'QuizRoom',
      helper: '지금 바로 실시간 지식 배틀에 합류하세요!',
    } as const;
  }, [status, user, error]);

  const shouldKeepChildrenMountedWhileAuthorizing =
    status === 'authorizing' && hasEnteredAppRef.current && (!!user || !!guestKey);

  if (
    (status === 'authenticated' && user) ||
    status === 'guest' ||
    shouldKeepChildrenMountedWhileAuthorizing ||
    status === 'upgrading' ||
    status === 'error'
  ) {
    return (
      <View style={styles.passThroughContainer}>
        {children}
        {error && showBanner ? (
          <ThemedView
            style={[styles.banner, { top: insets.top + Spacing.md }]}
            lightColor="rgba(20, 20, 20, 0.88)"
            darkColor="rgba(20, 20, 20, 0.92)"
            pointerEvents="none"
          >
            <ThemedText style={styles.bannerText}>{error}</ThemedText>
          </ThemedView>
        ) : null}
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView
        style={styles.card}
        lightColor="rgba(255, 255, 255, 0.98)"
        darkColor="rgba(30, 30, 30, 0.95)"
      >
        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={[styles.appIconWrapper, { backgroundColor: iconBackground }]}>
            <Image source={appIcon} style={styles.appIcon} resizeMode="contain" />
          </View>
          <ThemedText type="title" style={styles.title}>
            {headline}
          </ThemedText>
          {helper ? (
            <ThemedText style={styles.message}>{helper}</ThemedText>
          ) : null}
        </View>

        {/* Loading State */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : (
          <View style={styles.buttonGroup}>
            {/* Primary CTA - Google Sign In */}
            <Button
              variant="default"
              size="lg"
              rounded="lg"
              fullWidth
              onPress={() => {
                void signInWithGoogle();
              }}
              disabled={status === 'authorizing'}
            >
              Google 로그인
            </Button>

            {/* Secondary CTA - Guest Mode */}
            <Button
              variant="secondary"
              size="lg"
              rounded="lg"
              fullWidth
              onPress={() => {
                void enterGuestMode();
              }}
              disabled={status === 'authorizing'}
            >
              게스트로 시작
            </Button>
          </View>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  passThroughContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    gap: Spacing.xl,
    ...Elevation.sm,
  },
  hero: {
    gap: Spacing.md,
    alignItems: 'center',
  },
  appIconWrapper: {
    padding: Spacing.xs,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  title: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  message: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.8,
  },
  loadingContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  buttonGroup: {
    gap: Spacing.md,
    width: '100%',
  },
  trustText: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.6,
  },
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    maxWidth: 420,
    width: '92%',
    ...Elevation.sm,
  },
  bannerText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.95,
  },
});
