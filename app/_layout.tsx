import { GamificationProvider } from '@/context/gamification-context';
import { QuizSetupProvider } from '@/context/quiz-setup-context';
import { getAppVariant } from '@/utils/feature-flags';
import { FirebaseAuthTypes, getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

GoogleSignin.configure({
  webClientId: '819818280538-emjirg8e17j6cc4qhbe98dcsgmshk586.apps.googleusercontent.com',
});

export default function RootLayout() {
  const router = useRouter();
  const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL as string, {
    unsavedChangesWarning: false,
  });

  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null | undefined>(undefined);

  function handleAuthStateChanged(user: FirebaseAuthTypes.User | null) {
    setUser(user ? user : null);
    setInitializing(false);
  }

  useEffect(() => {
    const subscriber = onAuthStateChanged(getAuth(), handleAuthStateChanged);
    return subscriber;
  }, []);

  useEffect(() => {
    if (initializing) return;
    if (user) {
      const variant = getAppVariant();
      if (variant === 'greenfield') {
        router.replace('/(greenfield)');
      } else {
        router.replace('/(tabs)');
      }
    } else {
      router.replace('/(auth)/welcome-screen');
    }
  }, [initializing, user]);

  if (initializing) return null;

  return (
    <ConvexProvider client={convex}>
      <QuizSetupProvider>
        <GamificationProvider>
          <SafeAreaProvider>
            {Platform.OS === 'android' && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 24,
                  backgroundColor: '#FCFCFE',
                  zIndex: 999,
                }}
              />
            )}
            <StatusBar style={Platform.OS === 'android' ? 'dark' : 'auto'} />
            <Stack screenOptions={{ headerShown: false }} />
          </SafeAreaProvider>
        </GamificationProvider>
      </QuizSetupProvider>
    </ConvexProvider>
  );
}
