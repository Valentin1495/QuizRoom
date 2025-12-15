// @ts-nocheck
/**
 * Log Daily Quiz Result
 * Authenticated users only. Updates xp/total_correct/total_played.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAILY_XP_PER_CORRECT = 10;
const DAILY_COMPLETION_BONUS = 50;
const DAILY_PERFECT_BONUS = 30;
const DAILY_TOTAL_QUESTIONS = 6;

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

function getKstDayKey(ms: number) {
  const kstMs = ms + 9 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

async function ensureActivityStreak(supabaseAdmin: any, dbUser: { id: string; streak?: number | null }) {
  const now = Date.now();
  const dayKey = getKstDayKey(now);
  const yesterdayKey = getKstDayKey(now - 24 * 60 * 60 * 1000);

  const { error: insertError } = await supabaseAdmin
    .from('user_activity_days')
    .insert({ user_id: dbUser.id, day_key: dayKey });

  if (insertError) {
    // 23505 = unique_violation (already marked today)
    if (insertError.code === '23505') {
      return { dayKey, streak: dbUser.streak ?? 0, changed: false };
    }
    throw insertError;
  }

  const { data: yesterdayRow } = await supabaseAdmin
    .from('user_activity_days')
    .select('day_key')
    .eq('user_id', dbUser.id)
    .eq('day_key', yesterdayKey)
    .maybeSingle();

  const nextStreak = yesterdayRow ? (dbUser.streak ?? 0) + 1 : 1;
  await supabaseAdmin.from('users').update({ streak: nextStreak }).eq('id', dbUser.id);
  return { dayKey, streak: nextStreak, changed: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('FATAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
      return new Response(
        JSON.stringify({ error: 'Function is not configured correctly.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const supabaseAuth =
      authHeader && supabaseAnonKey
        ? createClient(supabaseUrl, supabaseAnonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { Authorization: authHeader } },
        })
        : null;

    const { correct, total, sessionId } = await req.json().catch(() => ({}));

    if (!isNumber(correct) || !isString(sessionId)) {
      return new Response(
        JSON.stringify({ error: 'INVALID_PAYLOAD' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
      );
    }

    if (!supabaseAuth) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { data: authData } = await supabaseAuth.auth.getUser();
    const authUser = authData?.user ?? null;
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

	    const { data: dbUser, error: userError } = await supabaseAdmin
	      .from('users')
	      .select('id, xp, streak, total_correct, total_played')
	      .eq('identity_id', authUser.id)
	      .single();

    if (userError || !dbUser) {
      return new Response(
        JSON.stringify({ error: 'USER_NOT_FOUND' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const activity = await ensureActivityStreak(supabaseAdmin, dbUser);
    const questionsAnswered = isNumber(total) ? total : DAILY_TOTAL_QUESTIONS;

    // Block duplicate rewards for the same sessionId (any existing row counts)
    const { data: existingRewards, error: rewardCheckError } = await supabaseAdmin
      .from('quiz_history')
      .select('id')
      .eq('user_id', dbUser.id)
      .eq('mode', 'daily')
      .eq('session_id', sessionId)
      .limit(1);

	    if (!rewardCheckError && (existingRewards?.length ?? 0) > 0) {
	      return new Response(
	        JSON.stringify({
	          data: {
	            alreadyClaimed: true,
	            xpGain: 0,
	            totalCorrect: dbUser.total_correct ?? 0,
	            totalPlayed: dbUser.total_played ?? 0,
	            xp: dbUser.xp ?? 0,
	            streak: activity.streak,
	          },
	        }),
	        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
	      );
	    }

    let xpGain = correct * DAILY_XP_PER_CORRECT;

    if (questionsAnswered >= DAILY_TOTAL_QUESTIONS) {
      xpGain += DAILY_COMPLETION_BONUS;
      if (correct >= DAILY_TOTAL_QUESTIONS) {
        xpGain += DAILY_PERFECT_BONUS;
      }
    }

    const updated = await supabaseAdmin
      .from('users')
      .update({
        xp: (dbUser.xp ?? 0) + xpGain,
        total_correct: (dbUser.total_correct ?? 0) + correct,
        total_played: (dbUser.total_played ?? 0) + questionsAnswered,
      })
      .eq('id', dbUser.id)
      .select('xp, total_correct, total_played')
      .single();

    // Insert a reward marker into quiz_history to prevent future claims
    await supabaseAdmin
      .from('quiz_history')
      .insert({
        user_id: dbUser.id,
        mode: 'daily',
        session_id: sessionId,
        payload: { rewardClaim: true },
      })
      .select('id')
      .single()
      .catch(() => undefined);

    return new Response(
      JSON.stringify({
        data: {
          xpGain,
          totalCorrect: updated.data?.total_correct ?? (dbUser.total_correct ?? 0) + correct,
          totalPlayed: updated.data?.total_played ?? (dbUser.total_played ?? 0) + questionsAnswered,
          xp: updated.data?.xp ?? (dbUser.xp ?? 0) + xpGain,
          streak: activity.streak,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('log-daily-result error', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
