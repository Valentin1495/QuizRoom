import { useCallback, useEffect, useState } from "react";
import auth, { FirebaseAuthTypes, onAuthStateChanged, getAuth } from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

// It's recommended to retrieve this from your google-services.json
// or configure it in a central place.
GoogleSignin.configure({
  webClientId: '819818280538-emjirg8e17j6cc4qhbe98dcsgmshk586.apps.googleusercontent.com',
});

export function useAuth() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);


  function handleAuthStateChanged(user: FirebaseAuthTypes.User | null) {
    setUser(user ? user : null);
    setInitializing(false);
  }

  useEffect(() => {
    const subscriber = onAuthStateChanged(getAuth(), handleAuthStateChanged);
    return subscriber;
  }, []);



  const signInWithGoogle = useCallback(async () => {
    try {
      await GoogleSignin.hasPlayServices();
      // First, sign in to establish a session
      await GoogleSignin.signIn();
      // Then, get the tokens for the signed-in user
      const { idToken } = await GoogleSignin.getTokens();

      if (!idToken) {
        throw new Error("Google Sign-In failed: idToken is missing from getTokens().");
      }

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(googleCredential);
    } catch (error) {
      console.error("Google Sign-In Error:", error);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await GoogleSignin.signOut();
      await auth().signOut();
    } catch (error) {
      console.error(error);
    }
  }, []);

  const getFirebaseIdToken = useCallback(async () => {
    const token = await auth().currentUser?.getIdToken();
    return token ?? null;
  }, []);

  return { user, initializing, signInWithGoogle, signOut, getFirebaseIdToken };
}
