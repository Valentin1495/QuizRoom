/**
 * Feature Flags for gradual migration from Convex to Supabase
 * 
 * Usage:
 * - Set EXPO_PUBLIC_USE_SUPABASE=true in .env.local to enable Supabase
 * - Default: false (uses Convex)
 */

export const USE_SUPABASE = process.env.EXPO_PUBLIC_USE_SUPABASE === 'true';

// Granular feature flags for phased migration
export const FEATURE_FLAGS = {
  // Phase 1: Read-only features
  dailyQuiz: USE_SUPABASE,
  deckFeed: USE_SUPABASE,
  quizHistory: USE_SUPABASE,

  // Phase 2: Auth (not yet)
  auth: false,

  // Phase 3: Live match (not yet)
  liveMatch: false,
} as const;
