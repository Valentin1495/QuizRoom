/**
 * Room Join Edge Function
 * Replaces convex/rooms.ts - join
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
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
      throw new Error('퀴즈룸을 찾을 수 없어요. 초대 코드를 확인해주세요.');
    }

    // Check expiry
    if (room.expires_at && room.expires_at <= Date.now()) {
      return new Response(
        JSON.stringify({ data: { expired: true } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let userId: string | null = null;
    let identityId: string;
    let nicknameFallback: string;
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
      if (!guestKey) throw new Error('GUEST_AUTH_REQUIRED');
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
          throw new Error('퀴즈 진행 중에는 다시 입장할 수 없어요. 게임이 끝난 뒤 다시 시도해 주세요.');
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

    // Check participant limit
    const { count } = await supabase
      .from('live_match_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .is('removed_at', null);

    if ((count ?? 0) >= PARTICIPANT_LIMIT) {
      throw new Error('퀴즈룸이 가득 찼어요. 다른 방을 찾아주세요.');
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
      })
      .select()
      .single();

    if (participantError) throw participantError;

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
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
