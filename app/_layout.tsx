import { AuthGate } from '@/components/auth-gate';
import { resultToastConfig } from '@/components/common/result-toast';
import { ColorSchemeProvider, useColorScheme } from '@/hooks/use-color-scheme';
import { SupabaseAuthProvider } from '@/hooks/use-supabase-auth';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';

export const unstable_settings = {
  anchor: '(tabs)',
};

const HIDDEN_HEADER_OPTIONS = { headerShown: false } as const;

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

  return (
    <SupabaseAuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthGate>
          <Stack screenOptions={HIDDEN_HEADER_OPTIONS}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="daily/index" />
            <Stack.Screen name="room" options={HIDDEN_HEADER_OPTIONS} />
          </Stack>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Toast config={resultToastConfig} />
        </AuthGate>
      </ThemeProvider>
    </SupabaseAuthProvider>
  );
}
