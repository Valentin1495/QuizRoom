/**
 * Supabase Live Match Hook
 * Replaces Convex live queries for real-time room state
 * Uses Supabase Realtime for subscriptions
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase, type LiveMatchRoom } from '@/lib/supabase';

// ============================================
// Types
// ============================================

type RoomState = {
  room: LiveMatchRoom | null;
  participants: ParticipantView[];
  me: ParticipantView | null;
  currentRound: RoundView | null;
  deck: DeckView | null;
  isLoading: boolean;
  error: string | null;
};

type ParticipantView = {
  participantId: string;
  oderId: string | null;
  avatarUrl: string | null;
  guestAvatarId: number | null;
  nickname: string;
  totalScore: number;
  isHost: boolean;
  isReady: boolean;
  rank: number;
  isConnected: boolean;
  currentStreak: number;
  maxStreak: number;
};

type RoundView = {
  index: number;
  question: {
    id: string;
    prompt: string;
    explanation: string | null;
    choices: { id: string; text: string }[];
  };
  myAnswer?: {
    choiceIndex: number;
    isCorrect: boolean;
    scoreDelta: number;
  };
  reveal?: {
    correctChoice: number;
    distribution: number[];
  };
};

type DeckView = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  questionCount: number;
};

type ReactionCount = {
  clap: number;
  fire: number;
  skull: number;
  laugh: number;
};

// ============================================
// Main Hook
// ============================================

export function useLiveMatchRoom(roomId: string | null, guestKey?: string) {
  const [state, setState] = useState<RoomState>({
    room: null,
    participants: [],
    me: null,
    currentRound: null,
    deck: null,
    isLoading: true,
    error: null,
  });

  const identityRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch initial state
  const fetchState = useCallback(async () => {
    if (!roomId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      // Get room
      const { data: room, error: roomError } = await supabase
        .from('live_match_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError || !room) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'ROOM_NOT_FOUND',
        }));
        return;
      }

      // Get deck
      let deck: DeckView | null = null;
      if (room.deck_id) {
        const { data: deckData } = await supabase
          .from('live_match_decks')
          .select('*')
          .eq('id', room.deck_id)
          .single();

        if (deckData) {
          deck = {
            id: deckData.id,
            slug: deckData.slug,
            title: deckData.title,
            emoji: deckData.emoji,
            description: deckData.description,
            questionCount: deckData.total_questions,
          };
        }
      }

      // Get participants
      const { data: participants } = await supabase
        .from('live_match_participants')
        .select('*')
        .eq('room_id', roomId)
        .is('removed_at', null)
        .order('total_score', { ascending: false });

      // Get user identity
      const { data: { user } } = await supabase.auth.getUser();
      const identity = user?.id ?? (guestKey ? `guest:${guestKey}` : null);
      identityRef.current = identity;

      // Map participants
      const now = Date.now();
      const participantViews: ParticipantView[] = (participants ?? []).map((p, idx) => ({
        participantId: p.id,
        userId: p.user_id,
        avatarUrl: null, // TODO: fetch from users table
        guestAvatarId: p.guest_avatar_id,
        nickname: p.nickname,
        totalScore: p.total_score,
        isHost: p.is_host,
        isReady: p.is_ready,
        rank: idx + 1,
        isConnected: now - new Date(p.last_seen_at).getTime() <= 30000,
        currentStreak: p.current_streak,
        maxStreak: p.max_streak,
      }));

      const me = participantViews.find(p => {
        if (!identity) return false;
        const participant = (participants ?? []).find(pp => pp.id === p.participantId);
        return participant?.identity_id === identity;
      }) ?? null;

      // Get current round
      let currentRound: RoundView | null = null;
      if (room.status !== 'lobby' && room.status !== 'results') {
        const { data: round } = await supabase
          .from('live_match_rounds')
          .select('*, questions(*)')
          .eq('room_id', roomId)
          .eq('index', room.current_round)
          .single();

        if (round?.questions) {
          const question = round.questions;
          const meParticipant = (participants ?? []).find(p => p.identity_id === identity);

          // Get my answer
          let myAnswer;
          if (meParticipant) {
            const { data: answer } = await supabase
              .from('live_match_answers')
              .select('*')
              .eq('room_id', roomId)
              .eq('round_index', room.current_round)
              .eq('participant_id', meParticipant.id)
              .single();

            if (answer) {
              myAnswer = {
                choiceIndex: answer.choice_index,
                isCorrect: answer.is_correct,
                scoreDelta: answer.score_delta,
              };
            }
          }

          // Get reveal data
          let reveal;
          if (room.status === 'reveal' || room.status === 'leaderboard' || room.status === 'results') {
            const { data: answers } = await supabase
              .from('live_match_answers')
              .select('*')
              .eq('room_id', roomId)
              .eq('round_index', room.current_round);

            const distribution = new Array(question.choices.length).fill(0);
            (answers ?? []).forEach(ans => {
              if (ans.choice_index >= 0 && ans.choice_index < distribution.length) {
                distribution[ans.choice_index]++;
              }
            });

            reveal = {
              correctChoice: question.answer_index,
              distribution,
            };
          }

          currentRound = {
            index: room.current_round,
            question: {
              id: question.id,
              prompt: question.prompt,
              explanation: question.explanation,
              choices: question.choices,
            },
            myAnswer,
            reveal,
          };
        }
      }

      setState({
        room,
        participants: participantViews,
        me,
        currentRound,
        deck,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('Failed to fetch room state:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, [roomId, guestKey]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!roomId) return;

    fetchState();

    // Create realtime channel
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_match_rooms',
          filter: `id=eq.${roomId}`,
        },
        () => {
          fetchState();
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
          fetchState();
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
          fetchState();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, fetchState]);

  return state;
}

// ============================================
// Action Hooks
// ============================================

export function useCreateRoom() {
  return useCallback(
    async (args: { deckId?: string; nickname?: string; guestKey?: string }) => {
      const { data, error } = await supabase.functions.invoke('room-create', {
        body: args,
      });
      if (error) throw error;
      return data.data;
    },
    []
  );
}

export function useJoinRoom() {
  return useCallback(
    async (args: { code: string; nickname?: string; guestKey?: string }) => {
      const { data, error } = await supabase.functions.invoke('room-join', {
        body: args,
      });
      if (error) throw error;
      if (data.data?.expired) {
        throw new Error('퀴즈룸이 만료됐어요. 새로 생성해 주세요.');
      }
      return data.data;
    },
    []
  );
}

export function useRoomAction() {
  return useCallback(
    async (
      action: string,
      args: {
        roomId: string;
        participantId: string;
        guestKey?: string;
        [key: string]: any;
      }
    ) => {
      const { data, error } = await supabase.functions.invoke('room-action', {
        body: { action, ...args },
      });
      if (error) throw error;
      return data.data;
    },
    []
  );
}

// ============================================
// Reaction Hook
// ============================================

export function useReactionCounts(roomId: string | null, roundIndex?: number) {
  const [counts, setCounts] = useState<ReactionCount>({
    clap: 0,
    fire: 0,
    skull: 0,
    laugh: 0,
  });
  const [recent, setRecent] = useState<{ emoji: string; createdAt: string }[]>([]);

  useEffect(() => {
    if (!roomId) return;

    const fetchReactions = async () => {
      const { data } = await supabase
        .from('live_match_reactions')
        .select('emoji, created_at')
        .eq('room_id', roomId)
        .eq('round_index', roundIndex ?? 0)
        .gte('created_at', new Date(Date.now() - 5000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      const newCounts: ReactionCount = { clap: 0, fire: 0, skull: 0, laugh: 0 };
      (data ?? []).forEach(r => {
        if (r.emoji in newCounts) {
          newCounts[r.emoji as keyof ReactionCount]++;
        }
      });

      setCounts(newCounts);
      setRecent((data ?? []).slice(0, 20).map(r => ({
        emoji: r.emoji,
        createdAt: r.created_at,
      })));
    };

    fetchReactions();

    // Subscribe to new reactions
    const channel = supabase
      .channel(`reactions:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_match_reactions',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, roundIndex]);

  return { counts, recent };
}

// ============================================
// Presence Hook
// ============================================

export function useRoomPresence(
  roomId: string | null,
  participantId: string | null
) {
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!roomId || !participantId) return;

    const channel = supabase.channel(`presence:${roomId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>();
        Object.values(state).forEach((presences: any[]) => {
          presences.forEach(p => {
            if (p.participantId) {
              ids.add(p.participantId);
            }
          });
        });
        setConnectedIds(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            participantId,
            joinedAt: Date.now(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, participantId]);

  return connectedIds;
}

// ============================================
// Heartbeat Hook
// ============================================

export function useHeartbeat(
  roomId: string | null,
  participantId: string | null,
  guestKey?: string,
  intervalMs = 10000
) {
  const roomAction = useRoomAction();

  useEffect(() => {
    if (!roomId || !participantId) return;

    const sendHeartbeat = async () => {
      try {
        await roomAction('heartbeat', { roomId, participantId, guestKey });
      } catch (err) {
        console.warn('Heartbeat failed:', err);
      }
    };

    // Initial heartbeat
    sendHeartbeat();

    // Interval
    const interval = setInterval(sendHeartbeat, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [roomId, participantId, guestKey, intervalMs, roomAction]);
}
