import { Colors } from '@/constants/Colors';
import { useSSO } from '@clerk/clerk-expo';
import * as AuthSession from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const useWarmUpBrowser = () => {
  useEffect(() => {
    // Preloads the browser for Android devices to reduce authentication load time
    // See: https://docs.expo.dev/guides/authentication/#improving-user-experience
    void WebBrowser.warmUpAsync();
    return () => {
      // Cleanup: closes browser when component unmounts
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

// Handle any pending authentication sessions
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  useWarmUpBrowser();
  const router = useRouter();

  // Use the `useSSO()` hook to access the `startSSOFlow()` method
  const { startSSOFlow } = useSSO();

  const signInWithGoogle = useCallback(async () => {
    try {
      // Start the authentication process by calling `startSSOFlow()`
      const { createdSessionId, setActive, signIn, signUp } =
        await startSSOFlow({
          strategy: 'oauth_google',
          // For web, defaults to current path
          // For native, you must pass a scheme, like AuthSession.makeRedirectUri({ scheme, path })
          // For more info, see https://docs.expo.dev/versions/latest/sdk/auth-session/#authsessionmakeredirecturioptions
          redirectUrl: AuthSession.makeRedirectUri(),
        });

      // If sign in was successful, set the active session
      if (createdSessionId) {
        setActive!({ session: createdSessionId });
        router.replace('/(tabs)');
      } else {
        // If there is no `createdSessionId`,
        // there are missing requirements, such as MFA
        // Use the `signIn` or `signUp` returned from `startSSOFlow`
        // to handle next steps
      }
    } catch (err) {
      // See https://clerk.com/docs/custom-flows/error-handling
      // for more info on error handling
      console.error(JSON.stringify(err, null, 2));
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topContainer}>
        <Image source={require('@/assets/images/Book-Globe.png')} />
        <Image
          source={require('@/assets/images/Education-Book.png')}
          style={{ position: 'absolute', top: 0, left: 0 }}
        />
        <Image
          source={require('@/assets/images/coins2.png')}
          style={{ position: 'absolute', top: 36, left: 180 }}
        />
        <Image
          source={require('@/assets/images/coins1.png')}
          style={{ position: 'absolute', top: -18, right: 0 }}
        />
        <Image
          source={require('@/assets/images/coins4.png')}
          style={{ position: 'absolute', top: 480, left: 60 }}
        />
        <Image
          source={require('@/assets/images/Book-Stacks.png')}
          style={{ position: 'absolute', top: 480, right: 50 }}
        />
      </View>

      <View style={styles.bottomContainer}>
        <Text style={styles.h1}>퀴즈로 뇌를 깨워볼 시간!</Text>
        <Text style={styles.h2}>
          <Text style={styles.appName}>Mindshot</Text>과 함께 성장해보세요!
        </Text>

        <TouchableOpacity
          onPress={signInWithGoogle}
          style={styles.button}
          activeOpacity={0.8}
        >
          <Image
            source={require('@/assets/images/google-logo.png')}
            style={styles.googleLogo}
          />
          <Text style={styles.buttonText}>구글 로그인</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.primary,
  },
  topContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bottomContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
    marginBottom: 40,
  },
  h1: {
    color: '#fff',
    fontSize: 32,
    letterSpacing: 0.4,
    fontWeight: '500',
  },
  h2: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  button: {
    width: 335,
    height: 60,
    backgroundColor: '#fff',
    borderRadius: 100,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: Colors.light.text,
    lineHeight: 24,
    letterSpacing: 0.4,
    fontWeight: '700',
    fontSize: 14,
  },
  googleLogo: {
    position: 'absolute',
    left: 42,
    top: '50%',
    transform: [{ translateY: -12 }], // 이미지 높이의 절반만큼 올려서 수직 중앙 정렬
  },
  appName: {
    fontWeight: '700',
    fontSize: 17,
  },
});
