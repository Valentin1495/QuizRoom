import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  FirebaseAuthTypes,
  signOut as firebaseSignOut,
  getAuth,
  getIdToken,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
} from "@react-native-firebase/auth";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { ConvexReactClient, useMutation } from "convex/react";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

type AuthStatus = "loading" | "unauthenticated" | "authorizing" | "authenticated" | "guest" | "error";

type AuthTokens = {
  idToken: string;
  provider?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  clientId?: string;
};

type AuthContextValue = {
  status: AuthStatus;
  user: AuthedUser | null;
  guestKey: string | null;
  setAuthTokens: (tokens: AuthTokens) => Promise<void>;
  beginAuthorizing: () => void;
  failAuthorizing: (message: string) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  enterGuestMode: () => Promise<void>;
  ensureGuestKey: () => Promise<string>;
  error: string | null;
  isConvexReady: boolean;
  refreshUser: () => Promise<void>;
  resetUser: () => Promise<void>;
};

type AuthedUser = {
  id: Id<"users">;
  handle: string;
  avatarUrl?: string;
  provider: string;
  streak: number;
  xp: number;
  totalCorrect: number;
  totalPlayed: number;
  interests: string[];
};

const TOKEN_STORAGE_KEY = "quizroomAuthTokens";
const GUEST_KEY_STORAGE_KEY = "quizroomGuestKey";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

GoogleSignin.configure({
  webClientId: '726867887633-8buje4l38mrpp0p98i8vh1k0jijqvuol.apps.googleusercontent.com',
});

