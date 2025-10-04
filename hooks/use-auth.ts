import { useState } from "react";
import { getAuth, GoogleAuthProvider, signInWithCredential, signOut } from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useUserStore } from "@/store/userStore";
import * as SecureStore from 'expo-secure-store';

export function useAuth() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const storeUser = useMutation(api.users.storeUser);
  const mergeGuestData = useMutation(api.users.mergeGuestData);
  const { guestId, login } = useUserStore((s) => ({ guestId: s.guestId, login: s.login }));

  const handleGoogleButtonPress = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);

    try {
      // Check if your device supports Google Play
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Get the users ID token
      const signInResult = await GoogleSignin.signIn();

      // Try the new style of google-sign in result, from v13+ of that module
      const idToken = signInResult.data?.idToken;
      if (!idToken) {
        throw new Error('No ID token found');
      }
      // Create a Google credential with the token
      const googleCredential = GoogleAuthProvider.credential(idToken);

      // Sign-in the user with the credential
      const userCredential = await signInWithCredential(getAuth(), googleCredential);

      // After successful sign-in, store the user in Convex
      await storeUser();

      // Check if there is guest data to merge
      if (guestId) {
        await mergeGuestData({ guestId });
        // Clear guest data after merging
        await SecureStore.deleteItemAsync('guestId');
        login(); // This will clear guestId from Zustand store
      }


      return userCredential;
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      throw error; // Re-throw the error to be handled by the caller if needed
    } finally {
      setIsSigningIn(false);
    }
  }

  const googleSignOut = async () => {
    try {
      await signOut(getAuth())
    } catch (error) {
      console.error(error);
    }
  };

  return { isSigningIn, handleGoogleButtonPress, googleSignOut };
}
