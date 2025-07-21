import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { api } from '../convex/_generated/api';

GoogleSignin.configure({
  webClientId:
    '819818280538-emjirg8e17j6cc4qhbe98dcsgmshk586.apps.googleusercontent.com',
});

export const useAuth = () => {
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const createOrUpdateUser = useMutation(api.users.createOrUpdateUser);

  const handleGoogleButtonPress = async () => {
    if (isSigningIn) {
      // console.log('⏳ Already signing in...');
      return;
    }
    setIsSigningIn(true);

    try {
      // console.log('🔍 Checking Google Play Services...');
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      // console.log('🔐 Signing in with Google...');
      const signInResult = await GoogleSignin.signIn();
      // console.log('✅ Google sign-in result:', signInResult);

      const idToken = signInResult.data?.idToken;
      if (!idToken) {
        throw new Error('No ID token found');
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(
        getAuth(),
        googleCredential
      );

      // console.log('🎉 Firebase sign-in successful:', userCredential);

      // Convex DB에 사용자 정보 저장
      const user = userCredential.user;
      await createOrUpdateUser({
        firebaseUid: user.uid,
        email: user.email || '',
        displayName: user.displayName || undefined,
        photoURL: user.photoURL || undefined,
      });

      // console.log('💾 User saved to Convex DB');
      return userCredential;
    } catch (error) {
      console.error('❌ Google Sign-In Error:', error);
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
