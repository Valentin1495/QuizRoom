/**
 * Unified Auth Hook
 * Switches between Convex/Firebase Auth and Supabase Auth based on feature flag
 * 
 * This allows gradual migration while keeping both systems working.
 */

import { FEATURE_FLAGS } from '@/lib/feature-flags';

import { useAuth as useConvexAuth } from './use-auth';
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
  id: string; // Unified as string (Convex Id is string at runtime)
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
  // Convex-specific (only available when using Convex auth)
  isConvexReady?: boolean;
};

/**
 * Unified auth hook that works with both Convex and Supabase
 * 
 * When FEATURE_FLAGS.auth is false: Uses Convex/Firebase Auth
 * When FEATURE_FLAGS.auth is true: Uses Supabase Auth
 */
export function useUnifiedAuth(): UnifiedAuthContextValue {
  // Always call both hooks (React rules) but only use one based on flag
  const convexAuth = useConvexAuth();
  const supabaseAuth = useSupabaseAuth();

  if (FEATURE_FLAGS.auth) {
    // Use Supabase Auth
    return {
      status: supabaseAuth.status,
      user: supabaseAuth.user ? {
        id: supabaseAuth.user.id,
        handle: supabaseAuth.user.handle,
        avatarUrl: supabaseAuth.user.avatarUrl,
        provider: supabaseAuth.user.provider,
        streak: supabaseAuth.user.streak,
        xp: supabaseAuth.user.xp,
        totalCorrect: supabaseAuth.user.totalCorrect,
        totalPlayed: supabaseAuth.user.totalPlayed,
        interests: supabaseAuth.user.interests,
      } : null,
      guestKey: supabaseAuth.guestKey,
      signInWithGoogle: supabaseAuth.signInWithGoogle,
      signOut: supabaseAuth.signOut,
      enterGuestMode: supabaseAuth.enterGuestMode,
      ensureGuestKey: supabaseAuth.ensureGuestKey,
      error: supabaseAuth.error,
      isReady: supabaseAuth.isReady,
      refreshUser: supabaseAuth.refreshUser,
      resetUser: supabaseAuth.resetUser,
      isConvexReady: false, // Convex won't be authenticated in Supabase mode
    };
  }

  // Use Convex/Firebase Auth (default)
  return {
    status: convexAuth.status,
    user: convexAuth.user ? {
      id: convexAuth.user.id as string, // Convex Id is string at runtime
      handle: convexAuth.user.handle,
      avatarUrl: convexAuth.user.avatarUrl,
      provider: convexAuth.user.provider,
      streak: convexAuth.user.streak,
      xp: convexAuth.user.xp,
      totalCorrect: convexAuth.user.totalCorrect,
      totalPlayed: convexAuth.user.totalPlayed,
      interests: convexAuth.user.interests,
    } : null,
    guestKey: convexAuth.guestKey,
    signInWithGoogle: convexAuth.signInWithGoogle,
    signOut: convexAuth.signOut,
    enterGuestMode: convexAuth.enterGuestMode,
    ensureGuestKey: convexAuth.ensureGuestKey,
    error: convexAuth.error,
    isReady: convexAuth.isConvexReady,
    refreshUser: convexAuth.refreshUser,
    resetUser: convexAuth.resetUser,
    isConvexReady: convexAuth.isConvexReady,
  };
}

/**
 * Re-export useUnifiedAuth as useAuth for easy migration
 * Components can import { useAuth } from '@/hooks/use-unified-auth'
 * and get the correct auth based on feature flag
 */
export { useUnifiedAuth as useAuth };
