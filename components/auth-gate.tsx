import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Button, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

type AuthGateProps = {
  children: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const { status, user, error, signInWithGoogle, enterGuestMode } = useAuth();

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
        helper: error ?? '잠시 후 다시 시도해주세요.',
      } as const;
    }
    return {
      isLoading: false,
      headline: 'QuizRoom에 로그인하고 계속하기',
      helper: 'Google 계정으로 간편하게 로그인하세요.',
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
            <View style={styles.buttonWrapper}>
              <Button
                title="Google 계정으로 로그인"
                onPress={() => {
                  void signInWithGoogle();
                }}
                color="#1a73e8"
                disabled={status === 'authorizing'}
              />
            </View>
            <View style={styles.buttonWrapper}>
              <Button
                title="로그인 없이 둘러보기"
                onPress={() => {
                  void enterGuestMode();
                }}
                color={Palette.slate500}
                disabled={status === 'authorizing'}
              />
            </View>
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
  buttonWrapper: {
    width: '100%',
  },
});
