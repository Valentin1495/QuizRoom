/**
 * Live Lobby Hook (Supabase Only)
 * Provides lobby data with Realtime subscription
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase-api';

// ============================================
// Types
// ============================================

export type LobbyRoom = {
  _id: string;
  code: string;
  hostId: string | null;
  hostIdentity: string;
  status: string;
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

export type LobbyDeck = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  questionCount: number;
};

export type LobbyParticipant = {
  participantId: string;
  odUserId: string | null;
  userId: string | null;
  avatarUrl: string | null;
  isGuest: boolean;
  guestAvatarId: number | null;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  joinedAt: number;
  isConnected: boolean;
  xp: number | null;
};

export type LobbyData = {
  room: LobbyRoom;
  deck: LobbyDeck | null;
  participants: LobbyParticipant[];
  now: number;
} | null;

// ============================================
// Lobby Hook with Realtime
// ============================================

export function useLiveLobby(code: string, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const shouldFetch = enabled && code.length > 0;

  const [lobby, setLobby] = useState<LobbyData>(null);
  const [isLoading, setIsLoading] = useState(shouldFetch);
  const [error, setError] = useState<Error | null>(null);
  const [latestPendingAction, setLatestPendingAction] = useState<LobbyRoom['pendingAction']>(null);

  const fetchLobby = useCallback(async (): Promise<LobbyData> => {
    if (!shouldFetch) {
      return lobby;
    }

    try {
      const { data: result, error: fetchError } = await supabase.functions.invoke(
        'room-lobby',
        { body: { code } }
      );

      if (fetchError) throw fetchError;
      const fetchedLobby: LobbyData = result?.data ?? null;
      if (fetchedLobby && fetchedLobby.room) {
        fetchedLobby.room.pendingAction =
          fetchedLobby.room.pendingAction ?? latestPendingAction ?? null;
      }
      setLobby(fetchedLobby);
      setError(null);
      return fetchedLobby;
    } catch (err) {
      console.error('[Lobby] Failed to fetch:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch lobby'));
      return lobby;
    }
  }, [code, latestPendingAction, lobby, shouldFetch]);

  // Keep a stable ref so realtime callbacks can always refetch with the latest closure values
  const fetchLobbyRef = useRef(fetchLobby);
  useEffect(() => {
    fetchLobbyRef.current = fetchLobby;
  }, [fetchLobby]);

  // Initial fetch (only when shouldFetch changes)
  useEffect(() => {
    if (!shouldFetch) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const run = async () => {
      try {
        await fetchLobbyRef.current?.();
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [shouldFetch]);

  // Realtime subscription
  useEffect(() => {
    if (!shouldFetch || !lobby?.room?._id) return;

    const roomId = lobby.room._id;
    console.log('[LiveLobby] Subscribing realtime for room', roomId);

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_match_participants',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const participantId = (payload.new as any)?.id ?? (payload.old as any)?.id;
          console.log('[LiveLobby] participants change', payload.eventType, participantId);
          void fetchLobbyRef.current?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_match_rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as any;
          const pending = row?.pending_action;
          const serverNow = payload.commit_timestamp
            ? new Date(payload.commit_timestamp).getTime()
            : undefined;
          console.log('[LiveLobby] room update', payload.eventType, {
            status: row?.status,
            pending,
            serverNow,
          });
          const normalizedPending = pending
            ? {
              type: pending.type,
              executeAt: pending.executeAt ?? pending.execute_at,
              delayMs: pending.delayMs ?? pending.delay_ms,
              createdAt: pending.createdAt ?? pending.created_at,
              initiatedBy: pending.initiatedBy ?? pending.initiated_by,
              initiatedIdentity: pending.initiatedIdentity ?? pending.initiated_identity,
              label: pending.label ?? '',
            }
            : null;
          setLatestPendingAction(normalizedPending);
          setLobby((prev) => {
            if (!prev) return prev;
            if (prev.room._id !== roomId) return prev;
            const updatedRoom = {
              ...prev.room,
              status: row?.status ?? prev.room.status,
              currentRound:
                typeof row?.current_round === 'number'
                  ? row.current_round
                  : prev.room.currentRound,
              phaseEndsAt:
                typeof row?.phase_ends_at === 'number' || row?.phase_ends_at === null
                  ? row.phase_ends_at
                  : prev.room.phaseEndsAt,
              pendingAction: normalizedPending,
              pauseState: row?.pause_state ?? prev.room.pauseState,
              serverNow: serverNow ?? row?.server_now ?? prev.room.serverNow,
              expiresAt:
                typeof row?.expires_at === 'number' || row?.expires_at === null
                  ? row.expires_at
                  : prev.room.expiresAt,
              version:
                typeof row?.version === 'number' ? row.version : prev.room.version,
            };
            return {
              ...prev,
              room: updatedRoom,
            };
          });
        }
      )
      .subscribe();

    // One more fetch right after subscribing to avoid missing updates between the first fetch and subscription
    void fetchLobbyRef.current?.();

    return () => {
      console.log('[LiveLobby] Unsubscribing realtime for room', roomId);
      void supabase.removeChannel(channel);
    };
  }, [shouldFetch, lobby?.room?._id]);

  return { lobby, isLoading, error, refetch: fetchLobby };
}

// ============================================
// Room Actions Hook
// ============================================

type RoomActionArgs = {
  roomId: string;
  participantId?: string;
  guestKey?: string;
  [key: string]: unknown;
};

export function useRoomActions() {
  const invokeAction = useCallback(
    async (action: string, args: RoomActionArgs) => {
      const { data, error } = await supabase.functions.invoke('room-action', {
        body: { action, ...args },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.data;
    },
    []
  );

  const join = useCallback(
    async (args: { code: string; nickname?: string; guestKey?: string }) => {
      const { data, error } = await supabase.functions.invoke('room-join', {
        body: args,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.data;
    },
    []
  );

  const leave = useCallback(
    async (args: { roomId: string; participantId: string; guestKey?: string }) => {
      return invokeAction('leave', args);
    },
    [invokeAction]
  );

  const heartbeat = useCallback(
    async (args: { roomId: string; participantId: string; guestKey?: string }) => {
      return invokeAction('heartbeat', args);
    },
    [invokeAction]
  );

  const setReady = useCallback(
    async (args: { roomId: string; participantId: string; ready: boolean; guestKey?: string }) => {
      return invokeAction('setReady', args);
    },
    [invokeAction]
  );

  const start = useCallback(
    async (args: { roomId: string; participantId: string; delayMs?: number; guestKey?: string }) => {
      return invokeAction('start', args);
    },
    [invokeAction]
  );

  const cancelPendingAction = useCallback(
    async (args: { roomId: string; participantId: string; guestKey?: string }) => {
      return invokeAction('cancelPendingAction', args);
    },
    [invokeAction]
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

  const sendReaction = useCallback(
    async (args: { roomId: string; participantId: string; emoji: string; guestKey?: string }) => {
      return invokeAction('sendReaction', args);
    },
    [invokeAction]
  );

  return {
    join,
    leave,
    heartbeat,
    setReady,
    start,
    cancelPendingAction,
    progress,
    submitAnswer,
    pause,
    resume,
    finish,
    rematch,
    resetToLobby,
    requestLobby,
    sendReaction,
  };
}
