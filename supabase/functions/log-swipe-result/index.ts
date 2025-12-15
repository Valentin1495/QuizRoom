// @ts-nocheck
/**
 * Log Swipe Session Result + Award Bonuses
 * - Adds completion/perfect bonus XP (authenticated users only)
 * - Upserts into quiz_history(mode='swipe') for the given session_id
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const isString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const SWIPE_COMPLETION_MIN_ANSWERED = 20;
const SWIPE_COMPLETION_BONUS_XP = 30;
const SWIPE_PERFECT_BONUS_XP = 50;

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, data } = body ?? {};
    const payloadData = asObject(data);

    const answered = payloadData.answered;
    const correct = payloadData.correct;

    if (!isString(sessionId) || !isNumber(answered) || !isNumber(correct)) {
      return new Response(
        JSON.stringify({ error: 'INVALID_PAYLOAD' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const now = Date.now();
    const createdAt = new Date(now).toISOString();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');

    if (!serviceRoleKey || !supabaseUrl || !supabaseAnonKey || !authHeader) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
    const authUser = authData?.user ?? null;
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: dbUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, xp')
      .eq('identity_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return new Response(
        JSON.stringify({ error: 'USER_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: existingHistory } = await supabaseAdmin
      .from('quiz_history')
      .select('id, payload')
      .eq('user_id', dbUser.id)
      .eq('mode', 'swipe')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const existingPayload = asObject(existingHistory?.payload);
    if (existingPayload.rewardClaim === true) {
      return new Response(
        JSON.stringify({
          data: {
            ok: true,
            alreadyClaimed: true,
            xpGain: 0,
            completionBonusXp: 0,
            perfectBonusXp: 0,
            xp: dbUser.xp ?? 0,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (answered < SWIPE_COMPLETION_MIN_ANSWERED) {
      const mergedPayload = { ...existingPayload, ...payloadData };
      if (existingHistory?.id) {
        await supabaseAdmin
          .from('quiz_history')
          .update({ payload: mergedPayload, created_at: createdAt })
          .eq('id', existingHistory.id);
      } else {
        await supabaseAdmin
          .from('quiz_history')
          .insert({
            user_id: dbUser.id,
            mode: 'swipe',
            session_id: sessionId,
            payload: mergedPayload,
            created_at: createdAt,
          });
      }

      return new Response(
        JSON.stringify({
          data: {
            ok: true,
            alreadyClaimed: false,
            notEligible: true,
            xpGain: 0,
            completionBonusXp: 0,
            perfectBonusXp: 0,
            xp: dbUser.xp ?? 0,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const completionBonusXp = SWIPE_COMPLETION_BONUS_XP;
    const perfectBonusXp = correct >= answered ? SWIPE_PERFECT_BONUS_XP : 0;
    const xpGain = completionBonusXp + perfectBonusXp;

    const nextXp = (dbUser.xp ?? 0) + xpGain;
    await supabaseAdmin
      .from('users')
      .update({ xp: nextXp })
      .eq('id', dbUser.id);

    const mergedPayload = {
      ...existingPayload,
      ...payloadData,
      rewardClaim: true,
      completionBonusXp,
      perfectBonusXp,
      bonusXpGain: xpGain,
    };

    if (existingHistory?.id) {
      await supabaseAdmin
        .from('quiz_history')
        .update({ payload: mergedPayload, created_at: createdAt })
        .eq('id', existingHistory.id);
    } else {
      await supabaseAdmin
        .from('quiz_history')
        .insert({
          user_id: dbUser.id,
          mode: 'swipe',
          session_id: sessionId,
          payload: mergedPayload,
          created_at: createdAt,
        });
    }

    return new Response(
      JSON.stringify({
        data: {
          ok: true,
          alreadyClaimed: false,
          xpGain,
          completionBonusXp,
          perfectBonusXp,
          xp: nextXp,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('log-swipe-result error', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

