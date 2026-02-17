/**
 * Room Join Edge Function
 * Replaces convex/rooms.ts - join
 */

// @ts-ignore - Deno runtime import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { deriveGuestNicknameFromKey } from '../_shared/guest.ts';

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
const MAX_NICKNAME_LENGTH = 24;
const PARTICIPANT_STALE_TIMEOUT_MS = 30 * 1000;

function respondError(message: string, status = 200) {
  return new Response(
    JSON.stringify({ error: message }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status }
  );
}

const PARTICIPANT_LIMIT = 10;

function nicknameKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[^0-9a-zA-Z가-힣]/g, '');
}

function ensureUniqueNickname(base: string, takenKeys: Set<string>) {
  const baseCandidate = base.slice(0, MAX_NICKNAME_LENGTH);
  const safeBase = baseCandidate.length > 0 ? baseCandidate : '익명참가자';
  const baseKey = nicknameKey(safeBase);
  if (!takenKeys.has(baseKey)) {
    takenKeys.add(baseKey);
    return safeBase;
  }

  for (let suffix = 2; suffix <= 999; suffix += 1) {
    const suffixText = String(suffix);
    const trimmed = safeBase.slice(0, Math.max(1, MAX_NICKNAME_LENGTH - suffixText.length));
    const candidate = `${trimmed}${suffixText}`;
    const key = nicknameKey(candidate);
    if (!takenKeys.has(key)) {
      takenKeys.add(key);
      return candidate;
    }
  }

  const fallback = `익명참가자${String(Date.now()).slice(-4)}`.slice(0, MAX_NICKNAME_LENGTH);
  const fallbackKey = nicknameKey(fallback);
  takenKeys.add(fallbackKey);
  return fallback;
}

function deriveGuestNickname(guestKey: string, takenKeys: Set<string>) {
  const candidate = deriveGuestNicknameFromKey(guestKey).slice(0, MAX_NICKNAME_LENGTH);
  return ensureUniqueNickname(candidate, takenKeys);
}

function isLiveParticipant(participant: { last_seen_at: string | null; disconnected_at: string | null }, nowMs: number) {
  if (participant.disconnected_at) return false;
  if (!participant.last_seen_at) return false;
  return nowMs - new Date(participant.last_seen_at).getTime() <= PARTICIPANT_STALE_TIMEOUT_MS;
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

    // Block all code-based joins unless the room is in lobby.
    // If the room is stuck in an in-progress state with zero active participants,
    // normalize it back to lobby so code re-entry can recover.
    if (room.status !== 'lobby') {
      const nowMs = Date.now();
      const { data: activeParticipants, error: activeCountError } = await supabase
        .from('live_match_participants')
        .select('id, last_seen_at, disconnected_at')
        .eq('room_id', room.id)
        .is('removed_at', null);

      if (activeCountError) {
        throw activeCountError;
      }

      const active = (activeParticipants ?? []) as {
        id: string;
        last_seen_at: string | null;
        disconnected_at: string | null;
      }[];
      const liveCount = active.filter((participant) => isLiveParticipant(participant, nowMs)).length;

      if (liveCount === 0) {
        if (active.length > 0) {
          await supabase
            .from('live_match_participants')
            .update({
              removed_at: new Date(nowMs).toISOString(),
              is_host: false,
              is_ready: false,
            })
            .eq('room_id', room.id)
            .is('removed_at', null);
        }

        await supabase
          .from('live_match_rooms')
          .update({
            status: 'lobby',
            current_round: 0,
            phase_ends_at: null,
            pending_action: null,
            pause_state: null,
            server_now: nowMs,
            expires_at: nowMs + LOBBY_EXPIRES_MS,
            version: (room.version ?? 0) + 1,
          })
          .eq('id', room.id);
        room.status = 'lobby';
        room.current_round = 0;
        room.phase_ends_at = null;
        room.pending_action = null;
        room.pause_state = null;
        room.server_now = nowMs;
        room.expires_at = nowMs + LOBBY_EXPIRES_MS;
        room.version = (room.version ?? 0) + 1;
      } else {
        return respondError('현재 게임이 진행 중이에요. 종료 후 다시 시도해 주세요.');
      }
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
      nicknameFallback = deriveGuestNickname(guestKey, new Set<string>());
    }

    // Check for existing participant
    let existingParticipant: any = null;
    if (userId) {
      const { data, error } = await supabase
        .from('live_match_participants')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', userId)
        .order('joined_at', { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const active = rows.find((row: any) => !row.removed_at) ?? null;
      existingParticipant = active ?? rows[0] ?? null;
    } else {
      const { data, error } = await supabase
        .from('live_match_participants')
        .select('*')
        .eq('room_id', room.id)
        .eq('identity_id', identityId!)
        .order('joined_at', { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const active = rows.find((row: any) => !row.removed_at) ?? null;
      existingParticipant = active ?? rows[0] ?? null;
    }

    const now = new Date().toISOString();
    const { data: activeParticipants } = await supabase
      .from('live_match_participants')
      .select('id, nickname')
      .eq('room_id', room.id)
      .is('removed_at', null);

    const takenNicknameKeys = new Set<string>(
      (activeParticipants ?? [])
        .filter((participant: { id: string }) => participant.id !== existingParticipant?.id)
        .map((participant: { nickname: string }) => nicknameKey((participant.nickname ?? '').slice(0, MAX_NICKNAME_LENGTH)))
        .filter(Boolean)
    );

    const requestedNickname = (nickname?.trim() || '').slice(0, MAX_NICKNAME_LENGTH);
    let sanitizedNickname = '';
    if (isGuest) {
      if (existingParticipant?.nickname) {
        const previousGuestNickname = existingParticipant.nickname.slice(0, MAX_NICKNAME_LENGTH);
        sanitizedNickname = ensureUniqueNickname(previousGuestNickname, takenNicknameKeys);
      } else {
        sanitizedNickname = deriveGuestNickname(guestKey!, takenNicknameKeys);
      }
    } else {
      sanitizedNickname = ensureUniqueNickname(
        (requestedNickname || existingParticipant?.nickname || nicknameFallback || '플레이어').slice(0, MAX_NICKNAME_LENGTH),
        takenNicknameKeys
      );
    }

    if (existingParticipant) {
      const pendingAction = room.pending_action as { type?: string } | null;
      const isStartPending = room.status === 'lobby' && pendingAction?.type === 'start';
      const isExistingActiveParticipant = !existingParticipant.removed_at;
      if (isStartPending && !isExistingActiveParticipant) {
        return respondError('현재 매치가 진행 중이에요. 종료 후 다시 시도해 주세요.');
      }

      // Rejoin (lobby only; non-lobby is rejected above)
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

    const pendingAction = room.pending_action as { type?: string } | null;
    const isStartPending = room.status === 'lobby' && pendingAction?.type === 'start';
    if (isStartPending) {
      return respondError('현재 매치가 진행 중이에요. 종료 후 다시 시도해 주세요.');
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
