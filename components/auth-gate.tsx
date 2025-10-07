import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

type AuthGateProps = {
  children: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const { status, user, signInWithGoogle, signInWithApple, error } = useAuth();

  const { isLoading, headline, helper } = useMemo(() => {
    if (status === 'authenticated' && user) {
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
        helper: error ?? '잠시 후 다시 시도해주세요.',
      } as const;
    }
    return {
      isLoading: false,
      headline: 'Blinko에 로그인하고 계속하기',
      helper: 'Google 또는 Apple 계정으로 3초 만에 시작해요.',
    } as const;
  }, [status, user, error]);

  const showAppleButton = Boolean(signInWithApple) && Platform.OS === 'ios';

  if (status === 'authenticated' && user) {
    return <>{children}</>;
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView
        style={styles.card}
        lightColor="rgba(255, 255, 255, 0.96)"
        darkColor="rgba(22, 22, 22, 0.92)"
      >
        <ThemedText type="title" style={styles.title}>
          {headline}
        </ThemedText>
        {helper ? (
          <ThemedText style={styles.message}>{helper}</ThemedText>
        ) : null}
        {isLoading ? (
          <ActivityIndicator size="large" color={Palette.purple600} />
        ) : (
          <>
            <Pressable onPress={signInWithGoogle} style={styles.googleButton}>
              <ThemedText style={styles.googleLabel} lightColor="#ffffff" darkColor="#ffffff">
                Google 계정으로 로그인
              </ThemedText>
            </Pressable>
            {showAppleButton ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={Radius.md}
                style={styles.appleButton}
                onPress={() => {
                  void signInWithApple?.();
                }}
              />
            ) : null}
          </>
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
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    gap: Spacing.lg,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
  googleButton: {
    backgroundColor: '#1a73e8',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  googleLabel: {
    fontWeight: '600',
  },
  appleButton: {
    width: '100%',
    height: 44,
    borderRadius: Radius.md,
  },
});
