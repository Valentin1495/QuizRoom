import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConvexReactClient, useMutation } from "convex/react";
import * as AppleAuthentication from "expo-apple-authentication";
import type { DiscoveryDocument } from "expo-auth-session";
import Constants, { ExecutionEnvironment } from "expo-constants";
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

type AuthSessionModule = typeof import("expo-auth-session");

type AuthProviderName = "google" | "apple";

type AuthStatus = "loading" | "unauthenticated" | "authorizing" | "authenticated" | "error";

type AuthTokens = {
  provider: AuthProviderName;
  idToken: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  clientId?: string;
};

type AuthContextValue = {
  status: AuthStatus;
  user: AuthedUser | null;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: (() => Promise<void>) | null;
  signOut: () => Promise<void>;
  error: string | null;
  isConvexReady: boolean;
  refreshUser: () => Promise<void>;
};

type AuthedUser = {
  id: Id<"users">;
  handle: string;
  avatarUrl?: string;
  provider: string;
  streak: number;
  xp: number;
  interests: string[];
};

const TOKEN_STORAGE_KEY = "blinkoAuthTokens";

const googleDiscovery: DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

const AUTH_REDIRECT_PATH = process.env.EXPO_PUBLIC_AUTH_REDIRECT_PATH ?? "auth/redirect";
const GOOGLE_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let authSessionModulePromise: Promise<AuthSessionModule> | null = null;

async function ensureAuthSessionModule() {
  if (!authSessionModulePromise) {
    authSessionModulePromise = import("expo-auth-session");
  }

  try {
    return await authSessionModulePromise;
  } catch (error) {
    authSessionModulePromise = null;
    throw error;
  }
}

function isExpoWebBrowserMissing(error: unknown) {
  return error instanceof Error && error.message.includes("ExpoWebBrowser");
}

function getAuthSessionUnavailableMessage() {
  return (
    "Expo WebBrowser native module이 빌드에 포함되어 있지 않습니다. " +
    "최신 Expo Go 또는 재빌드한 개발 클라이언트에서 다시 시도해주세요."
  );
}

function detectExpoClient() {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function resolveGoogleClientId() {
  const expoClientId = process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID;
  if (detectExpoClient() && expoClientId) {
    return expoClientId;
  }

  const platformSpecific = Platform.select<string | undefined>({
    ios:
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    android:
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    default:
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  });

  const fallback = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const resolved = platformSpecific ?? fallback;

  if (!resolved) {
    throw new Error(
      "Google 로그인을 위해 필요한 클라이언트 ID 환경 변수(EXPO_PUBLIC_GOOGLE_CLIENT_ID 등)가 설정되지 않았습니다."
    );
  }

  return resolved;
}

async function storeTokens(tokens: AuthTokens | null) {
  if (tokens === null) {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    }
    return;
  }

  const payload = JSON.stringify(tokens);

  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, payload);
    }
    return;
  }

  await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, payload);
}

function parseStoredTokens(payload: string | null): AuthTokens | null {
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as Partial<AuthTokens>;
    if (!parsed || typeof parsed !== "object" || !parsed.idToken || !parsed.provider) {
      return null;
    }
    return parsed as AuthTokens;
  } catch {
    return null;
  }
}

async function loadTokens(): Promise<AuthTokens | null> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") {
      return null;
    }

    const payload = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return parseStoredTokens(payload);
  }

  const payload = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
  return parseStoredTokens(payload);
}

function computeRedirectUri(AuthSession: AuthSessionModule) {
  const fallbackScheme = Constants.expoConfig?.scheme;
  const configuredScheme = process.env.EXPO_PUBLIC_APP_SCHEME ?? fallbackScheme;
  const scheme = Array.isArray(configuredScheme) ? configuredScheme[0] : configuredScheme;

  const forcedProxyEnv = process.env.EXPO_PUBLIC_AUTH_USE_PROXY?.toLowerCase();
  const forcedProxy = forcedProxyEnv === "true" ? true : forcedProxyEnv === "false" ? false : undefined;

  const shouldUseProxy =
    Platform.OS !== "web" && (forcedProxy ?? Constants.executionEnvironment === ExecutionEnvironment.StoreClient);

  if (shouldUseProxy) {
    const projectFullName =
      process.env.EXPO_PUBLIC_AUTH_PROXY_PROJECT ?? Constants.expoConfig?.originalFullName;
    if (projectFullName) {
      return encodeURI(`https://auth.expo.io/${projectFullName}`);
    }
    console.warn(
      "Expo Auth proxy를 사용할 수 없습니다. project full name이 필요해서 native redirect로 대체합니다."
    );
  }

  return AuthSession.makeRedirectUri({
    path: AUTH_REDIRECT_PATH,
    scheme,
  });
}

