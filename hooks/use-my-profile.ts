import { api } from '@/convex/_generated/api';
import {
  FirebaseAuthTypes,
  getAuth,
  onAuthStateChanged,
} from '@react-native-firebase/auth';
import { useQuery } from 'convex/react';
import { useEffect, useState } from 'react';

export function useMyProfile() {
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (currentUser) {
      setFirebaseUid(currentUser.uid);
    } else {
      const unsubscribe = onAuthStateChanged(
        auth,
        (user: FirebaseAuthTypes.User | null) => {
          setFirebaseUid(user?.uid ?? null);
        }
      );
      return unsubscribe;
    }
  }, []);

  const myProfile = useQuery(
    api.users.getUserByFirebaseUid,
    firebaseUid ? { firebaseUid } : 'skip'
  );

  return { myProfile, firebaseUid };
}