function generateGuestKey() {
  return `gr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function storeTokens(tokens: AuthTokens | null) {
  const key = TOKEN_STORAGE_KEY;
  if (tokens === null) {
    if (Platform.OS === "web") {
      window.localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
    return;
  }
  const payload = JSON.stringify(tokens);
  if (Platform.OS === "web") {
    window.localStorage.setItem(key, payload);
  } else {
    await SecureStore.setItemAsync(key, payload);
  }
}

async function storeGuestKeyValue(value: string) {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(GUEST_KEY_STORAGE_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(GUEST_KEY_STORAGE_KEY, value);
}

async function loadGuestKeyValue(): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(GUEST_KEY_STORAGE_KEY);
  }
  return SecureStore.getItemAsync(GUEST_KEY_STORAGE_KEY);
}

function parseStoredTokens(payload: string | null): AuthTokens | null {
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as Partial<AuthTokens>;
    if (!parsed || typeof parsed !== "object" || !parsed.idToken) return null;
    return parsed as AuthTokens;
  } catch {
    return null;
  }
}

async function loadTokens(): Promise<AuthTokens | null> {
  const key = TOKEN_STORAGE_KEY;
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return null;
    const payload = window.localStorage.getItem(key);
    return parseStoredTokens(payload);
  }
  const payload = await SecureStore.getItemAsync(key);
  return parseStoredTokens(payload);
}

export function AuthProvider({
  client,
  children,
}: {
  client: ConvexReactClient;
  children: ReactNode;
}) {
  const ensureSelf = useMutation(api.users.ensureSelf);
  const resetSelf = useMutation(api.users.resetSelf);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [guestKey, setGuestKey] = useState<string | null>(null);
  const [isConvexReady, setIsConvexReady] = useState(false);
  const tokensRef = useRef<AuthTokens | null>(null);
  const hasEnsuredRef = useRef(false);

  const bumpAuthVersion = useCallback(() => {
    client.setAuth(
      async () => {
        const current = tokensRef.current;
        if (!current) return null;
        return current.idToken;
      },
      (authenticated) => {
        if (!authenticated) hasEnsuredRef.current = false;
        setIsConvexReady(authenticated);
      }
    );
  }, [client]);

  const clearAuthState = useCallback(
    async (nextStatus: AuthStatus = "unauthenticated") => {
      tokensRef.current = null;
      await storeTokens(null);
      hasEnsuredRef.current = false;
      client.clearAuth();
      bumpAuthVersion();
      setUser(null);
      setStatus(nextStatus);
      setError(null);
    },
    [bumpAuthVersion, client]
  );

  useEffect(() => {
    (async () => {
      try {
        const stored = await loadGuestKeyValue();
        if (stored) {
          setGuestKey(stored);
          return;
        }
        const generated = generateGuestKey();
        setGuestKey(generated);
        await storeGuestKeyValue(generated);
      } catch (err) {
        console.warn("Failed to initialize guest key", err);
      }
    })();
  }, []);

  const ensureUser = useCallback(async () => {
    if (status === "guest") return;
    if (hasEnsuredRef.current || !isConvexReady || !tokensRef.current) return;
    try {
      const payload = await ensureSelf({});
      setUser({
        id: payload.userId,
        handle: payload.handle,
        avatarUrl: payload.avatarUrl ?? undefined,
        provider: payload.provider,
        streak: payload.streak,
        xp: payload.xp,
        interests: payload.interests,
        totalCorrect: payload.totalCorrect,
        totalPlayed: payload.totalPlayed,
      });
      setStatus("authenticated");
      setError(null);
      hasEnsuredRef.current = true;
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("NOT_AUTHENTICATED")
      ) {
        await clearAuthState("unauthenticated");
        return;
      }
      hasEnsuredRef.current = false;
      setStatus("error");
      setError(err instanceof Error ? err.message : "사용자 정보를 불러오지 못했습니다.");
    }
  }, [clearAuthState, ensureSelf, isConvexReady, status]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await loadTokens();
        if (stored) {
          tokensRef.current = stored;
          setStatus("loading");
          bumpAuthVersion();
        } else {
          setStatus("unauthenticated");
        }
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "세션 정보를 불러오지 못했어요.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isConvexReady && tokensRef.current) {
      void ensureUser();
    }
  }, [ensureUser, isConvexReady]);

  const ensureGuestKeyValue = useCallback(async () => {
    if (guestKey) {
      return guestKey;
    }
    const stored = await loadGuestKeyValue();
    if (stored) {
      setGuestKey(stored);
      return stored;
    }
    const generated = generateGuestKey();
    setGuestKey(generated);
    await storeGuestKeyValue(generated);
    return generated;
  }, [guestKey]);

  const beginAuthorizing = useCallback(() => {
    setStatus("authorizing");
    setError(null);
  }, []);

  const failAuthorizing = useCallback((message: string) => {
    setStatus("error");
    setError(message);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setStatus("authorizing");
    setError(null);
    try {
      // Check if your device supports Google Play
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Get the users ID token
      const signInResult = await GoogleSignin.signIn();
      // Try the new style of google-sign in result, from v13+ of that module
      const idToken =
        signInResult.data?.idToken ??
        (signInResult as { idToken?: string }).idToken ??
        null;
      if (!idToken) {
        throw new Error("Google ID 토큰을 가져오지 못했습니다.");
      }
      // Create a Google credential with the token
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(getAuth(), credential);
      setStatus("loading");
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === statusCodes.SIGN_IN_CANCELLED) {
        setStatus("unauthenticated");
        setError("로그인이 취소되었어요.");
        return;
      }
      if (code === statusCodes.IN_PROGRESS) {
        setError("이미 로그인 중입니다.");
        return;
      }
      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setStatus("error");
        setError("Google Play 서비스를 사용할 수 없습니다. 업데이트 후 다시 시도해주세요.");
        return;
      }
      await GoogleSignin.signOut().catch(() => undefined);
      console.error("Google sign-in failed", error);
      setStatus("error");
      setError(
        error instanceof Error
          ? error.message
          : "Google 로그인 중 문제가 발생했어요."
      );
    }
  }, []);

  const setAuthTokens = useCallback(
    async (tokens: AuthTokens) => {
      tokensRef.current = tokens;
      await storeTokens(tokens);
      hasEnsuredRef.current = false;
      bumpAuthVersion();
      setStatus("loading");
      setError(null);
    },
    [bumpAuthVersion]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), async (firebaseUser: FirebaseAuthTypes.User | null) => {
      if (!firebaseUser) {
        await clearAuthState();
        return;
      }

      try {
        const idToken = await getIdToken(firebaseUser);
        const existing = tokensRef.current;
        if (existing?.idToken === idToken) {
          return;
        }
        await setAuthTokens({
          idToken,
          provider:
            firebaseUser.providerData[0]?.providerId ??
            firebaseUser.providerId ??
            "firebase",
        });
      } catch (err) {
        console.error("Failed to process Firebase auth state change", err);
        setStatus("error");
        setError(err instanceof Error ? err.message : "로그인 정보를 불러오지 못했습니다.");
      }
    });

    return unsubscribe;
  }, [clearAuthState, setAuthTokens]);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(getAuth());
      console.log("Firebase signOut success");
    } catch (err) {
      console.error("Firebase signOut failed", err);
    }
    await clearAuthState("unauthenticated");
  }, [clearAuthState]);

  const enterGuestMode = useCallback(async () => {
    try {
      await firebaseSignOut(getAuth());
    } catch (err) {
      console.warn("Firebase signOut failed during guest mode transition", err);
    }
    await ensureGuestKeyValue();
    await clearAuthState("guest");
  }, [clearAuthState, ensureGuestKeyValue]);

  const refreshUser = useCallback(async () => {
    hasEnsuredRef.current = false;
    if (tokensRef.current) {
      await ensureUser();
    }
  }, [ensureUser]);

  const resetUser = useCallback(async () => {
    try {
      await firebaseSignOut(getAuth());
    } catch (err) {
      console.error("Firebase signOut failed, proceeding with account deletion", err);
    }
    await resetSelf();
    await clearAuthState();
  }, [resetSelf, clearAuthState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      guestKey,
      setAuthTokens,
      beginAuthorizing,
      failAuthorizing,
      signInWithGoogle,
      enterGuestMode,
      signOut,
      ensureGuestKey: ensureGuestKeyValue,
      error,
      isConvexReady,
      refreshUser,
      resetUser,
    }),
    [
      status,
      user,
      guestKey,
      setAuthTokens,
      beginAuthorizing,
      failAuthorizing,
      signInWithGoogle,
      enterGuestMode,
      signOut,
      ensureGuestKeyValue,
      error,
      isConvexReady,
      refreshUser,
      resetUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
