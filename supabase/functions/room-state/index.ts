/**
 * Room State Edge Function
 * Returns the full game state for a participant
 * Replaces convex/rooms.ts - getRoomState
 */

// @ts-ignore - Deno imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno imports
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PARTICIPANT_TIMEOUT_MS = 30 * 1000;

function isParticipantConnected(lastSeenAt: string | null, disconnectedAt: string | null, now: number): boolean {
  if (disconnectedAt) return false;
  if (!lastSeenAt) return false;
  return now - new Date(lastSeenAt).getTime() < PARTICIPANT_TIMEOUT_MS;
}

type Participant = {
  id: string;
  user_id: string | null;
  identity_id: string;
  is_guest: boolean;
  guest_avatar_id: number | null;
  nickname: string;
  is_host: boolean;
  is_ready: boolean;
  joined_at: string;
  last_seen_at: string | null;
  disconnected_at: string | null;
  total_score: number;
  avg_response_ms: number;
  answers: number;
  current_streak: number;
  max_streak: number;
};

type User = {
  id: string;
  avatar_url: string | null;
  xp: number;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { roomId, participantId, guestKey } = await req.json();

    // Get room
    const { data: room, error: roomError } = await supabase
      .from('live_match_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return new Response(
        JSON.stringify({ data: { status: 'not_found' } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get participant (me)
    const { data: meRecord, error: meError } = await supabase
      .from('live_match_participants')
      .select('*')
      .eq('id', participantId)
      .single();

    if (meError || !meRecord || meRecord.removed_at) {
      return new Response(
        JSON.stringify({ data: { status: 'not_in_room' } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const me = meRecord as Participant;
    const now = Date.now();

    // Get deck info
    let deckMeta = null;
    if (room.deck_id) {
      const { data: deck } = await supabase
        .from('live_match_decks')
        .select('id, slug, title, emoji, description, total_questions')
        .eq('id', room.deck_id)
        .single();

      if (deck) {
        deckMeta = {
          id: deck.id,
          slug: deck.slug,
          title: deck.title,
          emoji: deck.emoji,
          description: deck.description,
          questionCount: deck.total_questions,
        };
      }
    }

    // Get all participants
    const { data: participants } = await supabase
      .from('live_match_participants')
      .select('*')
      .eq('room_id', roomId)
      .is('removed_at', null);

    const participantList = (participants ?? []) as Participant[];

    // Sort by score
    participantList.sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      const avgA = a.answers > 0 ? a.avg_response_ms : Number.MAX_SAFE_INTEGER;
      const avgB = b.answers > 0 ? b.avg_response_ms : Number.MAX_SAFE_INTEGER;
      if (avgA !== avgB) return avgA - avgB;
      if (b.answers !== a.answers) return b.answers - a.answers;
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    });

    // Attach ranks
    const rankedParticipants = participantList.map((p, idx) => ({ ...p, rank: idx + 1 }));

    // Get user info
    const userIds = rankedParticipants
      .filter((p) => p.user_id)
      .map((p) => p.user_id) as string[];

    let usersById: Map<string, User> = new Map();
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, avatar_url, xp')
        .in('id', userIds);

      if (users) {
        usersById = new Map((users as User[]).map((u) => [u.id, u]));
      }
    }

    // Get current round and question
    let currentRound: any = undefined;
    const { data: round } = await supabase
      .from('live_match_rounds')
      .select('*, questions(*)')
      .eq('room_id', roomId)
      .eq('index', room.current_round)
      .single();

    if (round && round.questions) {
      const question = round.questions;

      // Get answers for this round
      const { data: answers } = await supabase
        .from('live_match_answers')
        .select('*')
        .eq('room_id', roomId)
        .eq('round_index', room.current_round);

      const myAnswer = answers?.find((a: any) => a.participant_id === me.id);

      // Reveal data (only in reveal/results phases)
      let reveal = undefined;
      if (room.status === 'reveal' || room.status === 'results' || room.status === 'leaderboard') {
        const distribution = new Array(question.choices.length).fill(0);
        (answers || []).forEach((ans: any) => {
          if (ans.choice_index >= 0 && ans.choice_index < distribution.length) {
            distribution[ans.choice_index] += 1;
          }
        });
        reveal = {
          correctChoice: question.answer_index,
          distribution,
        };
      }

      // Leaderboard data (only in reveal/leaderboard/results)
      let leaderboard = undefined;
      if (room.status === 'reveal' || room.status === 'leaderboard' || room.status === 'results') {
        const top = rankedParticipants.map((p) => {
          const user = p.user_id ? usersById.get(p.user_id) : undefined;
          return {
            participantId: p.id,
            odUserId: p.user_id,
            avatarUrl: user?.avatar_url ?? null,
            guestAvatarId: p.guest_avatar_id,
            nickname: p.nickname,
            totalScore: p.total_score,
            rank: p.rank,
          };
        });

        const meEntry = rankedParticipants.find((p) => p.id === me.id);
        leaderboard = {
          top,
          me: meEntry ? {
            participantId: meEntry.id,
            odUserId: meEntry.user_id,
            avatarUrl: meEntry.user_id ? usersById.get(meEntry.user_id)?.avatar_url ?? null : null,
            guestAvatarId: meEntry.guest_avatar_id,
            nickname: meEntry.nickname,
            totalScore: meEntry.total_score,
            rank: meEntry.rank,
          } : undefined,
        };
      }

      currentRound = {
        index: round.index,
        question: {
          id: question.id,
          prompt: question.prompt,
          explanation: question.explanation ?? null,
          answerIndex: question.answer_index,
          choices: question.choices.map((choice: any, idx: number) => ({
            id: choice.id ?? `${question.id}-${idx}`,
            text: choice.text,
          })),
        },
        myAnswer: myAnswer ? {
          choiceIndex: myAnswer.choice_index,
          isCorrect: myAnswer.is_correct,
          scoreDelta: myAnswer.score_delta,
        } : undefined,
        reveal,
        leaderboard,
      };
    }

    // Transform room to client format
    const roomData = {
      _id: room.id,
      code: room.code,
      hostId: room.host_id,
      hostIdentity: room.host_identity,
      status: room.status,
      deckId: room.deck_id,
      rules: room.rules,
      currentRound: room.current_round,
      totalRounds: room.total_rounds,
      phaseEndsAt: room.phase_ends_at,
      pendingAction: room.pending_action,
      pauseState: room.pause_state,
      serverNow: room.server_now,
      expiresAt: room.expires_at,
      version: room.version,
    };

    // Transform me
    const meData = {
      participantId: me.id,
      odUserId: me.user_id,
      isGuest: me.is_guest,
      nickname: me.nickname,
      totalScore: me.total_score,
      isHost: me.is_host,
      answers: me.answers,
      avgResponseMs: me.avg_response_ms,
      lastSeenAt: new Date(me.last_seen_at ?? 0).getTime(),
      disconnectedAt: me.disconnected_at ? new Date(me.disconnected_at).getTime() : null,
      currentStreak: me.current_streak ?? 0,
      maxStreak: me.max_streak ?? 0,
    };

    // Transform participants
    const participantsData = rankedParticipants.map((p) => {
      const user = p.user_id ? usersById.get(p.user_id) : undefined;
      return {
        participantId: p.id,
        odUserId: p.user_id,
        avatarUrl: user?.avatar_url ?? null,
        guestAvatarId: p.guest_avatar_id,
        nickname: p.nickname,
        totalScore: p.total_score,
        isHost: p.is_host,
        rank: p.rank,
        isConnected: isParticipantConnected(p.last_seen_at, p.disconnected_at, now),
        lastSeenAt: new Date(p.last_seen_at ?? 0).getTime(),
        disconnectedAt: p.disconnected_at ? new Date(p.disconnected_at).getTime() : null,
        answers: p.answers,
      };
    });

    return new Response(
      JSON.stringify({
        data: {
          status: 'ok',
          room: roomData,
          deck: deckMeta,
          me: meData,
          participants: participantsData,
          currentRound,
          now,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error getting room state:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
