/**
 * Unified Auth Hook
 * Uses Supabase Auth.
 */

import { useSupabaseAuth } from './use-supabase-auth';

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'authorizing'
  | 'authenticated'
  | 'guest'
  | 'error'
  | 'upgrading';

export type UnifiedUser = {
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

export type UnifiedAuthContextValue = {
  status: AuthStatus;
  user: UnifiedUser | null;
  guestKey: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  enterGuestMode: () => Promise<void>;
  ensureGuestKey: () => Promise<string>;
  error: string | null;
  isReady: boolean;
  refreshUser: () => Promise<void>;
  resetUser: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  applyUserDelta?: (delta: { xp?: number; streak?: number; totalCorrect?: number; totalPlayed?: number }) => void;
};

export function useUnifiedAuth(): UnifiedAuthContextValue {
  const supabaseAuth = useSupabaseAuth();
  return {
    status: supabaseAuth.status,
    user: supabaseAuth.user
      ? {
          id: supabaseAuth.user.id,
          handle: supabaseAuth.user.handle,
          avatarUrl: supabaseAuth.user.avatarUrl,
          provider: supabaseAuth.user.provider,
          streak: supabaseAuth.user.streak,
          xp: supabaseAuth.user.xp,
          totalCorrect: supabaseAuth.user.totalCorrect,
          totalPlayed: supabaseAuth.user.totalPlayed,
          interests: supabaseAuth.user.interests,
        }
      : null,
    guestKey: supabaseAuth.guestKey,
    signInWithGoogle: supabaseAuth.signInWithGoogle,
    signOut: supabaseAuth.signOut,
    enterGuestMode: supabaseAuth.enterGuestMode,
    ensureGuestKey: supabaseAuth.ensureGuestKey,
    error: supabaseAuth.error,
    isReady: supabaseAuth.isReady,
    refreshUser: supabaseAuth.refreshUser,
    resetUser: supabaseAuth.resetUser,
    deleteAccount: supabaseAuth.deleteAccount,
    applyUserDelta: supabaseAuth.applyUserDelta,
  };
}

/**
 * Re-export useUnifiedAuth as useAuth.
 */
export { useUnifiedAuth as useAuth };
