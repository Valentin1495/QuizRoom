/**
 * Room Lobby Edge Function
 * Replaces convex/rooms.ts - getLobby
 */

// @ts-ignore - Deno imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno imports
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { deriveAvatarSeedFromIdentity } from '../_shared/guest.ts';

// Deno type declaration
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

type Participant = {
  id: string;
  user_id: string | null;
  identity_id: string;
  is_guest: boolean;
  nickname: string;
  is_host: boolean;
  is_ready: boolean;
  joined_at: string;
  last_seen_at: string | null;
  disconnected_at: string | null;
};

type User = {
  id: string;
  avatar_url: string | null;
  xp: number;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONNECTION_TIMEOUT_MS = 15000;

function isParticipantConnected(lastSeenAt: string | null, disconnectedAt: string | null, now: number): boolean {
  if (disconnectedAt) return false;
  if (!lastSeenAt) return false;
  return now - new Date(lastSeenAt).getTime() < CONNECTION_TIMEOUT_MS;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { code } = await req.json();
    const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (!normalizedCode) {
      return new Response(
        JSON.stringify({ data: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get room by code
    const { data: room, error: roomError } = await supabase
      .from('live_match_rooms')
      .select('*')
      .eq('code', normalizedCode)
      .single();

    if (roomError || !room) {
      return new Response(
        JSON.stringify({ data: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Normalize room status (results -> lobby for display)
    const normalizedRoom = room.status === 'results'
      ? { ...room, status: 'lobby', current_round: 0, phase_ends_at: null }
      : room;

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

    // Get active participants
    console.log('[room-lobby] Fetching participants for room_id:', room.id);
    const { data: participants, error: participantsError } = await supabase
      .from('live_match_participants')
      .select('*')
      .eq('room_id', room.id)
      .is('removed_at', null)
      .order('joined_at', { ascending: true });

    console.log('[room-lobby] Participants query result:', {
      count: participants?.length ?? 0,
      error: participantsError,
      roomId: room.id
    });

    const now = Date.now();

    // Get user info for non-guest participants
    const participantList = (participants ?? []) as Participant[];
    const userIds = participantList
      .filter((p: Participant) => p.user_id)
      .map((p: Participant) => p.user_id);

    let usersById: Map<string, User> = new Map();
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, avatar_url, xp')
        .in('id', userIds);

      if (users) {
        usersById = new Map((users as User[]).map((u: User) => [u.id, u]));
      }
    }

    // Transform room to match Convex format
    const roomData = {
      _id: room.id,
      code: room.code,
      hostId: room.host_id,
      hostIdentity: room.host_identity,
      status: normalizedRoom.status,
      deckId: room.deck_id,
      rules: room.rules,
      currentRound: normalizedRoom.current_round,
      totalRounds: room.total_rounds,
      phaseEndsAt: normalizedRoom.phase_ends_at,
      pendingAction: room.pending_action,
      pauseState: room.pause_state,
      serverNow: room.server_now,
      expiresAt: room.expires_at,
      startedAt: room.started_at,
      version: room.version,
    };

    // Transform participants to match Convex format
    const participantData = participantList.map((p: Participant) => {
      const user = p.user_id ? usersById.get(p.user_id) : undefined;
      return {
        participantId: p.id,
        odUserId: p.user_id,
        userId: p.user_id,
        avatarUrl: user?.avatar_url ?? null,
        avatarSeed: deriveAvatarSeedFromIdentity(p.identity_id, `participant:${p.id}`),
        isGuest: p.is_guest,
        nickname: p.nickname,
        isHost: p.is_host,
        isReady: p.is_ready ?? false,
        joinedAt: new Date(p.joined_at).getTime(),
        isConnected: isParticipantConnected(p.last_seen_at, p.disconnected_at, now),
        xp: user?.xp ?? null,
      };
    });

    return new Response(
      JSON.stringify({
        data: {
          room: roomData,
          deck: deckMeta,
          participants: participantData,
          now,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error fetching lobby:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
