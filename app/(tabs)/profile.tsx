import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

export default function ProfileScreen() {
  const { status, user, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  const disabled = isSigningOut || status !== 'authenticated';

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">내 프로필</ThemedText>
      {user ? (
        <View style={styles.profileCard}>
          <ThemedText type="subtitle">{user.handle}</ThemedText>
          <ThemedText>스트릭 {user.streak} · 경험치 {user.xp}</ThemedText>
        </View>
      ) : (
        <ThemedText>로그인하면 스트릭과 코스메틱이 표시됩니다.</ThemedText>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={handleSignOut}
        style={({ pressed }) => [
          styles.signOutButton,
          disabled ? styles.signOutButtonDisabled : null,
          pressed && !disabled ? styles.signOutButtonPressed : null,
        ]}
      >
        {isSigningOut ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <ThemedText style={styles.signOutLabel} lightColor="#ffffff" darkColor="#ffffff">
            로그아웃
          </ThemedText>
        )}
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    gap: Spacing.lg,
  },
  profileCard: {
    gap: Spacing.xs,
  },
  signOutButton: {
    marginTop: 'auto',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.purple600,
  },
  signOutButtonPressed: {
    opacity: 0.85,
  },
  signOutButtonDisabled: {
    backgroundColor: Palette.slate500,
    opacity: 0.5,
  },
  signOutLabel: {
    fontWeight: '600',
  },
});
