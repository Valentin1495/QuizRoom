import 'react-native-gesture-handler';
import { Stack, useRouter } from 'expo-router';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { useCallback, useEffect, useState } from 'react';
import auth, { FirebaseAuthTypes, onAuthStateChanged, getAuth } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure Google Sign-In. This should only be done once.
GoogleSignin.configure({
  webClientId: '819818280538-mf2mmaknosrcvrb5mssf2lfun5sct27s.apps.googleusercontent.com',
});

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

export default function RootLayout() {
  const router = useRouter();
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

  // Handle user state changes
  function handleAuthStateChanged(user: FirebaseAuthTypes.User |
    null) {
    setUser(user ? user : null);
    setInitializing(false);
  }

  useEffect(() => {
    const subscriber = onAuthStateChanged(getAuth(),
      handleAuthStateChanged);
    return subscriber;      // unsubscribe on unmount                                         
  }, []);

  // Define the function to get the Firebase token
  const getFirebaseIdToken = useCallback(async () => {
    const token = await auth().currentUser?.getIdToken();
    return token ?? null;
  }, []);

  // Set up Convex authentication
  useEffect(() => {
    convex.setAuth(getFirebaseIdToken);
  }, [getFirebaseIdToken]);

  // Handle routing based on authentication state
  useEffect(() => {
    if (initializing) {
      return; // Don't route until initialization is complete
    }

    if (user) {
      // User is signed in, navigate to the main app.
      router.replace('/(tabs)/home');
    } else {
      // User is signed out, navigate to the onboarding screen.
      router.replace('/onboarding');
    }
  }, [initializing, user, router]);

  // While initializing, we can show a splash screen or return null.
  if (initializing) {
    return null;
  }

  return (
    <ConvexProvider client={convex}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="profile-setup" />
      </Stack>
    </ConvexProvider>
  );
}
