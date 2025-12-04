/**
 * Quiz History Edge Function
 * Replaces convex/history.ts
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

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get user's database ID
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('identity_id', user.id)
      .single();

    if (userError || !dbUser) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const { action, ...params } = await req.json();

    if (action === 'list') {
      const limit = Math.max(1, Math.min(params.limit ?? 10, 50));

      // Fetch history for each mode
      const [dailyRes, swipeRes, liveMatchRes] = await Promise.all([
        supabase
          .from('quiz_history')
          .select('*')
          .eq('user_id', dbUser.id)
          .eq('mode', 'daily')
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('quiz_history')
          .select('*')
          .eq('user_id', dbUser.id)
          .eq('mode', 'swipe')
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('quiz_history')
          .select('*')
          .eq('user_id', dbUser.id)
          .eq('mode', 'live_match')
          .order('created_at', { ascending: false })
          .limit(limit),
      ]);

      return new Response(
        JSON.stringify({
          data: {
            daily: dailyRes.data ?? [],
            swipe: swipeRes.data ?? [],
            liveMatch: liveMatchRes.data ?? [],
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'log') {
      const { mode, sessionId, data } = params;

      // Check for existing entry
      const { data: existing } = await supabase
        .from('quiz_history')
        .select('id')
        .eq('user_id', dbUser.id)
        .eq('mode', mode)
        .eq('session_id', sessionId)
        .single();

      if (existing) {
        // Update existing
        const { data: updated, error } = await supabase
          .from('quiz_history')
          .update({ payload: data, created_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ data: updated }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Insert new
      const { data: inserted, error } = await supabase
        .from('quiz_history')
        .insert({
          user_id: dbUser.id,
          mode,
          session_id: sessionId,
          payload: data,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ data: inserted }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  } catch (error) {
    console.error('Error in quiz history:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
