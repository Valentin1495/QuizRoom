/**
 * Live Game Hook (Supabase Only)
 * Provides game state with polling and Realtime subscription
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { getFunctionAuthHeaders, supabase } from '@/lib/supabase-api';

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
  correctCount?: number;
};

export type GameMe = {
  participantId: string;
  odUserId: string | null;
  isGuest: boolean;
  nickname: string;
  totalScore: number;
  isHost: boolean;
  answers: number;
  correctCount?: number;
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
  answerIndex?: number;
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
const PARTICIPANT_TIMEOUT_MS = 30 * 1000;

function isParticipantConnected(lastSeenAt: string | null, disconnectedAt: string | null, now: number): boolean {
  if (disconnectedAt) return false;
  if (!lastSeenAt) return false;
  return now - new Date(lastSeenAt).getTime() < PARTICIPANT_TIMEOUT_MS;
}

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
      const headers = await getFunctionAuthHeaders();
      const { data: result, error: fetchError } = await supabase.functions.invoke(
        'room-state',
        { body: { roomId, participantId, guestKey }, headers }
      );

      if (fetchError) throw fetchError;

      if (result?.data) {
        setGameState((prev) => {
          let incoming = result.data as GameState;
          if (prev.status === 'ok' && incoming.status === 'ok') {
            const incomingVersion = incoming.room.version;
            const prevVersion = prev.room.version;
            if (
              typeof incomingVersion === 'number' &&
              typeof prevVersion === 'number' &&
              incomingVersion < prevVersion
            ) {
              if (__DEV__) {
                console.log('[Game] Ignoring stale room-state snapshot', {
                  incomingVersion,
                  prevVersion,
                });
              }
              return prev;
            }

            if (
              prev.currentRound &&
              incoming.currentRound &&
              prev.currentRound.index === incoming.currentRound.index &&
              prev.currentRound.reveal &&
              !incoming.currentRound.reveal
            ) {
              incoming = {
                ...incoming,
                currentRound: {
                  ...incoming.currentRound,
                  reveal: prev.currentRound.reveal,
                },
              };
            }
          }
          return incoming;
        });
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
        (payload) => {
          const row = payload.new as any;
          const commitTsMs = payload.commit_timestamp
            ? new Date(payload.commit_timestamp).getTime()
            : Date.now();
          const incomingVersion =
            typeof row?.version === 'number' ? row.version : null;

          const pending = row?.pending_action;
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

          const pause = row?.pause_state;
          const normalizedPause = pause
            ? {
                previousStatus: pause.previousStatus ?? pause.previous_status ?? 'unknown',
                remainingMs: pause.remainingMs ?? pause.remaining_ms,
                pausedAt: pause.pausedAt ?? pause.paused_at ?? commitTsMs,
              }
            : null;

          setGameState((prev) => {
            if (prev.status !== 'ok') return prev;
            if (prev.room._id !== roomId) return prev;
            if (incomingVersion !== null && incomingVersion < prev.room.version) {
              return prev;
            }
            return {
              ...prev,
              room: {
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
                pauseState: normalizedPause,
                serverNow:
                  typeof row?.server_now === 'number' ? row.server_now : prev.room.serverNow,
                expiresAt:
                  typeof row?.expires_at === 'number' || row?.expires_at === null
                    ? row.expires_at
                    : prev.room.expiresAt,
                hostId: row?.host_id ?? prev.room.hostId,
                hostIdentity: row?.host_identity ?? prev.room.hostIdentity,
                version: incomingVersion ?? prev.room.version,
              },
              now: commitTsMs,
            };
          });

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
        (payload) => {
          const row = payload.new as any;
          const oldRow = payload.old as any;
          const participantRowId = row?.id ?? oldRow?.id;
          if (!participantRowId) {
            void fetchGameState();
            return;
          }

          const commitTsMs = payload.commit_timestamp
            ? new Date(payload.commit_timestamp).getTime()
            : Date.now();

          setGameState((prev) => {
            if (prev.status !== 'ok') return prev;
            if (prev.room._id !== roomId) return prev;

            const participants = [...prev.participants];
            const idx = participants.findIndex((p) => p.participantId === participantRowId);

            const removed = !!row?.removed_at;
            if (payload.eventType === 'DELETE' || removed) {
              if (idx >= 0) {
                participants.splice(idx, 1);
              }
              return { ...prev, participants, now: commitTsMs };
            }

            const base = idx >= 0 ? participants[idx] : null;
            const lastSeenAtMs = row?.last_seen_at
              ? new Date(row.last_seen_at).getTime()
              : base?.lastSeenAt ?? commitTsMs;
            const disconnectedAtMs = row?.disconnected_at
              ? new Date(row.disconnected_at).getTime()
              : null;

            const merged: GameParticipant = {
              participantId: participantRowId,
              odUserId: row?.user_id ?? base?.odUserId ?? null,
              avatarUrl: base?.avatarUrl ?? null,
              guestAvatarId: row?.guest_avatar_id ?? base?.guestAvatarId ?? null,
              nickname: row?.nickname ?? base?.nickname ?? '플레이어',
              totalScore:
                typeof row?.total_score === 'number' ? row.total_score : base?.totalScore ?? 0,
              isHost: typeof row?.is_host === 'boolean' ? row.is_host : base?.isHost ?? false,
              rank: base?.rank ?? 0,
              isConnected: isParticipantConnected(row?.last_seen_at ?? null, row?.disconnected_at ?? null, commitTsMs),
              lastSeenAt: lastSeenAtMs,
              disconnectedAt: disconnectedAtMs,
              answers:
                typeof row?.answers === 'number' ? row.answers : base?.answers ?? 0,
            };

            if (idx >= 0) {
              participants[idx] = merged;
            } else {
              participants.push(merged);
            }

            let me = prev.me;
            if (participantRowId === prev.me.participantId) {
              me = {
                ...prev.me,
                odUserId: merged.odUserId,
                nickname: merged.nickname,
                totalScore: merged.totalScore,
                isHost: merged.isHost,
                answers: merged.answers,
                lastSeenAt: merged.lastSeenAt,
                disconnectedAt: merged.disconnectedAt,
              };
            }

            return { ...prev, participants, me, now: commitTsMs };
          });

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
        (payload) => {
          const row = payload.new as any;
          const commitTsMs = payload.commit_timestamp
            ? new Date(payload.commit_timestamp).getTime()
            : Date.now();

          setGameState((prev) => {
            if (prev.status !== 'ok') return prev;
            if (prev.room._id !== roomId) return prev;
            if (!prev.currentRound) return prev;
            if (typeof row?.round_index !== 'number' || row.round_index !== prev.currentRound.index) {
              return prev;
            }

            const choicesLen = prev.currentRound.question.choices.length;
            const prevDistribution =
              prev.currentRound.reveal?.distribution ?? new Array(choicesLen).fill(0);
            const distribution = [...prevDistribution];
            const choiceIndex =
              typeof row?.choice_index === 'number' ? row.choice_index : null;
            if (choiceIndex !== null && choiceIndex >= 0 && choiceIndex < distribution.length) {
              distribution[choiceIndex] += 1;
            }

            const knownCorrect =
              typeof prev.currentRound.question.answerIndex === 'number'
                ? prev.currentRound.question.answerIndex
                : prev.currentRound.reveal?.correctChoice ?? -1;

            const reveal: GameReveal = {
              correctChoice: knownCorrect,
              distribution,
            };

            const isMine = row?.participant_id === prev.me.participantId;
            const safeChoiceIndex =
              typeof row?.choice_index === 'number' ? row.choice_index : 0;
            const myAnswer = isMine
              ? ({
                  choiceIndex: safeChoiceIndex,
                  isCorrect: !!row.is_correct,
                  scoreDelta: typeof row.score_delta === 'number' ? row.score_delta : 0,
                } as GameMyAnswer)
              : prev.currentRound.myAnswer;

            return {
              ...prev,
              currentRound: {
                ...prev.currentRound,
                myAnswer,
                reveal,
              },
              now: commitTsMs,
            };
          });

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
        const headers = await getFunctionAuthHeaders();
        await supabase.functions.invoke('room-action', {
          body: { action: 'heartbeat', roomId, participantId, guestKey },
          headers,
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
      const headers = await getFunctionAuthHeaders();
      const { data, error } = await supabase.functions.invoke('room-action', {
        body: { action, ...args },
        headers,
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
