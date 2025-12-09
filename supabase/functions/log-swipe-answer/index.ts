// @ts-nocheck
/**
 * Log Swipe Answer Edge Function
 * - Authenticated users -> answers table
 * - Guests or non-UUID questions -> guest_swipe_answers table
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const isString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((item) => typeof item === 'string');
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const getStreakMultiplier = (streak: number) => {
  if (streak >= 7) return 2.0;
  if (streak >= 6) return 1.8;
  if (streak >= 5) return 1.6;
  if (streak >= 4) return 1.4;
  if (streak >= 3) return 1.25;
  if (streak >= 2) return 1.1;
  return 1.0;
};

const applyStreakBonus = (baseXp: number, streak: number) =>
  Math.round(baseXp * getStreakMultiplier(streak));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      questionId,
      category,
      tags,
      choiceId,
      isCorrect,
      timeMs,
      answerToken,
      sessionKey,
      deckSlug,
      prompt,
      difficulty,
      metadata,
    } = body;

    // Basic validation
    if (
      !isString(questionId) ||
      !isString(category) ||
      !isString(choiceId) ||
      typeof isCorrect !== 'boolean' ||
      typeof timeMs !== 'number'
    ) {
      return new Response(
        JSON.stringify({ error: 'INVALID_PAYLOAD' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const sanitizedTags = isStringArray(tags) ? tags : [];
    const safeTimeMs = Math.max(0, Math.round(timeMs));

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');

    if (!serviceRoleKey || !supabaseUrl) {
      console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL is not set.');
      return new Response(
        JSON.stringify({ error: 'Function is not configured correctly.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin client (bypass RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Auth-only client to decode the incoming Authorization header
    const supabaseAuth =
      authHeader && supabaseAnonKey
        ? createClient(supabaseUrl, supabaseAnonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { Authorization: authHeader } },
        })
        : null;

    // Auth context
    let authUser = null;
    if (authHeader && supabaseAuth) {
      const { data: authData } = await supabaseAuth.auth.getUser();
      authUser = authData?.user ?? null;
    }

    // Authenticated users: only when questionId is UUID and answerToken present
    if (authUser && isUuid(questionId) && isString(answerToken)) {
      const { data: dbUser, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, xp, streak, total_played, total_correct')
        .eq('identity_id', authUser.id)
        .single();

      if (userError || !dbUser) {
        return new Response(
          JSON.stringify({ error: 'USER_NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('answers')
        .insert({
          user_id: dbUser.id,
          question_id: questionId,
          category,
          tags: sanitizedTags,
          choice_id: choiceId,
          answer_token: answerToken,
          is_correct: isCorrect,
          time_ms: safeTimeMs,
        })
        .select('id')
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // XP/스탯 업데이트 (정답일 때만 XP 지급)
      const currentStreak = dbUser.streak ?? 0;
      const baseXp = isCorrect ? 15 : 0;
      const xpGain = isCorrect ? applyStreakBonus(baseXp, currentStreak) : 0;
      const nextStreak = isCorrect ? currentStreak + 1 : 0;

      const updatedTotalPlayed = (dbUser.total_played ?? 0) + 1;
      const updatedTotalCorrect = (dbUser.total_correct ?? 0) + (isCorrect ? 1 : 0);

      await supabaseAdmin
        .from('users')
        .update({
          xp: (dbUser.xp ?? 0) + xpGain,
          streak: nextStreak,
          total_played: updatedTotalPlayed,
          total_correct: updatedTotalCorrect,
        })
        .eq('id', dbUser.id);

      return new Response(
        JSON.stringify({
          data: {
            table: 'answers',
            id: inserted?.id,
            xpGain,
            streak: nextStreak,
            totalPlayed: updatedTotalPlayed,
            totalCorrect: updatedTotalCorrect,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Guest path (or non-UUID question)
    if (!isString(sessionKey) || !isString(deckSlug) || !isString(prompt)) {
      return new Response(
        JSON.stringify({ error: 'GUEST_FIELDS_REQUIRED' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: guestInserted, error: guestError } = await supabaseAdmin
      .from('guest_swipe_answers')
      .insert({
        session_key: sessionKey,
        question_id: questionId,
        deck_slug: deckSlug,
        category,
        prompt,
        choice_id: choiceId,
        is_correct: isCorrect,
        time_ms: safeTimeMs,
        tags: sanitizedTags,
        difficulty: typeof difficulty === 'number' ? difficulty : null,
        metadata: metadata ?? null,
      })
      .select('id')
      .single();

    if (guestError) {
      return new Response(
        JSON.stringify({ error: guestError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ data: { table: 'guest_swipe_answers', id: guestInserted?.id } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('log-swipe-answer error', error);
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
