/**
 * Supabase Auth Hook
 * Replaces Firebase Auth + Convex session management
 */

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import { supabase, type User } from '@/lib/supabase';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'authorizing'
  | 'authenticated'
  | 'guest'
  | 'error'
  | 'upgrading';

type AuthedUser = {
  id: string;
  handle: string;
  avatarUrl?: string;
  provider: string;
  streak: number;
  xp: number;
  totalCorrect: number;
  totalPlayed: number;
  interests: string[];
};

type AuthContextValue = {
  status: AuthStatus;
  user: AuthedUser | null;
  guestKey: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  enterGuestMode: () => Promise<void>;
  ensureGuestKey: () => Promise<string>;
  error: string | null;
  isReady: boolean;
  refreshUser: () => Promise<void>;
  resetUser: () => Promise<void>;
};

const GUEST_KEY_STORAGE_KEY = 'quizroomGuestKey';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function generateGuestKey() {
  return `gr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function storeGuestKeyValue(value: string) {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(GUEST_KEY_STORAGE_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(GUEST_KEY_STORAGE_KEY, value);
}

async function loadGuestKeyValue(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(GUEST_KEY_STORAGE_KEY);
  }
  return SecureStore.getItemAsync(GUEST_KEY_STORAGE_KEY);
}

// XP -> 레벨 변환 함수
function calculateLevel(xp: number): {
  level: number;
  current: number;
  next: number;
  progress: number;
} {
  let level = 1;
  let totalXp = 0;

  while (totalXp + Math.floor(100 * Math.pow(level, 1.5)) <= xp) {
    totalXp += Math.floor(100 * Math.pow(level, 1.5));
    level++;
  }

  const current = xp - totalXp;
  const next = Math.floor(100 * Math.pow(level, 1.5));
  const progress = Math.min(100, Math.round((current / next) * 100));

  return { level, current, next, progress };
}

// 레벨별 타이틀
function getLevelTitle(level: number): string {
  if (level >= 60) return '챌린저';
  if (level >= 50) return '그랜드 마스터';
  if (level >= 40) return '마스터';
  if (level >= 30) return '다이아몬드';
  if (level >= 20) return '플래티넘';
  if (level >= 15) return '골드';
  if (level >= 10) return '실버';
  if (level >= 5) return '브론즈';
  return '아이언';
}

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [guestKey, setGuestKey] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const lastSettledStatusRef = useRef<AuthStatus>('loading');

  // Initialize guest key
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
        console.warn('Failed to initialize guest key', err);
      }
    })();
  }, []);

  // Fetch user profile from database
  const fetchUserProfile = useCallback(async (authUserId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('identity_id', authUserId)
        .single();

      if (fetchError) {
        // User doesn't exist yet, create one
        if (fetchError.code === 'PGRST116') {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) throw new Error('No auth user');

          const newUser = {
            identity_id: authUserId,
            provider: authUser.app_metadata.provider || 'unknown',
            handle: authUser.user_metadata.name || authUser.email?.split('@')[0] || `user-${authUserId.slice(-6)}`,
            avatar_url: authUser.user_metadata.avatar_url || authUser.user_metadata.picture,
            interests: [],
            streak: 0,
            xp: 0,
            total_correct: 0,
            total_played: 0,
            cosmetics: [],
            skill: { global: 1200, tags: [] },
          };

          const { data: insertedUser, error: insertError } = await supabase
            .from('users')
            .insert(newUser)
            .select()
            .single();

          if (insertError) throw insertError;
          return insertedUser;
        }
        throw fetchError;
      }

      return data;
    } catch (err) {
      console.error('Failed to fetch user profile', err);
      throw err;
    }
  }, []);

  // Convert database user to auth user format
  const toAuthedUser = useCallback((dbUser: User): AuthedUser => ({
    id: dbUser.id,
    handle: dbUser.handle,
    avatarUrl: dbUser.avatar_url ?? undefined,
    provider: dbUser.provider,
    streak: dbUser.streak,
    xp: dbUser.xp,
    totalCorrect: dbUser.total_correct,
    totalPlayed: dbUser.total_played,
    interests: dbUser.interests,
  }), []);

  // Handle auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (__DEV__) {
          console.log('[SupabaseAuth] Auth state changed:', event);
        }

        if (event === 'SIGNED_OUT' || !session) {
          const fallbackStatus =
            lastSettledStatusRef.current === 'guest' ? 'guest' : 'unauthenticated';
          setUser(null);
          setStatus(fallbackStatus);
          setIsReady(true);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          try {
            const dbUser = await fetchUserProfile(session.user.id);
            setUser(toAuthedUser(dbUser));
            setStatus('authenticated');
            setError(null);
          } catch (err) {
            console.error('Failed to load user after auth', err);
            setStatus('error');
            setError(err instanceof Error ? err.message : '사용자 정보를 불러오지 못했습니다.');
          }
          setIsReady(true);
        }
      }
    );

    // Initial session check
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const dbUser = await fetchUserProfile(session.user.id);
          setUser(toAuthedUser(dbUser));
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
      } catch (err) {
        console.error('Failed to check initial session', err);
        setStatus('unauthenticated');
      }
      setIsReady(true);
    })();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile, toAuthedUser]);

  // Track settled status
  useEffect(() => {
    if (status !== 'authorizing') {
      lastSettledStatusRef.current = status;
    }
  }, [status]);

  // Sign in with Google
  const signInWithGoogle = useCallback(async () => {
    const previousStatus = lastSettledStatusRef.current;
    if (previousStatus === 'guest' || previousStatus === 'authenticated') {
      setStatus('upgrading');
    } else {
      setStatus('authorizing');
    }
    setError(null);

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();

      const idToken =
        signInResult.data?.idToken ??
        (signInResult as { idToken?: string }).idToken ??
        null;

      if (!idToken) {
        throw new Error('Google ID 토큰을 가져오지 못했습니다.');
      }

      // Sign in to Supabase with Google ID token
      const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (signInError) throw signInError;

      // Auth state change listener will handle the rest
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;

      if (code === statusCodes.SIGN_IN_CANCELLED) {
        setStatus(previousStatus);
        return;
      }
      if (code === statusCodes.IN_PROGRESS) {
        setError('이미 로그인 중입니다.');
        return;
      }
      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setStatus('error');
        setError('Google Play 서비스를 사용할 수 없습니다. 업데이트 후 다시 시도해주세요.');
        return;
      }

      await GoogleSignin.signOut().catch(() => undefined);
      console.error('Google sign-in failed', err);
      setStatus('error');
      setError(
        err instanceof Error
          ? err.message
          : 'Google 로그인 중 문제가 발생했어요.'
      );
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      await GoogleSignin.signOut().catch(() => undefined);
    } catch (err) {
      console.error('Sign out failed', err);
    }
    setUser(null);
    setStatus('unauthenticated');
    setError(null);
  }, []);

  // Enter guest mode
  const enterGuestMode = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      await GoogleSignin.signOut().catch(() => undefined);
    } catch (err) {
      console.warn('Sign out failed during guest mode transition', err);
    }

    // Ensure guest key exists
    let key = guestKey;
    if (!key) {
      const stored = await loadGuestKeyValue();
      if (stored) {
        key = stored;
        setGuestKey(stored);
      } else {
        key = generateGuestKey();
        setGuestKey(key);
        await storeGuestKeyValue(key);
      }
    }

    setUser(null);
    setStatus('guest');
    setError(null);
  }, [guestKey]);

  // Ensure guest key
  const ensureGuestKey = useCallback(async () => {
    if (guestKey) return guestKey;

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

  // Refresh user data
  const refreshUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const dbUser = await fetchUserProfile(session.user.id);
      setUser(toAuthedUser(dbUser));
    } catch (err) {
      console.error('Failed to refresh user', err);
    }
  }, [fetchUserProfile, toAuthedUser]);

  // Reset/delete user
  const resetUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Delete user data
      await supabase
        .from('users')
        .delete()
        .eq('identity_id', session.user.id);
    }

    await signOut();
  }, [signOut]);

  // Refresh token on app focus
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active' && status === 'authenticated') {
        try {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.warn('[SupabaseAuth] Failed to refresh token on app focus', refreshError);
          }
        } catch (err) {
          console.warn('[SupabaseAuth] Failed to refresh session', err);
        }
      }
    });

    return () => subscription.remove();
  }, [status]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      guestKey,
      signInWithGoogle,
      signOut,
      enterGuestMode,
      ensureGuestKey,
      error,
      isReady,
      refreshUser,
      resetUser,
    }),
    [
      status,
      user,
      guestKey,
      signInWithGoogle,
      signOut,
      enterGuestMode,
      ensureGuestKey,
      error,
      isReady,
      refreshUser,
      resetUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSupabaseAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return ctx;
}

// Export level helpers for use in components
export { calculateLevel, getLevelTitle };
