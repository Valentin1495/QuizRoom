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
const LOBBY_EXPIRES_MS = 1000 * 60 * 10;

function getComboMultiplier(streak: number): number {
  if (streak >= 10) return 3.0;
  if (streak >= 7) return 2.5;
  if (streak >= 5) return 2.0;
  if (streak >= 3) return 1.5;
  return 1.0;
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

        const delayMs = params.delayMs ?? ACTION_DELAY_DEFAULT_MS;
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
