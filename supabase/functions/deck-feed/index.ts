/**
 * Deck Feed Edge Function
 * Replaces convex/decks.ts - getFeed
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { tag, limit = 20 } = await req.json().catch(() => ({}));

    let query = supabase
      .from('decks')
      .select('*')
      .eq('status', 'published')
      .eq('visibility', 'public')
      .order('plays', { ascending: false })
      .limit(Math.min(limit, 50));

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    const { data: decks, error } = await query;

    if (error) throw error;

    return new Response(
      JSON.stringify({
        data: decks.map(deck => ({
          id: deck.id,
          slug: deck.slug,
          title: deck.title,
          description: deck.description,
          tags: deck.tags,
          plays: deck.plays,
          likes: deck.likes,
          createdAt: deck.created_at,
        })),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error fetching deck feed:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
