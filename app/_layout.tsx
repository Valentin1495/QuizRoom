import 'react-native-gesture-handler';
import { Stack, SplashScreen, useRouter, useRootNavigationState } from 'expo-router';
import { ConvexProvider } from 'convex/react';
import convex from '../lib/convexClient';
import { useUserStore } from '@/store/userStore';
import { useEffect, useState } from 'react';

// Prevent the splash screen from auto-hiding before we are ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const { isFirstLaunch, profile } = useUserStore();
  const [hydrated, setHydrated] = useState(false);
  const navigationState = useRootNavigationState();

  useEffect(() => {
    const unsub = useUserStore.persist.onFinishHydration(() => setHydrated(true));
    if (useUserStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return () => unsub?.();
  }, []);

  useEffect(() => {
    // Wait until the navigation state is ready and the store is hydrated.
    if (!hydrated || !navigationState?.key) {
      return;
    }

    SplashScreen.hideAsync();

    if (isFirstLaunch) {
      router.replace('/onboarding');
    } else if (!profile.nickname) {
      router.replace('/profile-setup');
    } else {
      router.replace('/(tabs)/home');
    }
  }, [hydrated, navigationState?.key, isFirstLaunch, profile.nickname, router]);

  return (
    <ConvexProvider client={convex}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* The `index` route is rendered by default while the splash screen is visible */}
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="profile-setup" />
      </Stack>
    </ConvexProvider>
  );
}
