import { useCallback, useState } from "react";
import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function useAuth() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const storeUser = useMutation(api.users.storeUser);

  const handleGoogleButtonPress = useCallback(async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        throw new Error("No ID token found after Google Sign-In.");
      }

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);

      // After successful sign in, store the user in Convex.
      await storeUser();

      return userCredential;
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      throw error; // Re-throw the error to be handled by the caller if needed
    } finally {
      setIsSigningIn(false);
    }
  }, [isSigningIn, storeUser]);

  const signOut = useCallback(async () => {
    try {
      await GoogleSignin.signOut();
      await auth().signOut();
    } catch (error) {
      console.error(error);
    }
  }, []);

  return { isSigningIn, handleGoogleButtonPress, signOut };
}
