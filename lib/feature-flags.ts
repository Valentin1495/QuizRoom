/**
 * Feature Flags for gradual migration from Convex to Supabase
 * 
 * Usage:
 * - Set EXPO_PUBLIC_USE_SUPABASE=true in .env.local to enable Supabase
 * - Default: false (uses Convex)
 * 
 * Migration Status:
 * - Phase 1: Daily Quiz, Deck Feed ✓
 * - Phase 2: Auth ✓
 * - Phase 3: Live Match ✓ (fully migrated to Supabase)
 */

export const USE_SUPABASE = process.env.EXPO_PUBLIC_USE_SUPABASE === 'true';

// Granular feature flags for phased migration
export const FEATURE_FLAGS = {
  // Phase 1: Read-only features (public, no auth required)
  dailyQuiz: USE_SUPABASE,
  deckFeed: USE_SUPABASE,

  // Phase 1.5: Read-only features (requires Supabase Auth)
  quizHistory: USE_SUPABASE,

  // Phase 2: Auth - complete
  auth: true,

  // Phase 3: Live Match - fully migrated to Supabase
  // Uses Supabase Edge Functions and Realtime
  liveMatch: true,
} as const;