function buildGoogleSignInError(resultType: string) {
  switch (resultType) {
    case "dismiss":
    case "cancel":
      return "로그인이 취소되었어요.";
    default:
      return "Google 로그인에 실패했습니다. 다시 시도해주세요.";
  }
}

export function AuthProvider({
  client,
  children,
}: {
  client: ConvexReactClient;
  children: ReactNode;
}) {
  const ensureSelf = useMutation(api.users.ensureSelf);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [isConvexReady, setIsConvexReady] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const tokensRef = useRef<AuthTokens | null>(null);
  const hasEnsuredRef = useRef(false);

  const refreshTokens = useCallback(async () => {
    const existing = tokensRef.current;
    if (!existing) {
      throw new Error("No authentication state available");
    }
    if (existing.provider !== "google") {
      throw new Error("현재 공급자는 토큰 갱신을 지원하지 않습니다.");
    }
    if (!existing.refreshToken) {
      throw new Error("Refresh token이 없습니다. 다시 로그인해주세요.");
    }

    const clientId = existing.clientId ?? resolveGoogleClientId();

    const response = await fetch(googleDiscovery.tokenEndpoint!, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: existing.refreshToken,
        client_id: clientId,
        ...(GOOGLE_CLIENT_SECRET ? { client_secret: GOOGLE_CLIENT_SECRET } : {}),
      }).toString(),
    });

    if (!response.ok) {
      throw new Error("Google 토큰을 갱신하지 못했습니다.");
    }

    const payload = await response.json();
    if (!payload.id_token) {
      throw new Error("Google 갱신 응답에 id_token이 없습니다.");
    }

    const updated: AuthTokens = {
      provider: "google",
      idToken: payload.id_token,
      accessToken: payload.access_token ?? existing.accessToken,
      refreshToken: payload.refresh_token ?? existing.refreshToken,
      expiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : existing.expiresAt,
      clientId,
    };

    tokensRef.current = updated;
    await storeTokens(updated);
    return updated;
  }, []);

  const bumpAuthVersion = useCallback(() => {
    client.setAuth(
      async ({ forceRefreshToken }) => {
        const current = tokensRef.current;
        if (!current) {
          return null;
        }

        if (forceRefreshToken) {
          if (current.provider === "google" && current.refreshToken) {
            try {
              const refreshed = await refreshTokens();
              return refreshed.idToken;
            } catch (refreshError) {
              await storeTokens(null);
              tokensRef.current = null;
              setUser(null);
              setStatus("unauthenticated");
              setError(
                refreshError instanceof Error
                  ? refreshError.message
                  : "세션이 만료되었습니다. 다시 로그인해주세요."
              );
              return null;
            }
          }
          return current.idToken;
        }
        return current.idToken;
      },
      (authenticated) => {
        if (!authenticated) {
          hasEnsuredRef.current = false;
        }
        setIsConvexReady(authenticated);
      }
    );
  }, [client, refreshTokens]);

  const ensureUser = useCallback(async () => {
    if (hasEnsuredRef.current || !isConvexReady || !tokensRef.current) {
      return;
    }
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
      });
      setStatus("authenticated");
      setError(null);
      hasEnsuredRef.current = true;
    } catch (err) {
      hasEnsuredRef.current = false;
      setStatus("error");
      setError(err instanceof Error ? err.message : "사용자 정보를 불러오지 못했습니다.");
    }
  }, [ensureSelf, isConvexReady]);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      setIsAppleAvailable(false);
      return;
    }

    let mounted = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (mounted) {
          setIsAppleAvailable(available);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsAppleAvailable(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

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

  const signInWithGoogle = useCallback(async () => {
    setStatus("authorizing");
    setError(null);

    let AuthSession: AuthSessionModule;
    let redirectUri: string;
    let clientId: string;

    try {
      AuthSession = await ensureAuthSessionModule();
      redirectUri = computeRedirectUri(AuthSession);
      clientId = resolveGoogleClientId();
    } catch (error) {
      console.error("Failed to prepare google auth session", error);
      setStatus("unauthenticated");
      setError(
        isExpoWebBrowserMissing(error)
          ? getAuthSessionUnavailableMessage()
          : error instanceof Error
            ? error.message
            : "로그인 모듈을 불러오지 못했습니다."
      );
      return;
    }

    try {
      const authRequest = new AuthSession.AuthRequest({
        clientId,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        scopes: ["openid", "profile", "email"],
        usePKCE: true,
        extraParams: {
          access_type: "offline",
          prompt: "consent",
          nonce: Math.random().toString(36).slice(2),
        },
      });

      await authRequest.makeAuthUrlAsync(googleDiscovery);

      const result = await authRequest.promptAsync(googleDiscovery);

      if (result.type !== "success" || !result.params?.code) {
        setStatus("unauthenticated");
        setError(buildGoogleSignInError(result.type));
        return;
      }

      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId,
          code: result.params.code,
          redirectUri,
          extraParams: {
            code_verifier: authRequest.codeVerifier ?? "",
            ...(GOOGLE_CLIENT_SECRET ? { client_secret: GOOGLE_CLIENT_SECRET } : {}),
          },
        },
        googleDiscovery
      );

      if (!tokenResponse?.idToken) {
        setStatus("unauthenticated");
        setError("Google 로그인에 실패했습니다. 다시 시도해주세요.");
        return;
      }

      const tokens: AuthTokens = {
        provider: "google",
        idToken: tokenResponse.idToken,
        accessToken: tokenResponse.accessToken ?? undefined,
        refreshToken: tokenResponse.refreshToken ?? undefined,
        expiresAt: tokenResponse.expiresIn ? Date.now() + tokenResponse.expiresIn * 1000 : undefined,
        clientId,
      };

      tokensRef.current = tokens;
      await storeTokens(tokens);
      hasEnsuredRef.current = false;
      bumpAuthVersion();
      setStatus("loading");
    } catch (error) {
      console.error("Google sign-in failed", error);
      setStatus("unauthenticated");
      setError(
        isExpoWebBrowserMissing(error)
          ? getAuthSessionUnavailableMessage()
          : error instanceof Error
            ? error.message
            : "Google 로그인 중 문제가 발생했어요."
      );
    }
  }, [bumpAuthVersion]);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== "ios") {
      setStatus("unauthenticated");
      setError("Apple 로그인을 지원하지 않는 기기입니다.");
      return;
    }

    setStatus("authorizing");
    setError(null);

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        setStatus("unauthenticated");
        setError("Apple 로그인에 실패했습니다. 다시 시도해주세요.");
        return;
      }

      const tokens: AuthTokens = {
        provider: "apple",
        idToken: credential.identityToken,
      };

      tokensRef.current = tokens;
      await storeTokens(tokens);
      hasEnsuredRef.current = false;
      bumpAuthVersion();
      setStatus("loading");
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code?: string }).code === "ERR_CANCELED"
      ) {
        setStatus("unauthenticated");
        setError("로그인이 취소되었어요.");
        return;
      }

      console.error("Apple sign-in failed", error);
      setStatus("unauthenticated");
      setError(
        error instanceof Error ? error.message : "Apple 로그인 중 문제가 발생했어요."
      );
    }
  }, [bumpAuthVersion]);

  const signOut = useCallback(async () => {
    tokensRef.current = null;
    await storeTokens(null);
    hasEnsuredRef.current = false;
    client.clearAuth();
    bumpAuthVersion();
    setUser(null);
    setStatus("unauthenticated");
    setError(null);
  }, [bumpAuthVersion, client]);

  const refreshUser = useCallback(async () => {
    hasEnsuredRef.current = false;
    if (tokensRef.current) {
      await ensureUser();
    }
  }, [ensureUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signInWithGoogle,
      signInWithApple: isAppleAvailable ? signInWithApple : null,
      signOut,
      error,
      isConvexReady,
      refreshUser,
    }),
    [status, user, signInWithGoogle, signInWithApple, signOut, error, isConvexReady, refreshUser, isAppleAvailable]
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
