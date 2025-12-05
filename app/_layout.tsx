import { AuthGate } from '@/components/auth-gate';
import { resultToastConfig } from '@/components/common/result-toast';
import { AuthProvider } from '@/hooks/use-auth';
import { ColorSchemeProvider, useColorScheme } from '@/hooks/use-color-scheme';
import { SupabaseAuthProvider } from '@/hooks/use-supabase-auth';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ColorSchemeProvider>
        <RootLayoutContent />
      </ColorSchemeProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutContent() {
  const colorScheme = useColorScheme();

  // Both providers are always present to allow gradual migration
  // AuthGate and components use FEATURE_FLAGS.auth to decide which to use
  return (
    <ConvexProvider client={convex}>
      <AuthProvider client={convex}>
        <SupabaseAuthProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AuthGate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="daily/index" />
                <Stack.Screen name="room" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
              <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
              <Toast config={resultToastConfig} />
            </AuthGate>
          </ThemeProvider>
        </SupabaseAuthProvider>
      </AuthProvider>
    </ConvexProvider>
  );
}
