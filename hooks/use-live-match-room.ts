/**
 * Live Match Room Hooks (Supabase Only)
 */


import {
  ROOM_EXPIRED_MESSAGE,
  ROOM_FULL_MESSAGE,
  ROOM_IN_PROGRESS_MESSAGE,
  ROOM_NOT_FOUND_MESSAGE,
  extractJoinErrorMessage as supabaseExtractJoinErrorMessage,
  useCreateLiveMatchRoom as useSupabaseCreateLiveMatchRoom,
  useJoinLiveMatchRoom as useSupabaseJoinLiveMatchRoom,
} from '@/lib/supabase-api';

// Re-export error messages
export {
  ROOM_EXPIRED_MESSAGE,
  ROOM_FULL_MESSAGE,
  ROOM_IN_PROGRESS_MESSAGE,
  ROOM_NOT_FOUND_MESSAGE
};

/**
 * Extract user-friendly error message from join error
 */
export function extractJoinErrorMessage(error: unknown) {
  return supabaseExtractJoinErrorMessage(error);
}

type CreateRoomArgs = {
  deckId?: string;
  nickname?: string;
  guestKey?: string;
};

type CreateRoomResult = {
  roomId: string;
  code: string;
  participantId: string;
  pendingAction: unknown | null;
};

type JoinRoomArgs = {
  code: string;
  nickname?: string;
  guestKey?: string;
};

type JoinRoomResult = {
  roomId: string;
  participantId: string;
  pendingAction: unknown | null;
};

/**
 * Hook to create a live match room
 */
export function useCreateLiveMatchRoom(): (args: CreateRoomArgs) => Promise<CreateRoomResult> {
  return useSupabaseCreateLiveMatchRoom();
}

/**
 * Hook to join a live match room
 */
export function useJoinLiveMatchRoom(): (args: JoinRoomArgs) => Promise<JoinRoomResult> {
  return useSupabaseJoinLiveMatchRoom();
}
