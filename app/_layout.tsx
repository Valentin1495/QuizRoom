import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { ConvexProvider } from 'convex/react';
import convex from '../lib/convexClient';

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="profile-setup" />
      </Stack>
    </ConvexProvider>
  );
}
