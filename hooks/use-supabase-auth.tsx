/**
 * Supabase Auth Hook
 * Replaces Firebase Auth + Convex session management
 */

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';

import { supabase, type Database, type User } from '@/lib/supabase';

type UserInsert = Database['public']['Tables']['users']['Insert'];

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '726867887633-8buje4l38mrpp0p98i8vh1k0jijqvuol.apps.googleusercontent.com',
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
  applyUserDelta: (delta: Partial<Pick<AuthedUser, 'xp' | 'streak' | 'totalCorrect' | 'totalPlayed'>>) => void;
};

const PROFILE_FETCH_TIMEOUT_MS = 20000;
const GUEST_KEY_STORAGE_KEY = 'quizroomGuestKey';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function generateGuestKey() {
  return `gr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildFallbackUserFromSession(sessionUser: SupabaseAuthUser): AuthedUser {
  const handle =
    sessionUser.user_metadata?.name ||
    sessionUser.email?.split('@')[0] ||
    `user-${sessionUser.id.slice(-6)}`;
  const avatarUrl =
    sessionUser.user_metadata?.avatar_url ||
    sessionUser.user_metadata?.picture ||
    undefined;
  return {
    id: sessionUser.id,
    handle,
    avatarUrl,
    provider: sessionUser.app_metadata?.provider || 'unknown',
    streak: 0,
    xp: 0,
    totalCorrect: 0,
    totalPlayed: 0,
    interests: [],
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race<T>([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
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
  // Supports account linking: if user exists with same email but different identity_id,
  // update the identity_id to link the accounts (migration from Convex/Firebase)
  const fetchUserProfile = useCallback(async (authUserId: string) => {
    try {
      if (__DEV__) {
        console.log('[SupabaseAuth] fetchUserProfile called with:', authUserId);
      }

      // First, try to find user by identity_id (Supabase Auth ID)
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('identity_id', authUserId)
        .single();

      if (fetchError) {
        if (__DEV__) {
          console.log('[SupabaseAuth] User not found by identity_id, error:', fetchError.code);
        }

        // User not found by identity_id
        if (fetchError.code === 'PGRST116') {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) throw new Error('No auth user');

          const email = authUser.email;

          // Try to find existing user by email (for account linking from Convex migration)
          if (email) {
            // Check if there's a user with matching handle (email prefix) from migration
            const emailPrefix = email.split('@')[0];
            const { data: existingByHandle } = await supabase
              .from('users')
              .select('*')
              .eq('handle', emailPrefix)
              .single() as { data: User | null };

            if (existingByHandle) {
              // Found existing user! Update identity_id to link accounts
              if (__DEV__) {
                console.log('[SupabaseAuth] Linking existing account:', existingByHandle.handle);
              }
              const { data: linkedUser, error: linkError } = await (supabase
                .from('users') as any)
                .update({
                  identity_id: authUserId,
                  avatar_url: authUser.user_metadata.avatar_url || authUser.user_metadata.picture || existingByHandle.avatar_url,
                })
                .eq('id', existingByHandle.id)
                .select()
                .single();

              if (linkError) throw linkError;
              return linkedUser;
            }
          }

          // No existing user found, create new one
          if (__DEV__) {
            console.log('[SupabaseAuth] Creating new user for:', authUser.email);
          }

          const newUser: UserInsert = {
            identity_id: authUserId,
            provider: authUser.app_metadata.provider || 'unknown',
            handle: authUser.user_metadata.name || authUser.email?.split('@')[0] || `user-${authUserId.slice(-6)}`,
            avatar_url: authUser.user_metadata.avatar_url || authUser.user_metadata.picture,
            interests: [] as string[],
            streak: 0,
            xp: 0,
            total_correct: 0,
            total_played: 0,
            cosmetics: [] as string[],
            skill: { global: 1200, tags: [] as { tag: string; rating: number }[] },
          };

          const { data: insertedUser, error: insertError } = await supabase
            .from('users')
            .insert(newUser as any)
            .select()
            .single();

          if (insertError) {
            console.error('[SupabaseAuth] Failed to create user:', insertError);
            throw insertError;
          }

          if (__DEV__) {
            console.log('[SupabaseAuth] New user created:', (insertedUser as User)?.handle);
          }
          return insertedUser as User;
        }
        throw fetchError;
      }

      if (__DEV__) {
        console.log('[SupabaseAuth] Found existing user:', (data as User)?.handle);
      }
      return data as User;
    } catch (err) {
      console.error('[SupabaseAuth] fetchUserProfile error:', err);
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
          // This event can be triggered by a manual signOut, a token refresh failure,
          // or on initial load for a user with no session.
          // We transition to 'unauthenticated' if the app is loading or if a logged-in
          // user signs out. This avoids overriding the 'guest' state.
          if (status === 'loading' || status === 'authenticated') {
            setStatus('unauthenticated');
          }
          setUser(null);
          setIsReady(true);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          try {
            if (__DEV__) {
              console.log('[SupabaseAuth] Fetching user profile for:', session.user.id);
            }
            const startedAt = Date.now();
            const dbUser = await withTimeout(
              fetchUserProfile(session.user.id),
              PROFILE_FETCH_TIMEOUT_MS,
              'fetchUserProfile'
            );
            if (__DEV__) {
              console.log(
                '[SupabaseAuth] User profile loaded:',
                dbUser?.handle,
                `(took ${Date.now() - startedAt}ms)`
              );
            }
            setUser(toAuthedUser(dbUser));
            setStatus('authenticated');
            setError(null);
          } catch (err) {
            console.error('[SupabaseAuth] Failed to load user after auth', err);
            const message = err instanceof Error ? err.message : '';
            const fallback = session?.user ? buildFallbackUserFromSession(session.user) : null;
            const isTimeout = message.includes('timed out');
            if (isTimeout && fallback) {
              console.warn('[SupabaseAuth] Using fallback profile from session due to timeout');
              setUser(fallback);
              setStatus('authenticated');
              setError('프로필 동기화가 지연되어 임시 프로필로 시작했어요. 잠시 후 다시 시도합니다.');
            } else {
              await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
              setStatus('error');
              setError(err instanceof Error ? err.message : '사용자 정보를 불러오지 못했습니다.');
            }
          }
          setIsReady(true);
        }
      }
    );

    // Note: INITIAL_SESSION event fires immediately on subscription,
    // so we don't need a separate manual session check here.
    // This avoids race conditions and duplicate profile fetches.

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

  // Realtime subscription to user row for live XP/stats updates
  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      if (status !== 'authenticated') return;
      const { data: { session } } = await supabase.auth.getSession();
      const identityId = session?.user?.id;
      if (!identityId) return;

      // Initial fetch to ensure we sync with server state
      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('identity_id', identityId)
        .single();
      if (dbUser && !cancelled) {
        setUser(toAuthedUser(dbUser));
      }

      const channel = supabase
        .channel(`user-updates-${identityId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'users', filter: `identity_id=eq.${identityId}` },
          (payload) => {
            const row = payload.new as User;
            if (!cancelled) {
              setUser(toAuthedUser(row));
            }
          }
        )
        .subscribe((status) => {
          if (__DEV__) {
            console.log('[SupabaseAuth] user realtime status:', status);
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    };

    let cleanup: (() => void) | undefined;
    setup().then((fn) => {
      cleanup = fn;
    });

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [status, toAuthedUser]);

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
      await supabase.auth.signOut({ scope: 'local' });
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
    // Call the unified signOut function to ensure the session is cleared
    await signOut();
    // Then, explicitly set the status to guest
    setStatus('guest');

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
  }, [signOut, guestKey]);

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
      const dbUser = await withTimeout(
        fetchUserProfile(session.user.id),
        PROFILE_FETCH_TIMEOUT_MS,
        'refreshUserProfile'
      );
      setUser(toAuthedUser(dbUser));
    } catch (err) {
      console.error('Failed to refresh user', err);
    }
  }, [fetchUserProfile, toAuthedUser]);

  // Optimistically apply user stat deltas (e.g., XP gain) in UI
  const applyUserDelta = useCallback((delta: Partial<Pick<AuthedUser, 'xp' | 'streak' | 'totalCorrect' | 'totalPlayed'>>) => {
    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        xp: delta.xp !== undefined ? delta.xp : prev.xp,
        streak: delta.streak !== undefined ? delta.streak : prev.streak,
        totalCorrect: delta.totalCorrect !== undefined ? delta.totalCorrect : prev.totalCorrect,
        totalPlayed: delta.totalPlayed !== undefined ? delta.totalPlayed : prev.totalPlayed,
      };
    });
  }, []);

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
      applyUserDelta,
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
      applyUserDelta,
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
