/**
 * Room Create Edge Function
 * Replaces convex/rooms.ts - create
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LOBBY_EXPIRES_MS = 1000 * 60 * 10;
const MAX_NICKNAME_LENGTH = 24;
const DEFAULT_RULES = {
  rounds: 10,
  readSeconds: 3,
  answerSeconds: 10,
  graceSeconds: 2,
  revealSeconds: 6,
  leaderboardSeconds: 5,
};
const GUEST_ADJECTIVES = [
  '졸린',
  '조용한',
  '빠른',
  '수줍은',
  '똑똑한',
  '느긋한',
  '용감한',
  '화난',
  '웃는',
  '잠든',
  '떠도는',
  '길잃은',
  '초보',
  '익명의',
];
const GUEST_ANIMALS = [
  '고양이',
  '여우',
  '수달',
  '판다',
  '까치',
  '곰',
  '다람쥐',
  '토끼',
  '고래',
  '햄스터',
];
const GUEST_CHARACTERS = [
  '버섯',
  '슬라임',
  '유령',
  '기사',
  '모험가',
  '마법사',
  '전사',
  '연금술사',
  '궁수',
  '정찰병',
];
const BLOCKED_NICKNAME_TOKENS = [
  '시발',
  '씨발',
  '병신',
  '좆',
  '개새끼',
  '느금',
  'tlqkf',
  'fuck',
  'shit',
  'bitch',
];

async function generateUniqueCode(supabase: any, length = 6) {
  for (let attempt = 0; attempt < 6; attempt++) {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    const { data } = await supabase
      .from('live_match_rooms')
      .select('id')
      .eq('code', code)
      .single();
    if (!data) return code;
  }
  throw new Error('FAILED_TO_ALLOCATE_CODE');
}

function hashString(source: string) {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nicknameKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[^0-9a-zA-Z가-힣]/g, '');
}

function containsBlockedToken(value: string) {
  const key = nicknameKey(value);
  if (!key) return false;
  return BLOCKED_NICKNAME_TOKENS.some((token) => key.includes(token));
}

function buildGuestNickname(seed: number) {
  const adjective = GUEST_ADJECTIVES[seed % GUEST_ADJECTIVES.length];
  const nounPool = (seed & 1) === 0 ? GUEST_ANIMALS : GUEST_CHARACTERS;
  const nounSeed = ((seed >>> 8) ^ (seed * 2654435761)) >>> 0;
  const noun = nounPool[nounSeed % nounPool.length];
  return `${adjective} ${noun}`;
}

function deriveGuestNickname(guestKey: string) {
  return buildGuestNickname(hashString(guestKey)).slice(0, MAX_NICKNAME_LENGTH);
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
    const { deckId, nickname, guestKey } = await req.json();

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
        } else {
          throw new Error('USER_NOT_FOUND');
        }
      }
    }

    // Guest mode
    if (!userId) {
      if (!guestKey) throw new Error('GUEST_AUTH_REQUIRED');
      identityId = `guest:${guestKey}`;
      nicknameFallback = deriveGuestNickname(guestKey);
    }

    // Resolve deck
    let deck;
    if (deckId) {
      const { data } = await supabase
        .from('live_match_decks')
        .select('*')
        .eq('id', deckId)
        .eq('is_active', true)
        .single();
      if (!data) throw new Error('DECK_NOT_AVAILABLE');
      deck = data;
    } else {
      const { data } = await supabase
        .from('live_match_decks')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      if (!data) throw new Error('NO_DECK_AVAILABLE');
      deck = data;
    }

    const totalRounds = Math.min(DEFAULT_RULES.rounds, deck.total_questions);
    if (totalRounds <= 0) throw new Error('DECK_NOT_AVAILABLE');

    const code = await generateUniqueCode(supabase);
    const now = Date.now();
    const requestedNickname = (nickname?.trim() || '').slice(0, MAX_NICKNAME_LENGTH);
    const sanitizedNickname = isGuest
      ? nicknameFallback.slice(0, MAX_NICKNAME_LENGTH)
      : (!containsBlockedToken(requestedNickname)
        ? (requestedNickname || nicknameFallback).slice(0, MAX_NICKNAME_LENGTH)
        : nicknameFallback.slice(0, MAX_NICKNAME_LENGTH));

    // Create room
    const { data: room, error: roomError } = await supabase
      .from('live_match_rooms')
      .insert({
        code,
        host_id: userId,
        host_identity: identityId!,
        status: 'lobby',
        deck_id: deck.id,
        rules: { ...DEFAULT_RULES, rounds: totalRounds },
        current_round: 0,
        total_rounds: totalRounds,
        server_now: now,
        expires_at: now + LOBBY_EXPIRES_MS,
        version: 1,
      })
      .select()
      .single();

    if (roomError) throw roomError;

    // Create host participant
    const { data: participant, error: participantError } = await supabase
      .from('live_match_participants')
      .insert({
        room_id: room.id,
        user_id: userId,
        identity_id: identityId!,
        is_guest: isGuest,
        guest_avatar_id: isGuest ? deriveGuestAvatarId(guestKey) : null,
        nickname: sanitizedNickname,
        is_host: true,
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

    return new Response(
      JSON.stringify({
        data: {
          roomId: room.id,
          code: room.code,
          participantId: participant.id,
          pendingAction: null,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error creating room:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
