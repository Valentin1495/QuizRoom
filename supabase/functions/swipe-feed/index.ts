// @ts-nocheck
/**
 * Swipe Feed Edge Function
 * Returns a list of questions for swipe mode from Supabase tables.
 *
 * Request body:
 * {
 *   category: string;          // required
 *   tags?: string[];           // optional (not used yet)
 *   deckSlug?: string;         // optional
 *   excludeTag?: string;       // optional
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
    const { category, tags, limit, cursor, deckSlug, excludeTag } = body;

    if (!isString(category) && !isString(deckSlug)) {
      return new Response(
        JSON.stringify({ error: 'INVALID_CATEGORY' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('FATAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
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
    const tagFilter = isStringArray(tags) && tags.length ? tags : null;

    const normalizedCategory = isString(category) ? category.trim().toLowerCase() : null;
    const normalizedDeckSlug = isString(deckSlug) ? deckSlug.trim() : null;
    const normalizedExcludeTag = isString(excludeTag) ? excludeTag.trim() : null;
    let deckId = null;

    if (normalizedDeckSlug) {
      const { data: deck, error: deckError } = await admin
        .from('decks')
        .select('id')
        .eq('slug', normalizedDeckSlug)
        .maybeSingle();

      if (deckError) {
        console.error('swipe-feed deck lookup error', {
          code: deckError.code,
          message: deckError.message,
        });
        return new Response(
          JSON.stringify({ error: deckError.message, code: deckError.code }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (!deck?.id) {
        return new Response(
          JSON.stringify({ data: { items: [], nextCursor: null, hasMore: false } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      deckId = deck.id;
    }

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
      .order('created_at', { ascending: false })
      .limit(requestedLimit + 1);

    if (normalizedCategory) {
      query = query.eq('category', normalizedCategory);
    }

    if (deckId) {
      query = query.eq('deck_id', deckId);
    }

    if (tagFilter && tagFilter.length) {
      query = query.contains('tags', tagFilter);
    }

    if (normalizedExcludeTag) {
      const escapedTag = normalizedExcludeTag.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      query = query.not('tags', 'cs', `{"${escapedTag}"}`);
    }

    if (isString(cursor)) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      console.error('swipe-feed query error', { code: error.code, message: error.message });
      return new Response(
        JSON.stringify({ error: error.message, code: error.code }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const hasMore = (data?.length ?? 0) > requestedLimit;
    const items = (data ?? []).slice(0, requestedLimit).map((item) => {
      const choices = Array.isArray(item.choices) ? item.choices : [];
      const correctChoice = choices[item.answer_index] ?? null;
      const mediaMeta = item.media_meta && typeof item.media_meta === 'object' ? item.media_meta : null;
      const hint = mediaMeta && typeof mediaMeta.hint === 'string' ? mediaMeta.hint : null;
      const answerToken = `v1:${item.id}:${Date.now()}`;
      return {
        id: item.id,
        deckSlug: item.deck?.slug ?? '',
        prompt: item.prompt,
        mediaUrl: item.media_url ?? null,
        hint,
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
