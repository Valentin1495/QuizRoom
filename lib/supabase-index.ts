/**
 * Supabase Index
 * Central export file for all Supabase-related functionality
 * 
 * Usage:
 * import { supabase, useSupabaseAuth, useLiveMatchRoom } from '@/lib/supabase-index';
 */

// ============================================
// Core Client
// ============================================
export { getCurrentUserId, getSession, isAuthenticated, onAuthStateChange, supabase } from './supabase';

// ============================================
// Database Types
// ============================================
export * from './database.types';
export type { Database } from './database.types';

// ============================================
// API Hooks (Read operations)
// ============================================
export {
  ROOM_EXPIRED_MESSAGE, ROOM_FULL_MESSAGE,
  ROOM_IN_PROGRESS_MESSAGE, ROOM_NOT_FOUND_MESSAGE,
  // Error helpers
  extractJoinErrorMessage, useCategories,
  // Daily
  useDailyQuiz,
  // Decks
  useDeckFeed,
  useLiveMatchDecks, useLogQuizHistory,
  // History
  useQuizHistory,
  // User
  useUserStats
} from './supabase-api';

// ============================================
// Auth Hook
// ============================================
export {
  SupabaseAuthProvider,
  calculateLevel,
  getLevelTitle, useSupabaseAuth
} from '../hooks/use-supabase-auth';

// ============================================
// Live Match Hooks
// ============================================
export {
  useCreateRoom, useHeartbeat, useJoinRoom, useLiveMatchRoom, useReactionCounts, useRoomAction, useRoomPresence
} from '../hooks/use-supabase-live-match';

// ============================================
// Provider
// ============================================
export { SupabaseProvider } from '../providers/supabase-provider';
