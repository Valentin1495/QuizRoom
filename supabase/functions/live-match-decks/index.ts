/**
 * Live Match Decks Edge Function
 * Replaces convex/rooms.ts - listDecks
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
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      authHeader
        ? {
            global: {
              headers: { Authorization: authHeader },
            },
          }
        : {}
    );

    const { data: decks, error } = await supabase
      .from('live_match_decks')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return new Response(
      JSON.stringify({
        data: decks.map(deck => ({
          id: deck.id,
          slug: deck.slug,
          title: deck.title,
          emoji: deck.emoji,
          description: deck.description,
          questionCount: deck.total_questions,
          sourceCategories: deck.source_categories,
          updatedAt: deck.updated_at,
        })),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error fetching live match decks:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
