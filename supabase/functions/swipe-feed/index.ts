// @ts-nocheck
/**
 * Swipe Feed Edge Function
 * Returns a list of questions for swipe mode from Supabase tables.
 *
 * Request body:
 * {
 *   category: string;          // required
 *   tags?: string[];           // optional (not used yet)
 *   limit?: number;            // default 20
 *   cursor?: string;           // ISO timestamp for pagination (created_at LT cursor)
 * }
 *
 * Response:
 * { data: { items, nextCursor, hasMore } }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const isString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((t) => typeof t === 'string');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { category, tags, limit, cursor } = body;

    if (!isString(category)) {
      return new Response(
        JSON.stringify({ error: 'INVALID_CATEGORY' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!serviceRoleKey) {
      console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY is not set.');
      return new Response(
        JSON.stringify({ error: 'Function is not configured correctly.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the service role key to create a client that can bypass RLS.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const requestedLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const tagFilter = isStringArray(tags) ? tags : null;

    const normalizedCategory = category.trim().toLowerCase();

    let query = admin
      .from('questions')
      .select(
        `
          id,
          category,
          prompt,
          media_url,
          media_meta,
          tags,
          choices,
          answer_index,
          explanation,
          difficulty,
          quality_score,
          elo,
          created_at,
          deck:decks(slug)
        `
      )
      .eq('category', normalizedCategory)
      .order('created_at', { ascending: false })
      .limit(requestedLimit + 1);

    if (tagFilter && tagFilter.length) {
      query = query.contains('tags', tagFilter);
    }

    if (isString(cursor)) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message, code: error.code }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const hasMore = (data?.length ?? 0) > requestedLimit;
    const items = (data ?? []).slice(0, requestedLimit).map((item) => {
      const choices = Array.isArray(item.choices) ? item.choices : [];
      const correctChoice = choices[item.answer_index] ?? null;
      const answerToken = `v1:${item.id}:${Date.now()}`;
      return {
        id: item.id,
        deckSlug: item.deck?.slug ?? '',
        prompt: item.prompt,
        mediaUrl: item.media_url ?? null,
        choices,
        correctChoiceId: correctChoice?.id ?? null,
        correctChoiceIndex: correctChoice ? item.answer_index : null,
        category: item.category,
        tags: item.tags ?? [],
        answerToken,
        explanation: item.explanation ?? null,
        difficulty: item.difficulty ?? 0.5,
        qualityScore: item.quality_score ?? 0.5,
        elo: item.elo ?? 1200,
        createdAt: item.created_at,
      };
    });

    const nextCursor = hasMore ? items[items.length - 1]?.createdAt ?? null : null;

    return new Response(
      JSON.stringify({ data: { items, nextCursor, hasMore } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('swipe-feed error', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
