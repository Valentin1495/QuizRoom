import { log } from '@/utils/log';
import { logError } from '@/utils/log-error';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { api } from '../convex/_generated/api';

export const useAuth = () => {
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const createOrUpdateUser = useMutation(api.users.createOrUpdateUser);

  const handleGoogleButtonPress = async () => {
    if (isSigningIn) {
      log('⏳ Already signing in...');
      return;
    }
    setIsSigningIn(true);

    try {
      log('🔍 Checking Google Play Services...');
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      log('🔐 Signing in with Google...');
      const signInResult = await GoogleSignin.signIn();
      log('✅ Google sign-in result:', signInResult);

      const idToken = signInResult.data?.idToken;
      if (!idToken) {
        throw new Error('No ID token found');
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(
        getAuth(),
        googleCredential
      );

      log('🎉 Firebase sign-in successful:', userCredential);

      // Convex DB에 사용자 정보 저장
      const user = userCredential.user;
      await createOrUpdateUser({
        firebaseUid: user.uid,
        email: user.email || '',
        displayName: user.displayName || undefined,
        photoURL: user.photoURL || undefined,
      });

      log('💾 User saved to Convex DB');
      return userCredential;
    } catch (error) {
      logError('❌ Google Sign-In Error:', error);
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  };

  return {
    isSigningIn,
    handleGoogleButtonPress,
  };
};
