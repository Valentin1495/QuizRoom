import { AuthGate } from '@/components/auth-gate';
import { AuthProvider } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ConvexProvider client={convex}>
      <AuthProvider client={convex}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthGate>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="daily/index"
                options={{ title: '데일리 블링크', headerBackButtonDisplayMode: 'minimal' }}
              />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </AuthGate>
        </ThemeProvider>
      </AuthProvider>
    </ConvexProvider>
  );
}
