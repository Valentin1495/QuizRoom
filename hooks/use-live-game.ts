/**
 * Live Game Hook (Supabase Only)
 * Provides game state with polling and Realtime subscription
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase-api';

// ============================================
// Types
// ============================================

export type GameRoom = {
  _id: string;
  code: string;
  hostId: string | null;
  hostIdentity: string;
  status: 'lobby' | 'countdown' | 'question' | 'grace' | 'reveal' | 'leaderboard' | 'results' | 'paused';
  deckId: string | null;
  rules: {
    rounds: number;
    readSeconds: number;
    answerSeconds: number;
    graceSeconds: number;
    revealSeconds: number;
    leaderboardSeconds: number;
  };
  currentRound: number;
  totalRounds: number;
  phaseEndsAt: number | null;
  pendingAction: {
    type: string;
    executeAt: number;
    delayMs: number;
    createdAt: number;
    initiatedBy?: string | null;
    initiatedIdentity?: string;
    label: string;
  } | null;
  pauseState: {
    previousStatus: string;
    remainingMs?: number;
    pausedAt: number;
  } | null;
  serverNow?: number;
  expiresAt?: number;
  version: number;
};

export type GameDeck = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  questionCount: number;
};

export type GameParticipant = {
  participantId: string;
  odUserId: string | null;
  avatarUrl: string | null;
  guestAvatarId: number | null;
  nickname: string;
  totalScore: number;
  isHost: boolean;
  rank: number;
  isConnected: boolean;
  lastSeenAt: number;
  disconnectedAt: number | null;
  answers: number;
};

export type GameMe = {
  participantId: string;
  odUserId: string | null;
  isGuest: boolean;
  nickname: string;
  totalScore: number;
  isHost: boolean;
  answers: number;
  avgResponseMs: number;
  lastSeenAt: number;
  disconnectedAt: number | null;
  currentStreak: number;
  maxStreak: number;
};

export type GameChoice = {
  id: string;
  text: string;
};

export type GameQuestion = {
  id: string;
  prompt: string;
  explanation: string | null;
  choices: GameChoice[];
};

export type GameMyAnswer = {
  choiceIndex: number;
  isCorrect: boolean;
  scoreDelta: number;
};

export type GameReveal = {
  correctChoice: number;
  distribution: number[];
};

export type GameLeaderboardEntry = {
  participantId: string;
  odUserId: string | null;
  avatarUrl: string | null;
  guestAvatarId: number | null;
  nickname: string;
  totalScore: number;
  rank: number;
};

export type GameLeaderboard = {
  top: GameLeaderboardEntry[];
  me?: GameLeaderboardEntry;
};

export type GameCurrentRound = {
  index: number;
  question: GameQuestion;
  myAnswer?: GameMyAnswer;
  reveal?: GameReveal;
  leaderboard?: GameLeaderboard;
};

export type GameState = {
  status: 'ok';
  room: GameRoom;
  deck: GameDeck | null;
  me: GameMe;
  participants: GameParticipant[];
  currentRound?: GameCurrentRound;
  now: number;
} | {
  status: 'not_in_room' | 'not_found' | 'loading' | 'error';
};

// ============================================
// Game State Hook
// ============================================

const POLL_INTERVAL_MS = 1000; // Poll every second during active game
const HEARTBEAT_INTERVAL_MS = 5000;

export function useLiveGame(
  roomId: string | null,
  participantId: string | null,
  options?: { enabled?: boolean; guestKey?: string }
) {
  const enabled = options?.enabled ?? true;
  const guestKey = options?.guestKey;
  const shouldFetch = enabled && !!roomId && !!participantId;

  const [gameState, setGameState] = useState<GameState>({ status: 'loading' });
  const [error, setError] = useState<Error | null>(null);
  const lastFetchRef = useRef<number>(0);
  const isFetchingRef = useRef(false);

  const fetchGameState = useCallback(async () => {
    if (!shouldFetch || isFetchingRef.current) return;

    isFetchingRef.current = true;
    try {
      const { data: result, error: fetchError } = await supabase.functions.invoke(
        'room-state',
        { body: { roomId, participantId, guestKey } }
      );

      if (fetchError) throw fetchError;

      if (result?.data) {
        setGameState(result.data);
        setError(null);
      } else if (result?.error) {
        throw new Error(result.error);
      }
      lastFetchRef.current = Date.now();
    } catch (err) {
      console.error('[Game] Failed to fetch state:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch game state'));
      setGameState({ status: 'error' });
    } finally {
      isFetchingRef.current = false;
    }
  }, [roomId, participantId, guestKey, shouldFetch]);

  // Initial fetch
  useEffect(() => {
    if (!shouldFetch) {
      setGameState({ status: 'loading' });
      return;
    }

    void fetchGameState();
  }, [fetchGameState, shouldFetch]);

  // Polling during active game phases
  useEffect(() => {
    if (!shouldFetch) return;
    if (gameState.status !== 'ok') return;

    const room = gameState.room;
    const isActivePhase = ['countdown', 'question', 'grace', 'reveal', 'leaderboard'].includes(room.status);

    if (!isActivePhase) return;

    const interval = setInterval(() => {
      void fetchGameState();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [shouldFetch, gameState, fetchGameState]);

  // Realtime subscription for room changes
  useEffect(() => {
    if (!shouldFetch || !roomId) return;

    const channel = supabase
      .channel(`game:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_match_rooms',
          filter: `id=eq.${roomId}`,
        },
        () => {
          void fetchGameState();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_match_participants',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void fetchGameState();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_match_answers',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void fetchGameState();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [shouldFetch, roomId, fetchGameState]);

  // Heartbeat
  useEffect(() => {
    if (!shouldFetch || !roomId || !participantId) return;

    const sendHeartbeat = async () => {
      try {
        await supabase.functions.invoke('room-action', {
          body: { action: 'heartbeat', roomId, participantId, guestKey },
        });
      } catch (err) {
        console.error('[Game] Heartbeat failed:', err);
      }
    };

    // Send initial heartbeat
    void sendHeartbeat();

    const interval = setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [shouldFetch, roomId, participantId, guestKey]);

  return { gameState, error, refetch: fetchGameState };
}

// ============================================
// Game Actions Hook
// ============================================

export function useGameActions() {
  const invokeAction = useCallback(
    async (action: string, args: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('room-action', {
        body: { action, ...args },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.data;
    },
    []
  );

  const progress = useCallback(
    async (args: { roomId: string; participantId: string; guestKey?: string }) => {
      return invokeAction('progress', args);
    },
    [invokeAction]
  );

  const submitAnswer = useCallback(
    async (args: { roomId: string; participantId: string; choiceIndex: number; guestKey?: string }) => {
      return invokeAction('submitAnswer', args);
    },
    [invokeAction]
  );

  const pause = useCallback(
    async (args: { roomId: string; participantId: string; guestKey?: string }) => {
      return invokeAction('pause', args);
    },
    [invokeAction]
  );

  const resume = useCallback(
    async (args: { roomId: string; participantId: string; guestKey?: string }) => {
      return invokeAction('resume', args);
    },
    [invokeAction]
  );

  const finish = useCallback(
    async (args: { roomId: string; participantId: string; guestKey?: string }) => {
      return invokeAction('finish', args);
    },
    [invokeAction]
  );

  const rematch = useCallback(
    async (args: { roomId: string; participantId: string; delayMs?: number; guestKey?: string }) => {
      return invokeAction('rematch', args);
    },
    [invokeAction]
  );

  const resetToLobby = useCallback(
    async (args: { roomId: string; participantId: string; guestKey?: string }) => {
      return invokeAction('resetToLobby', args);
    },
    [invokeAction]
  );

  const requestLobby = useCallback(
    async (args: { roomId: string; participantId: string; delayMs?: number; guestKey?: string }) => {
      return invokeAction('requestLobby', args);
    },
    [invokeAction]
  );

  const leave = useCallback(
    async (args: { roomId: string; participantId: string; guestKey?: string }) => {
      return invokeAction('leave', args);
    },
    [invokeAction]
  );

  const sendReaction = useCallback(
    async (args: { roomId: string; participantId: string; emoji: string; guestKey?: string }) => {
      return invokeAction('sendReaction', args);
    },
    [invokeAction]
  );

  const cancelPendingAction = useCallback(
    async (args: { roomId: string; participantId: string; guestKey?: string }) => {
      return invokeAction('cancelPendingAction', args);
    },
    [invokeAction]
  );

  return {
    progress,
    submitAnswer,
    pause,
    resume,
    finish,
    rematch,
    resetToLobby,
    requestLobby,
    leave,
    sendReaction,
    cancelPendingAction,
  };
}

// ============================================
// Utility: Time Left Calculator
// ============================================

export function computeTimeLeft(expiresAt?: number | null, now?: number) {
  if (!expiresAt || !now) return null;
  const diff = Math.max(0, expiresAt - now);
  return Math.ceil(diff / 1000);
}

// ============================================
// Utility: Combo Multiplier
// ============================================

export function getComboMultiplier(streak: number): number {
  if (streak >= 10) return 3.0;
  if (streak >= 7) return 2.5;
  if (streak >= 5) return 2.0;
  if (streak >= 3) return 1.5;
  return 1.0;
}
