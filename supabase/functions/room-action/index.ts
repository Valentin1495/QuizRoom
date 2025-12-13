/**
 * Room Action Edge Function
 * Handles: heartbeat, setReady, leave, start, progress, submitAnswer, sendReaction
 * Replaces various functions from convex/rooms.ts
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_RULES = {
  rounds: 10,
  readSeconds: 3,
  answerSeconds: 10,
  graceSeconds: 2,
  revealSeconds: 6,
  leaderboardSeconds: 5,
};

const ACTION_DELAY_DEFAULT_MS = 3000;
const ACTION_DELAY_MIN_MS = 2000;
const ACTION_DELAY_MAX_MS = 10000;
const LOBBY_EXPIRES_MS = 1000 * 60 * 10;

const PAUSABLE_STATUSES = new Set(['countdown', 'question', 'grace', 'reveal', 'leaderboard']);

// XP rewards
const LIVE_MATCH_PARTICIPATION_XP = 30;
const LIVE_MATCH_RANK_XP: Record<number, number> = { 1: 100, 2: 50, 3: 30 };

function clampDelay(delayMs?: number) {
  if (!delayMs || Number.isNaN(delayMs)) return ACTION_DELAY_DEFAULT_MS;
  return Math.min(Math.max(delayMs, ACTION_DELAY_MIN_MS), ACTION_DELAY_MAX_MS);
}

function applyStreakBonus(baseXp: number, streak: number): number {
  if (streak >= 7) return Math.round(baseXp * 1.5);
  if (streak >= 3) return Math.round(baseXp * 1.25);
  return baseXp;
}

function getComboMultiplier(streak: number): number {
  if (streak >= 10) return 3.0;
  if (streak >= 7) return 2.5;
  if (streak >= 5) return 2.0;
  if (streak >= 3) return 1.5;
  return 1.0;
}

async function awardLiveMatchXpOnce(args: {
  supabase: any;
  roomId: string;
  room: any;
  participants: any[];
}) {
  const { supabase, roomId, room, participants } = args;

  const { data: existingAward } = await supabase
    .from('live_match_logs')
    .select('id')
    .eq('room_id', roomId)
    .eq('type', 'xp_awarded')
    .limit(1)
    .maybeSingle();

  if (existingAward) {
    console.log('[RoomAction] xp already awarded', { roomId });
    return { awarded: false, alreadyAwarded: true };
  }

  console.log('[RoomAction] awarding xp', { roomId, participants: participants.length });

  const { data: allAnswers } = await supabase
    .from('live_match_answers')
    .select('participant_id, is_correct')
    .eq('room_id', roomId);

  const correctCountByParticipant = new Map<string, number>();
  for (const answer of allAnswers || []) {
    if (answer.is_correct) {
      const current = correctCountByParticipant.get(answer.participant_id) ?? 0;
      correctCountByParticipant.set(answer.participant_id, current + 1);
    }
  }

  // Rank ordering must match supabase/functions/room-state for consistency.
  const sortedParticipants = [...participants].sort((a, b) => {
    if (b.total_score !== a.total_score) return b.total_score - a.total_score;
    const avgA = a.answers > 0 ? a.avg_response_ms : Number.MAX_SAFE_INTEGER;
    const avgB = b.answers > 0 ? b.avg_response_ms : Number.MAX_SAFE_INTEGER;
    if (avgA !== avgB) return avgA - avgB;
    if (b.answers !== a.answers) return b.answers - a.answers;
    return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
  });

  for (let i = 0; i < sortedParticipants.length; i++) {
    const p = sortedParticipants[i];
    if (!p.user_id) continue;

    const { data: user } = await supabase
      .from('users')
      .select('xp, streak, total_played, total_correct')
      .eq('id', p.user_id)
      .single();

    if (!user) continue;

    const rank = i + 1;
    let baseXp = LIVE_MATCH_PARTICIPATION_XP;
    baseXp += LIVE_MATCH_RANK_XP[rank] ?? 0;
    const xpGain = applyStreakBonus(baseXp, user.streak);
    const correctCount = correctCountByParticipant.get(p.id) ?? 0;

    await supabase
      .from('users')
      .update({
        xp: user.xp + xpGain,
        total_played: user.total_played + room.total_rounds,
        total_correct: user.total_correct + correctCount,
      })
      .eq('id', p.user_id);

    console.log('[RoomAction] xp updated', { roomId, userId: p.user_id, rank, xpGain });
  }

  await supabase.from('live_match_logs').insert({
    room_id: roomId,
    type: 'xp_awarded',
    payload: { at: Date.now() },
  });

  console.log('[RoomAction] xp award complete', { roomId });
  return { awarded: true, alreadyAwarded: false };
}

async function logLiveMatchHistoryOnce(args: {
  supabase: any;
  roomId: string;
  room: any;
  participants: any[];
  now: number;
}) {
  const { supabase, roomId, room, participants, now } = args;

  const sessionId = `live_match:${roomId}:results`;
  const createdAt = new Date(now).toISOString();

  let deckSlug: string | undefined;
  let deckTitle: string | undefined;
  if (room.deck_id) {
    const { data: deck } = await supabase
      .from('live_match_decks')
      .select('slug, title')
      .eq('id', room.deck_id)
      .maybeSingle();
    deckSlug = deck?.slug ?? undefined;
    deckTitle = deck?.title ?? undefined;
  }

  const { data: allAnswers } = await supabase
    .from('live_match_answers')
    .select('participant_id, is_correct')
    .eq('room_id', roomId);

  const correctCountByParticipant = new Map<string, number>();
  for (const answer of allAnswers || []) {
    if (answer.is_correct) {
      const current = correctCountByParticipant.get(answer.participant_id) ?? 0;
      correctCountByParticipant.set(answer.participant_id, current + 1);
    }
  }

  // Rank ordering must match supabase/functions/room-state for consistency.
  const sortedParticipants = [...participants].sort((a, b) => {
    if (b.total_score !== a.total_score) return b.total_score - a.total_score;
    const avgA = a.answers > 0 ? a.avg_response_ms : Number.MAX_SAFE_INTEGER;
    const avgB = b.answers > 0 ? b.avg_response_ms : Number.MAX_SAFE_INTEGER;
    if (avgA !== avgB) return avgA - avgB;
    if (b.answers !== a.answers) return b.answers - a.answers;
    return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
  });

  for (let i = 0; i < sortedParticipants.length; i++) {
    const p = sortedParticipants[i];
    if (!p.user_id) continue;

    const rank = i + 1;
    const payload = {
      deckSlug,
      deckTitle,
      roomCode: room.code,
      rank,
      totalParticipants: participants.length,
      totalScore: p.total_score ?? 0,
      answered: p.answers ?? 0,
      correct: correctCountByParticipant.get(p.id) ?? 0,
    };

    const { data: existing } = await supabase
      .from('quiz_history')
      .select('id')
      .eq('user_id', p.user_id)
      .eq('mode', 'live_match')
      .eq('session_id', sessionId)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from('quiz_history')
        .update({ payload, created_at: createdAt })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('quiz_history')
        .insert({
          user_id: p.user_id,
          mode: 'live_match',
          session_id: sessionId,
          payload,
          created_at: createdAt,
        });
    }
  }

  console.log('[RoomAction] live match history logged', { roomId, sessionId });
}

function computeScoreDelta(isCorrect: boolean, elapsedMs: number, rules: any, streak = 0) {
  if (!isCorrect) return { score: 0, multiplier: 1.0 };
  const base = 100;
  const remainingSeconds = Math.max(0, rules.answerSeconds - elapsedMs / 1000);
  const bonus = Math.ceil((remainingSeconds / rules.answerSeconds) * 50);
  const baseScore = base + bonus;
  const multiplier = getComboMultiplier(streak);
  return { score: Math.round(baseScore * multiplier), multiplier };
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

    const { action, roomId, participantId, guestKey, ...params } = await req.json();

    // Get room
    const { data: room, error: roomError } = await supabase
      .from('live_match_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      throw new Error('ROOM_NOT_FOUND');
    }

    // Get participant
    const { data: participant, error: participantError } = await supabase
      .from('live_match_participants')
      .select('*')
      .eq('id', participantId)
      .single();

    if (participantError || !participant || participant.room_id !== roomId) {
      throw new Error('NOT_IN_ROOM');
    }

    const now = Date.now();
    const nowIso = new Date().toISOString();

    switch (action) {
      case 'heartbeat': {
        await supabase
          .from('live_match_participants')
          .update({ last_seen_at: nowIso, disconnected_at: null })
          .eq('id', participantId);

        // Execute pending action if time has come
        if (room.pending_action && room.pending_action.executeAt <= now) {
          const pendingAction = room.pending_action;

          if (pendingAction.type === 'start' && room.status === 'lobby') {
            const rules = room.rules || DEFAULT_RULES;
            // First round should start immediately with a question.
            await supabase
              .from('live_match_rounds')
              .update({ started_at: now })
              .eq('room_id', roomId)
              .eq('index', 0);
            await supabase
              .from('live_match_rooms')
              .update({
                status: 'question',
                current_round: 0,
                server_now: now,
                phase_ends_at: now + rules.answerSeconds * 1000,
                expires_at: now + LOBBY_EXPIRES_MS,
                version: room.version + 1,
                pending_action: null,
                pause_state: null,
              })
              .eq('id', roomId);
          } else if (pendingAction.type === 'rematch' && (room.status === 'results' || room.status === 'lobby')) {
            const rules = room.rules || DEFAULT_RULES;

            // Get deck for new questions
            const { data: deck } = await supabase
              .from('live_match_decks')
              .select('question_ids')
              .eq('id', room.deck_id)
              .single();

            if (deck?.question_ids?.length) {
              const shuffled = [...deck.question_ids].sort(() => Math.random() - 0.5);
              const selectedIds = shuffled.slice(0, room.total_rounds);

              for (let i = 0; i < selectedIds.length; i++) {
                await supabase.from('live_match_rounds').insert({
                  room_id: roomId,
                  index: i,
                  question_id: selectedIds[i],
                  started_at: 0,
                });
              }
            }

            // First round should start immediately with a question.
            await supabase
              .from('live_match_rounds')
              .update({ started_at: now })
              .eq('room_id', roomId)
              .eq('index', 0);
            await supabase
              .from('live_match_rooms')
              .update({
                status: 'question',
                current_round: 0,
                server_now: now,
                phase_ends_at: now + rules.answerSeconds * 1000,
                expires_at: now + LOBBY_EXPIRES_MS,
                version: room.version + 1,
                pending_action: null,
                pause_state: null,
              })
              .eq('id', roomId);
          } else if (pendingAction.type === 'toLobby' && room.status === 'results') {
            await supabase
              .from('live_match_rooms')
              .update({
                status: 'lobby',
                current_round: 0,
                server_now: now,
                phase_ends_at: null,
                expires_at: now + LOBBY_EXPIRES_MS,
                version: room.version + 1,
                pending_action: null,
                pause_state: null,
              })
              .eq('id', roomId);
          }
        }

        return new Response(
          JSON.stringify({ data: { ok: true } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'setReady': {
        if (room.status !== 'lobby') {
          throw new Error('로비 상태에서만 준비를 변경할 수 있어요.');
        }

        await supabase
          .from('live_match_participants')
          .update({ is_ready: params.ready, last_seen_at: nowIso })
          .eq('id', participantId);

        return new Response(
          JSON.stringify({ data: { ok: true } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'leave': {
        await supabase
          .from('live_match_participants')
          .update({ removed_at: nowIso, is_host: false, is_ready: false })
          .eq('id', participantId);

        return new Response(
          JSON.stringify({ data: { ok: true } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'start': {
        if (!participant.is_host) {
          throw new Error('NOT_AUTHORIZED');
        }
        if (room.status !== 'lobby') {
          throw new Error('ROOM_ALREADY_STARTED');
        }

        // Get non-host participants
        const { data: participants } = await supabase
          .from('live_match_participants')
          .select('*')
          .eq('room_id', roomId)
          .is('removed_at', null)
          .neq('is_host', true);

        if (participants?.some(p => !p.is_ready)) {
          throw new Error('게스트와 참가자 모두 준비를 완료해야 해요.');
        }

        // Get questions for rounds
        const { data: deck } = await supabase
          .from('live_match_decks')
          .select('question_ids')
          .eq('id', room.deck_id)
          .single();

        if (!deck || !deck.question_ids.length) {
          throw new Error('NO_QUESTIONS_AVAILABLE');
        }

        // Shuffle and select questions
        const shuffled = [...deck.question_ids].sort(() => Math.random() - 0.5);
        const selectedIds = shuffled.slice(0, room.total_rounds);

        // Create rounds
        for (let i = 0; i < selectedIds.length; i++) {
          await supabase.from('live_match_rounds').insert({
            room_id: roomId,
            index: i,
            question_id: selectedIds[i],
            started_at: 0,
          });
        }

        const delayMs = params.delayMs ?? ACTION_DELAY_DEFAULT_MS;
        const executeAt = now + delayMs;

        await supabase
          .from('live_match_rooms')
          .update({
            pending_action: {
              type: 'start',
              executeAt,
              delayMs,
              createdAt: now,
              initiatedBy: participant.user_id,
              initiatedIdentity: participant.identity_id,
              label: '게임 시작',
            },
            version: room.version + 1,
          })
          .eq('id', roomId);

        return new Response(
          JSON.stringify({ data: { ok: true, executeAt } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'progress': {
        if (!participant.is_host) {
          throw new Error('NOT_AUTHORIZED');
        }

        const rules = room.rules || DEFAULT_RULES;
        let newStatus = room.status;
        let newRound = room.current_round;
        let newPhaseEndsAt = room.phase_ends_at;

        switch (room.status) {
          case 'countdown': {
            // Update round start time
            await supabase
              .from('live_match_rounds')
              .update({ started_at: now })
              .eq('room_id', roomId)
              .eq('index', room.current_round);

            newStatus = 'question';
            newPhaseEndsAt = now + rules.answerSeconds * 1000;
            break;
          }
          case 'question': {
            await supabase
              .from('live_match_rounds')
              .update({ closed_at: now })
              .eq('room_id', roomId)
              .eq('index', room.current_round);

            newStatus = 'grace';
            newPhaseEndsAt = now + rules.graceSeconds * 1000;
            break;
          }
          case 'grace': {
            newStatus = 'reveal';
            newPhaseEndsAt = now + rules.revealSeconds * 1000;
            break;
          }
          case 'reveal': {
            newStatus = 'leaderboard';
            newPhaseEndsAt = now + rules.leaderboardSeconds * 1000;
            break;
          }
	          case 'leaderboard': {
	            const nextRound = room.current_round + 1;
	            if (nextRound >= room.total_rounds) {
	              const { data: participants } = await supabase
	                .from('live_match_participants')
	                .select('*')
	                .eq('room_id', roomId)
	                .is('removed_at', null);

	              if (participants?.length) {
	                await awardLiveMatchXpOnce({ supabase, roomId, room, participants });
	                await logLiveMatchHistoryOnce({ supabase, roomId, room, participants, now });
	              }
	              newStatus = 'results';
	              newPhaseEndsAt = null;
	            } else {
	              newStatus = 'countdown';
              newRound = nextRound;
              newPhaseEndsAt = now + rules.readSeconds * 1000;
            }
            break;
          }
        }

        await supabase
          .from('live_match_rooms')
          .update({
            status: newStatus,
            current_round: newRound,
            server_now: now,
            phase_ends_at: newPhaseEndsAt,
            version: room.version + 1,
            pending_action: null,
            pause_state: null,
          })
          .eq('id', roomId);

        return new Response(
          JSON.stringify({ data: { ok: true, status: newStatus } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'submitAnswer': {
        if (room.status !== 'question' && room.status !== 'grace') {
          throw new Error('ROUND_NOT_ACTIVE');
        }

        // Check if already answered
        const { data: existingAnswer } = await supabase
          .from('live_match_answers')
          .select('id')
          .eq('room_id', roomId)
          .eq('round_index', room.current_round)
          .eq('participant_id', participantId)
          .single();

        if (existingAnswer) {
          return new Response(
            JSON.stringify({ data: { ok: true, alreadyAnswered: true } }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Get round and question
        const { data: round } = await supabase
          .from('live_match_rounds')
          .select('*, questions(*)')
          .eq('room_id', roomId)
          .eq('index', room.current_round)
          .single();

        if (!round || !round.questions) {
          throw new Error('ROUND_NOT_FOUND');
        }

        const question = round.questions;
        const isCorrect = question.answer_index === params.choiceIndex;

        const rules = room.rules || DEFAULT_RULES;
        const inferredStart = round.started_at > 0
          ? round.started_at
          : (room.phase_ends_at ? room.phase_ends_at - rules.answerSeconds * 1000 : now);
        const elapsed = Math.max(0, now - inferredStart);

        const currentStreak = participant.current_streak ?? 0;
        const newStreak = isCorrect ? currentStreak + 1 : 0;
        const { score: delta } = computeScoreDelta(isCorrect, elapsed, rules, newStreak);

        // Insert answer
        await supabase.from('live_match_answers').insert({
          room_id: roomId,
          round_index: room.current_round,
          participant_id: participantId,
          choice_index: params.choiceIndex,
          received_at: now,
          is_correct: isCorrect,
          score_delta: delta,
        });

        // Update participant stats
        const totalAnswers = participant.answers + 1;
        const totalAvg = participant.avg_response_ms * participant.answers;
        const newAvg = (totalAvg + elapsed) / totalAnswers;
        const newMaxStreak = Math.max(participant.max_streak ?? 0, newStreak);

        await supabase
          .from('live_match_participants')
          .update({
            total_score: participant.total_score + delta,
            answers: totalAnswers,
            avg_response_ms: newAvg,
            last_seen_at: nowIso,
            current_streak: newStreak,
            max_streak: newMaxStreak,
          })
          .eq('id', participantId);

        return new Response(
          JSON.stringify({ data: { ok: true, isCorrect, scoreDelta: delta } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'sendReaction': {
        const VALID_EMOJIS = ['clap', 'fire', 'skull', 'laugh'];
        if (!VALID_EMOJIS.includes(params.emoji)) {
          return new Response(
            JSON.stringify({ data: { success: false, reason: 'INVALID_EMOJI' } }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Check cooldown (1 second)
        const { data: recent } = await supabase
          .from('live_match_reactions')
          .select('created_at')
          .eq('room_id', roomId)
          .eq('participant_id', participantId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (recent) {
          const recentTime = new Date(recent.created_at).getTime();
          if (now - recentTime < 1000) {
            return new Response(
              JSON.stringify({ data: { success: false, reason: 'COOLDOWN' } }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }
        }

        await supabase.from('live_match_reactions').insert({
          room_id: roomId,
          participant_id: participantId,
          round_index: room.current_round,
          emoji: params.emoji,
        });

        return new Response(
          JSON.stringify({ data: { success: true } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'rematch': {
        if (!participant.is_host) {
          throw new Error('NOT_AUTHORIZED');
        }
        if (room.status !== 'results' && room.status !== 'lobby') {
          throw new Error('INVALID_STATE');
        }

        // Reset participants
        await supabase
          .from('live_match_participants')
          .update({ total_score: 0, answers: 0, avg_response_ms: 0, is_ready: false, current_streak: 0 })
          .eq('room_id', roomId);

        // Delete old answers and rounds
        await supabase.from('live_match_answers').delete().eq('room_id', roomId);
        await supabase.from('live_match_rounds').delete().eq('room_id', roomId);

        const delayMs = clampDelay(params.delayMs);
        const executeAt = now + delayMs;

        await supabase
          .from('live_match_rooms')
          .update({
            pending_action: {
              type: 'rematch',
              executeAt,
              delayMs,
              createdAt: now,
              initiatedBy: participant.user_id,
              initiatedIdentity: participant.identity_id,
              label: '리매치',
            },
            version: room.version + 1,
          })
          .eq('id', roomId);

        return new Response(
          JSON.stringify({ data: { ok: true } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'pause': {
        if (!participant.is_host) {
          throw new Error('NOT_AUTHORIZED');
        }
        if (room.status === 'paused') {
          return new Response(
            JSON.stringify({ data: { ok: true, alreadyPaused: true } }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
        if (!PAUSABLE_STATUSES.has(room.status)) {
          throw new Error('INVALID_STATE');
        }
        if (room.pending_action) {
          throw new Error('ACTION_PENDING');
        }

        const remainingMs = room.phase_ends_at ? Math.max(0, room.phase_ends_at - now) : undefined;

        await supabase
          .from('live_match_rooms')
          .update({
            status: 'paused',
            server_now: now,
            phase_ends_at: null,
            pause_state: {
              previousStatus: room.status,
              remainingMs,
              pausedAt: now,
            },
            version: room.version + 1,
          })
          .eq('id', roomId);

        return new Response(
          JSON.stringify({ data: { ok: true } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'resume': {
        if (!participant.is_host) {
          throw new Error('NOT_AUTHORIZED');
        }
        if (room.status !== 'paused' || !room.pause_state) {
          throw new Error('INVALID_STATE');
        }

        const previousStatus = room.pause_state.previousStatus;
        const remainingMs = room.pause_state.remainingMs;

        await supabase
          .from('live_match_rooms')
          .update({
            status: previousStatus,
            server_now: now,
            phase_ends_at: remainingMs !== undefined ? now + remainingMs : null,
            pause_state: null,
            version: room.version + 1,
          })
          .eq('id', roomId);

        return new Response(
          JSON.stringify({ data: { ok: true } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'cancelPendingAction': {
        if (!room.pending_action) {
          return new Response(
            JSON.stringify({ data: { ok: true, noPendingAction: true } }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        await supabase
          .from('live_match_rooms')
          .update({
            pending_action: null,
            version: room.version + 1,
          })
          .eq('id', roomId);

        await supabase.from('live_match_logs').insert({
          room_id: roomId,
          type: 'action_cancelled',
          payload: {
            type: room.pending_action.type,
            cancelledAt: now,
          },
        });

        return new Response(
          JSON.stringify({ data: { ok: true } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

	      case 'finish': {
	        if (!participant.is_host) {
	          throw new Error('NOT_AUTHORIZED');
	        }

        // Get all participants
        const { data: participants } = await supabase
          .from('live_match_participants')
          .select('*')
          .eq('room_id', roomId)
          .is('removed_at', null);

	        if (!participants) {
	          throw new Error('NO_PARTICIPANTS');
	        }
	        await awardLiveMatchXpOnce({ supabase, roomId, room, participants });
	        await logLiveMatchHistoryOnce({ supabase, roomId, room, participants, now });

	        await supabase
	          .from('live_match_rooms')
	          .update({
            status: 'results',
            server_now: now,
            phase_ends_at: null,
            version: room.version + 1,
            pending_action: null,
            pause_state: null,
          })
          .eq('id', roomId);

        return new Response(
          JSON.stringify({ data: { ok: true } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'resetToLobby': {
        if (!participant.is_host) {
          throw new Error('NOT_AUTHORIZED');
        }
        if (room.status !== 'results' && room.status !== 'lobby') {
          throw new Error('INVALID_STATE');
        }

        // Reset participants
        await supabase
          .from('live_match_participants')
          .update({ total_score: 0, answers: 0, avg_response_ms: 0, is_ready: false, current_streak: 0 })
          .eq('room_id', roomId);

        // Delete old answers and rounds
        await supabase.from('live_match_answers').delete().eq('room_id', roomId);
        await supabase.from('live_match_rounds').delete().eq('room_id', roomId);

        await supabase
          .from('live_match_rooms')
          .update({
            status: 'lobby',
            current_round: 0,
            server_now: now,
            phase_ends_at: null,
            expires_at: now + LOBBY_EXPIRES_MS,
            version: room.version + 1,
            pending_action: null,
            pause_state: null,
          })
          .eq('id', roomId);

        return new Response(
          JSON.stringify({ data: { ok: true } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'requestLobby': {
        if (room.status !== 'results') {
          throw new Error('NOT_AVAILABLE');
        }
        if (room.pending_action) {
          throw new Error('ACTION_PENDING');
        }

        const delayMs = clampDelay(params.delayMs);
        const executeAt = now + delayMs;

        // If not host, just log the request
        if (!participant.is_host) {
          await supabase.from('live_match_logs').insert({
            room_id: roomId,
            type: 'lobby_request',
            payload: {
              participantId: participantId,
              userId: participant.user_id,
              nickname: participant.nickname,
              delayMs,
            },
          });

          return new Response(
            JSON.stringify({ data: { ok: true, logged: true } }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        await supabase
          .from('live_match_rooms')
          .update({
            pending_action: {
              type: 'toLobby',
              executeAt,
              delayMs,
              createdAt: now,
              initiatedBy: participant.user_id,
              initiatedIdentity: participant.identity_id,
              label: '대기실로',
            },
            version: room.version + 1,
          })
          .eq('id', roomId);

        return new Response(
          JSON.stringify({ data: { ok: true } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      default:
        throw new Error('INVALID_ACTION');
    }
  } catch (error) {
    console.error('Error in room action:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
