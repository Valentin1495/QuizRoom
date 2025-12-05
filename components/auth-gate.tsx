import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useConvexAuth } from '@/hooks/use-auth';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

type AuthGateProps = {
  children: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  // Use appropriate auth based on feature flag
  const convexAuth = useConvexAuth();
  const supabaseAuth = useSupabaseAuth();

  const { status, user, error, signInWithGoogle, enterGuestMode } = FEATURE_FLAGS.auth
    ? supabaseAuth
    : convexAuth;
  const primaryColor = useThemeColor({}, 'primary');

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
      helper: 'Google 계정으로 간편하게 로그인하고 \n 실시간 지식 배틀에 합류하세요!',
    } as const;
  }, [status, user, error]);

  if (status === 'authenticated' && user) {
    return <>{children}</>;
  }

  if (status === 'guest' || status === 'upgrading') {
    return <>{children}</>;
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
});
