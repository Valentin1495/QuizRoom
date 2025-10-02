import { ActivityIndicator, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { Colors } from '@/theme/tokens';
import { useEffect, useState } from 'react';

export default function AppEntry() {
  const router = useRouter();
  const { isFirstLaunch, profile } = useUserStore();
  const [hydrated, setHydrated] = useState(() => useUserStore.persist.hasHydrated());
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    const unsub = useUserStore.persist.onFinishHydration(() => setHydrated(true));
    if (useUserStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return () => unsub?.();
  }, []);

  useEffect(() => {
    // Wait until the root navigator is ready AND the store is hydrated
    if (!rootNavigationState?.key || !hydrated) {
      return;
    }

    if (isFirstLaunch) {
      router.replace('/onboarding');
      return;
    }

    if (!profile.nickname) {
      router.replace('/profile-setup');
      return;
    }

    router.replace('/(tabs)/home');
  }, [hydrated, rootNavigationState?.key, isFirstLaunch, profile.nickname, router]);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
      }}
    >
      <ActivityIndicator color={Colors.accent} size="large" />
    </View>
  );
}
