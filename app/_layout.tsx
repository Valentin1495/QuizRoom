import 'react-native-gesture-handler';
import { Stack, SplashScreen, useRouter, useRootNavigationState } from 'expo-router';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { useUserStore } from '@/store/userStore';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/use-auth';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

// Prevent the splash screen from auto-hiding before we are ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const { isFirstLaunch, profile } = useUserStore();
  const [hydrated, setHydrated] = useState(false);
  const navigationState = useRootNavigationState();
  const { initializing, getFirebaseIdToken, user } = useAuth();

  useEffect(() => {
    convex.setAuth(getFirebaseIdToken);
  }, [getFirebaseIdToken]);

  useEffect(() => {
    const unsub = useUserStore.persist.onFinishHydration(() => setHydrated(true));
    if (useUserStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return () => unsub?.();
  }, []);

  useEffect(() => {
    // Wait until auth is loaded, navigation is ready, and the store is hydrated.
    if (initializing || !hydrated || !navigationState?.key) {
      return;
    }

    SplashScreen.hideAsync();

    if (isFirstLaunch) {
      router.replace('/onboarding');
    }
    else if (!profile.nickname) {
      router.replace('/profile-setup');
    }
    else {
      // This part might need adjustment based on whether you want to
      // redirect to home immediately or wait for firebase auth state.
      // For now, it respects the existing logic.
      router.replace('/(tabs)/home');
    }
  }, [initializing, hydrated, navigationState?.key, isFirstLaunch, profile.nickname, router]);

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
