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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    // Auth context
    let authUser = null;
    if (authHeader) {
      const { data: authData } = await supabase.auth.getUser();
      authUser = authData?.user ?? null;
    }

    // Authenticated users: only when questionId is UUID and answerToken present
    if (authUser && isUuid(questionId) && isString(answerToken)) {
      const { data: dbUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('identity_id', authUser.id)
        .single();

      if (userError || !dbUser) {
        return new Response(
          JSON.stringify({ error: 'USER_NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data: inserted, error: insertError } = await supabase
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

      return new Response(
        JSON.stringify({ data: { table: 'answers', id: inserted?.id } }),
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

    const { data: guestInserted, error: guestError } = await supabase
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
