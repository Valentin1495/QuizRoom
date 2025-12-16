/**
 * Room Join Edge Function
 * Replaces convex/rooms.ts - join
 */

// @ts-ignore - Deno runtime import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Deno type hints for editor
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOBBY_EXPIRES_MS = 1000 * 60 * 10;

function respondError(message: string, status = 200) {
  return new Response(
    JSON.stringify({ error: message }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status }
  );
}

const PARTICIPANT_LIMIT = 10;

function deriveGuestNickname(guestKey: string) {
  const adjectives = ['빠른', '용감한', '현명한', '친절한', '재미있는'];
  const nouns = ['퀴즈러', '도전자', '플레이어', '탐험가', '수집가'];
  const hash = guestKey.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
  const adj = adjectives[Math.abs(hash) % adjectives.length];
  const noun = nouns[Math.abs(hash >> 8) % nouns.length];
  return `${adj} ${noun}`;
}

function deriveGuestAvatarId(guestKey: string) {
  const hash = guestKey.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
  return Math.abs(hash) % 20;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    const { code, nickname, guestKey } = await req.json();

    const normalizedCode = code.trim().toUpperCase();

    // Find room
    const { data: room, error: roomError } = await supabase
      .from('live_match_rooms')
      .select('*')
      .eq('code', normalizedCode)
      .single();

    if (roomError || !room) {
      return respondError('퀴즈룸을 찾을 수 없어요. 초대 코드를 확인해주세요.');
    }

    // Check expiry
    const nowMs = Date.now();
    if (room.expires_at && room.expires_at <= nowMs) {
      // If participants are still active, treat room as alive and extend expiry.
      const { count: activeCount } = await supabase
        .from('live_match_participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id)
        .is('removed_at', null);

      if ((activeCount ?? 0) > 0) {
        const nextExpiry = nowMs + LOBBY_EXPIRES_MS;
        await supabase.from('live_match_rooms').update({ expires_at: nextExpiry }).eq('id', room.id);
        room.expires_at = nextExpiry;
      } else {
        return new Response(
          JSON.stringify({ data: { expired: true } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    let userId: string | null = null;
    let identityId = '';
    let nicknameFallback = '';
    let isGuest = true;

    // Check if authenticated
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await userClient.auth.getUser();

      if (user) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('id, handle')
          .eq('identity_id', user.id)
          .single();

        if (dbUser) {
          userId = dbUser.id;
          identityId = user.id;
          nicknameFallback = dbUser.handle;
          isGuest = false;
        }
      }
    }

    // Guest mode
    if (!userId) {
      if (!guestKey) return respondError('GUEST_AUTH_REQUIRED');
      identityId = `guest:${guestKey}`;
      nicknameFallback = deriveGuestNickname(guestKey);
    }

    // Check for existing participant
    let existingParticipant;
    if (userId) {
      const { data } = await supabase
        .from('live_match_participants')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', userId)
        .single();
      existingParticipant = data;
    } else {
      const { data } = await supabase
        .from('live_match_participants')
        .select('*')
        .eq('room_id', room.id)
        .eq('identity_id', identityId!)
        .single();
      existingParticipant = data;
    }

    const now = new Date().toISOString();
    const sanitizedNickname = (nickname?.trim() || existingParticipant?.nickname || nicknameFallback).slice(0, 24);

    if (existingParticipant) {
      // Rejoin
      if (existingParticipant.removed_at) {
        if (room.status !== 'lobby') {
          return respondError('현재 게임이 진행 중이에요. 종료 후 다시 시도해 주세요.');
        }
      }

      await supabase
        .from('live_match_participants')
        .update({
          removed_at: null,
          disconnected_at: null,
          nickname: sanitizedNickname,
          last_seen_at: now,
          is_host: identityId === room.host_identity,
          user_id: userId,
          identity_id: identityId!,
          is_guest: isGuest,
          guest_avatar_id: isGuest ? deriveGuestAvatarId(guestKey) : null,
          is_ready: false,
        })
        .eq('id', existingParticipant.id);

      await supabase
        .from('live_match_rooms')
        .update({ expires_at: nowMs + LOBBY_EXPIRES_MS })
        .eq('id', room.id);

      return new Response(
        JSON.stringify({
          data: {
            roomId: room.id,
            participantId: existingParticipant.id,
            pendingAction: room.pending_action ?? null,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Prevent new participants from joining once the game has started
    if (room.status !== 'lobby') {
      return respondError('현재 게임이 진행 중이에요. 종료 후 다시 시도해 주세요.');
    }

    // Check participant limit
    const { count } = await supabase
      .from('live_match_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .is('removed_at', null);

    if ((count ?? 0) >= PARTICIPANT_LIMIT) {
      return respondError('퀴즈룸이 가득 찼어요. 다른 방을 찾아주세요.');
    }

    // Create new participant
    const { data: participant, error: participantError } = await supabase
      .from('live_match_participants')
      .insert({
        room_id: room.id,
        user_id: userId,
        identity_id: identityId!,
        is_guest: isGuest,
        guest_avatar_id: isGuest ? deriveGuestAvatarId(guestKey) : null,
        nickname: sanitizedNickname,
        is_host: identityId === room.host_identity,
        is_ready: false,
        total_score: 0,
        avg_response_ms: 0,
        answers: 0,
        removed_at: null,
        disconnected_at: null,
        last_seen_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (participantError) throw participantError;

    await supabase
      .from('live_match_rooms')
      .update({ expires_at: nowMs + LOBBY_EXPIRES_MS })
      .eq('id', room.id);

    return new Response(
      JSON.stringify({
        data: {
          roomId: room.id,
          participantId: participant.id,
          pendingAction: room.pending_action ?? null,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error joining room:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return respondError(message);
  }
});
